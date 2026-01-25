/**
 * Server-related type definitions
 */

export type ServerStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'error';

export type ServerHealth = 'healthy' | 'unhealthy' | 'unknown';

export type ServerType = 'PAPER' | 'VANILLA' | 'FORGE' | 'NEOFORGE' | 'FABRIC' | 'SPIGOT' | 'BUKKIT';

export interface Player {
  name: string;
  uuid: string;
  joinedAt?: string;
}

export interface ServerDetail {
  name: string;
  status: ServerStatus;
  health: ServerHealth;
  type: ServerType;
  version: string;
  memory: {
    allocated: string;
    used?: string;
  };
  uptime?: string;
  players: {
    online: number;
    max: number;
    list: Player[];
  };
  port?: number;
  hostname?: string;
}

export interface ServerLogs {
  lines: string[];
  timestamp: string;
}

export interface ServerActionResponse {
  success: boolean;
  message: string;
  server?: string;
}

/**
 * Server summary for list view
 */
export interface ServerSummary {
  /** Server name (e.g., 'myserver') */
  name: string;
  /** Docker container name (e.g., 'mc-myserver') */
  containerName: string;
  /** Current server status */
  status: ServerStatus;
  /** Health check status */
  health: ServerHealth;
  /** Server type */
  type: ServerType;
  /** Minecraft version */
  version: string;
  /** Number of online players */
  playerCount: number;
  /** Maximum player slots */
  maxPlayers: number;
  /** Server hostname for connection */
  hostname: string;
  /** Server port (usually 25565) */
  port: number;
  /** Last status update timestamp */
  updatedAt: string;
}

/**
 * API response for server list
 */
export interface ServersResponse {
  servers: ServerSummary[];
  total: number;
}

/**
 * API error response
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
