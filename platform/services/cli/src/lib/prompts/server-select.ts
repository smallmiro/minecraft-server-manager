/**
 * Server selection prompt component
 * Reusable prompt for selecting a Minecraft server
 */

import { select, isCancel } from '@clack/prompts';
import { colors, log, type ContainerStatus } from '@minecraft-docker/shared';
import { getContainer } from '../../infrastructure/index.js';
import { getOnlinePlayerCount, serverOfContainer } from '../rcon.js';

export interface ServerInfo {
  name: string;
  containerName: string;
  status: 'running' | 'stopped' | 'unknown';
  playerCount?: number;
}

export interface ServerSelectOptions {
  message?: string;
  servers: ServerInfo[];
  includeAllOption?: boolean;
  allowOffline?: boolean;
}

/**
 * Prompt user to select a server
 * Returns the server name or null if cancelled
 */
export async function selectServer(options: ServerSelectOptions): Promise<string | null> {
  const { servers, message = 'Select server:', includeAllOption = false, allowOffline = false } = options;

  if (servers.length === 0) {
    log.error('No servers found');
    return null;
  }

  // Filter to running servers only if not allowing offline
  const availableServers = allowOffline ? servers : servers.filter(s => s.status === 'running');

  if (availableServers.length === 0) {
    log.error('No running servers found');
    return null;
  }

  // Fetch player counts for running servers
  const serversWithPlayers = await Promise.all(
    availableServers.map(async (server) => {
      if (server.status === 'running' && server.playerCount === undefined) {
        try {
          const count = await getOnlinePlayerCount(server.containerName);
          return { ...server, playerCount: count };
        } catch {
          return { ...server, playerCount: 0 };
        }
      }
      return server;
    })
  );

  // Build options list
  const selectOptions: Array<{ value: string; label: string; hint?: string }> = [];

  if (includeAllOption) {
    selectOptions.push({
      value: '__all__',
      label: 'All servers',
      hint: `${serversWithPlayers.length} servers`,
    });
  }

  for (const server of serversWithPlayers) {
    const statusLabel = server.status === 'running'
      ? colors.green('online')
      : colors.dim('offline');

    const playerLabel = server.status === 'running' && server.playerCount !== undefined
      ? `${server.playerCount} player${server.playerCount !== 1 ? 's' : ''}`
      : '';

    selectOptions.push({
      value: server.name,
      label: server.name,
      hint: [statusLabel, playerLabel].filter(Boolean).join(', '),
    });
  }

  const selected = await select({
    message,
    options: selectOptions,
  });

  if (isCancel(selected)) {
    return null;
  }

  return selected as string;
}

/** Container states that `docker ps` shows as "Up". */
const UP_STATES: ContainerStatus[] = ['running', 'paused'];

/**
 * Get list of servers from the container runtime
 */
export async function getServerList(): Promise<ServerInfo[]> {
  try {
    const runtime = getContainer().containerRuntime;
    return runtime.list().map((containerName) => ({
      name: containerName.replace('mc-', ''),
      containerName,
      status: UP_STATES.includes(runtime.getStatus(serverOfContainer(containerName))) ? 'running' : 'stopped',
    }));
  } catch {
    return [];
  }
}
