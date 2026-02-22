import type { IConfigSnapshotUseCase } from '../../application/ports/inbound/IConfigSnapshotUseCase.js';
import type { IConfigSnapshotScheduleUseCase } from '../../application/ports/inbound/IConfigSnapshotScheduleUseCase.js';
import type { IConfigSnapshotRepository } from '../../application/ports/outbound/IConfigSnapshotRepository.js';
import type { ConfigSnapshotSchedule } from '../../domain/entities/ConfigSnapshotSchedule.js';

// node-cron types (manual declaration to avoid build issues if @types not installed)
interface CronTask {
  stop(): void;
  start(): void;
}

type CronSchedule = (
  expression: string,
  func: () => void | Promise<void>,
  options?: { scheduled?: boolean; timezone?: string }
) => CronTask;

type CronValidate = (expression: string) => boolean;

/**
 * Info about a running cron job
 */
export interface CronJobInfo {
  scheduleName: string;
  serverName: string;
  cronExpression: string;
  retentionCount: number;
}

/**
 * Logger interface for dependency injection
 */
export interface ISchedulerLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  error(error: unknown, msg: string): void;
}

/**
 * ConfigSnapshotSchedulerService
 * Manages cron-based config snapshot scheduling using node-cron.
 * Follows the same pattern as BackupSchedulerService.
 */
export class ConfigSnapshotSchedulerService {
  private tasks: Map<string, CronTask> = new Map();
  private jobInfo: Map<string, CronJobInfo> = new Map();
  private cronSchedule: CronSchedule | null = null;
  private cronValidate: CronValidate | null = null;

  constructor(
    private readonly snapshotUseCase: IConfigSnapshotUseCase,
    private readonly scheduleUseCase: IConfigSnapshotScheduleUseCase,
    private readonly snapshotRepository: IConfigSnapshotRepository,
    private readonly logger: ISchedulerLogger
  ) {}

  /**
   * Initialize the scheduler: load node-cron and start enabled schedules
   */
  async initialize(): Promise<void> {
    try {
      // Dynamic import of node-cron to handle missing dependency gracefully
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeCron = await (Function('return import("node-cron")')() as Promise<{
        schedule: CronSchedule;
        validate: CronValidate;
      }>);
      this.cronSchedule = nodeCron.schedule;
      this.cronValidate = nodeCron.validate;
    } catch (error) {
      this.logger.warn(
        'node-cron not available. Config snapshot scheduling disabled. Install with: pnpm add node-cron'
      );
      return;
    }

    await this.loadEnabledSchedules();
  }

  /**
   * Load all enabled schedules and register cron tasks
   */
  async loadEnabledSchedules(): Promise<void> {
    if (!this.cronSchedule) return;

    try {
      const schedules = await this.scheduleUseCase.findAll();
      const enabled = schedules.filter((s) => s.enabled);

      this.logger.info(
        `Loading ${enabled.length} enabled config snapshot schedule(s)`
      );

      for (const schedule of enabled) {
        this.registerTask(schedule);
      }
    } catch (error) {
      this.logger.error(error, 'Failed to load config snapshot schedules');
    }
  }

  /**
   * Register a cron task for a schedule
   */
  registerTask(schedule: ConfigSnapshotSchedule): void {
    if (!this.cronSchedule) return;

    // Remove existing task if any
    this.unregisterTask(schedule.id);

    const cronExpr = schedule.cronExpression.expression;

    try {
      const task = this.cronSchedule(cronExpr, async () => {
        await this.executeSnapshot(schedule.id);
      });

      this.tasks.set(schedule.id, task);
      this.jobInfo.set(schedule.id, {
        scheduleName: schedule.name,
        serverName: schedule.serverName.value,
        cronExpression: cronExpr,
        retentionCount: schedule.retentionCount,
      });

      this.logger.info(
        `Registered config snapshot schedule: ${schedule.name} (${cronExpr}) for server ${schedule.serverName.value}`
      );
    } catch (error) {
      this.logger.error(
        error,
        `Failed to register config snapshot schedule: ${schedule.name}`
      );
    }
  }

