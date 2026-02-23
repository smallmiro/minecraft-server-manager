import * as p from '@clack/prompts';
import { log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../../../infrastructure/di/container.js';

export interface ConfigSnapshotScheduleRemoveOptions {
  root?: string;
  id: string;
  force?: boolean;
}

/**
 * Remove a config snapshot schedule
 */
export async function configSnapshotScheduleRemoveCommand(
  options: ConfigSnapshotScheduleRemoveOptions
): Promise<number> {
  if (!options.id) {
    log.error(
      'Schedule ID is required. Usage: mcctl config-snapshot schedule remove <id>'
    );
    return 1;
  }

  const container = getContainer(options.root);
  const useCase = container.configSnapshotScheduleUseCase;

  try {
    // Confirmation prompt (unless --force)
    if (!options.force) {
      const confirmed = await p.confirm({
        message: `Remove schedule ${colors.cyan(options.id.substring(0, 8))}...?`,
        initialValue: false,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        console.log(colors.dim('\nRemoval cancelled.\n'));
        return 0;
      }
    }

    await useCase.delete(options.id);

    console.log('');
    console.log(
      colors.green(
        `Schedule removed: ${colors.dim(options.id.substring(0, 8))}...`
      )
    );
    console.log('');

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to remove schedule: ${message}`);
    return 1;
  }
}
