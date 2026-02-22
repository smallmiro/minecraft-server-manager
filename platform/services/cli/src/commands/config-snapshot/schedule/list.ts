import { log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../../../infrastructure/di/container.js';

export interface ConfigSnapshotScheduleListOptions {
  root?: string;
  serverName?: string;
  json?: boolean;
}

/**
 * List config snapshot schedules
 */
export async function configSnapshotScheduleListCommand(
  options: ConfigSnapshotScheduleListOptions
): Promise<number> {
  const container = getContainer(options.root);
  const useCase = container.configSnapshotScheduleUseCase;

  try {
    const schedules = options.serverName
      ? await useCase.findByServer(options.serverName)
      : await useCase.findAll();

    if (options.json) {
      console.log(JSON.stringify(schedules.map((s) => s.toJSON()), null, 2));
      return 0;
    }

    if (schedules.length === 0) {
      console.log('');
      if (options.serverName) {
        console.log(
          colors.dim(
            `No schedules configured for server "${options.serverName}".`
          )
        );
      } else {
        console.log(colors.dim('No schedules configured.'));
      }
      console.log(
        colors.dim(
          '  Use: mcctl config-snapshot schedule add --server <name> --cron "0 3 * * *" --name "Daily"'
        )
      );
      console.log('');
      return 0;
    }

    console.log('');
    console.log(colors.bold(`Config Snapshot Schedules (${schedules.length}):`));
    console.log('');

    for (const schedule of schedules) {
      const status = schedule.enabled
        ? colors.green('enabled')
        : colors.dim('disabled');

      const name = colors.bold(schedule.name);
      const cron = colors.cyan(schedule.cronExpression.expression);
      const humanReadable = colors.dim(
        `(${schedule.cronExpression.toHumanReadable()})`
      );

      console.log(
        `  ${name}  ${cron} ${humanReadable}  [${status}]`
      );
      console.log(`    ID:        ${colors.dim(schedule.id)}`);
      console.log(`    Server:    ${colors.bold(schedule.serverName.value)}`);
      console.log(
        `    Retention: max ${colors.yellow(String(schedule.retentionCount))} snapshots`
      );

      if (schedule.lastRunAt) {
        const statusColor =
          schedule.lastRunStatus === 'success' ? colors.green : colors.red;
        console.log(
          `    Last run:  ${statusColor(schedule.lastRunStatus ?? 'unknown')} at ${schedule.lastRunAt.toLocaleString()}`
        );
      }

      console.log('');
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to list schedules: ${message}`);
    return 1;
  }
}
