import { join } from 'node:path';
import { Paths, log, colors, AuditActionEnum } from '@minecraft-docker/shared';
import { ShellExecutor } from '../lib/shell.js';
import { isContainerRunning, execRconWithOutput, getContainerName } from '../lib/rcon.js';
import {
  readPlayerJson,
  writePlayerJson,
  findPlayerByName,
  type PlayerEntry,
} from '../lib/player-json.js';
import { getContainer } from '../infrastructure/di/container.js';

export interface WhitelistCommandOptions {
  root?: string;
  serverName?: string;
  subCommand?: 'list' | 'add' | 'remove' | 'on' | 'off' | 'status';
  playerName?: string;
  json?: boolean;
}

/**
 * Manage server whitelist
 */
export async function whitelistCommand(options: WhitelistCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  if (!options.serverName) {
    log.error('Server name is required');
    log.info('Usage: mcctl whitelist <server> <list|add|remove|on|off|status> [player]');
    return 1;
  }

  if (!options.subCommand) {
    log.error('Action is required: list, add, remove, on, off, status');
    log.info('Usage: mcctl whitelist <server> <list|add|remove|on|off|status> [player]');
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
  const whitelistJsonPath = join(paths.servers, options.serverName, 'data', 'whitelist.json');

  switch (options.subCommand) {
    case 'list':
      return await listWhitelist(options, config, whitelistJsonPath, containerName, isRunning);

    case 'add':
      if (!options.playerName) {
        log.error('Player name is required for add');
        log.info('Usage: mcctl whitelist <server> add <player>');
        return 1;
      }
      return await addToWhitelist(
        shell,
        options,
        config,
        whitelistJsonPath,
        containerName,
        isRunning
      );

    case 'remove':
      if (!options.playerName) {
        log.error('Player name is required for remove');
        log.info('Usage: mcctl whitelist <server> remove <player>');
        return 1;
      }
      return await removeFromWhitelist(
        shell,
        options,
        config,
        whitelistJsonPath,
        containerName,
        isRunning
      );

    case 'on':
      return await enableWhitelist(shell, options, containerName, isRunning);

    case 'off':
      return await disableWhitelist(shell, options, containerName, isRunning);

    case 'status':
      return await whitelistStatus(options, config, containerName, isRunning);

    default:
      log.error(`Unknown action: ${options.subCommand}`);
      log.info('Valid actions: list, add, remove, on, off, status');
      return 1;
  }
}

/**
 * List whitelisted players
 */
async function listWhitelist(
  options: WhitelistCommandOptions,
  config: Record<string, string>,
  whitelistJsonPath: string,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  let players: PlayerEntry[] = [];
  let source = 'json';

  if (isRunning) {
    // Try RCON first for accurate data
    const result = await execRconWithOutput(containerName, ['whitelist', 'list']);
    if (result.code === 0) {
      // Parse RCON output: "There are X whitelisted players: player1, player2"
      const match = result.output.match(/:\s*(.+)$/);
      if (match && match[1]) {
        const names = match[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        players = names.map((name) => ({ uuid: '', name }));
        source = 'rcon';
      }
    }
  }

  // Fallback to JSON file
  if (players.length === 0 || source !== 'rcon') {
    players = await readPlayerJson(whitelistJsonPath);
    source = 'json';
  }

  // Also check config.env WHITELIST
  const configWhitelist = config['WHITELIST']
    ? config['WHITELIST'].split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  if (options.json) {
    console.log(
      JSON.stringify({
        server: options.serverName,
        running: isRunning,
        players: players.map((p) => p.name),
        configWhitelist,
        source,
      })
    );
  } else {
    console.log(colors.bold(`\nWhitelist for ${options.serverName}:\n`));
    if (players.length === 0) {
      console.log('  (none)');
    } else {
      for (const player of players) {
        console.log(`  ${colors.cyan(player.name)}`);
      }
    }
    console.log('');
    if (!isRunning) {
      log.warn('Server is not running. Showing whitelist from JSON file');
    }
  }

  return 0;
}

/**
 * Add player to whitelist
 */
async function addToWhitelist(
  shell: ShellExecutor,
  options: WhitelistCommandOptions,
  config: Record<string, string>,
  whitelistJsonPath: string,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  const playerName = options.playerName!;

  // Read current whitelist
  const players = await readPlayerJson(whitelistJsonPath);

  // Check if already whitelisted
  if (findPlayerByName(players, playerName)) {
    if (options.json) {
      console.log(
        JSON.stringify({
          success: false,
          error: 'already_whitelisted',
          player: playerName,
          server: options.serverName,
        })
      );
    } else {
      log.warn(`${playerName} is already whitelisted`);
    }
    return 0;
  }

  let rconSuccess = false;
  let rconMessage = '';

  // Execute RCON if server is running
  if (isRunning) {
    const result = await execRconWithOutput(containerName, ['whitelist', 'add', playerName]);
    rconSuccess = result.code === 0;
    rconMessage = result.output.trim();
  }

  // Update config.env WHITELIST
  const currentConfigList = config['WHITELIST']
    ? config['WHITELIST'].split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  if (!currentConfigList.some((n) => n.toLowerCase() === playerName.toLowerCase())) {
    const newList = [...currentConfigList, playerName].join(',');
    shell.writeConfigValue(options.serverName!, 'WHITELIST', newList);
  }

  // Log audit
  const container = getContainer({ rootDir: options.root });
  await container.auditLogPort.log({
    action: AuditActionEnum.PLAYER_WHITELIST_ADD,
    actor: 'cli:local',
    targetType: 'player',
    targetName: playerName,
    status: 'success',
    details: { server: options.serverName },
    errorMessage: null,
  });

  if (options.json) {
    console.log(
      JSON.stringify({
        success: true,
        player: playerName,
        server: options.serverName,
        rcon: isRunning ? { success: rconSuccess, message: rconMessage } : null,
        running: isRunning,
      })
    );
  } else {
    if (isRunning && rconSuccess) {
      console.log(colors.green(`${playerName} added to whitelist (applied immediately)`));
    } else if (isRunning && !rconSuccess) {
      console.log(colors.yellow(`RCON: ${rconMessage}`));
      console.log(colors.green(`Config updated. Will apply on server restart.`));
    } else {
      console.log(colors.yellow(`Server is not running.`));
      console.log(colors.green(`Config updated. Changes will apply on next start.`));
    }
  }

  return 0;
}

/**
 * Remove player from whitelist
 */
async function removeFromWhitelist(
  shell: ShellExecutor,
  options: WhitelistCommandOptions,
  config: Record<string, string>,
  whitelistJsonPath: string,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  const playerName = options.playerName!;

  let rconSuccess = false;
  let rconMessage = '';

  // Execute RCON if server is running
  if (isRunning) {
    const result = await execRconWithOutput(containerName, ['whitelist', 'remove', playerName]);
    rconSuccess = result.code === 0;
    rconMessage = result.output.trim();
  }

  // Update config.env WHITELIST
  const currentConfigList = config['WHITELIST']
    ? config['WHITELIST'].split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const newConfigList = currentConfigList.filter(
    (n) => n.toLowerCase() !== playerName.toLowerCase()
  );
  shell.writeConfigValue(options.serverName!, 'WHITELIST', newConfigList.join(','));

  // Log audit
  const container = getContainer({ rootDir: options.root });
  await container.auditLogPort.log({
    action: AuditActionEnum.PLAYER_WHITELIST_REMOVE,
    actor: 'cli:local',
    targetType: 'player',
    targetName: playerName,
    status: 'success',
    details: { server: options.serverName },
    errorMessage: null,
  });

  if (options.json) {
    console.log(
      JSON.stringify({
        success: true,
        player: playerName,
        server: options.serverName,
        rcon: isRunning ? { success: rconSuccess, message: rconMessage } : null,
        running: isRunning,
      })
    );
  } else {
    if (isRunning && rconSuccess) {
      console.log(colors.green(`${playerName} removed from whitelist (applied immediately)`));
    } else if (isRunning && !rconSuccess) {
      console.log(colors.yellow(`RCON: ${rconMessage}`));
      console.log(colors.green(`Config updated. Will apply on server restart.`));
    } else {
      console.log(colors.yellow(`Server is not running.`));
      console.log(colors.green(`Config updated. Changes will apply on next start.`));
    }
  }

  return 0;
}

/**
 * Enable whitelist
 */
async function enableWhitelist(
  shell: ShellExecutor,
  options: WhitelistCommandOptions,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  let rconSuccess = false;
  let rconMessage = '';

  if (isRunning) {
    const result = await execRconWithOutput(containerName, ['whitelist', 'on']);
    rconSuccess = result.code === 0;
    rconMessage = result.output.trim();
  }

  // Update config.env
  shell.writeConfigValue(options.serverName!, 'ENABLE_WHITELIST', 'true');

  if (options.json) {
    console.log(
      JSON.stringify({
        success: true,
        action: 'enable',
        server: options.serverName,
        rcon: isRunning ? { success: rconSuccess, message: rconMessage } : null,
        running: isRunning,
      })
    );
  } else {
    if (isRunning && rconSuccess) {
      console.log(colors.green(`Whitelist enabled (applied immediately)`));
    } else if (!isRunning) {
      console.log(colors.yellow(`Server is not running.`));
      console.log(colors.green(`Config updated. Whitelist will be enabled on next start.`));
    }
  }

  return 0;
}

/**
 * Disable whitelist
 */
async function disableWhitelist(
  shell: ShellExecutor,
  options: WhitelistCommandOptions,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  let rconSuccess = false;
  let rconMessage = '';

  if (isRunning) {
    const result = await execRconWithOutput(containerName, ['whitelist', 'off']);
    rconSuccess = result.code === 0;
    rconMessage = result.output.trim();
  }

  // Update config.env
  shell.writeConfigValue(options.serverName!, 'ENABLE_WHITELIST', 'false');

  if (options.json) {
    console.log(
      JSON.stringify({
        success: true,
        action: 'disable',
        server: options.serverName,
        rcon: isRunning ? { success: rconSuccess, message: rconMessage } : null,
        running: isRunning,
      })
    );
  } else {
    if (isRunning && rconSuccess) {
      console.log(colors.green(`Whitelist disabled (applied immediately)`));
    } else if (!isRunning) {
      console.log(colors.yellow(`Server is not running.`));
      console.log(colors.green(`Config updated. Whitelist will be disabled on next start.`));
    }
  }

  return 0;
}

/**
 * Show whitelist status
 */
async function whitelistStatus(
  options: WhitelistCommandOptions,
  config: Record<string, string>,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  const enabled = config['ENABLE_WHITELIST']?.toLowerCase() === 'true';
  const whitelistPlayers = config['WHITELIST']
    ? config['WHITELIST'].split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  if (options.json) {
    console.log(
      JSON.stringify({
        server: options.serverName,
        enabled,
        playerCount: whitelistPlayers.length,
        running: isRunning,
      })
    );
  } else {
    console.log(colors.bold(`\nWhitelist Status for ${options.serverName}:\n`));
    console.log(`  Enabled: ${enabled ? colors.green('Yes') : colors.red('No')}`);
    console.log(`  Players: ${colors.cyan(String(whitelistPlayers.length))}`);
    console.log(`  Running: ${isRunning ? colors.green('Yes') : colors.yellow('No')}`);
    console.log('');
  }

  return 0;
}
