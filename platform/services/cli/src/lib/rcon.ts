import { ServerName, type ContainerStatus } from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/index.js';

/**
 * Result of an RCON command execution
 */
export interface RconResult {
  code: number;
  output: string;
}

/**
 * The port argument for a container name: the ServerName of `mc-<server>`,
 * or the name itself (v2 workload form) when it is not a valid server container.
 */
export function serverOfContainer(containerName: string): ServerName | string {
  if (!containerName.startsWith('mc-')) return containerName;
  try {
    return ServerName.fromExisting(containerName.slice(3));
  } catch {
    return containerName;
  }
}

/** States where `docker inspect -f {{.State.Running}}` prints true. */
const RUNNING_STATES: ContainerStatus[] = ['running', 'paused', 'restarting'];

/**
 * Check if a Docker container is running
 */
export async function isContainerRunning(containerName: string): Promise<boolean> {
  const status = await getContainer().containerRuntime.getStatusAsync(serverOfContainer(containerName));
  return RUNNING_STATES.includes(status);
}

/**
 * Execute RCON command and capture output
 */
export async function execRconWithOutput(
  containerName: string,
  command: string[]
): Promise<RconResult> {
  const result = await getContainer().serverConsolePort.command(serverOfContainer(containerName), command);
  return { code: result.exitCode, output: result.stdout || result.stderr };
}

/**
 * Get container name from server name
 * Ensures the container name has the 'mc-' prefix
 */
export function getContainerName(serverName: string): string {
  return serverName.startsWith('mc-') ? serverName : `mc-${serverName}`;
}

/**
 * Online players result
 */
export interface OnlinePlayersResult {
  count: number;
  maxPlayers: number;
  players: string[];
}

/**
 * Get online players from a server
 */
export async function getOnlinePlayers(containerName: string): Promise<OnlinePlayersResult> {
  const result = await execRconWithOutput(containerName, ['list']);

  if (result.code !== 0) {
    return { count: 0, maxPlayers: 0, players: [] };
  }

  // Parse output: "There are X of a max Y players online: player1, player2, player3"
  // or "There are 0 of a max Y players online:"
  const match = result.output.match(/There are (\d+) of a max (\d+) players online:?\s*(.*)?/i);

  if (!match) {
    return { count: 0, maxPlayers: 0, players: [] };
  }

  const countStr = match[1];
  const maxStr = match[2];
  const count = countStr ? parseInt(countStr, 10) : 0;
  const maxPlayers = maxStr ? parseInt(maxStr, 10) : 0;
  const playerList = match[3]?.trim();

  const players = playerList
    ? playerList.split(',').map(p => p.trim()).filter(Boolean)
    : [];

  return { count, maxPlayers, players };
}

/**
 * Get online player count (shortcut)
 */
export async function getOnlinePlayerCount(containerName: string): Promise<number> {
  const result = await getOnlinePlayers(containerName);
  return result.count;
}

/**
 * Check if a player is online on a specific server
 */
export async function isPlayerOnline(containerName: string, playerName: string): Promise<boolean> {
  const result = await getOnlinePlayers(containerName);
  return result.players.some(p => p.toLowerCase() === playerName.toLowerCase());
}

/**
 * Check if player is whitelisted
 */
export async function isPlayerWhitelisted(containerName: string, playerName: string): Promise<boolean> {
  const result = await execRconWithOutput(containerName, ['whitelist', 'list']);

  if (result.code !== 0) {
    return false;
  }

  // Parse output: "There are X whitelisted players: player1, player2"
  const players = result.output
    .split(':')[1]
    ?.split(',')
    .map(p => p.trim().toLowerCase())
    .filter(Boolean) ?? [];

  return players.includes(playerName.toLowerCase());
}

/**
 * Check if player is an operator
 */
export async function isPlayerOperator(containerName: string, playerName: string): Promise<boolean> {
  const result = await execRconWithOutput(containerName, ['op', 'list']);

  if (result.code !== 0) {
    // Try alternative: read ops.json parsing would need file access
    return false;
  }

  // Parse output varies by server, try common format
  const output = result.output.toLowerCase();
  return output.includes(playerName.toLowerCase());
}

/**
 * Check if player is banned
 */
export async function isPlayerBanned(containerName: string, playerName: string): Promise<boolean> {
  const result = await execRconWithOutput(containerName, ['banlist', 'players']);

  if (result.code !== 0) {
    return false;
  }

  const output = result.output.toLowerCase();
  return output.includes(playerName.toLowerCase());
}
