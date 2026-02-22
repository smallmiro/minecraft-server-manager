import { log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../../infrastructure/di/container.js';

export interface ConfigSnapshotListOptions {
  root?: string;
  serverName?: string;
  limit?: number;
  offset?: number;
  json?: boolean;
}

/**
 * List config snapshots (all servers or specific server)
 */
export async function configSnapshotListCommand(
  options: ConfigSnapshotListOptions
): Promise<number> {
  const container = getContainer(options.root);
  const useCase = container.configSnapshotUseCase;
  const limit = options.limit ?? 20;

  try {
    const snapshots = await useCase.list(options.serverName, limit, options.offset);

    if (options.json) {
      console.log(JSON.stringify(snapshots.map((s) => s.toJSON()), null, 2));
      return 0;
    }

    if (snapshots.length === 0) {
      console.log('');
      if (options.serverName) {
        console.log(
          colors.dim(
            `No snapshots found for server "${options.serverName}".`
          )
        );
      } else {
        console.log(colors.dim('No snapshots found.'));
      }
      console.log(
        colors.dim(
          '  Use: mcctl config-snapshot create <server> to create one.'
        )
      );
      console.log('');
      return 0;
    }

    console.log('');
    if (options.serverName) {
      console.log(
        colors.bold(
          `Config Snapshots for ${options.serverName} (${snapshots.length}):`
        )
      );
    } else {
      console.log(
        colors.bold(`Config Snapshots (${snapshots.length}):`)
      );
    }
    console.log('');

    for (const snapshot of snapshots) {
      const date = snapshot.createdAt.toLocaleString();
      const server = colors.cyan(snapshot.serverName.value.padEnd(15));
      const id = colors.dim(snapshot.id.substring(0, 8) + '...');
      const fileCount = colors.yellow(`${snapshot.files.length} files`);
      const desc = snapshot.description
        ? colors.dim(`  "${snapshot.description}"`)
        : '';

      console.log(
        `  ${server}  ${colors.dim(date)}  ${fileCount}  ${id}${desc}`
      );
    }

    console.log('');
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to list snapshots: ${message}`);
    return 1;
  }
}
