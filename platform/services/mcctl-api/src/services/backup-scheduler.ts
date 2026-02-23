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
import { AuditActionEnum, type AuditLogData } from '@minecraft-docker/shared';

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
    private readonly platformPath: string,
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
   * Extract stdout string from execFilePromise result.
   * Handles both real execFile (returns {stdout, stderr}) and
   * test mocks that may resolve with a plain string.
   */
  private extractStdout(result: unknown): string {
    if (typeof result === 'string') return result;
    if (result !== null && typeof result === 'object' && 'stdout' in result) {
      return String((result as { stdout: unknown }).stdout ?? '');
    }
    return '';
  }

  /**
   * Get the commit count in the git repository at the given directory.
   * Uses execFile to prevent shell injection.
   */
  private async getCommitCount(repoDir: string): Promise<number> {
    const result = await execFilePromise(
      'git',
      ['rev-list', '--count', 'HEAD'],
      { cwd: repoDir }
    );
    const stdout = this.extractStdout(result);
    return parseInt(stdout.trim(), 10);
  }

  /**
   * Get the date of the oldest commit in the git repository.
   * Returns null if there are no commits.
   */
  private async getOldestCommitDate(repoDir: string): Promise<Date | null> {
    const result = await execFilePromise(
      'git',
      ['log', '--reverse', '--format=%aI', '-1'],
      { cwd: repoDir }
    );
    const stdout = this.extractStdout(result);
    const timestamp = stdout.trim();
    if (!timestamp) return null;
    return new Date(timestamp);
  }

  /**
   * Truncate git history by keeping only the last `keepCount` commits.
   * Uses orphan branch rewrite strategy which is safe for linear histories.
   * The orphan branch discards all history before the target commit.
   *
   * Strategy:
   *   1. Find the SHA of the Nth commit from HEAD (where N = keepCount)
   *   2. Create an orphan branch starting at that commit (no parent)
   *   3. Cherry-pick remaining commits from keepCount back to HEAD
   *   4. Replace the main branch with the orphan branch
   *   5. Force-push to remote
   */
  private async truncateHistory(
    repoDir: string,
    keepCount: number
  ): Promise<void> {
    // Find the SHA of the commit at position keepCount from HEAD (1-indexed from tip)
    const revListResult = await execFilePromise(
      'git',
      ['rev-list', '--ancestry-path', `HEAD~${keepCount}..HEAD`],
      { cwd: repoDir }
    );
    const revListOut = this.extractStdout(revListResult);

    // rev-list returns newest-first; we want the oldest kept commit (last line)
    const keptCommits = revListOut.trim().split('\n').filter(Boolean);
    if (keptCommits.length === 0) {
      // Nothing to truncate
      return;
    }

    // The root commit to start orphan from is the oldest kept commit
    const oldestKeptSha = keptCommits[keptCommits.length - 1]!;

    // Create orphan branch from the oldest kept commit's tree
    const tempBranch = `_prune-temp-${Date.now()}`;
    const currentBranch = await this.getCurrentBranch(repoDir);

    // Create orphan branch with the same tree as oldestKeptSha
    await execFilePromise(
      'git',
      ['checkout', '--orphan', tempBranch, oldestKeptSha],
      { cwd: repoDir }
    );

    // Commit the tree to establish root
    await execFilePromise(
      'git',
      ['commit', '--allow-empty', '-m', 'Retention prune root'],
      { cwd: repoDir }
    );

    // Cherry-pick commits from after oldest kept commit to HEAD (newest first, so reverse)
    const commitsToReplay = keptCommits.slice(0, -1).reverse();
    for (const sha of commitsToReplay) {
      try {
        await execFilePromise('git', ['cherry-pick', sha], { cwd: repoDir });
      } catch {
        // If cherry-pick fails, abort and restore original branch
        await execFilePromise('git', ['cherry-pick', '--abort'], { cwd: repoDir }).catch(() => {});
        await execFilePromise('git', ['checkout', currentBranch], { cwd: repoDir }).catch(() => {});
        await execFilePromise('git', ['branch', '-D', tempBranch], { cwd: repoDir }).catch(() => {});
        throw new Error(`Cherry-pick failed during retention pruning at commit ${sha}`);
      }
    }

    // Replace main branch with orphan branch
    await execFilePromise(
      'git',
      ['checkout', '-B', currentBranch, tempBranch],
      { cwd: repoDir }
    );

    // Delete temp branch
    await execFilePromise('git', ['branch', '-D', tempBranch], { cwd: repoDir }).catch(() => {});

    // Force-push to sync remote
    await execFilePromise('git', ['push', '--force', 'origin', currentBranch], { cwd: repoDir });
  }

  /**
   * Get the current git branch name.
   */
  private async getCurrentBranch(repoDir: string): Promise<string> {
    const result = await execFilePromise(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: repoDir }
    );
    const stdout = this.extractStdout(result);
    return stdout.trim() || 'main';
  }

  /**
   * Apply the retention policy from a BackupSchedule to the git history.
   *
   * Algorithm:
   *   1. Count commits (git rev-list --count HEAD)
   *   2. If maxCount is set: check if count > maxCount; if so, prune to maxCount
   *   3. Re-count after maxCount prune to avoid using stale count for maxAgeDays
   *   4. If maxAgeDays is set: get oldest commit date, check age; if too old, prune
   *   5. Force-push after any truncation
   *
   * Pruning errors do NOT fail the backup itself - they are logged as warnings.
   */
  async applyRetentionPolicy(
    schedule: BackupSchedule,
    repoDir: string
  ): Promise<void> {
    const policy = schedule.retentionPolicy;
    const maxCount = policy.maxCount;
    const maxAgeDays = policy.maxAgeDays;

    // Nothing to do if no policy configured
    if (maxCount === undefined && maxAgeDays === undefined) {
      return;
    }

    // Check if repository exists
    let commitCount: number;
    try {
      commitCount = await this.getCommitCount(repoDir);
    } catch {
      // No commits yet or repo doesn't exist - nothing to prune
      return;
    }

    if (commitCount === 0) return;

    // Step 1: Apply maxCount pruning
    if (maxCount !== undefined) {
      const needsCountPrune = commitCount > maxCount;

      if (needsCountPrune) {
        this.logger.info(
          `Applying retention prune by maxCount: keeping ${maxCount} of ${commitCount} commits for schedule "${schedule.name}"`
        );
        try {
          await this.truncateHistory(repoDir, maxCount);
          // Re-count after pruning to get accurate count for next check
          // This prevents double-truncation if maxAgeDays is also configured
          commitCount = await this.getCommitCount(repoDir);
          // Write audit log for successful maxCount prune
          await this.writeRetentionAuditLog(schedule, 'maxCount', maxCount, 'success');
        } catch (pruneError) {
          const errMsg = (pruneError as Error).message ?? String(pruneError);
          this.logger.warn(
            `Retention prune by maxCount failed (backup still succeeded): ${errMsg}`
          );
          await this.writeRetentionAuditLog(schedule, 'maxCount', maxCount, 'failure', errMsg);
          // Re-count even if truncation failed (might be partially done)
          try {
            commitCount = await this.getCommitCount(repoDir);
          } catch {
            // Ignore re-count failure
          }
          return; // Stop further pruning to avoid compounding issues
        }
      }
    }

    // Step 2: Apply maxAgeDays pruning using the freshly counted commitCount
    if (maxAgeDays !== undefined) {
      let oldestDate: Date | null;
      try {
        oldestDate = await this.getOldestCommitDate(repoDir);
      } catch {
        oldestDate = null;
      }

      if (oldestDate !== null) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - maxAgeDays);

        if (oldestDate < cutoff) {
          // Calculate how many commits fall within the age window
          // We need to keep commits newer than cutoff
          // For simplicity: count commits newer than cutoff and keep that many
          let keepCount: number;
          try {
            const cutoffIso = cutoff.toISOString();
            const newerCountResult = await execFilePromise(
              'git',
              ['rev-list', '--count', '--after', cutoffIso, 'HEAD'],
              { cwd: repoDir }
            );
            const newerCountOut = this.extractStdout(newerCountResult);
            keepCount = parseInt(newerCountOut.trim(), 10);
          } catch {
            keepCount = 1; // Keep at least 1 commit
          }

          if (keepCount < 1) keepCount = 1;

          this.logger.info(
            `Applying retention prune by maxAgeDays: keeping ${keepCount} commits (max age ${maxAgeDays} days) for schedule "${schedule.name}"`
          );

          try {
            await this.truncateHistory(repoDir, keepCount);
            await this.writeRetentionAuditLog(schedule, 'maxAgeDays', maxAgeDays, 'success');
          } catch (pruneError) {
            const errMsg = (pruneError as Error).message ?? String(pruneError);
            this.logger.warn(
              `Retention prune by maxAgeDays failed (backup still succeeded): ${errMsg}`
            );
            await this.writeRetentionAuditLog(schedule, 'maxAgeDays', maxAgeDays, 'failure', errMsg);
          }
        }
      }
    }
  }

  /**
   * Write an audit log entry for a retention pruning operation.
   * Errors are silently ignored to avoid affecting the backup result.
   */
  private async writeRetentionAuditLog(
    schedule: BackupSchedule,
    pruneType: 'maxCount' | 'maxAgeDays',
    limit: number,
    status: 'success' | 'failure',
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
          pruneType,
          limit,
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

      // Apply retention policy after successful backup
      // Pruning errors must NOT fail the backup itself
      await this.applyRetentionPolicy(schedule, backupCacheDir);

      // Get commit hash from the backup cache directory
      let commitHash: string | undefined;
      try {
        const hashResult = await execFilePromise(
          'git',
          ['rev-parse', '--short', 'HEAD'],
          { cwd: backupCacheDir }
        );
        const hashOut = this.extractStdout(hashResult);
        commitHash = hashOut.trim() || undefined;
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
