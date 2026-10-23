import type { FastifyBaseLogger } from 'fastify';
import type { IBackupScheduleUseCase, IWorldBackupPort } from '@minecraft-docker/shared';
import type { BackupSchedule } from '@minecraft-docker/shared';
import { AuditActionEnum, type AuditLogData } from '@minecraft-docker/shared';
import { SCHEDULED_LOCK_WAIT_MS, shortHash } from '../lib/world-backup.js';

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
 * Optional audit log writer function type.
 * Decouples BackupSchedulerService from the concrete audit log service.
 */
export type AuditLogWriter = (data: AuditLogData) => Promise<void>;

/**
 * BackupSchedulerService
 * Manages cron-based backup scheduling using node-cron
 */
export class BackupSchedulerService {
  private tasks: Map<string, CronTask> = new Map();
  private cronSchedule: CronSchedule | null = null;
  private cronValidate: CronValidate | null = null;

  constructor(
    private readonly useCase: IBackupScheduleUseCase,
    private readonly backup: IWorldBackupPort,
    private readonly logger: FastifyBaseLogger,
    private readonly auditLogWriter?: AuditLogWriter
  ) {}

  /**
   * Initialize the scheduler: load node-cron and start enabled schedules
   */
  async initialize(): Promise<void> {
    try {
      // Dynamic import of node-cron to handle missing dependency gracefully
      const nodeCron = await import('node-cron');
      this.cronSchedule = nodeCron.schedule as CronSchedule;
      this.cronValidate = nodeCron.validate as CronValidate;
    } catch (error) {
      this.logger.warn(
        'node-cron not available. Backup scheduling disabled. Install with: pnpm add node-cron'
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
      const schedules = await this.useCase.findAll();
      const enabled = schedules.filter((s) => s.enabled);

      this.logger.info(
        `Loading ${enabled.length} enabled backup schedule(s)`
      );

      for (const schedule of enabled) {
        this.registerTask(schedule);
      }
    } catch (error) {
      this.logger.error(error, 'Failed to load backup schedules');
    }
  }

  /**
   * Register a cron task for a schedule
   */
  registerTask(schedule: BackupSchedule): void {
    if (!this.cronSchedule) return;

    // Remove existing task if any
    this.unregisterTask(schedule.id);

    const cronExpr = schedule.cronExpression.expression;

    try {
      const task = this.cronSchedule(cronExpr, async () => {
        await this.executeBackup(schedule.id);
      });

      this.tasks.set(schedule.id, task);
      this.logger.info(
        `Registered backup schedule: ${schedule.name} (${cronExpr})`
      );
    } catch (error) {
      this.logger.error(
        error,
        `Failed to register schedule: ${schedule.name}`
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
    }
  }

  /**
   * Run one scheduled backup through the world backup port (#732), then apply
   * the schedule's retention policy. A prune failure never fails the backup.
   */
  private async executeBackup(scheduleId: string): Promise<void> {
    const schedule = await this.useCase.findById(scheduleId);
    if (!schedule || !schedule.enabled) {
      this.logger.warn(`Skipping disabled/missing schedule: ${scheduleId}`);
      return;
    }

    this.logger.info(`Executing scheduled backup: ${schedule.name}`);

    const pushed = await this.backup.push({
      message: `Scheduled backup: ${schedule.name} [${new Date().toISOString()}]`,
      lockWaitMs: SCHEDULED_LOCK_WAIT_MS,
    });
    if (!pushed.ok) {
      const hint =
        pushed.error.code === 'missing_worlds'
          ? ' If they were deleted on purpose, run: mcctl backup push --allow-missing'
          : '';
      this.logger.error(`Scheduled backup failed: ${schedule.name} - ${pushed.error.message}`);
      await this.useCase.recordRun(scheduleId, 'failure', `${pushed.error.message}${hint}`);
      return;
    }
    for (const w of [...pushed.value.warnings, ...pushed.value.skipped]) {
      this.logger.warn(`Scheduled backup ${schedule.name}: ${w}`);
    }

    await this.applyRetentionPolicy(schedule);

    const hash = shortHash(pushed.value.commit);
    const message = pushed.value.changed ? `Backup complete${hash ? ` (${hash})` : ''}` : 'No changes to backup';
    await this.useCase.recordRun(scheduleId, 'success', message);
    this.logger.info(`Scheduled backup ${schedule.name}: ${message}`);
  }

  /** Prune through the port (#9); failures are logged and audited only. */
  private async applyRetentionPolicy(schedule: BackupSchedule): Promise<void> {
    const pruned = await this.backup.prune(schedule.retentionPolicy, { lockWaitMs: SCHEDULED_LOCK_WAIT_MS });
    if (!pruned.ok) {
      this.logger.warn(`Retention prune failed (backup still succeeded): ${pruned.error.message}`);
      await this.writeRetentionAuditLog(schedule, 'failure', 0, pruned.error.message);
      return;
    }
    for (const w of pruned.value.warnings) this.logger.warn(`Retention prune for ${schedule.name}: ${w}`);
    if (pruned.value.removed > 0) {
      this.logger.info(`Retention prune removed ${pruned.value.removed} backup(s) for schedule "${schedule.name}"`);
      await this.writeRetentionAuditLog(schedule, 'success', pruned.value.removed);
    }
  }

  /**
   * Write an audit log entry for a retention pruning operation.
   * Errors are silently ignored to avoid affecting the backup result.
   */
  private async writeRetentionAuditLog(
    schedule: BackupSchedule,
    status: 'success' | 'failure',
    removed: number,
    errorMessage?: string
  ): Promise<void> {
    if (!this.auditLogWriter) return;
    try {
      await this.auditLogWriter({
        action: AuditActionEnum.BACKUP_SCHEDULE_RUN,
        actor: 'scheduler',
        targetType: 'backup',
        targetName: schedule.name,
        details: {
          operation: 'retention-prune',
          removed,
          maxCount: schedule.retentionPolicy.maxCount,
          maxAgeDays: schedule.retentionPolicy.maxAgeDays,
          scheduleId: schedule.id,
        },
        status,
        errorMessage,
      });
    } catch {
      // Audit log failures must not affect backup operation
    }
  }

  /**
   * Reload all schedules (e.g., after CRUD operation)
   */
  async reload(): Promise<void> {
    // Stop all existing tasks
    for (const task of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();

    // Reload enabled schedules
    await this.loadEnabledSchedules();
  }

  /**
   * Stop all scheduled tasks
   */
  shutdown(): void {
    for (const task of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();
    this.logger.info('Backup scheduler stopped');
  }

  /**
   * Get the number of active tasks
   */
  get activeTaskCount(): number {
    return this.tasks.size;
  }
}
