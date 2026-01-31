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
    this.prompt.intro('GitHub Backup 설정');

    try {
      // Check if already configured
      const currentStatus = await this.status();
      if (currentStatus.configured && !force) {
        const overwrite = await this.prompt.confirm({
          message: '백업이 이미 설정되어 있습니다. 덮어쓰시겠습니까?',
          initialValue: false,
        });

        if (this.prompt.isCancel(overwrite) || !overwrite) {
          this.prompt.outro('설정이 취소되었습니다.');
          return {
            success: false,
            error: 'Cancelled - existing configuration preserved',
          };
        }
      }

      // Get GitHub token
      this.prompt.note(
        'GitHub Personal Access Token이 필요합니다.\n' +
        'https://github.com/settings/tokens 에서 생성하세요.\n' +
        '필요한 권한: repo (Full control of private repositories)',
        '토큰 생성 안내'
      );

      const token = await this.prompt.password({
        message: 'GitHub Personal Access Token:',
      });

      if (this.prompt.isCancel(token) || !token) {
        this.prompt.outro('설정이 취소되었습니다.');
        return {
          success: false,
          error: 'Cancelled',
        };
      }

      // Get repository
      const repository = await this.prompt.text({
        message: '백업 저장소를 입력하세요 (username/repo):',
        placeholder: 'username/minecraft-worlds-backup',
        validate: (value) => {
          if (!value) return '저장소를 입력하세요.';
          if (!value.includes('/')) return 'username/repo 형식으로 입력하세요.';
          return undefined;
        },
      });

      if (this.prompt.isCancel(repository) || !repository) {
        this.prompt.outro('설정이 취소되었습니다.');
        return {
          success: false,
          error: 'Cancelled',
        };
      }

      // Get branch
      const branchChoice = await this.prompt.select<string>({
        message: '브랜치를 선택하세요:',
        options: [
          { value: 'main', label: 'main', hint: '권장' },
          { value: 'master', label: 'master' },
          { value: '_custom', label: '직접 입력' },
        ],
      });

      if (this.prompt.isCancel(branchChoice)) {
        this.prompt.outro('설정이 취소되었습니다.');
        return {
          success: false,
          error: 'Cancelled',
        };
      }

      let branch = branchChoice;
      if (branchChoice === '_custom') {
        const customBranch = await this.prompt.text({
          message: '브랜치 이름을 입력하세요:',
          placeholder: 'main',
        });

        if (this.prompt.isCancel(customBranch) || !customBranch) {
          this.prompt.outro('설정이 취소되었습니다.');
          return {
            success: false,
            error: 'Cancelled',
          };
        }
        branch = customBranch;
      }

      // Auto backup on stop
      const autoBackup = await this.prompt.confirm({
        message: '서버 종료 시 자동으로 백업할까요?',
        initialValue: true,
      });

      if (this.prompt.isCancel(autoBackup)) {
        this.prompt.outro('설정이 취소되었습니다.');
        return {
          success: false,
          error: 'Cancelled',
        };
      }

      // Test connection
      const spinner = this.prompt.spinner();
      spinner.start('GitHub 연결 테스트 중...');

      const testResult = await this.testGitHubConnection(token, repository);

      if (!testResult.success) {
        spinner.stop('연결 실패');
        this.prompt.error(testResult.error || '저장소에 접근할 수 없습니다.');
        this.prompt.note(
          '토큰 권한 또는 저장소 이름을 확인하세요.\n' +
          '저장소가 없으면 먼저 GitHub에서 생성하세요.',
          '문제 해결'
        );
        this.prompt.outro('설정이 취소되었습니다.');
        return {
          success: false,
          error: testResult.error,
        };
      }

      spinner.stop('연결 성공');

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

      this.prompt.success('백업 설정이 완료되었습니다!');
      this.prompt.note(
        `저장소: ${repository}\n` +
        `브랜치: ${branch}\n` +
        `자동 백업: ${autoBackup ? '활성화' : '비활성화'}`,
        '설정 정보'
      );
      this.prompt.outro('이제 mcctl backup push로 백업할 수 있습니다.');

      return {
        success: true,
        repository,
        branch,
        autoBackupEnabled: autoBackup,
      };
    } catch (error) {
      if (this.prompt.isCancel(error)) {
        this.prompt.outro('설정이 취소되었습니다.');
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
        error: '저장소를 찾을 수 없습니다. 저장소 이름을 확인하세요.',
      };
    }

    if (result.stderr.includes('Authentication failed') || result.stderr.includes('403')) {
      return {
        success: false,
        error: '인증에 실패했습니다. 토큰 권한을 확인하세요.',
      };
    }

    return {
      success: false,
      error: result.stderr || '알 수 없는 오류가 발생했습니다.',
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