  /**
   * Unregister a cron task
   */
  unregisterTask(scheduleId: string): void {
    const existing = this.tasks.get(scheduleId);
    if (existing) {
      existing.stop();
      this.tasks.delete(scheduleId);
      this.jobInfo.delete(scheduleId);
    }
  }

  /**
   * Add a schedule (called when a new schedule is created via API)
   */
  addSchedule(schedule: ConfigSnapshotSchedule): void {
    if (schedule.enabled) {
      this.registerTask(schedule);
    }
  }

  /**
   * Update a schedule (called when a schedule is updated via API)
   */
  updateSchedule(schedule: ConfigSnapshotSchedule): void {
    if (schedule.enabled) {
      this.registerTask(schedule);
    } else {
      this.unregisterTask(schedule.id);
    }
  }

  /**
   * Remove a schedule (called when a schedule is deleted via API)
   */
  removeSchedule(scheduleId: string): void {
    this.unregisterTask(scheduleId);
  }

  /**
   * Execute a config snapshot for a given schedule.
   */
  private async executeSnapshot(scheduleId: string): Promise<void> {
    // Re-fetch the schedule to check if still enabled
    const schedules = await this.scheduleUseCase.findAll();
    const schedule = schedules.find(
      (s) => s.id === scheduleId && s.enabled
    );

    if (!schedule) {
      this.logger.warn(
        `Skipping disabled/missing config snapshot schedule: ${scheduleId}`
      );
      return;
    }

    this.logger.info(
      `Executing scheduled config snapshot: ${schedule.name} for server ${schedule.serverName.value}`
    );

    try {
      // Create a config snapshot
      const description = `Scheduled: ${schedule.name} [${new Date().toISOString()}]`;
      await this.snapshotUseCase.create(
        schedule.serverName.value,
        description,
        schedule.id
      );

      // Record success
      await this.scheduleUseCase.recordRun(scheduleId, 'success');

      this.logger.info(
        `Scheduled config snapshot complete: ${schedule.name}`
      );

      // Apply retention policy
      await this.applyRetentionPolicy(scheduleId, schedule.retentionCount);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Scheduled config snapshot failed: ${schedule.name} - ${errorMsg}`
      );

      try {
        await this.scheduleUseCase.recordRun(scheduleId, 'failure');
      } catch (recordError) {
        this.logger.error(
          recordError,
          `Failed to record run failure for schedule: ${scheduleId}`
        );
      }
    }
  }

  /**
   * Apply retention policy: delete oldest snapshots exceeding retentionCount
   */
  private async applyRetentionPolicy(
    scheduleId: string,
    retentionCount: number
  ): Promise<void> {
    try {
      const count = await this.snapshotRepository.countByScheduleId(scheduleId);

      if (count <= retentionCount) {
        return;
      }

      const snapshots =
        await this.snapshotRepository.findByScheduleId(scheduleId);

      // Snapshots are ordered by created_at DESC, so delete from the end (oldest)
      const toDelete = snapshots.slice(retentionCount);

      for (const snapshot of toDelete) {
        await this.snapshotUseCase.delete(snapshot.id);
        this.logger.info(
          `Pruned config snapshot ${snapshot.id} (retention policy, schedule: ${scheduleId})`
        );
      }
    } catch (error) {
      this.logger.error(
        error,
        `Failed to apply retention policy for schedule: ${scheduleId}`
      );
    }
  }

  /**
   * Reload all schedules (e.g., after external changes)
   */
  async reload(): Promise<void> {
    // Stop all existing tasks
    for (const [, task] of this.tasks) {
      task.stop();
    }
    this.tasks.clear();
    this.jobInfo.clear();

    // Reload enabled schedules
    await this.loadEnabledSchedules();
  }

  /**
   * Stop all scheduled tasks (graceful shutdown)
   */
  shutdown(): void {
    for (const [, task] of this.tasks) {
      task.stop();
    }
    this.tasks.clear();
    this.jobInfo.clear();
    this.logger.info('Config snapshot scheduler stopped');
  }

  /**
   * Get the number of active tasks
   */
  get activeTaskCount(): number {
    return this.tasks.size;
  }

  /**
   * Get info about running cron jobs
   */
  getRunningJobs(): Map<string, CronJobInfo> {
    return new Map(this.jobInfo);
  }
}
