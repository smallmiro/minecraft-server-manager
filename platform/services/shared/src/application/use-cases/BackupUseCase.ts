import type {
  IBackupUseCase,
  BackupInitResult,
  BackupPushResult,
  BackupStatusResult,
  BackupHistoryResult,
  BackupRestoreResult,
  IPromptPort,
  IShellPort,
} from '../ports/index.js';

/**
 * Backup Use Case
 * Manages world backups to GitHub
 */
export class BackupUseCase implements IBackupUseCase {
  private configSaveCallback?: (config: Record<string, string | boolean>) => void;

  constructor(
    private readonly prompt: IPromptPort,
    private readonly shell: IShellPort
  ) {}

  /**
   * Set callback for saving configuration (called by CLI layer)
   */
  setConfigSaveCallback(callback: (config: Record<string, string | boolean>) => void): void {
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
        this.configSaveCallback(config);
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
    // Use git ls-remote to test connection
    const result = await this.shell.exec('git', [
      'ls-remote',
      '--heads',
      `https://${token}@github.com/${repository}.git`,
    ]);

    if (result.success) {
      return { success: true };
    }

    // Parse error message
    if (result.stderr.includes('not found') || result.stderr.includes('404')) {
      return {
        success: false,
        error: 'Repository not found. Please check the repository name.',
      };
    }

    if (result.stderr.includes('Authentication failed') || result.stderr.includes('403')) {
      return {
        success: false,
        error: 'Authentication failed. Please check your token permissions.',
      };
    }

    return {
      success: false,
      error: result.stderr || 'An unknown error occurred.',
    };
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
  async pushWithMessage(message: string): Promise<BackupPushResult> {
    const spinner = this.prompt.spinner();
    spinner.start('Backing up worlds...');

    const result = await this.shell.backupPush(message);

    if (!result.success) {
      spinner.stop('Backup failed');
      this.prompt.error(result.stderr || 'Unknown error');
      return {
        success: false,
        message,
        error: result.stderr,
      };
    }

    spinner.stop('Backup complete');

    // Parse commit hash from output
    const commitMatch = result.stdout.match(/commit:\s*([a-f0-9]+)/i);
    const commitHash = commitMatch ? commitMatch[1] : undefined;

    this.prompt.success('Worlds backed up successfully');
    if (commitHash) {
      this.prompt.note(`Commit: ${commitHash}`, 'Backup Info');
    }

    this.prompt.outro('Backup complete');

    return {
      success: true,
      commitHash,
      message,
    };
  }

  /**
   * Get backup status
   */
  async status(): Promise<BackupStatusResult> {
    const result = await this.shell.backupStatus();

    if (!result.success) {
      return {
        configured: false,
      };
    }

    // Parse status output
    const output = result.stdout;

    const repoMatch = output.match(/Repository:\s*(.+)/i);
    const branchMatch = output.match(/Branch:\s*(.+)/i);
    const lastBackupMatch = output.match(/Last backup:\s*(.+)/i);
    const autoMatch = output.match(/Auto backup:\s*(enabled|disabled)/i);

    return {
      configured: true,
      repository: repoMatch ? repoMatch[1]?.trim() : undefined,
      branch: branchMatch ? branchMatch[1]?.trim() : undefined,
      lastBackup: lastBackupMatch
        ? new Date(lastBackupMatch[1]!.trim())
        : undefined,
      autoBackupEnabled: autoMatch
        ? autoMatch[1]?.toLowerCase() === 'enabled'
        : undefined,
    };
  }

  /**
   * Get backup history
   */
  async history(): Promise<BackupHistoryResult[]> {
    const result = await this.shell.backupHistory(true);

    if (!result.success) {
      return [];
    }

    try {
      const data = JSON.parse(result.stdout);
      return data.map((entry: Record<string, unknown>) => ({
        commitHash: entry.hash as string,
        message: entry.message as string,
        date: new Date(entry.date as string),
        author: entry.author as string,
      }));
    } catch {
      return [];
    }
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

    const result = await this.shell.backupRestore(commitHash);

    if (!result.success) {
      spinner.stop('Restore failed');
      this.prompt.error(result.stderr || 'Unknown error');
      return {
        success: false,
        commitHash,
        error: result.stderr,
      };
    }

    spinner.stop('Restore complete');
    this.prompt.success(`Restored from ${commitHash.substring(0, 7)}`);
    this.prompt.outro('Restore complete');

    return {
      success: true,
      commitHash,
    };
  }
}
