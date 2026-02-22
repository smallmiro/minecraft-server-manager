import { log, colors, CronExpression } from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/index.js';

/**
 * Backup schedule command options
 */
export interface BackupScheduleCommandOptions {
  root?: string;
  subCommand?: string;
  /** Schedule ID (for remove, enable, disable) */
  scheduleId?: string;
  /** Cron expression or preset */
  cron?: string;
  /** Schedule name */
  name?: string;
  /** Maximum backup count */
  maxCount?: number;
  /** Maximum backup age in days */
  maxAgeDays?: number;
  json?: boolean;
}

/**
 * Execute backup schedule command
 */
export async function backupScheduleCommand(
  options: BackupScheduleCommandOptions
): Promise<number> {
  const subCommand = options.subCommand ?? 'list';

  switch (subCommand) {
    case 'list':
      return scheduleList(options);
    case 'add':
      return scheduleAdd(options);
    case 'remove':
      return scheduleRemove(options);
    case 'enable':
      return scheduleEnable(options);
    case 'disable':
      return scheduleDisable(options);
    default:
      log.error(`Unknown schedule subcommand: ${subCommand}`);
      console.log(
        'Usage: mcctl backup schedule [list|add|remove|enable|disable]'
      );
      return 1;
  }
}

/**
 * List all backup schedules
 */
async function scheduleList(
  options: BackupScheduleCommandOptions
): Promise<number> {
  const container = getContainer(options.root);
  const useCase = container.backupScheduleUseCase;

  try {
    const schedules = await useCase.findAll();

    if (options.json) {
      console.log(JSON.stringify(schedules.map((s) => s.toJSON()), null, 2));
      return 0;
    }

    if (schedules.length === 0) {
      console.log('');
      console.log(colors.dim('No backup schedules configured.'));
      console.log(
        colors.dim(
          '  Use: mcctl backup schedule add --cron "0 3 * * *" --name "Daily Backup"'
        )
      );
      console.log('');
      return 0;
    }

    console.log('');
    console.log(colors.bold('Backup Schedules:'));
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

      console.log(`  ${name}  ${cron} ${humanReadable}  [${status}]`);
      console.log(`    ID: ${colors.dim(schedule.id)}`);

      if (schedule.retentionPolicy.maxCount !== undefined) {
        console.log(
          `    Retention: max ${schedule.retentionPolicy.maxCount} backups`
        );
      }
      if (schedule.retentionPolicy.maxAgeDays !== undefined) {
        console.log(
          `    Retention: max ${schedule.retentionPolicy.maxAgeDays} days`
        );
      }

      if (schedule.lastRunAt) {
        const statusColor =
          schedule.lastRunStatus === 'success' ? colors.green : colors.red;
        console.log(
          `    Last run: ${statusColor(schedule.lastRunStatus ?? 'unknown')} at ${schedule.lastRunAt.toLocaleString()}`
        );
        if (schedule.lastRunMessage) {
          console.log(`    Message: ${schedule.lastRunMessage}`);
        }
      }
      console.log('');
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * Add a new backup schedule
 */
async function scheduleAdd(
  options: BackupScheduleCommandOptions
): Promise<number> {
  const container = getContainer(options.root);
  const useCase = container.backupScheduleUseCase;

  try {
    if (!options.cron) {
      log.error('--cron is required. Use a cron expression or preset name.');
      console.log('');
      console.log('  Presets: daily, every-6h, every-12h, hourly, weekly');
      console.log('  Example: mcctl backup schedule add --cron "0 3 * * *"');
      console.log('  Example: mcctl backup schedule add --cron daily');
      console.log('');
      return 1;
    }

    // Try preset first, fall back to raw cron
    let cronExpr: string;
    try {
      const presets = CronExpression.getPresets();
      if (presets[options.cron]) {
        cronExpr = presets[options.cron]!;
      } else {
        cronExpr = options.cron;
      }
    } catch {
      cronExpr = options.cron;
    }

    const name = options.name ?? `Backup Schedule`;

    const schedule = await useCase.create({
      name,
      cron: cronExpr,
      maxCount: options.maxCount,
      maxAgeDays: options.maxAgeDays,
    });

    if (options.json) {
      console.log(JSON.stringify(schedule.toJSON(), null, 2));
      return 0;
    }

    console.log('');
    console.log(colors.green('Backup schedule created!'));
    console.log(`  Name: ${colors.bold(schedule.name)}`);
    console.log(`  Cron: ${colors.cyan(schedule.cronExpression.expression)}`);
    console.log(
      `  Schedule: ${schedule.cronExpression.toHumanReadable()}`
    );
    console.log(`  ID: ${colors.dim(schedule.id)}`);
    console.log('');

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * Remove a backup schedule
 */
async function scheduleRemove(
  options: BackupScheduleCommandOptions
): Promise<number> {
  const container = getContainer(options.root);
  const useCase = container.backupScheduleUseCase;

  try {
    if (!options.scheduleId) {
      log.error('Schedule ID is required.');
      console.log('  Usage: mcctl backup schedule remove <id>');
      return 1;
    }

    const schedule = await useCase.findById(options.scheduleId);
    if (!schedule) {
      log.error(`Schedule not found: ${options.scheduleId}`);
      return 1;
    }

    await useCase.remove(options.scheduleId);

    console.log('');
    console.log(
      colors.green(`Removed schedule: ${colors.bold(schedule.name)}`)
    );
    console.log('');

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * Enable a backup schedule
 */
async function scheduleEnable(
  options: BackupScheduleCommandOptions
): Promise<number> {
  const container = getContainer(options.root);
  const useCase = container.backupScheduleUseCase;

  try {
    if (!options.scheduleId) {
      log.error('Schedule ID is required.');
      console.log('  Usage: mcctl backup schedule enable <id>');
      return 1;
    }

    const schedule = await useCase.enable(options.scheduleId);

    console.log('');
    console.log(
      colors.green(`Enabled schedule: ${colors.bold(schedule.name)}`)
    );
    console.log('');

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * Disable a backup schedule
 */
async function scheduleDisable(
  options: BackupScheduleCommandOptions
): Promise<number> {
  const container = getContainer(options.root);
  const useCase = container.backupScheduleUseCase;

  try {
    if (!options.scheduleId) {
      log.error('Schedule ID is required.');
      console.log('  Usage: mcctl backup schedule disable <id>');
      return 1;
    }

    const schedule = await useCase.disable(options.scheduleId);

    console.log('');
    console.log(
      colors.yellow(`Disabled schedule: ${colors.bold(schedule.name)}`)
    );
    console.log('');

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}
