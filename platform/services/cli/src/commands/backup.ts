import { Paths, Config, log, colors } from '@minecraft-docker/shared';
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
  force?: boolean;
  /** Consent to drop worlds that are in the last backup but missing now. */
  allowMissing?: boolean;
}

/** How long `push --auto` (auto-on-stop) waits for another backup operation. */
const AUTO_LOCK_WAIT_MS = 600_000;

/** Next step for a failed backup operation, by IWorldBackupPort error code. */
export function backupHint(code: string | undefined, root: string): string | undefined {
  switch (code) {
    case 'missing_worlds':
      return 'If you deleted these worlds on purpose, run: mcctl backup push --allow-missing';
    case 'locked':
      return `If no backup is running, remove the stale lock: ${root}/backups/.backup.lock`;
    case 'servers_running':
      return 'Stop the running servers (mcctl stop <server>), then retry the restore.';
    case 'recovery_required':
      return 'A restore did not finish. Recover the paths listed in the INCOMPLETE file, then delete that file (see the backup docs).';
    case 'runtime_unavailable':
      return 'Docker is not reachable; check `docker info`.';
    case 'not_configured':
      return 'Run: mcctl backup init';
    case 'git_too_old':
      return 'Install git 2.31 or newer.';
    default:
      return undefined;
  }
}

function printFailure(error: string | undefined, code: string | undefined, root: string, fallback: string): void {
  log.error(error || fallback);
  const hint = backupHint(code, root);
  if (hint) console.log(colors.dim(`  ${hint}`));
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
    case 'init':
      return backupInit(paths, container, options);

    case 'status':
      return backupStatus(container, options);

    case 'push':
      return backupPush(container, options, paths.root);

    case 'history':
      return backupHistory(container, options);

    case 'restore':
      return backupRestore(container, options, paths.root);

    default:
      log.error(`Unknown backup subcommand: ${subCommand}`);
      console.log('Usage: mcctl backup [init|status|push|history|restore]');
      return 1;
  }
}

/**
 * Initialize backup configuration
 */
async function backupInit(
  paths: Paths,
  container: ReturnType<typeof getContainer>,
  options: BackupCommandOptions
): Promise<number> {
  const useCase = container.backupUseCase;
  const config = new Config(paths);

  // Set callback to save configuration to .env
  useCase.setConfigSaveCallback((envConfig) => config.updateEnv(envConfig));

  try {
    const result = await useCase.init(options.force);
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
  options: BackupCommandOptions,
  root: string
): Promise<number> {
  const useCase = container.backupUseCase;

  try {
    // Non-interactive: a message, --auto (auto-on-stop) or --allow-missing
    if (options.message || options.auto || options.allowMissing) {
      const result = await useCase.pushWithMessage(options.message ?? '', {
        allowMissing: options.allowMissing === true,
        lockWaitMs: options.auto ? AUTO_LOCK_WAIT_MS : 0,
      });

      if (result.success) {
        console.log('');
        console.log(colors.green(result.noChanges ? '✓ No changes to backup' : '✓ Backup complete!'));
        if (result.commitHash) {
          console.log(`  Commit: ${colors.cyan(result.commitHash.substring(0, 7))}`);
        }
        console.log('');
        return 0;
      }
      printFailure(result.error, result.errorCode, root, 'Backup failed');
      return 1;
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
  options: BackupCommandOptions,
  root: string
): Promise<number> {
  const useCase = container.backupUseCase;

  try {
    // If commit hash provided, use direct restore (confirm unless --force)
    if (options.commitHash) {
      if (!options.force) {
        const confirmed = await container.promptPort.confirm({
          message: `Replace the current worlds with backup ${options.commitHash}? All servers must be stopped.`,
          initialValue: false,
        });
        if (container.promptPort.isCancel(confirmed) || !confirmed) {
          console.log('Restore cancelled');
          return 0;
        }
      }
      const result = await useCase.restoreFromCommit(options.commitHash);

      if (result.success) {
        console.log('');
        console.log(colors.green('✓ Restore complete!'));
        console.log(`  Restored from: ${colors.cyan(result.commitHash.substring(0, 7))}`);
        if (result.previousDir) console.log(`  Previous data: ${result.previousDir}`);
        console.log('');
        return 0;
      }
      printFailure(result.error, result.errorCode, root, 'Restore failed');
      return 1;
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
