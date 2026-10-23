import { Paths, log, colors } from '@minecraft-docker/shared';
import { ShellExecutor } from '../lib/shell.js';
import { getContainer } from '../infrastructure/index.js';

export interface ConfigCommandOptions {
  root?: string;
  serverName?: string;
  key?: string;
  value?: string;
  json?: boolean;
  // Shortcut flags
  cheats?: boolean;
  noCheats?: boolean;
  pvp?: boolean;
  noPvp?: boolean;
  commandBlock?: boolean;
  noCommandBlock?: boolean;
}

// Shortcut flag mappings
const SHORTCUTS: Record<string, { key: string; value: string }> = {
  cheats: { key: 'ALLOW_CHEATS', value: 'true' },
  noCheats: { key: 'ALLOW_CHEATS', value: 'false' },
  pvp: { key: 'PVP', value: 'true' },
  noPvp: { key: 'PVP', value: 'false' },
  commandBlock: { key: 'ENABLE_COMMAND_BLOCK', value: 'true' },
  noCommandBlock: { key: 'ENABLE_COMMAND_BLOCK', value: 'false' },
};

/**
 * View or modify server configuration
 */
export async function configCommand(options: ConfigCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  if (!options.serverName) {
    log.error('Server name is required');
    log.info('Usage: mcctl config <server> [key] [value]');
    log.info('       mcctl config <server> --cheats');
    return 1;
  }

  const shell = new ShellExecutor(paths);

  // Check if server exists
  const config = shell.readConfig(options.serverName);
  if (config === null) {
    log.error(`Server '${options.serverName}' not found`);
    return 1;
  }

  // Handle shortcut flags
  for (const [flagName, mapping] of Object.entries(SHORTCUTS)) {
    if (options[flagName as keyof ConfigCommandOptions]) {
      const success = shell.writeConfigValue(options.serverName, mapping.key, mapping.value);
      if (success) {
        console.log(colors.green(`✓ ${mapping.key}=${mapping.value}`));
        log.info('Restart server to apply changes: mcctl stop <server> && mcctl start <server>');
        return 0;
      } else {
        log.error(`Failed to update ${mapping.key}`);
        return 1;
      }
    }
  }

  // View all config
  if (!options.key) {
    if (options.json) {
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log(colors.bold(`\nConfiguration for ${options.serverName}:\n`));
      for (const [key, value] of Object.entries(config)) {
        console.log(`  ${colors.cyan(key)}=${value}`);
      }
      console.log('');
    }
    return 0;
  }

  // View specific key
  if (!options.value) {
    const currentValue = config[options.key];
    if (currentValue === undefined) {
      log.error(`Key '${options.key}' not found in config`);
      return 1;
    }
    if (options.json) {
      console.log(JSON.stringify({ [options.key]: currentValue }));
    } else {
      console.log(`${options.key}=${currentValue}`);
    }
    return 0;
  }

  // Set config value
  const oldValue = config[options.key];

  // LEVEL (or WORLD_NAME when no LEVEL is set) is a world assignment (#670)
  let success: boolean;
  const world = await assignIfWorldChanges(options, config);
  if (world === 'refused') {
    return 1;
  } else if (world === 'assigned' && options.key === 'LEVEL') {
    success = true; // the assignment port wrote LEVEL
  } else {
    success = shell.writeConfigValue(options.serverName, options.key, options.value);
  }

  if (success) {
    if (options.json) {
      console.log(JSON.stringify({
        server: options.serverName,
        key: options.key,
        oldValue: oldValue ?? null,
        newValue: options.value,
      }));
    } else {
      if (oldValue !== undefined) {
        console.log(colors.green(`✓ ${options.key}: ${oldValue} → ${options.value}`));
      } else {
        console.log(colors.green(`✓ ${options.key}=${options.value} (added)`));
      }
      log.info('Restart server to apply changes: mcctl stop <server> && mcctl start <server>');
    }
    return 0;
  } else {
    log.error(`Failed to update ${options.key}`);
    return 1;
  }
}

/**
 * Route a LEVEL/WORLD_NAME change that changes the server's effective world
 * (LEVEL, else WORLD_NAME) through the assignment rules: R1, R7 and a
 * stopped server. A WORLD_NAME under a set LEVEL changes nothing and is
 * written as before.
 */
async function assignIfWorldChanges(
  options: ConfigCommandOptions,
  config: Record<string, string>
): Promise<'unchanged' | 'assigned' | 'refused'> {
  const { key, value, serverName } = options;
  if ((key !== 'LEVEL' && key !== 'WORLD_NAME') || !value || !serverName) return 'unchanged';

  const container = getContainer(options.root);
  try {
    const snapshot = await container.worldAssignmentPort.listAssignments();
    const before = snapshot.assignments.find((a) => a.server === serverName)?.world;
    const after = key === 'LEVEL' ? value : config['LEVEL']?.trim() || value;
    if (before === after) return 'unchanged';

    const result = await container.worldManagementUseCase.assignWorldByName(after, serverName, {
      requireExisting: false,
    });
    if (!result.success) {
      log.error(result.error || 'Failed to change the world');
      return 'refused';
    }
    return 'assigned';
  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error));
    return 'refused';
  }
}
