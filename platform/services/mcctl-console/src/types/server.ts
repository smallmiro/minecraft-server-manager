/**
 * Server-related types for mcctl-console
 *
 * These types mirror the mcctl-api responses for type-safe data fetching.
 */

/**
 * Server status states
 */
export type ServerStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'error';

/**
 * Server health states
 */
export type ServerHealth = 'healthy' | 'unhealthy' | 'starting' | 'unknown';

/**
 * Server type (Minecraft distribution)
 */
export type ServerType = 'VANILLA' | 'PAPER' | 'FORGE' | 'FABRIC' | 'NEOFORGE' | 'SPIGOT' | 'BUKKIT';

/**
 * Player information
 */
export interface Player {
  name: string;
  uuid: string;
  joinedAt?: string;
}

/**
 * Players info for server
 */
export interface PlayersInfo {
  online: number;
  max: number;
  list: Player[];
}

/**
 * Memory info for server
 */
export interface MemoryInfo {
  used?: string;
  allocated: string;
}

/**
 * Server resource usage
 */
export interface ServerResources {
  cpu: number;       // CPU usage percentage
  memory: number;    // Memory usage in bytes
  memoryLimit: number; // Memory limit in bytes
}

/**
 * Server entity
 */
export interface Server {
  /** Server name (unique identifier) */
  name: string;

  /** Display name (optional) */
  displayName?: string;

  /** Current status */
  status: ServerStatus;

  /** Server health */
  health: ServerHealth;

  /** Server type (PAPER, FORGE, etc.) */
  type: ServerType;

  /** Minecraft version */
  version: string;

  /** Players info */
  players: PlayersInfo;

  /** Memory info */
  memory: MemoryInfo;

  /** Server hostname */
  hostname: string;

  /** Server port */
  port: number;

  /** Server MOTD */
  motd?: string;

  /** World name */
  world?: string;

  /** Resource usage */
  resources?: ServerResources;

  /** Server uptime formatted string */
  uptime?: string;

  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Server logs response
 */
export interface ServerLogsResponse {
  lines: string[];
  total: number;
}

/**
 * Server list response
 */
export interface ServersResponse {
  servers: Server[];
  total: number;
}

/**
 * Server action response
 */
export interface ServerActionResponse {
  success: boolean;
  message: string;
  server?: Server;
}

/**
 * Server command execution response
 */
export interface CommandResponse {
  success: boolean;
  output: string;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  [key: string]: string | number | boolean;
}

/**
 * Server summary (for list views)
 */
export type ServerSummary = Server;

/**
 * Server detail (for detail views)
 */
export type ServerDetail = Server;

/**
 * Server logs
 */
export type ServerLogs = ServerLogsResponse;
