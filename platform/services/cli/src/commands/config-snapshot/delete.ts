import * as p from '@clack/prompts';
import { log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../../infrastructure/di/container.js';

export interface ConfigSnapshotDeleteOptions {
  root?: string;
  id: string;
  force?: boolean;
}

/**
 * Delete a config snapshot
 */
export async function configSnapshotDeleteCommand(
  options: ConfigSnapshotDeleteOptions
): Promise<number> {
  if (!options.id) {
    log.error('Snapshot ID is required. Usage: mcctl config-snapshot delete <id>');
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
      const confirmed = await p.confirm({
        message: `Delete snapshot ${colors.cyan(snapshot.id.substring(0, 8))} for server "${colors.bold(snapshot.serverName.value)}" (${snapshot.files.length} files, created ${snapshot.createdAt.toLocaleDateString()})?`,
        initialValue: false,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        console.log(colors.dim('\nDeletion cancelled.\n'));
        return 0;
      }
    }

    await useCase.delete(options.id);

    console.log('');
    console.log(
      colors.green(
        `Snapshot deleted: ${colors.bold(snapshot.id.substring(0, 8))}...`
      )
    );
    console.log('');

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to delete snapshot: ${message}`);
    return 1;
  }
}
