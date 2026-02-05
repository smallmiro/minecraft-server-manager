import { join } from 'node:path';
import { Paths, log, colors, AuditActionEnum } from '@minecraft-docker/shared';
import { ShellExecutor } from '../lib/shell.js';
import { isContainerRunning, execRconWithOutput, getContainerName } from '../lib/rcon.js';
import {
  readBannedPlayersJson,
  writeBannedPlayersJson,
  readBannedIpsJson,
  writeBannedIpsJson,
  findBannedPlayerByName,
  findBannedIp,
  createTimestamp,
  type BannedPlayerEntry,
  type BannedIpEntry,
} from '../lib/player-json.js';
import { getContainer } from '../infrastructure/di/container.js';

export interface BanCommandOptions {
  root?: string;
  serverName?: string;
  subCommand?: 'list' | 'add' | 'remove' | 'ip';
  target?: string; // player name or IP
  reason?: string;
  ipAction?: 'list' | 'add' | 'remove';
  json?: boolean;
}

/**
 * Manage server bans
 */
export async function banCommand(options: BanCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  if (!options.serverName) {
    log.error('Server name is required');
    log.info('Usage: mcctl ban <server> <list|add|remove|ip> [player/ip] [reason]');
    return 1;
  }

  if (!options.subCommand) {
    log.error('Action is required: list, add, remove, ip');
    log.info('Usage: mcctl ban <server> <list|add|remove|ip> [player/ip] [reason]');
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
  const bannedPlayersPath = join(paths.servers, options.serverName, 'data', 'banned-players.json');
  const bannedIpsPath = join(paths.servers, options.serverName, 'data', 'banned-ips.json');

  switch (options.subCommand) {
    case 'list':
      return await listBannedPlayers(options, bannedPlayersPath, containerName, isRunning);

    case 'add':
      if (!options.target) {
        log.error('Player name is required for ban');
        log.info('Usage: mcctl ban <server> add <player> [reason]');
        return 1;
      }
      return await banPlayer(options, bannedPlayersPath, containerName, isRunning);

    case 'remove':
      if (!options.target) {
        log.error('Player name is required for unban');
        log.info('Usage: mcctl ban <server> remove <player>');
        return 1;
      }
      return await unbanPlayer(options, bannedPlayersPath, containerName, isRunning);

    case 'ip':
      return await handleIpBan(options, bannedIpsPath, containerName, isRunning);

    default:
      log.error(`Unknown action: ${options.subCommand}`);
      log.info('Valid actions: list, add, remove, ip');
      return 1;
  }
}

/**
 * List banned players
 */
async function listBannedPlayers(
  options: BanCommandOptions,
  bannedPlayersPath: string,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  let players: BannedPlayerEntry[] = [];
  let source = 'json';

  if (isRunning) {
    const result = await execRconWithOutput(containerName, ['banlist', 'players']);
    if (result.code === 0) {
      // Parse output - format varies by MC version
      const match = result.output.match(/:\s*(.+)$/);
      if (match && match[1] && !match[1].includes('There are no')) {
        const names = match[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        players = names.map((name) => ({
          uuid: '',
          name,
          created: '',
          source: 'rcon',
          expires: 'forever',
          reason: '',
        }));
        source = 'rcon';
      }
    }
  }

  // Fallback to JSON
  if (players.length === 0 || source !== 'rcon') {
    players = await readBannedPlayersJson(bannedPlayersPath);
    source = 'json';
  }

  if (options.json) {
    console.log(
      JSON.stringify({
        server: options.serverName,
        running: isRunning,
        players: players.map((p) => ({
          name: p.name,
          reason: p.reason,
          created: p.created,
        })),
        source,
      })
    );
  } else {
    console.log(colors.bold(`\nBanned Players for ${options.serverName}:\n`));
    if (players.length === 0) {
      console.log('  (none)');
    } else {
      for (const player of players) {
        const reason = player.reason ? ` - ${player.reason}` : '';
        console.log(`  ${colors.red(player.name)}${colors.dim(reason)}`);
      }
    }
    console.log('');
    if (!isRunning) {
      log.warn('Server is not running. Showing bans from JSON file');
    }
  }

  return 0;
}

/**
 * Ban a player
 */
async function banPlayer(
  options: BanCommandOptions,
  bannedPlayersPath: string,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  const playerName = options.target!;
  const reason = options.reason || 'Banned by operator';

  // Check if already banned
  const bannedPlayers = await readBannedPlayersJson(bannedPlayersPath);
  if (findBannedPlayerByName(bannedPlayers, playerName)) {
    if (options.json) {
      console.log(
        JSON.stringify({
          success: false,
          error: 'already_banned',
          player: playerName,
          server: options.serverName,
        })
      );
    } else {
      log.warn(`${playerName} is already banned`);
    }
    return 0;
  }

  let rconSuccess = false;
  let rconMessage = '';

  if (isRunning) {
    const rconCmd = reason ? ['ban', playerName, reason] : ['ban', playerName];
    const result = await execRconWithOutput(containerName, rconCmd);
    rconSuccess = result.code === 0;
    rconMessage = result.output.trim();
  }

  // Update JSON file for non-running server
  if (!isRunning) {
    const newEntry: BannedPlayerEntry = {
      uuid: '', // Will be populated by server on start
      name: playerName,
      created: createTimestamp(),
      source: 'mcctl',
      expires: 'forever',
      reason,
    };
    bannedPlayers.push(newEntry);
    await writeBannedPlayersJson(bannedPlayersPath, bannedPlayers);
  }

  // Log audit
  const container = getContainer({ rootDir: options.root });
  await container.auditLogPort.log({
    action: AuditActionEnum.PLAYER_BAN,
    actor: 'cli:local',
    targetType: 'player',
    targetName: playerName,
    status: 'success',
    details: { server: options.serverName, reason },
    errorMessage: null,
  });

  if (options.json) {
    console.log(
      JSON.stringify({
        success: true,
        player: playerName,
        reason,
        server: options.serverName,
        rcon: isRunning ? { success: rconSuccess, message: rconMessage } : null,
        running: isRunning,
      })
    );
  } else {
    if (isRunning && rconSuccess) {
      console.log(colors.green(`${playerName} has been banned (applied immediately)`));
    } else if (isRunning && !rconSuccess) {
      console.log(colors.yellow(`RCON: ${rconMessage}`));
    } else {
      console.log(colors.yellow(`Server is not running.`));
      console.log(colors.green(`Ban saved. Will apply on next start.`));
    }
  }

  return 0;
}

/**
 * Unban a player
 */
async function unbanPlayer(
  options: BanCommandOptions,
  bannedPlayersPath: string,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  const playerName = options.target!;

  let rconSuccess = false;
  let rconMessage = '';

  if (isRunning) {
    const result = await execRconWithOutput(containerName, ['pardon', playerName]);
    rconSuccess = result.code === 0;
    rconMessage = result.output.trim();
  }

  // Update JSON file
  const bannedPlayers = await readBannedPlayersJson(bannedPlayersPath);
  const filteredPlayers = bannedPlayers.filter(
    (p) => p.name.toLowerCase() !== playerName.toLowerCase()
  );
  if (filteredPlayers.length !== bannedPlayers.length) {
    await writeBannedPlayersJson(bannedPlayersPath, filteredPlayers);
  }

  // Log audit
  const container = getContainer({ rootDir: options.root });
  await container.auditLogPort.log({
    action: AuditActionEnum.PLAYER_UNBAN,
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
      console.log(colors.green(`${playerName} has been unbanned (applied immediately)`));
    } else if (isRunning && !rconSuccess) {
      console.log(colors.yellow(`RCON: ${rconMessage}`));
    } else {
      console.log(colors.yellow(`Server is not running.`));
      console.log(colors.green(`Unban saved. Will apply on next start.`));
    }
  }

  return 0;
}

/**
 * Handle IP ban commands
 */
async function handleIpBan(
  options: BanCommandOptions,
  bannedIpsPath: string,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  const ipAction = options.ipAction;

  if (!ipAction) {
    log.error('IP action is required: list, add, remove');
    log.info('Usage: mcctl ban <server> ip <list|add|remove> [ip] [reason]');
    return 1;
  }

  switch (ipAction) {
    case 'list':
      return await listBannedIps(options, bannedIpsPath, containerName, isRunning);

    case 'add':
      if (!options.target) {
        log.error('IP address is required');
        log.info('Usage: mcctl ban <server> ip add <ip> [reason]');
        return 1;
      }
      return await banIp(options, bannedIpsPath, containerName, isRunning);

    case 'remove':
      if (!options.target) {
        log.error('IP address is required');
        log.info('Usage: mcctl ban <server> ip remove <ip>');
        return 1;
      }
      return await unbanIp(options, bannedIpsPath, containerName, isRunning);

    default:
      log.error(`Unknown IP action: ${ipAction}`);
      return 1;
  }
}

/**
 * List banned IPs
 */
async function listBannedIps(
  options: BanCommandOptions,
  bannedIpsPath: string,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  let ips: BannedIpEntry[] = [];
  let source = 'json';

  if (isRunning) {
    const result = await execRconWithOutput(containerName, ['banlist', 'ips']);
    if (result.code === 0) {
      const match = result.output.match(/:\s*(.+)$/);
      if (match && match[1] && !match[1].includes('There are no')) {
        const ipList = match[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        ips = ipList.map((ip) => ({
          ip,
          created: '',
          source: 'rcon',
          expires: 'forever',
          reason: '',
        }));
        source = 'rcon';
      }
    }
  }

  if (ips.length === 0 || source !== 'rcon') {
    ips = await readBannedIpsJson(bannedIpsPath);
    source = 'json';
  }

  if (options.json) {
    console.log(
      JSON.stringify({
        server: options.serverName,
        running: isRunning,
        ips: ips.map((entry) => ({
          ip: entry.ip,
          reason: entry.reason,
          created: entry.created,
        })),
        source,
      })
    );
  } else {
    console.log(colors.bold(`\nBanned IPs for ${options.serverName}:\n`));
    if (ips.length === 0) {
      console.log('  (none)');
    } else {
      for (const entry of ips) {
        const reason = entry.reason ? ` - ${entry.reason}` : '';
        console.log(`  ${colors.red(entry.ip)}${colors.dim(reason)}`);
      }
    }
    console.log('');
  }

  return 0;
}

/**
 * Ban an IP
 */
async function banIp(
  options: BanCommandOptions,
  bannedIpsPath: string,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  const ip = options.target!;
  const reason = options.reason || 'Banned by operator';

  const bannedIps = await readBannedIpsJson(bannedIpsPath);
  if (findBannedIp(bannedIps, ip)) {
    if (options.json) {
      console.log(
        JSON.stringify({
          success: false,
          error: 'already_banned',
          ip,
          server: options.serverName,
        })
      );
    } else {
      log.warn(`${ip} is already banned`);
    }
    return 0;
  }

  let rconSuccess = false;
  let rconMessage = '';

  if (isRunning) {
    const rconCmd = reason ? ['ban-ip', ip, reason] : ['ban-ip', ip];
    const result = await execRconWithOutput(containerName, rconCmd);
    rconSuccess = result.code === 0;
    rconMessage = result.output.trim();
  }

  if (!isRunning) {
    const newEntry: BannedIpEntry = {
      ip,
      created: createTimestamp(),
      source: 'mcctl',
      expires: 'forever',
      reason,
    };
    bannedIps.push(newEntry);
    await writeBannedIpsJson(bannedIpsPath, bannedIps);
  }

  if (options.json) {
    console.log(
      JSON.stringify({
        success: true,
        ip,
        reason,
        server: options.serverName,
        rcon: isRunning ? { success: rconSuccess, message: rconMessage } : null,
        running: isRunning,
      })
    );
  } else {
    if (isRunning && rconSuccess) {
      console.log(colors.green(`${ip} has been banned (applied immediately)`));
    } else if (!isRunning) {
      console.log(colors.yellow(`Server is not running.`));
      console.log(colors.green(`IP ban saved. Will apply on next start.`));
    }
  }

  return 0;
}

/**
 * Unban an IP
 */
async function unbanIp(
  options: BanCommandOptions,
  bannedIpsPath: string,
  containerName: string,
  isRunning: boolean
): Promise<number> {
  const ip = options.target!;

  let rconSuccess = false;
  let rconMessage = '';

  if (isRunning) {
    const result = await execRconWithOutput(containerName, ['pardon-ip', ip]);
    rconSuccess = result.code === 0;
    rconMessage = result.output.trim();
  }

  const bannedIps = await readBannedIpsJson(bannedIpsPath);
  const filteredIps = bannedIps.filter((entry) => entry.ip !== ip);
  if (filteredIps.length !== bannedIps.length) {
    await writeBannedIpsJson(bannedIpsPath, filteredIps);
  }

  if (options.json) {
    console.log(
      JSON.stringify({
        success: true,
        ip,
        server: options.serverName,
        rcon: isRunning ? { success: rconSuccess, message: rconMessage } : null,
        running: isRunning,
      })
    );
  } else {
    if (isRunning && rconSuccess) {
      console.log(colors.green(`${ip} has been unbanned (applied immediately)`));
    } else if (!isRunning) {
      console.log(colors.yellow(`Server is not running.`));
      console.log(colors.green(`IP unban saved. Will apply on next start.`));
    }
  }

  return 0;
}
