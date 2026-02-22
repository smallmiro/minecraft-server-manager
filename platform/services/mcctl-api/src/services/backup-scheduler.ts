import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
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
        // Run git commands sequentially using execFile (safe from injection)
        await execFilePromise('git', ['add', '-A'], { ...execOptions, cwd: worldsPath });
        await execFilePromise('git', ['commit', '-m', commitMessage], { ...execOptions, cwd: worldsPath });
        await execFilePromise('git', ['push'], { ...execOptions, cwd: worldsPath });
      }

      // Get commit hash
      let commitHash: string | undefined;
      try {
        const { stdout: hashOut } = await execFilePromise(
          'git',
          ['rev-parse', '--short', 'HEAD'],
          { cwd: worldsPath }
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

      // Apply retention policy pruning after successful backup
      await this.applyRetentionPolicy(schedule, worldsPath);
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
   * Apply retention policy: prune old backups if policy thresholds are exceeded.
   * Uses git log to count commits and find the oldest commit date,
   * then calls BackupRetentionPolicy.shouldPrune() to decide.
   */
  private async applyRetentionPolicy(
    schedule: BackupSchedule,
    worldsPath: string
  ): Promise<void> {
    const policy = schedule.retentionPolicy;

    // Skip if no retention limits are set
    if (policy.maxCount === undefined && policy.maxAgeDays === undefined) {
      return;
    }

    try {
      // Count backup commits
      const { stdout: logOutput } = await execFilePromise(
        'git',
        ['log', '--oneline'],
        { cwd: worldsPath }
      );
      const commitLines = logOutput.trim().split('\n').filter((line) => line.length > 0);
      const backupCount = commitLines.length;

      if (backupCount === 0) {
        return;
      }

      // Get oldest commit date
      const { stdout: dateOutput } = await execFilePromise(
        'git',
        ['log', '--reverse', '--format=%aI', '-1'],
        { cwd: worldsPath }
      );
      const oldestDateStr = dateOutput.trim();
      const oldestBackupDate = oldestDateStr ? new Date(oldestDateStr) : new Date();

      // Check if pruning is needed
      if (!policy.shouldPrune(backupCount, oldestBackupDate)) {
        return;
      }

      this.logger.info(
        `Retention policy triggered for ${schedule.name}: ${backupCount} backups, oldest from ${oldestBackupDate.toISOString()}`
      );

      // Prune by maxCount: remove oldest commits beyond the limit
      if (policy.maxCount !== undefined && backupCount > policy.maxCount) {
        const excessCount = backupCount - policy.maxCount;
        this.logger.info(
          `Pruning ${excessCount} old backup(s) to maintain maxCount=${policy.maxCount}`
        );

        try {
          await this.truncateHistory(worldsPath, policy.maxCount);
        } catch (pruneError) {
          this.logger.warn(
            `Failed to prune old backups by count: ${pruneError instanceof Error ? pruneError.message : String(pruneError)}`
          );
        }
      }

      // Prune by maxAgeDays: remove commits older than cutoff
      if (policy.maxAgeDays !== undefined) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - policy.maxAgeDays);
        const cutoffISO = cutoff.toISOString();

        this.logger.info(
          `Pruning backups older than ${cutoffISO} (maxAgeDays=${policy.maxAgeDays})`
        );

        try {
          // Count commits within the retention window
          const { stdout: recentOutput } = await execFilePromise(
            'git',
            ['log', '--format=%H', '--after', cutoffISO],
            { cwd: worldsPath }
          );
          const retainedCommits = recentOutput.trim().split('\n').filter((line) => line.length > 0);

          if (retainedCommits.length > 0 && retainedCommits.length < backupCount) {
            await this.truncateHistory(worldsPath, retainedCommits.length);
          }
        } catch (pruneError) {
          this.logger.warn(
            `Failed to prune old backups by age: ${pruneError instanceof Error ? pruneError.message : String(pruneError)}`
          );
        }
      }
    } catch (error) {
      // Retention policy errors should not fail the backup itself
      this.logger.warn(
        `Retention policy check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Truncate git history to keep only the most recent N commits.
   * Uses orphan branch approach: creates a new orphan branch from the
   * oldest commit to keep, then cherry-picks the remaining commits.
   * After truncation, force-pushes to sync with remote.
   */
  private async truncateHistory(
    worldsPath: string,
    keepCount: number
  ): Promise<void> {
    // Get the current branch name
    const { stdout: branchOutput } = await execFilePromise(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: worldsPath }
    );
    const currentBranch = branchOutput.trim();

    // Get the list of commit hashes to keep (most recent N commits, oldest first)
    const { stdout: keepOutput } = await execFilePromise(
      'git',
      ['log', '--format=%H', `-${keepCount}`],
      { cwd: worldsPath }
    );
    const commitsToKeep = keepOutput.trim().split('\n').filter((h) => h.length > 0).reverse();

    if (commitsToKeep.length === 0) {
      return;
    }

    const oldestToKeep = commitsToKeep[0]!;
    const tempBranch = `_retention_temp_${Date.now()}`;

    try {
      // Create orphan branch starting from the oldest commit to keep
      await execFilePromise(
        'git',
        ['checkout', '--orphan', tempBranch, oldestToKeep],
        { cwd: worldsPath }
      );

      // Commit the tree of the oldest retained commit as the new root
      await execFilePromise(
        'git',
        ['commit', '-C', oldestToKeep],
        { cwd: worldsPath }
      );

      // Cherry-pick the remaining commits on top (if any)
      if (commitsToKeep.length > 1) {
        const remainingCommits = commitsToKeep.slice(1);
        await execFilePromise(
          'git',
          ['cherry-pick', ...remainingCommits],
          { cwd: worldsPath }
        );
      }

      // Replace the original branch with the truncated one
      await execFilePromise(
        'git',
        ['branch', '-M', tempBranch, currentBranch],
        { cwd: worldsPath }
      );

      // Force-push to sync remote with truncated history
      await execFilePromise(
        'git',
        ['push', '--force-with-lease'],
        { cwd: worldsPath }
      );

      this.logger.info(
        `History truncated to ${keepCount} commit(s) on branch ${currentBranch}`
      );
    } catch (error) {
      // Attempt to recover: go back to original branch
      try {
        await execFilePromise(
          'git',
          ['checkout', currentBranch],
          { cwd: worldsPath }
        );
        await execFilePromise(
          'git',
          ['branch', '-D', tempBranch],
          { cwd: worldsPath }
        );
      } catch {
        // Recovery failed, log but don't mask original error
      }
      throw error;
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
