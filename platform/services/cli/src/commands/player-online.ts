import { Paths, log, colors, getRunningMcContainers } from '@minecraft-docker/shared';
import { ShellExecutor } from '../lib/shell.js';
import { isContainerRunning, execRconWithOutput, getContainerName } from '../lib/rcon.js';

export interface PlayerOnlineCommandOptions {
  root?: string;
  serverName?: string;
  all?: boolean;
  json?: boolean;
}

interface OnlinePlayer {
  name: string;
  server: string;
}

interface ServerOnlineInfo {
  server: string;
  running: boolean;
  players: string[];
  playerCount: number;
  maxPlayers: number;
}

/**
 * Show online players
 */
export async function playerOnlineCommand(options: PlayerOnlineCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  if (options.all) {
    return await listAllOnlinePlayers(paths, options);
  }

  if (!options.serverName) {
    log.error('Server name is required (or use --all for all servers)');
    log.info('Usage: mcctl player online <server>');
    log.info('       mcctl player online --all');
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

  if (!isRunning) {
    if (options.json) {
      console.log(
        JSON.stringify({
          server: options.serverName,
          running: false,
          players: [],
          playerCount: 0,
        })
      );
    } else {
      log.warn(`Server '${options.serverName}' is not running`);
    }
    return 0;
  }

  const serverInfo = await getServerOnlineInfo(containerName, options.serverName);

  if (options.json) {
    console.log(JSON.stringify(serverInfo));
  } else {
    console.log(colors.bold(`\nOnline Players for ${options.serverName}:\n`));
    console.log(
      `  Status: ${colors.green('Running')} (${serverInfo.playerCount}/${serverInfo.maxPlayers})`
    );
    console.log('');
    if (serverInfo.players.length === 0) {
      console.log('  No players online');
    } else {
      for (const player of serverInfo.players) {
        console.log(`  ${colors.cyan(player)}`);
      }
    }
    console.log('');
  }

  return 0;
}

/**
 * List online players from all running servers
 */
async function listAllOnlinePlayers(
  paths: Paths,
  options: PlayerOnlineCommandOptions
): Promise<number> {
  const containers = getRunningMcContainers();

  if (containers.length === 0) {
    if (options.json) {
      console.log(
        JSON.stringify({
          servers: [],
          totalPlayers: 0,
        })
      );
    } else {
      log.warn('No running servers found');
    }
    return 0;
  }

  const serverInfos: ServerOnlineInfo[] = [];
  const allPlayers: OnlinePlayer[] = [];

  for (const container of containers) {
    const serverName = container.replace(/^mc-/, '');
    const info = await getServerOnlineInfo(container, serverName);
    serverInfos.push(info);

    for (const player of info.players) {
      allPlayers.push({ name: player, server: serverName });
    }
  }

  if (options.json) {
    console.log(
      JSON.stringify({
        servers: serverInfos,
        totalPlayers: allPlayers.length,
        players: allPlayers,
      })
    );
  } else {
    console.log(colors.bold('\nOnline Players (All Servers):\n'));

    if (allPlayers.length === 0) {
      console.log('  No players online on any server');
    } else {
      console.log(`  Total: ${colors.cyan(String(allPlayers.length))} players\n`);

      for (const info of serverInfos) {
        if (info.players.length > 0) {
          console.log(
            `  ${colors.bold(info.server)} (${info.playerCount}/${info.maxPlayers}):`
          );
          for (const player of info.players) {
            console.log(`    ${colors.cyan(player)}`);
          }
          console.log('');
        }
      }
    }
  }

  return 0;
}

/**
 * Get online player information for a server
 */
async function getServerOnlineInfo(
  containerName: string,
  serverName: string
): Promise<ServerOnlineInfo> {
  const result = await execRconWithOutput(containerName, ['list']);

  let players: string[] = [];
  let playerCount = 0;
  let maxPlayers = 20;

  if (result.code === 0) {
    // Parse "There are X of a max of Y players online: player1, player2"
    // or "There are X/Y players online: player1, player2"
    const countMatch = result.output.match(
      /There are (\d+)(?:\s+of a max of\s+|\/)(\d+) players? online/i
    );
    if (countMatch && countMatch[1] && countMatch[2]) {
      playerCount = parseInt(countMatch[1], 10);
      maxPlayers = parseInt(countMatch[2], 10);
    }

    // Extract player names after the colon
    const playersMatch = result.output.match(/:\s*(.+)$/);
    if (playersMatch && playersMatch[1]) {
      players = playersMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  return {
    server: serverName,
    running: true,
    players,
    playerCount,
    maxPlayers,
  };
}
