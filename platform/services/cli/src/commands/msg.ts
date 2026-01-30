import { Paths, log, colors, getRunningMcContainers } from '@minecraft-docker/shared';
import { ShellExecutor } from '../lib/shell.js';
import { execRconWithOutput, getContainerName } from '../lib/rcon.js';
import * as p from '@clack/prompts';

export interface MsgCommandOptions {
  root?: string;
  server?: string;
  player?: string;
  all?: boolean;
  message?: string;
}

interface ServerPlayer {
  server: string;
  container: string;
  player: string;
}

/**
 * Send message to players
 */
export async function msgCommand(options: MsgCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  // If --all flag with message, broadcast to all servers
  if (options.all && options.message) {
    if (options.player) {
      // Find player across all servers and send private message
      return await sendToPlayerAcrossServers(options.player, options.message);
    } else {
      // Broadcast to all servers
      return await broadcastToAllServers(options.message);
    }
  }

  // If server specified with message
  if (options.server && options.message) {
    const shell = new ShellExecutor(paths);
    const config = shell.readConfig(options.server);

    if (config === null) {
      log.error(`Server '${options.server}' not found`);
      return 1;
    }

    const containerName = getContainerName(options.server);

    if (options.player) {
      // Send private message to specific player
      return await sendPrivateMessage(containerName, options.player, options.message);
    } else {
      // Broadcast to all players on server
      return await broadcastToServer(containerName, options.server, options.message);
    }
  }

  // Interactive mode
  return await interactiveMode(paths);
}

/**
 * Interactive mode for sending messages
 */
async function interactiveMode(paths: Paths): Promise<number> {
  const containers = getRunningMcContainers();

  if (containers.length === 0) {
    log.error('No running servers found');
    return 1;
  }

  p.intro(colors.cyan('Send Message'));

  // Select target scope
  const scope = await p.select({
    message: 'Select target scope',
    options: [
      { value: 'server', label: 'Specific server' },
      { value: 'all', label: 'All servers' },
    ],
  });

  if (p.isCancel(scope)) {
    p.cancel('Cancelled');
    return 0;
  }

  let targetServer: string | undefined;
  let targetContainer: string | undefined;

  if (scope === 'server') {
    // Select server
    const serverOptions = containers.map((c) => ({
      value: c,
      label: c.replace(/^mc-/, ''),
    }));

    const server = await p.select({
      message: 'Select server',
      options: serverOptions,
    });

    if (p.isCancel(server)) {
      p.cancel('Cancelled');
      return 0;
    }

    targetContainer = server as string;
    targetServer = targetContainer.replace(/^mc-/, '');
  }

  // Select target type
  const targetType = await p.select({
    message: 'Send to',
    options: [
      { value: 'all', label: 'All players (broadcast)' },
      { value: 'player', label: 'Specific player (private message)' },
    ],
  });

  if (p.isCancel(targetType)) {
    p.cancel('Cancelled');
    return 0;
  }

  let targetPlayer: string | undefined;

  if (targetType === 'player') {
    // Get online players
    const onlinePlayers = await getOnlinePlayersForSelection(
      scope === 'all' ? containers : [targetContainer!]
    );

    if (onlinePlayers.length === 0) {
      log.warn('No players online');
      p.outro('No players to message');
      return 0;
    }

    const playerOptions = onlinePlayers.map((sp) => ({
      value: sp,
      label: scope === 'all' ? `${sp.player} (${sp.server})` : sp.player,
    }));

    const selectedPlayer = await p.select({
      message: 'Select player',
      options: playerOptions,
    });

    if (p.isCancel(selectedPlayer)) {
      p.cancel('Cancelled');
      return 0;
    }

    const selected = selectedPlayer as ServerPlayer;
    targetPlayer = selected.player;
    if (scope === 'all') {
      targetContainer = selected.container;
      targetServer = selected.server;
    }
  }

  // Enter message
  const message = await p.text({
    message: 'Enter message',
    placeholder: 'Hello!',
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Message cannot be empty';
      }
      return undefined;
    },
  });

  if (p.isCancel(message)) {
    p.cancel('Cancelled');
    return 0;
  }

  const messageText = message as string;

  // Send message
  if (targetType === 'player' && targetPlayer && targetContainer) {
    const result = await sendPrivateMessage(targetContainer, targetPlayer, messageText);
    if (result === 0) {
      p.outro(colors.green(`Message sent to ${targetPlayer}`));
    }
    return result;
  } else if (scope === 'all') {
    const result = await broadcastToAllServers(messageText);
    if (result === 0) {
      p.outro(colors.green('Message broadcast to all servers'));
    }
    return result;
  } else if (targetContainer && targetServer) {
    const result = await broadcastToServer(targetContainer, targetServer, messageText);
    if (result === 0) {
      p.outro(colors.green(`Message broadcast to ${targetServer}`));
    }
    return result;
  }

  return 1;
}

