import { log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../../../infrastructure/di/container.js';

export interface ConfigSnapshotScheduleAddOptions {
  root?: string;
  serverName?: string;
  cron?: string;
  name?: string;
  retention?: number;
  json?: boolean;
}

/**
 * Add a new config snapshot schedule
 */
export async function configSnapshotScheduleAddCommand(
  options: ConfigSnapshotScheduleAddOptions
): Promise<number> {
  const container = getContainer(options.root);
  const useCase = container.configSnapshotScheduleUseCase;

  // Validate required fields
  if (!options.serverName) {
    log.error(
      '--server is required. Usage: mcctl config-snapshot schedule add --server <name> --cron "..." --name "..."'
    );
    return 1;
  }

  if (!options.cron) {
    log.error(
      '--cron is required. Example: --cron "0 3 * * *"'
    );
    return 1;
  }

  if (!options.name) {
    log.error(
      '--name is required. Example: --name "Daily Snapshot"'
    );
    return 1;
  }

  const retentionCount = options.retention ?? 10;

  try {
    const schedule = await useCase.create(
      options.serverName,
      options.name,
      options.cron,
      retentionCount
    );

    if (options.json) {
      console.log(JSON.stringify(schedule.toJSON(), null, 2));
      return 0;
    }

    console.log('');
    console.log(colors.green('Config snapshot schedule created!'));
    console.log(`  Name:      ${colors.bold(schedule.name)}`);
    console.log(`  Server:    ${colors.bold(schedule.serverName.value)}`);
    console.log(`  Cron:      ${colors.cyan(schedule.cronExpression.expression)}`);
    console.log(
      `  Schedule:  ${schedule.cronExpression.toHumanReadable()}`
    );
    console.log(
      `  Retention: max ${colors.yellow(String(schedule.retentionCount))} snapshots`
    );
    console.log(`  ID:        ${colors.dim(schedule.id)}`);
    console.log('');

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to create schedule: ${message}`);
    return 1;
  }
}
