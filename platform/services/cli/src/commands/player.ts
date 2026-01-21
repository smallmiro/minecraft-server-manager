/**
 * Unified player management command
 * Interactive mode for player management actions
 */

import { join } from 'node:path';
import { intro, outro, isCancel, spinner, note } from '@clack/prompts';
import { Paths, log, colors } from '@minecraft-docker/shared';
import { getPlayerCache } from '../lib/player-cache.js';
import { getMojangApiClient, getOfflinePlayerInfo, type PlayerInfo } from '../lib/mojang-api.js';
import {
  selectServer,
  getServerList,
  selectPlayer,
  promptPlayerName,
  selectAction,
  promptContinue,
  type PlayerAction,
} from '../lib/prompts/index.js';
import {
  getContainerName,
  execRconWithOutput,
  isPlayerWhitelisted,
  isPlayerOperator,
  isPlayerBanned,
  isPlayerOnline as checkPlayerOnline,
} from '../lib/rcon.js';

export interface PlayerCommandOptions {
  root?: string;
  subCommand?: 'info' | 'cache';
  serverName?: string;
  playerName?: string;
  cacheAction?: 'clear' | 'stats';
  offline?: boolean;
  json?: boolean;
}

/**
 * Execute player management command
 */
export async function playerCommand(options: PlayerCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  // Handle cache subcommand
  if (options.subCommand === 'cache') {
    return handleCacheCommand(options);
  }

  // Handle info subcommand (direct lookup)
  if (options.subCommand === 'info' && options.playerName) {
    return handleInfoCommand(options);
  }

  // Interactive mode
  return handleInteractiveMode(options);
}

/**
 * Handle player info lookup
 */
async function handleInfoCommand(options: PlayerCommandOptions): Promise<number> {
  const { playerName, offline = false, json = false } = options;

  if (!playerName) {
    log.error('Player name is required');
    return 1;
  }

  const s = spinner();
  s.start(`Looking up ${playerName}...`);

  try {
    let info: PlayerInfo | null;

    if (offline) {
      info = getOfflinePlayerInfo(playerName);
    } else {
      const cache = getPlayerCache();
      info = await cache.lookupWithProfile(playerName);
    }

    s.stop();

    if (!info) {
      if (json) {
        console.log(JSON.stringify({ error: 'Player not found', player: playerName }));
      } else {
        log.error(`Player '${playerName}' not found`);
      }
      return 1;
    }

    if (json) {
      console.log(JSON.stringify({
        name: info.name,
        uuid: info.uuid,
        uuidNoDashes: info.uuidNoDashes,
        skinUrl: info.skinUrl,
        source: info.source,
      }));
    } else {
      console.log('');
      console.log(colors.bold(`Player: ${info.name}`));
      console.log(`  UUID: ${colors.cyan(info.uuid)}`);
      if (info.skinUrl) {
        console.log(`  Skin: ${colors.dim(info.skinUrl)}`);
      }
      console.log(`  Source: ${info.source === 'cache' ? 'cached' : info.source}`);
      console.log('');
    }

    return 0;
  } catch (error) {
    s.stop();
    const message = error instanceof Error ? error.message : String(error);
    if (json) {
      console.log(JSON.stringify({ error: message, player: playerName }));
    } else {
      log.error(message);
    }
    return 1;
  }
}

/**
 * Handle cache management commands
 */
async function handleCacheCommand(options: PlayerCommandOptions): Promise<number> {
  const { cacheAction, json = false } = options;
  const cache = getPlayerCache();

  if (cacheAction === 'clear') {
    await cache.clear();
    if (json) {
      console.log(JSON.stringify({ success: true, action: 'clear' }));
    } else {
      log.info('Player cache cleared');
    }
    return 0;
  }

  if (cacheAction === 'stats') {
    const stats = await cache.getStats();
    if (json) {
      console.log(JSON.stringify(stats));
    } else {
      console.log('');
      console.log(colors.bold('Player Cache Statistics'));
      console.log(`  Players cached: ${colors.cyan(String(stats.playerCount))}`);
      console.log(`  Cache size: ${colors.cyan(formatBytes(stats.cacheSize))}`);
      if (stats.oldestEntry) {
        console.log(`  Oldest entry: ${colors.dim(new Date(stats.oldestEntry).toLocaleString())}`);
      }
      if (stats.newestEntry) {
        console.log(`  Newest entry: ${colors.dim(new Date(stats.newestEntry).toLocaleString())}`);
      }
      console.log('');
    }
    return 0;
  }

  log.error('Unknown cache action. Use: clear, stats');
  return 1;
}

/**
 * Handle interactive player management mode
 */
