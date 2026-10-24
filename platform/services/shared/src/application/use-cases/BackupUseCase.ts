import type {
  IBackupUseCase,
  BackupInitResult,
  BackupPushResult,
  BackupStatusResult,
  BackupHistoryResult,
  BackupRestoreResult,
  BackupPushOptions,
  IPromptPort,
  IWorldBackupPort,
} from '../ports/index.js';

/**
 * Backup Use Case
 * Manages world backups to GitHub
 */
export class BackupUseCase implements IBackupUseCase {
  private configSaveCallback?: (config: Record<string, string | boolean>) => void | Promise<void>;

  constructor(
    private readonly prompt: IPromptPort,
    private readonly port: IWorldBackupPort
  ) {}

  /**
   * Set callback for saving configuration (called by CLI layer)
   */
  setConfigSaveCallback(callback: (config: Record<string, string | boolean>) => void | Promise<void>): void {
    this.configSaveCallback = callback;
  }

  /**
   * Interactive backup initialization
   */
  async init(force = false): Promise<BackupInitResult> {
    this.prompt.intro('GitHub Backup Setup');

    try {
      // Check if already configured
      const currentStatus = await this.status();
      if (currentStatus.configured && !force) {
        const overwrite = await this.prompt.confirm({
          message: 'Backup is already configured. Do you want to overwrite?',
          initialValue: false,
        });

        if (this.prompt.isCancel(overwrite) || !overwrite) {
          this.prompt.outro('Setup cancelled.');
          return {
            success: false,
            error: 'Cancelled - existing configuration preserved',
          };
        }
      }

      // Get GitHub token
      this.prompt.note(
        'A GitHub Personal Access Token is required.\n' +
        'Create one at: https://github.com/settings/tokens\n' +
        'Required scope: repo (Full control of private repositories)',
        'Token Setup Guide'
      );

      const token = await this.prompt.password({
        message: 'GitHub Personal Access Token:',
      });

      if (this.prompt.isCancel(token) || !token) {
        this.prompt.outro('Setup cancelled.');
        return {
          success: false,
          error: 'Cancelled',
        };
      }

      // Get repository
      const repository = await this.prompt.text({
        message: 'Enter backup repository (username/repo):',
        placeholder: 'username/minecraft-worlds-backup',
        validate: (value) => {
          if (!value) return 'Repository is required.';
          if (!value.includes('/')) return 'Use format: username/repo';
          return undefined;
        },
      });

      if (this.prompt.isCancel(repository) || !repository) {
        this.prompt.outro('Setup cancelled.');
        return {
          success: false,
          error: 'Cancelled',
        };
      }

      // Get branch
      const branchChoice = await this.prompt.select<string>({
        message: 'Select branch:',
        options: [
          { value: 'main', label: 'main', hint: 'recommended' },
          { value: 'master', label: 'master' },
          { value: '_custom', label: 'Custom' },
        ],
      });

      if (this.prompt.isCancel(branchChoice)) {
        this.prompt.outro('Setup cancelled.');
        return {
          success: false,
          error: 'Cancelled',
        };
      }

      let branch = branchChoice;
      if (branchChoice === '_custom') {
        const customBranch = await this.prompt.text({
          message: 'Enter branch name:',
          placeholder: 'main',
        });

        if (this.prompt.isCancel(customBranch) || !customBranch) {
          this.prompt.outro('Setup cancelled.');
          return {
            success: false,
            error: 'Cancelled',
          };
        }
        branch = customBranch;
      }

      // Auto backup on stop
      const autoBackup = await this.prompt.confirm({
        message: 'Enable auto backup when server stops?',
        initialValue: true,
      });

      if (this.prompt.isCancel(autoBackup)) {
        this.prompt.outro('Setup cancelled.');
        return {
          success: false,
          error: 'Cancelled',
        };
      }

      // Test connection
      const spinner = this.prompt.spinner();
      spinner.start('Testing GitHub connection...');

      const testResult = await this.testGitHubConnection(token, repository);

      if (!testResult.success) {
        spinner.stop('Connection failed');
        this.prompt.error(testResult.error || 'Cannot access repository.');
        this.prompt.note(
          'Please check your token permissions and repository name.\n' +
          'If the repository does not exist, create it on GitHub first.',
          'Troubleshooting'
        );
        this.prompt.outro('Setup cancelled.');
        return {
          success: false,
          error: testResult.error,
        };
      }

      spinner.stop('Connection successful');

      // Save configuration
      const config = {
        BACKUP_GITHUB_TOKEN: token,
        BACKUP_GITHUB_REPO: repository,
        BACKUP_GITHUB_BRANCH: branch,
        BACKUP_AUTO_ON_STOP: autoBackup,
      };

      if (this.configSaveCallback) {
        await this.configSaveCallback(config);
      }

      this.prompt.success('Backup setup complete!');
      this.prompt.note(
        `Repository: ${repository}\n` +
        `Branch: ${branch}\n` +
        `Auto backup: ${autoBackup ? 'enabled' : 'disabled'}`,
        'Configuration'
      );
      this.prompt.outro('You can now use: mcctl backup push');

      return {
        success: true,
        repository,
        branch,
        autoBackupEnabled: autoBackup,
      };
    } catch (error) {
      if (this.prompt.isCancel(error)) {
        this.prompt.outro('Setup cancelled.');
        return {
          success: false,
          error: 'Cancelled',
        };
      }
      throw error;
    }
  }

