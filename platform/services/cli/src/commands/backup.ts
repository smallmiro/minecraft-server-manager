import { Paths, log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/index.js';

/**
 * Backup command options
 */
export interface BackupCommandOptions {
  root?: string;
  subCommand?: string;
  message?: string;
  commitHash?: string;
  json?: boolean;
  auto?: boolean;
}

/**
 * Execute backup command
 */
export async function backupCommand(options: BackupCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  // Check if initialized
  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  const container = getContainer(options.root);
  const subCommand = options.subCommand ?? 'status';

  switch (subCommand) {
    case 'status':
      return backupStatus(container, options);

    case 'push':
      return backupPush(container, options);

    case 'history':
      return backupHistory(container, options);

    case 'restore':
      return backupRestore(container, options);

    default:
      log.error(`Unknown backup subcommand: ${subCommand}`);
      console.log('Usage: mcctl backup [status|push|history|restore]');
      return 1;
  }
}

/**
 * Show backup status
 */
async function backupStatus(
  container: ReturnType<typeof getContainer>,
  options: BackupCommandOptions
): Promise<number> {
  const useCase = container.backupUseCase;

  try {
    const status = await useCase.status();

    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
      return 0;
    }

    console.log('');
    console.log(colors.bold('Backup Configuration:'));
    console.log('');

    if (!status.configured) {
      console.log(colors.yellow('  Status: Not configured'));
      console.log('');
      console.log('  To enable backups, set in .env:');
      console.log(colors.dim('    BACKUP_GITHUB_TOKEN=your-token'));
      console.log(colors.dim('    BACKUP_GITHUB_REPO=username/repo'));
      console.log('');
      return 0;
    }

    console.log(colors.green('  Status: Configured'));
    if (status.repository) {
      console.log(`  Repository: ${colors.cyan(status.repository)}`);
    }
    if (status.branch) {
      console.log(`  Branch: ${status.branch}`);
    }
    if (status.lastBackup) {
      console.log(`  Last backup: ${status.lastBackup.toLocaleString()}`);
    }
    if (status.autoBackupEnabled !== undefined) {
      console.log(
        `  Auto backup: ${status.autoBackupEnabled ? colors.green('enabled') : colors.dim('disabled')}`
      );
    }
    console.log('');

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * Push backup to GitHub
 */
async function backupPush(
  container: ReturnType<typeof getContainer>,
  options: BackupCommandOptions
): Promise<number> {
  const useCase = container.backupUseCase;

  try {
    // If message provided, use direct push
    if (options.message) {
      const result = await useCase.pushWithMessage(options.message);

      if (result.success) {
        console.log('');
        console.log(colors.green('✓ Backup complete!'));
        if (result.commitHash) {
          console.log(`  Commit: ${colors.cyan(result.commitHash)}`);
        }
        console.log('');
        return 0;
      } else {
        log.error(result.error || 'Backup failed');
        return 1;
      }
    }

    // Interactive mode
    const result = await useCase.push();
    return result.success ? 0 : 1;
  } catch (error) {
    const prompt = container.promptPort;
    if (prompt.isCancel(error)) {
      return 0;
    }

    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * Show backup history
 */
async function backupHistory(
  container: ReturnType<typeof getContainer>,
  options: BackupCommandOptions
): Promise<number> {
  const useCase = container.backupUseCase;

  try {
    const history = await useCase.history();

    if (history.length === 0) {
      console.log('No backup history found');
      return 0;
    }

    if (options.json) {
      console.log(JSON.stringify(history, null, 2));
      return 0;
    }

    console.log('');
    console.log(colors.bold('Backup History:'));
    console.log('');

    for (const entry of history.slice(0, 10)) {
      const hash = colors.cyan(entry.commitHash.substring(0, 7));
      const date = colors.dim(entry.date.toLocaleDateString());
      console.log(`  ${hash}  ${entry.message}  ${date}`);
    }

    if (history.length > 10) {
      console.log(colors.dim(`  ... and ${history.length - 10} more`));
    }

    console.log('');
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * Restore from backup
 */
async function backupRestore(
  container: ReturnType<typeof getContainer>,
  options: BackupCommandOptions
): Promise<number> {
  const useCase = container.backupUseCase;

  try {
    // If commit hash provided, use direct restore
    if (options.commitHash) {
      const result = await useCase.restoreFromCommit(options.commitHash);

      if (result.success) {
        console.log('');
        console.log(colors.green('✓ Restore complete!'));
        console.log(`  Restored from: ${colors.cyan(result.commitHash.substring(0, 7))}`);
        console.log('');
        return 0;
      } else {
        log.error(result.error || 'Restore failed');
        return 1;
      }
    }

    // Interactive mode
    const result = await useCase.restore();
    return result.success ? 0 : 1;
  } catch (error) {
    const prompt = container.promptPort;
    if (prompt.isCancel(error)) {
      return 0;
    }

    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}
