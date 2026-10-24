import type { RouterAutoScale, RouterResolver } from '../domain/services/routerDetail.js';

/**
 * Server status types
 */
export type ContainerStatus = 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created' | 'not_found' | 'not_created';
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
  playitEnabled?: boolean;
  templateVersion?: string;
  /** Anonymous per-install UUID used as the GA4 user_id by mcctl-console */
  installId?: string;
  /** Set to false to disable mcctl-console usage telemetry */
  telemetry?: boolean;
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
  HOST_IPS?: string;
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
  PLAYIT_SECRET_KEY?: string;
  BETTER_AUTH_SECRET?: string;
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

/**
 * Container stats types
 */
export interface ContainerStats {
  memoryUsage: number;  // bytes
  memoryLimit: number;  // bytes
  memoryPercent: number; // 0-100
  cpuPercent: number;   // 0-100
}

export interface PlayerListResult {
  online: number;
  max: number;
  players: string[];
}

/**
 * Detailed server info
 */
export interface DetailedServerInfo extends ServerInfo {
  type?: string;
  version?: string;
  memory?: string;
  uptime?: string;
  uptimeSeconds?: number;
  players?: PlayerListResult;
  stats?: ContainerStats;
  worldName?: string;
  worldSize?: string;
}

/**
 * Router detail info
 */
export interface RouterDetailInfo extends RouterInfo {
  uptime?: string;
  uptimeSeconds?: number;
  routes: RouteInfo[];
  mode?: string;
  /** mc-router container image, e.g. `itzg/mc-router:1.47.1` (#768). */
  image?: string;
  /** Global auto-scale settings from the mc-router env; absent when unreadable (#768). */
  autoScale?: RouterAutoScale;
  /** nip.io resolver addresses from the platform `.env`; absent when unreadable (#768). */
  resolver?: RouterResolver;
}

export interface RouteInfo {
  hostname: string;
  target: string;
  serverStatus: ContainerStatus;
  serverType?: string;
  serverVersion?: string;
  /** Effective auto-scale up: `mc-router.auto-scale-up` label, else the router global (#768). */
  autoScaleUp?: boolean;
  /** Effective auto-scale down: `mc-router.auto-scale-down` label, else the router global (#768). */
  autoScaleDown?: boolean;
  /**
   * Whether mc-router's management API lists this hostname (#768). Only set by
   * getRouterDetailInfoAsync; absent when the API could not be read.
   */
  discoveredByRouter?: boolean;
}

/**
 * playit.gg types
 */
export interface PlayitAgentStatus {
  enabled: boolean;
  agentRunning: boolean;
  secretKeyConfigured: boolean;
  containerStatus: ContainerStatus;
  uptime?: string;
  uptimeSeconds?: number;
}

export interface PlayitServerInfo {
  serverName: string;
  playitDomain: string | null;
  lanHostname: string;
}
