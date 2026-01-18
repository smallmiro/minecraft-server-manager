/**
 * Server status types
 */
export type ContainerStatus = 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created' | 'not_found';
export type HealthStatus = 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown';

export interface ServerInfo {
  name: string;
  container: string;
  status: ContainerStatus;
  health: HealthStatus;
  hostname: string;
}

export interface RouterInfo {
  name: string;
  status: ContainerStatus;
  health: HealthStatus;
  port: number;
}

export interface AvahiInfo {
  name: string;
  status: string;
  type: 'system';
}

export interface PlatformStatus {
  router: RouterInfo;
  avahi_daemon: AvahiInfo;
  servers: ServerInfo[];
}

/**
 * Configuration types
 */
export interface McctlConfig {
  version: string;
  initialized: string;
  dataDir: string;
  defaultType: ServerType;
  defaultVersion: string;
  autoStart: boolean;
  avahiEnabled: boolean;
}

export type ServerType = 'PAPER' | 'VANILLA' | 'FORGE' | 'FABRIC' | 'SPIGOT' | 'BUKKIT';

export interface ServerConfig {
  name: string;
  type: ServerType;
  version: string;
  memory: string;
  motd?: string;
  seed?: string;
  worldUrl?: string;
  world?: string;
}

export interface EnvConfig {
  HOST_IP?: string;
  RCON_PASSWORD?: string;
  TZ?: string;
  DEFAULT_VERSION?: string;
  DEFAULT_MEMORY?: string;
  MINECRAFT_NETWORK?: string;
  MINECRAFT_SUBNET?: string;
  BACKUP_GITHUB_TOKEN?: string;
  BACKUP_GITHUB_REPO?: string;
  BACKUP_GITHUB_BRANCH?: string;
  BACKUP_AUTO_ON_STOP?: boolean;
}

/**
 * World lock types
 */
export type LockStatus = 'unlocked' | 'locked' | 'stale';

export interface WorldLock {
  world: string;
  status: LockStatus;
  holder?: string;
  timestamp?: Date;
  age?: string;
}

/**
 * Backup types
 */
export interface BackupInfo {
  commit: string;
  message: string;
  date: Date;
  author: string;
}

export interface BackupStatus {
  configured: boolean;
  repo?: string;
  branch?: string;
  lastBackup?: BackupInfo;
}

/**
 * Player types
 */
export interface PlayerInfo {
  username: string;
  uuid: string;
  offlineUuid?: string;
  avatar?: string;
}

/**
 * Command result types
 */
export interface CommandResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
}
