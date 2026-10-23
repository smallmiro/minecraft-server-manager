import type { PlayerListResult } from '../../../types/index.js';

export interface ConsoleCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ConsoleEndpoint {
  host: string;
  port: number;
  password: string;
}

/**
 * Server Console Port - Outbound Port (ADR-0001)
 *
 * RCON access to a server workload. `name` is the Docker container name in D1.
 */
export interface IServerConsolePort {
  /** `list` via RCON. null when offline or unparseable. */
  listPlayers(name: string): Promise<PlayerListResult | null>;
  /**
   * Runs one RCON command. Never rejects (spawn error → exitCode 1, stderr = message).
   * `signal` aborts the local process (#732). For Docker that kills the `docker exec`
   * client; rcon-cli inside the container does not necessarily stop.
   */
  command(name: string, args: string[], options?: { signal?: AbortSignal }): Promise<ConsoleCommandResult>;
  /** Address and credentials for a direct RCON TCP session (`mcctl rcon`). null when unknown. */
  getEndpoint(name: string): Promise<ConsoleEndpoint | null>;
}
