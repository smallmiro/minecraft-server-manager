import type { PlayerListResult } from '../../../types/index.js';
import type { ServerName } from '../../../domain/value-objects/ServerName.js';

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
 * RCON access to a server workload. `name` is the server (#665); a string is the
 * container name itself (`mc-<server>`, @deprecated, narrowed in v3.0.0 #736).
 */
export interface IServerConsolePort {
  /** `list` via RCON. null when offline or unparseable. */
  listPlayers(name: ServerName | string): Promise<PlayerListResult | null>;
  /**
   * Runs one RCON command. Never rejects (spawn error → exitCode 1, stderr = message).
   * `signal` aborts the local process (#732). For Docker that kills the `docker exec`
   * client; rcon-cli inside the container does not necessarily stop.
   */
  command(name: ServerName | string, args: string[], options?: { signal?: AbortSignal }): Promise<ConsoleCommandResult>;
  /** Address and credentials for a direct RCON TCP session (`mcctl rcon`). null when unknown. */
  getEndpoint(name: ServerName | string): Promise<ConsoleEndpoint | null>;
}
