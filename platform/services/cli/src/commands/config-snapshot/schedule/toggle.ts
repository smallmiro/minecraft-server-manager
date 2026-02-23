import { log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../../../infrastructure/di/container.js';

export interface ConfigSnapshotScheduleToggleOptions {
  root?: string;
  id: string;
  action: 'enable' | 'disable';
}

/**
 * Enable or disable a config snapshot schedule
 */
export async function configSnapshotScheduleToggleCommand(
  options: ConfigSnapshotScheduleToggleOptions
): Promise<number> {
  if (!options.id) {
    log.error(
      `Schedule ID is required. Usage: mcctl config-snapshot schedule ${options.action} <id>`
    );
    return 1;
  }

  const container = getContainer(options.root);
  const useCase = container.configSnapshotScheduleUseCase;

  try {
    if (options.action === 'enable') {
      await useCase.enable(options.id);

      console.log('');
      console.log(
        colors.green(
          `Schedule enabled: ${colors.dim(options.id.substring(0, 8))}...`
        )
      );
      console.log('');
    } else {
      await useCase.disable(options.id);

      console.log('');
      console.log(
        colors.yellow(
          `Schedule disabled: ${colors.dim(options.id.substring(0, 8))}...`
        )
      );
      console.log('');
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to ${options.action} schedule: ${message}`);
    return 1;
  }
}
