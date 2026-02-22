import * as p from '@clack/prompts';
import { log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../../infrastructure/di/container.js';

export interface ConfigSnapshotRestoreOptions {
  root?: string;
  id: string;
  force?: boolean;
  noSafety?: boolean;
}

/**
 * Restore server configuration from a config snapshot
 */
export async function configSnapshotRestoreCommand(
  options: ConfigSnapshotRestoreOptions
): Promise<number> {
  if (!options.id) {
    log.error(
      'Snapshot ID is required. Usage: mcctl config-snapshot restore <id>'
    );
    return 1;
  }

  const container = getContainer(options.root);
  const useCase = container.configSnapshotUseCase;

  try {
    const snapshot = await useCase.findById(options.id);

    if (!snapshot) {
      log.error(`Snapshot not found: ${options.id}`);
      return 1;
    }

    // Confirmation prompt (unless --force)
    if (!options.force) {
      console.log('');
      console.log(colors.bold('Restore Configuration'));
      console.log(`  Server:  ${colors.bold(snapshot.serverName.value)}`);
      console.log(`  Snapshot: ${colors.cyan(snapshot.id.substring(0, 8))}...`);
      console.log(
        `  Created: ${colors.dim(snapshot.createdAt.toLocaleString())}`
      );
      console.log(
        `  Files:   ${colors.yellow(String(snapshot.files.length))} files will be overwritten`
      );
      if (snapshot.description) {
        console.log(`  Note:    ${colors.dim(snapshot.description)}`);
      }
      console.log('');

      const confirmed = await p.confirm({
        message: `Restore ${snapshot.files.length} files for server "${snapshot.serverName.value}"? This will overwrite current configuration.`,
        initialValue: false,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        console.log(colors.dim('\nRestore cancelled.\n'));
        return 0;
      }
    }

    console.log(colors.dim('\nRestoring configuration files...'));

    await useCase.restore(options.id, options.force ?? false);

    console.log('');
    console.log(
      colors.green(
        `Configuration restored from snapshot ${colors.bold(snapshot.id.substring(0, 8))}...`
      )
    );
    console.log(
      `  ${colors.yellow(String(snapshot.files.length))} files restored for server "${colors.bold(snapshot.serverName.value)}".`
    );
    console.log('');

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to restore snapshot: ${message}`);
    return 1;
  }
}
