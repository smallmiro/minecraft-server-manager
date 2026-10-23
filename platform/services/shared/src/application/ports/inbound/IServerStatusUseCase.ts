import { Server, ServerStatus } from '../../../domain/index.js';

/**
 * Server Status Use Case - Inbound Port
 * Displays server status information
 *
 * @deprecated Unused by the CLI. Use `mcctl status` / IServerRepository directly. Removed in v3.0.0 (#736).
 */
export interface IServerStatusUseCase {
  /**
   * Get status of all servers
   */
  execute(): Promise<ServerStatusResult[]>;

  /**
   * Get status of a specific server
   */
  executeForServer(name: string): Promise<ServerStatusResult>;

  /**
   * Get status in JSON format
   */
  executeAsJson(): Promise<string>;
}

/**
 * Server status result
 */
export interface ServerStatusResult {
  name: string;
  containerName: string;
  hostname: string;
  status: ServerStatus;
  type: string;
  version: string;
  playerCount: number;
  memory?: string;
  uptime?: string;
}