/**
 * Get online players for selection
 */
async function getOnlinePlayersForSelection(containers: string[]): Promise<ServerPlayer[]> {
  const players: ServerPlayer[] = [];

  for (const container of containers) {
    const serverName = container.replace(/^mc-/, '');
    const result = await execRconWithOutput(container, ['list']);

    if (result.code === 0) {
      const output = result.output.trim();
      const playersMatch = output.match(/:\s*(.+)$/);

      if (playersMatch && playersMatch[1]) {
        const playerNames = playersMatch[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        for (const playerName of playerNames) {
          players.push({
            server: serverName,
            container,
            player: playerName,
          });
        }
      }
    }
  }

  return players;
}

/**
 * Send private message to a player
 */
async function sendPrivateMessage(
  container: string,
  player: string,
  message: string
): Promise<number> {
  const result = await execRconWithOutput(container, ['tell', player, message]);

  if (result.code !== 0) {
    log.error(`Failed to send message: ${result.output}`);
    return 1;
  }

  console.log(colors.green(`[${container.replace(/^mc-/, '')}] `) + `Whispered to ${player}: ${message}`);
  return 0;
}

/**
 * Broadcast message to all players on a server
 */
async function broadcastToServer(
  container: string,
  serverName: string,
  message: string
): Promise<number> {
  const result = await execRconWithOutput(container, ['say', message]);

  if (result.code !== 0) {
    log.error(`Failed to broadcast: ${result.output}`);
    return 1;
  }

  console.log(colors.green(`[${serverName}] `) + `Broadcast: ${message}`);
  return 0;
}

/**
 * Broadcast message to all running servers
 */
async function broadcastToAllServers(message: string): Promise<number> {
  const containers = getRunningMcContainers();

  if (containers.length === 0) {
    log.error('No running servers found');
    return 1;
  }

  let successCount = 0;
  let failCount = 0;

  for (const container of containers) {
    const serverName = container.replace(/^mc-/, '');
    const result = await execRconWithOutput(container, ['say', message]);

    if (result.code === 0) {
      console.log(colors.green(`[${serverName}] `) + `Broadcast: ${message}`);
      successCount++;
    } else {
      log.error(`[${serverName}] Failed to broadcast`);
      failCount++;
    }
  }

  console.log('');
  console.log(
    colors.bold(`Broadcast complete: `) +
      colors.green(`${successCount} success`) +
      (failCount > 0 ? `, ${colors.red(`${failCount} failed`)}` : '')
  );

  return failCount > 0 ? 1 : 0;
}

/**
 * Find player across all servers and send private message
 */
async function sendToPlayerAcrossServers(player: string, message: string): Promise<number> {
  const containers = getRunningMcContainers();

  if (containers.length === 0) {
    log.error('No running servers found');
    return 1;
  }

  // Find player
  for (const container of containers) {
    const result = await execRconWithOutput(container, ['list']);

    if (result.code === 0) {
      const output = result.output.trim().toLowerCase();
      if (output.includes(player.toLowerCase())) {
        // Found player on this server
        const serverName = container.replace(/^mc-/, '');
        console.log(colors.dim(`Found ${player} on ${serverName}`));
        return await sendPrivateMessage(container, player, message);
      }
    }
  }

  log.error(`Player '${player}' not found on any server`);
  return 1;
}
