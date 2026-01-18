import { Server, ServerStatus } from '../../../domain/index.js';

/**
 * Server Repository Port - Outbound Port
 * Interface for server data access
 */
export interface IServerRepository {
  /**
   * Get all servers
   */
  findAll(): Promise<Server[]>;

  /**
   * Find server by name
   */
  findByName(name: string): Promise<Server | null>;

  /**
   * Check if server exists
   */
  exists(name: string): Promise<boolean>;

  /**
   * Get server status
   */
  getStatus(name: string): Promise<ServerStatus>;

  /**
   * Get server configuration from config.env
   */
  getConfig(name: string): Promise<ServerConfigData | null>;

  /**
   * List server names
   */
  listNames(): Promise<string[]>;

  /**
   * Get running servers
   */
  findRunning(): Promise<Server[]>;

  /**
   * Get stopped servers
   */
  findStopped(): Promise<Server[]>;
}

/**
 * Server configuration data from config.env
 */
export interface ServerConfigData {
  name: string;
  type: string;
  version: string;
  memory?: string;
  rconPassword?: string;
  seed?: string;
  worldName?: string;
  worldUrl?: string;
  customEnv?: Record<string, string>;
}
