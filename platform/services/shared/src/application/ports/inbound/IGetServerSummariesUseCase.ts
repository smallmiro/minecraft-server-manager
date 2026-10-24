import type { ContainerStats, PlayerListResult, ServerInfo } from '../../../types/index.js';

/**
 * One server of the list summary (#764): the base list item, unchanged, plus
 * config.env fields and, for a running server, live players and memory.
 */
export interface ServerSummaryItem extends ServerInfo {
  /** config.env TYPE (PAPER when unset). Absent without config.env. */
  type?: string;
  /** config.env VERSION (LATEST when unset). Absent without config.env. */
  version?: string;
  /** config.env MEMORY. Absent when unset or without config.env. */
  memory?: string;
  /**
   * Running servers only. null when RCON failed, timed out or could not be
   * parsed; absent for any other status.
   */
  players?: PlayerListResult | null;
  /** Running servers only, when the container stats answered in time. Bytes. */
  stats?: Pick<ContainerStats, 'memoryUsage' | 'memoryLimit'>;
}

export interface ServerSummaryTotals {
  /** Sum of `players.online` over the servers whose players are known. */
  playersOnline: number;
  /** Sum of `players.max` over the servers whose players are known. */
  playersMax: number;
  /** Servers whose status is 'running' (including those with players: null). */
  running: number;
}

export interface ServerSummariesResult {
  servers: ServerSummaryItem[];
  totals: ServerSummaryTotals;
}

/**
 * Server list summary - Inbound Port (#764)
 *
 * Enriches the server list (as `getAllServers()` + `getServerInfoFromConfig()`
 * build it) in one call, so a dashboard needs no per-server detail request.
 */
export interface IGetServerSummariesUseCase {
  /**
   * `servers` keep their order and base fields. Never rejects because of a
   * single server: a failed probe only affects that server.
   */
  execute(servers: ServerInfo[]): Promise<ServerSummariesResult>;
}
