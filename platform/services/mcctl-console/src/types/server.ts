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

  /** Server type (PAPER, FORGE, etc.) */
  type: ServerType;

  /** Minecraft version */
  version: string;

  /** Currently online players */
  players: Player[];

  /** Maximum allowed players */
  maxPlayers: number;

  /** Server MOTD */
  motd?: string;

  /** World name */
  world?: string;

  /** Resource usage */
  resources?: ServerResources;

  /** Server uptime in seconds */
  uptime?: number;

  /** Last updated timestamp */
  updatedAt: string;
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
