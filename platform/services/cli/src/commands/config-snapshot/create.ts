import { log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../../infrastructure/di/container.js';

export interface ConfigSnapshotCreateOptions {
  root?: string;
  serverName?: string;
  description?: string;
  json?: boolean;
}

/**
 * Create a new config snapshot for a server
 */
export async function configSnapshotCreateCommand(
  options: ConfigSnapshotCreateOptions
): Promise<number> {
  const container = getContainer(options.root);
  const useCase = container.configSnapshotUseCase;

  // Validate server name
  if (!options.serverName) {
    log.error('Server name is required. Usage: mcctl config-snapshot create <server>');
    return 1;
  }

  try {
    console.log('');
    console.log(
      colors.dim(
        `Creating snapshot for server "${options.serverName}"...`
      )
    );

    const snapshot = await useCase.create(
      options.serverName,
      options.description
    );

    if (options.json) {
      console.log(JSON.stringify(snapshot.toJSON(), null, 2));
      return 0;
    }

    console.log(colors.green('Snapshot created successfully!'));
    console.log(`  ID:     ${colors.cyan(snapshot.id)}`);
    console.log(`  Server: ${colors.bold(snapshot.serverName.value)}`);
    console.log(
      `  Files:  ${colors.yellow(String(snapshot.files.length))} files captured`
    );
    console.log(
      `  Time:   ${colors.dim(snapshot.createdAt.toLocaleString())}`
    );
    if (snapshot.description) {
      console.log(`  Note:   ${colors.dim(snapshot.description)}`);
    }
    console.log('');

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to create snapshot: ${message}`);
    return 1;
  }
}
