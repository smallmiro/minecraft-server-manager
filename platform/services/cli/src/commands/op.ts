import { Paths, log, colors, AuditActionEnum } from '@minecraft-docker/shared';
import { ShellExecutor } from '../lib/shell.js';
import { isContainerRunning, execRconWithOutput, getContainerName } from '../lib/rcon.js';
import { getContainer } from '../infrastructure/di/container.js';

export interface OpCommandOptions {
  root?: string;
  serverName?: string;
  subCommand?: 'add' | 'remove' | 'list';
  playerName?: string;
  json?: boolean;
}

/**
 * Manage server operators
 */
export async function opCommand(options: OpCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  if (!options.serverName) {
    log.error('Server name is required');
    log.info('Usage: mcctl op <server> <add|remove|list> [player]');
    return 1;
  }

  if (!options.subCommand) {
    log.error('Action is required: add, remove, or list');
    log.info('Usage: mcctl op <server> <add|remove|list> [player]');
    return 1;
  }

  const shell = new ShellExecutor(paths);
  const config = shell.readConfig(options.serverName);

  if (config === null) {
    log.error(`Server '${options.serverName}' not found`);
    return 1;
  }

  const containerName = getContainerName(options.serverName);

  const isRunning = await isContainerRunning(containerName);

  switch (options.subCommand) {
    case 'list': {
      return await listOps(shell, options, config, containerName, isRunning);
    }

    case 'add': {
      if (!options.playerName) {
        log.error('Player name is required for add');
        log.info('Usage: mcctl op <server> add <player>');
        return 1;
      }
      return await addOp(shell, options, config, containerName, isRunning);
    }

    case 'remove': {
      if (!options.playerName) {
        log.error('Player name is required for remove');
        log.info('Usage: mcctl op <server> remove <player>');
        return 1;
      }
      return await removeOp(shell, options, config, containerName, isRunning);
    }

    default:
      log.error(`Unknown action: ${options.subCommand}`);
      log.info('Valid actions: add, remove, list');
      return 1;
  }
}

/**
 * List current operators
 */
async function listOps(
  shell: ShellExecutor,
  options: OpCommandOptions,
  config: Record<string, string>,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  // Get OPs from config.env
  const configOps = config['OPS'] ? config['OPS'].split(',').map((s) => s.trim()).filter(Boolean) : [];

  if (options.json) {
    console.log(JSON.stringify({
      server: options.serverName,
      running: isRunning,
      operators: configOps,
      source: 'config.env',
    }));
  } else {
    console.log(colors.bold(`\nOperators for ${options.serverName}:\n`));
    if (configOps.length === 0) {
      console.log('  (none)');
    } else {
      for (const op of configOps) {
        console.log(`  ${colors.cyan(op)}`);
      }
    }
    console.log('');
    if (!isRunning) {
      log.warn('Server is not running. Showing operators from config.env');
    }
  }

  return 0;
}

/**
 * Add an operator
 */
async function addOp(
  shell: ShellExecutor,
  options: OpCommandOptions,
  config: Record<string, string>,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  const playerName = options.playerName!;

  // Get current OPs from config
  const currentOps = config['OPS']
    ? config['OPS'].split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Check if already an OP
  if (currentOps.some((op) => op.toLowerCase() === playerName.toLowerCase())) {
    if (options.json) {
      console.log(JSON.stringify({
        success: false,
        error: 'already_op',
        player: playerName,
        server: options.serverName,
      }));
    } else {
      log.warn(`${playerName} is already an operator`);
    }
    return 0;
  }

  let rconSuccess = false;
  let rconMessage = '';

  // Execute RCON if server is running
  if (isRunning) {
    const result = await execRconWithOutput(containerName, ['op', playerName]);
    rconSuccess = result.code === 0;
    rconMessage = result.output.trim();
  }

  // Update config.env
  const newOps = [...currentOps, playerName].join(',');
  const configSuccess = shell.writeConfigValue(options.serverName!, 'OPS', newOps);

  // Log audit
  const container = getContainer({ rootDir: options.root });
  await container.auditLogPort.log({
    action: AuditActionEnum.PLAYER_OP,
    actor: 'cli:local',
    targetType: 'player',
    targetName: playerName,
    status: 'success',
    details: { server: options.serverName },
    errorMessage: null,
  });

  if (options.json) {
    console.log(JSON.stringify({
      success: true,
      player: playerName,
      server: options.serverName,
      rcon: isRunning ? { success: rconSuccess, message: rconMessage } : null,
      config: { success: configSuccess },
      running: isRunning,
    }));
  } else {
    if (isRunning && rconSuccess) {
      console.log(colors.green(`✓ ${playerName} is now an operator (applied immediately)`));
    } else if (isRunning && !rconSuccess) {
      console.log(colors.yellow(`⚠ RCON failed: ${rconMessage}`));
      if (configSuccess) {
        console.log(colors.green(`✓ Config updated. Will apply on server restart.`));
      }
    } else {
      console.log(colors.yellow(`⚠ Server is not running.`));
      if (configSuccess) {
        console.log(colors.green(`✓ Config updated. Changes will apply on next start.`));
      }
    }
  }

  return 0;
}

/**
 * Remove an operator
 */
async function removeOp(
  shell: ShellExecutor,
  options: OpCommandOptions,
  config: Record<string, string>,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  const playerName = options.playerName!;

  // Get current OPs from config
  const currentOps = config['OPS']
    ? config['OPS'].split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Check if is an OP
  const opIndex = currentOps.findIndex((op) => op.toLowerCase() === playerName.toLowerCase());
  if (opIndex === -1) {
    if (options.json) {
      console.log(JSON.stringify({
        success: false,
        error: 'not_an_op',
        player: playerName,
        server: options.serverName,
      }));
    } else {
      log.warn(`${playerName} is not an operator`);
    }
    return 0;
  }

  let rconSuccess = false;
  let rconMessage = '';

  // Execute RCON if server is running
  if (isRunning) {
    const result = await execRconWithOutput(containerName, ['deop', playerName]);
    rconSuccess = result.code === 0;
    rconMessage = result.output.trim();
  }

  // Update config.env
  currentOps.splice(opIndex, 1);
  const newOps = currentOps.join(',');
  const configSuccess = newOps
    ? shell.writeConfigValue(options.serverName!, 'OPS', newOps)
    : shell.writeConfigValue(options.serverName!, 'OPS', '');

  // Log audit
  const container = getContainer({ rootDir: options.root });
  await container.auditLogPort.log({
    action: AuditActionEnum.PLAYER_DEOP,
    actor: 'cli:local',
    targetType: 'player',
    targetName: playerName,
    status: 'success',
    details: { server: options.serverName },
    errorMessage: null,
  });

  if (options.json) {
    console.log(JSON.stringify({
      success: true,
      player: playerName,
      server: options.serverName,
      rcon: isRunning ? { success: rconSuccess, message: rconMessage } : null,
      config: { success: configSuccess },
      running: isRunning,
    }));
  } else {
    if (isRunning && rconSuccess) {
      console.log(colors.green(`✓ ${playerName} is no longer an operator (applied immediately)`));
    } else if (isRunning && !rconSuccess) {
      console.log(colors.yellow(`⚠ RCON failed: ${rconMessage}`));
      if (configSuccess) {
        console.log(colors.green(`✓ Config updated. Will apply on server restart.`));
      }
    } else {
      console.log(colors.yellow(`⚠ Server is not running.`));
      if (configSuccess) {
        console.log(colors.green(`✓ Config updated. Changes will apply on next start.`));
      }
    }
  }

  return 0;
}