async function handleInteractiveMode(options: PlayerCommandOptions): Promise<number> {
  intro(colors.cyan('Player Management'));

  try {
    // Step 1: Select server (if not provided)
    let serverName = options.serverName;

    if (!serverName) {
      const servers = await getServerList();
      const selected = await selectServer({
        message: 'Select server:',
        servers: servers.map(s => ({
          name: s.name,
          containerName: s.containerName,
          status: s.status,
        })),
        allowOffline: false,
      });

      if (!selected) {
        outro(colors.dim('Cancelled'));
        return 0;
      }

      serverName = selected;
    }

    const containerName = getContainerName(serverName);

    // Main interaction loop
    while (true) {
      // Step 2: Select player
      const selectedPlayer = await selectPlayer({
        containerName,
        message: 'Select player:',
        allowManualEntry: true,
      });

      if (!selectedPlayer) {
        outro(colors.dim('Cancelled'));
        return 0;
      }

      // Step 3: Action loop for selected player
      let continueWithPlayer = true;

      while (continueWithPlayer) {
        // Get player status for action filtering
        const [isWhitelisted, isOperator, isBanned] = await Promise.all([
          isPlayerWhitelisted(containerName, selectedPlayer.name).catch(() => undefined),
          isPlayerOperator(containerName, selectedPlayer.name).catch(() => undefined),
          isPlayerBanned(containerName, selectedPlayer.name).catch(() => undefined),
        ]);

        // Step 4: Select action
        const action = await selectAction({
          playerName: selectedPlayer.name,
          isOnline: selectedPlayer.isOnline,
          isWhitelisted,
          isOperator,
          isBanned,
        });

        if (!action || action === 'exit') {
          outro(colors.dim('Goodbye!'));
          return 0;
        }

        if (action === 'back') {
          continueWithPlayer = false;
          continue;
        }

        // Execute the action
        const success = await executeAction(action, containerName, selectedPlayer.name);

        if (success) {
          // Ask if user wants to perform another action
          const next = await promptContinue(selectedPlayer.name);

          if (!next || next === 'exit') {
            outro(colors.dim('Goodbye!'));
            return 0;
          }

          if (next === 'back') {
            continueWithPlayer = false;
          }
          // 'another' continues the action loop
        }
      }
    }
  } catch (error) {
    if (isCancel(error)) {
      outro(colors.dim('Cancelled'));
      return 0;
    }

    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * Execute a player action
 */
async function executeAction(action: PlayerAction, containerName: string, playerName: string): Promise<boolean> {
  const s = spinner();

  try {
    switch (action) {
      case 'info': {
        s.start(`Looking up ${playerName}...`);
        const cache = getPlayerCache();
        const info = await cache.lookupWithProfile(playerName);
        s.stop();

        if (info) {
          note(
            `Name: ${info.name}\n` +
            `UUID: ${info.uuid}\n` +
            (info.skinUrl ? `Skin: ${info.skinUrl}\n` : '') +
            `Source: ${info.source}`,
            `Player Info: ${playerName}`
          );
        } else {
          log.warn(`Player '${playerName}' not found in Mojang database`);
        }
        return true;
      }

      case 'whitelist-add': {
        s.start(`Adding ${playerName} to whitelist...`);
        const result = await execRconWithOutput(containerName, ['whitelist', 'add', playerName]);
        s.stop();

        if (result.code === 0) {
          log.info(result.output.trim() || `${playerName} added to whitelist`);
        } else {
          log.error(result.output.trim() || 'Failed to add to whitelist');
        }
        return result.code === 0;
      }

      case 'whitelist-remove': {
        s.start(`Removing ${playerName} from whitelist...`);
        const result = await execRconWithOutput(containerName, ['whitelist', 'remove', playerName]);
        s.stop();

        if (result.code === 0) {
          log.info(result.output.trim() || `${playerName} removed from whitelist`);
        } else {
          log.error(result.output.trim() || 'Failed to remove from whitelist');
        }
        return result.code === 0;
      }

      case 'op-add': {
        s.start(`Adding ${playerName} as operator...`);
        const result = await execRconWithOutput(containerName, ['op', playerName]);
        s.stop();

        if (result.code === 0) {
          log.info(result.output.trim() || `${playerName} is now an operator`);
        } else {
          log.error(result.output.trim() || 'Failed to add as operator');
        }
        return result.code === 0;
      }

      case 'op-remove': {
        s.start(`Removing ${playerName} as operator...`);
        const result = await execRconWithOutput(containerName, ['deop', playerName]);
        s.stop();

        if (result.code === 0) {
          log.info(result.output.trim() || `${playerName} is no longer an operator`);
        } else {
          log.error(result.output.trim() || 'Failed to remove as operator');
        }
        return result.code === 0;
      }

      case 'ban': {
        s.start(`Banning ${playerName}...`);
        const result = await execRconWithOutput(containerName, ['ban', playerName]);
        s.stop();

        if (result.code === 0) {
          log.info(result.output.trim() || `${playerName} has been banned`);
        } else {
          log.error(result.output.trim() || 'Failed to ban player');
        }
        return result.code === 0;
      }

      case 'unban': {
        s.start(`Unbanning ${playerName}...`);
        const result = await execRconWithOutput(containerName, ['pardon', playerName]);
        s.stop();

        if (result.code === 0) {
          log.info(result.output.trim() || `${playerName} has been unbanned`);
        } else {
          log.error(result.output.trim() || 'Failed to unban player');
        }
        return result.code === 0;
      }

      case 'kick': {
        s.start(`Kicking ${playerName}...`);
        const result = await execRconWithOutput(containerName, ['kick', playerName]);
        s.stop();

        if (result.code === 0) {
          log.info(result.output.trim() || `${playerName} has been kicked`);
        } else {
          log.error(result.output.trim() || 'Failed to kick player');
        }
        return result.code === 0;
      }

      default:
        return false;
    }
  } catch (error) {
    s.stop();
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return false;
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
