import { log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../../infrastructure/di/container.js';

export interface ConfigSnapshotShowOptions {
  root?: string;
  id: string;
  files?: boolean;
  json?: boolean;
}

/**
 * Show details of a specific config snapshot
 */
export async function configSnapshotShowCommand(
  options: ConfigSnapshotShowOptions
): Promise<number> {
  if (!options.id) {
    log.error('Snapshot ID is required. Usage: mcctl config-snapshot show <id>');
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

    if (options.json) {
      console.log(JSON.stringify(snapshot.toJSON(), null, 2));
      return 0;
    }

    console.log('');
    console.log(colors.bold('Config Snapshot Details'));
    console.log('');
    console.log(`  ID:          ${colors.cyan(snapshot.id)}`);
    console.log(`  Server:      ${colors.bold(snapshot.serverName.value)}`);
    console.log(
      `  Created:     ${colors.dim(snapshot.createdAt.toLocaleString())}`
    );
    console.log(
      `  Files:       ${colors.yellow(String(snapshot.files.length))} files`
    );

    if (snapshot.description) {
      console.log(`  Description: ${colors.dim(snapshot.description)}`);
    }

    if (snapshot.scheduleId) {
      console.log(`  Schedule ID: ${colors.dim(snapshot.scheduleId)}`);
    }

    if (options.files && snapshot.files.length > 0) {
      console.log('');
      console.log(colors.bold('  Files:'));

      for (const file of snapshot.files) {
        const sizeKb = (file.size / 1024).toFixed(1);
        console.log(
          `    ${colors.cyan(file.path.padEnd(40))} ${colors.dim(
            `${sizeKb} KB`
          )} ${colors.dim(file.hash.substring(0, 8))}`
        );
      }
    }

    console.log('');
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to show snapshot: ${message}`);
    return 1;
  }
}