  /**
   * Test GitHub connection
   */
  private async testGitHubConnection(
    token: string,
    repository: string
  ): Promise<{ success: boolean; error?: string }> {
    const r = await this.port.testConnection({ token, repository });
    return r.ok ? { success: true } : { success: false, error: r.error.message };
  }

  /**
   * Interactive backup push
   */
  async push(): Promise<BackupPushResult> {
    this.prompt.intro('Backup Worlds to GitHub');

    try {
      // Check backup status first
      const statusResult = await this.status();

      if (!statusResult.configured) {
        this.prompt.error('Backup not configured');
        this.prompt.note(
          'Set BACKUP_GITHUB_TOKEN and BACKUP_GITHUB_REPO in .env',
          'Configuration Required'
        );
        this.prompt.outro('Backup cancelled');
        return {
          success: false,
          error: 'Backup not configured',
        };
      }

      // Prompt for backup message
      const message = await this.prompt.text({
        message: 'Backup message:',
        placeholder: 'Manual backup',
      });

      if (this.prompt.isCancel(message)) {
        this.prompt.outro('Backup cancelled');
        return {
          success: false,
          error: 'Cancelled',
        };
      }

      // Execute backup
      return await this.pushWithMessage(message || 'Manual backup');
    } catch (error) {
      if (this.prompt.isCancel(error)) {
        this.prompt.outro('Backup cancelled');
        return {
          success: false,
          error: 'Cancelled',
        };
      }
      throw error;
    }
  }

  /**
   * Push backup with message
   */
  async pushWithMessage(message: string, options: BackupPushOptions = {}): Promise<BackupPushResult> {
    const spinner = this.prompt.spinner();
    spinner.start('Backing up worlds...');

    const r = await this.port.push({ message, ...options });
    if (!r.ok) {
      spinner.stop('Backup failed');
      this.prompt.error(r.error.message);
      return { success: false, message, error: r.error.message, errorCode: r.error.code };
    }
    const { changed, commit, warnings } = r.value;
    spinner.stop(changed ? 'Backup complete' : 'No changes to backup');
    for (const w of warnings) this.prompt.warn(w);
    if (commit) this.prompt.note(`Commit: ${commit.substring(0, 7)}`, 'Backup Info');
    this.prompt.outro('Backup complete');
    return { success: true, commitHash: commit, message, noChanges: !changed, warnings };
  }

  /**
   * Get backup status
   */
  async status(): Promise<BackupStatusResult> {
    const r = await this.port.status();
    if (!r.ok || !r.value.configured) return { configured: false };
    return {
      configured: true,
      repository: r.value.repository,
      branch: r.value.branch,
      lastBackup: r.value.lastBackup?.date,
      autoBackupEnabled: r.value.autoOnStop,
    };
  }

  /**
   * Get backup history
   */
  async history(): Promise<BackupHistoryResult[]> {
    const r = await this.port.history();
    if (!r.ok) return [];
    return r.value.map((c) => ({ commitHash: c.hash, message: c.message, date: c.date, author: c.author }));
  }

  /**
   * Interactive restore selection
   */
  async restore(): Promise<BackupRestoreResult> {
    this.prompt.intro('Restore from Backup');

    try {
      // Get history
      const history = await this.history();

      if (history.length === 0) {
        this.prompt.warn('No backup history found');
        this.prompt.outro('Nothing to restore');
        return {
          success: false,
          commitHash: '',
          error: 'No backup history found',
        };
      }

      // Prompt for commit selection
      const selected = await this.prompt.select<string>({
        message: 'Select backup to restore:',
        options: history.slice(0, 10).map((entry) => ({
          value: entry.commitHash,
          label: entry.commitHash.substring(0, 7),
          hint: `${entry.message} (${entry.date.toLocaleDateString()})`,
        })),
      });

      if (this.prompt.isCancel(selected)) {
        this.prompt.outro('Restore cancelled');
        return {
          success: false,
          commitHash: '',
          error: 'Cancelled',
        };
      }

      // Confirm restore
      const confirmed = await this.prompt.confirm({
        message: 'This will overwrite current world data. Continue?',
        initialValue: false,
      });

      if (!confirmed) {
        this.prompt.outro('Restore cancelled');
        return {
          success: false,
          commitHash: selected,
          error: 'Cancelled',
        };
      }

      // Execute restore
      return await this.restoreFromCommit(selected);
    } catch (error) {
      if (this.prompt.isCancel(error)) {
        this.prompt.outro('Restore cancelled');
        return {
          success: false,
          commitHash: '',
          error: 'Cancelled',
        };
      }
      throw error;
    }
  }

  /**
   * Restore from specific commit
   */
  async restoreFromCommit(commitHash: string): Promise<BackupRestoreResult> {
    const spinner = this.prompt.spinner();
    spinner.start('Restoring from backup...');

    const r = await this.port.restore(commitHash);
    if (!r.ok) {
      spinner.stop('Restore failed');
      this.prompt.error(r.error.message);
      return { success: false, commitHash, error: r.error.message, errorCode: r.error.code };
    }
    spinner.stop('Restore complete');
    for (const s of r.value.skipped) this.prompt.warn(`Skipped ${s}`);
    this.prompt.success(`Restored from ${r.value.commit.substring(0, 7)}`);
    this.prompt.note(`Previous data kept in ${r.value.previousDir}`, 'Restore Info');
    this.prompt.outro('Restore complete');
    return { success: true, commitHash: r.value.commit, previousDir: r.value.previousDir };
  }
}
