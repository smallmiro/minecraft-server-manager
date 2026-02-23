import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import os from 'os';
import type { FastifyBaseLogger } from 'fastify';
import type {
  IBackupScheduleUseCase,
} from '@minecraft-docker/shared';
import type { BackupSchedule } from '@minecraft-docker/shared';

const execFilePromise = promisify(execFile);

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
 * BackupSchedulerService
 * Manages cron-based backup scheduling using node-cron
 */
export class BackupSchedulerService {
  private tasks: Map<string, CronTask> = new Map();
  private cronSchedule: CronSchedule | null = null;
  private cronValidate: CronValidate | null = null;

  constructor(
    private readonly useCase: IBackupScheduleUseCase,
    private readonly platformPath: string,
    private readonly logger: FastifyBaseLogger
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
   * Execute a backup for a given schedule.
   * Uses execFile with array arguments to prevent shell injection.
   * Runs git commands against $HOME/.minecraft-backup (the actual git repo),
   * NOT platform/worlds/ which is only the source data directory.
   */
  private async executeBackup(scheduleId: string): Promise<void> {
    const schedule = await this.useCase.findById(scheduleId);
    if (!schedule || !schedule.enabled) {
      this.logger.warn(
        `Skipping disabled/missing schedule: ${scheduleId}`
      );
      return;
    }

    this.logger.info(
      `Executing scheduled backup: ${schedule.name}`
    );

    try {
      const worldsPath = join(this.platformPath, 'worlds');
      if (!existsSync(worldsPath)) {
        await this.useCase.recordRun(
          scheduleId,
          'failure',
          'Worlds directory not found'
        );
        return;
      }

      // The backup cache directory used by backup.sh as the git repository
      const backupCacheDir = join(os.homedir(), '.minecraft-backup');

      // Build commit message (safe: passed as argument, not interpolated into shell)
      const commitMessage = `Scheduled backup: ${schedule.name} [${new Date().toISOString()}]`;

      // Run backup script or git commands using execFile (no shell injection)
      const scriptPath = join(this.platformPath, 'scripts', 'backup.sh');
      const execOptions = {
        cwd: this.platformPath,
        timeout: 300000, // 5 minute timeout for scheduled backups
        env: {
          ...process.env,
          MCCTL_ROOT: this.platformPath,
        },
      };

      if (existsSync(scriptPath)) {
        // Use execFile with array args to prevent shell injection
        await execFilePromise(
          'bash',
          [scriptPath, 'push', '--message', commitMessage],
          execOptions
        );
      } else {
        // Fallback: run git commands against the backup cache directory
        // (not worlds/ which is not a git repository)
        const gitOptions = { ...execOptions, cwd: backupCacheDir };
        await execFilePromise('git', ['add', '-A'], gitOptions);
        await execFilePromise('git', ['commit', '-m', commitMessage], gitOptions);
        await execFilePromise('git', ['push'], gitOptions);
      }

      // Get commit hash from the backup cache directory
      let commitHash: string | undefined;
      try {
        const { stdout: hashOut } = await execFilePromise(
          'git',
          ['rev-parse', '--short', 'HEAD'],
          { cwd: backupCacheDir }
        );
        commitHash = hashOut.trim();
      } catch {
        // Ignore
      }

      await this.useCase.recordRun(
        scheduleId,
        'success',
        `Backup complete${commitHash ? ` (${commitHash})` : ''}`
      );

      this.logger.info(
        `Scheduled backup complete: ${schedule.name}${commitHash ? ` [${commitHash}]` : ''}`
      );

    } catch (error) {
      const execError = error as { stderr?: string; message?: string };

      // "nothing to commit" is not an error
      if (
        execError.stderr?.includes('nothing to commit') ||
        execError.message?.includes('nothing to commit')
      ) {
        await this.useCase.recordRun(
          scheduleId,
          'success',
          'No changes to backup'
        );
        return;
      }

      const errorMsg =
        execError.stderr || execError.message || 'Unknown error';
      this.logger.error(
        `Scheduled backup failed: ${schedule.name} - ${errorMsg}`
      );
      await this.useCase.recordRun(scheduleId, 'failure', errorMsg);
    }
  }

  /**
   * Reload all schedules (e.g., after CRUD operation)
   */
  async reload(): Promise<void> {
    // Stop all existing tasks
    for (const [id, task] of this.tasks) {
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
    for (const [id, task] of this.tasks) {
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
