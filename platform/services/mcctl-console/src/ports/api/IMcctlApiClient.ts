/**
 * API Client Interface for mcctl-api communication
 * Port interface for the BFF proxy layer
 */

export interface ServerSummary {
  name: string;
  container: string;
  status: 'running' | 'stopped' | 'created' | 'exited' | 'not_created' | 'unknown';
  health: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown';
  hostname: string;
}

export interface ServerStats {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
}

export interface ServerDetail extends ServerSummary {
  type?: string;
  version?: string;
  memory?: string;
  uptime?: string;
  uptimeSeconds?: number;
  players?: {
    online: number;
    max: number;
    list: string[];
  };
  stats?: ServerStats;
  worldName?: string;
  worldSize?: string;
}

export interface ServerListResponse {
  servers: ServerSummary[];
  total: number;
}

export interface ServerDetailResponse {
  server: ServerDetail;
}

export interface CreateServerRequest {
  name: string;
  type?: string;
  version?: string;
  memory?: string;
  seed?: string;
  worldUrl?: string;
  worldName?: string;
  autoStart?: boolean;
  sudoPassword?: string;
  // Modpack-specific fields (for MODRINTH/AUTO_CURSEFORGE types)
  modpack?: string;
  modpackVersion?: string;
  modLoader?: string;
}

export interface CreateServerResponse {
  success: boolean;
  server: {
    name: string;
    container: string;
    status: string;
  };
}

export interface DeleteServerResponse {
  success: boolean;
  server: string;
  message: string;
}

export interface ActionResponse {
  success: boolean;
  server: string;
  action: 'start' | 'stop' | 'restart';
  timestamp: string;
  message?: string;
  error?: string;
}

export interface ExecCommandRequest {
  command: string;
}

export interface ExecCommandResponse {
  success: boolean;
  output: string;
}

export interface LogsResponse {
  logs: string;
  lines: number;
}

export interface World {
  name: string;
  path: string;
  isLocked: boolean;
  lockedBy?: string;
  size?: string;
  lastModified?: string;
}

export interface WorldListResponse {
  worlds: World[];
  total: number;
}

export interface WorldDetailResponse {
  world: World;
}

export interface CreateWorldRequest {
  name: string;
  seed?: string;
  serverName?: string;
  autoStart?: boolean;
}

export interface CreateWorldResponse {
  success: boolean;
  worldName: string;
  seed?: string;
  serverName?: string;
  started?: boolean;
}

export interface AssignWorldRequest {
  serverName: string;
}

export interface AssignWorldResponse {
  success: boolean;
  worldName: string;
  serverName: string;
}

export interface ReleaseWorldResponse {
  success: boolean;
  worldName: string;
  previousServer?: string;
}

export interface DeleteWorldResponse {
  success: boolean;
  worldName: string;
  size?: string;
}

// ============================================================
// Server Configuration Types
// ============================================================

export type Difficulty = 'peaceful' | 'easy' | 'normal' | 'hard';
export type GameMode = 'survival' | 'creative' | 'adventure' | 'spectator';

export interface ServerConfig {
  // Server Properties (hot-reload capable)
  motd?: string;
  maxPlayers?: number;
  difficulty?: Difficulty;
  gameMode?: GameMode;
  pvp?: boolean;
  viewDistance?: number;
  spawnProtection?: number;

  // Performance Settings (restart required)
  memory?: string;
  useAikarFlags?: boolean;
}

export interface ServerConfigResponse {
  config: ServerConfig;
}

export interface UpdateServerConfigRequest {
  motd?: string;
  maxPlayers?: number;
  difficulty?: Difficulty;
  gameMode?: GameMode;
  pvp?: boolean;
  viewDistance?: number;
  spawnProtection?: number;
  memory?: string;
  useAikarFlags?: boolean;
}

export interface UpdateServerConfigResponse {
  success: boolean;
  config: ServerConfig;
  restartRequired: boolean;
  changedFields: string[];
}

export interface WorldResetResponse {
  success: boolean;
  message: string;
  worldName: string;
}

// ============================================================
// Hostname Management Types
// ============================================================

export interface HostnameInfo {
  hostname: string;
  type: 'system' | 'custom';
  description?: string;
}

export interface HostnameResponse {
  serverName: string;
  hostnames: string[];
  systemHostnames: HostnameInfo[];
  customHostnames: string[];
}

export interface UpdateHostnamesResponse {
  success: boolean;
  serverName: string;
  hostnames: string[];
  systemHostnames: HostnameInfo[];
  customHostnames: string[];
  recreateRequired: boolean;
}

// ============================================================
// Router Status Types
// ============================================================

export type ContainerStatus =
  | 'running'
  | 'exited'
  | 'paused'
  | 'restarting'
  | 'dead'
  | 'created'
  | 'not_found'
  | 'not_created';

export type HealthStatus =
  | 'healthy'
  | 'unhealthy'
  | 'starting'
  | 'none'
  | 'unknown';

export interface RouteInfo {
  hostname: string;
  target: string;
  serverStatus: ContainerStatus;
  serverType?: string;
  serverVersion?: string;
}

export interface RouterDetail {
  name: string;
  status: ContainerStatus;
  health: HealthStatus;
  port: number;
  uptime?: string;
  uptimeSeconds?: number;
  mode?: string;
  routes: RouteInfo[];
}

export interface AvahiInfo {
  name: string;
  status: string;
  type: string;
}

export interface RouterStatusResponse {
  router: RouterDetail;
  avahi?: AvahiInfo;
}

export interface ApiError {
  error: string;
  message: string;
}

// ============================================================
// Backup Types
// ============================================================

export interface BackupStatusResponse {
  configured: boolean;
  lastBackup?: string;
  repository?: string;
}

export interface BackupPushResponse {
  success: boolean;
  commitHash?: string;
  message?: string;
}

export interface BackupCommit {
  hash: string;
  date: string;
  message: string;
  author: string;
}

export interface BackupHistoryResponse {
  commits: BackupCommit[];
  total: number;
}

export interface BackupRestoreResponse {
  success: boolean;
  message?: string;
}

// ============================================================
// Player Management Types
// ============================================================

export type PlayerDataSource = 'rcon' | 'file' | 'config';

export interface WhitelistEntry {
  name: string;
  uuid: string;
}

export interface BannedPlayerEntry {
  name: string;
  uuid: string;
  reason: string;
  created: string;
  source: string;
  expires: string;
}

export interface PlayerListResponse {
  players: string[];
  total: number;
  source?: PlayerDataSource;
}

export interface WhitelistResponse {
  players: WhitelistEntry[];
  total: number;
  source?: PlayerDataSource;
}

export interface BannedPlayersResponse {
  players: BannedPlayerEntry[];
  total: number;
  source: 'file';
}

export interface PlayerActionResponse {
  success: boolean;
  message: string;
  source?: PlayerDataSource;
}

/**
 * Operator info with level and role
 */
export interface OperatorInfo {
  name: string;
  uuid: string;
  level: number;
  role: string;
  bypassesPlayerLimit: boolean;
}

/**
 * Operators list response (with level information)
 */
export interface OperatorsListResponse {
  operators: OperatorInfo[];
  count: number;
  source?: PlayerDataSource;
}

/**
 * Operator action response (add/update/remove)
 */
export interface OperatorActionResponse {
  success: boolean;
  operator?: OperatorInfo;
  message?: string;
  source?: PlayerDataSource;
}

/**
 * mcctl-api Client Interface
 * Defines the contract for API communication
 */
export interface IMcctlApiClient {
  // Server operations
  getServers(): Promise<ServerListResponse>;
  getServer(name: string): Promise<ServerDetailResponse>;
  createServer(request: CreateServerRequest): Promise<CreateServerResponse>;
  deleteServer(name: string, force?: boolean): Promise<DeleteServerResponse>;
  startServer(name: string): Promise<ActionResponse>;
  stopServer(name: string): Promise<ActionResponse>;
  restartServer(name: string): Promise<ActionResponse>;
  execCommand(serverName: string, command: string): Promise<ExecCommandResponse>;
  getLogs(serverName: string, lines?: number): Promise<LogsResponse>;

  // World operations
  getWorlds(): Promise<WorldListResponse>;
  getWorld(name: string): Promise<WorldDetailResponse>;
  createWorld(request: CreateWorldRequest): Promise<CreateWorldResponse>;
  assignWorld(worldName: string, serverName: string): Promise<AssignWorldResponse>;
  releaseWorld(worldName: string, force?: boolean): Promise<ReleaseWorldResponse>;
  deleteWorld(worldName: string, force?: boolean): Promise<DeleteWorldResponse>;

  // Server configuration operations
  getServerConfig(serverName: string): Promise<ServerConfigResponse>;
  updateServerConfig(serverName: string, config: UpdateServerConfigRequest): Promise<UpdateServerConfigResponse>;
  resetWorld(serverName: string): Promise<WorldResetResponse>;

  // Router operations
  getRouterStatus(): Promise<RouterStatusResponse>;

  // Backup operations
  getBackupStatus(): Promise<BackupStatusResponse>;
  pushBackup(message?: string): Promise<BackupPushResponse>;
  getBackupHistory(limit?: number): Promise<BackupHistoryResponse>;
  restoreBackup(commitHash: string): Promise<BackupRestoreResponse>;

  // Player management operations
  getWhitelist(serverName: string): Promise<WhitelistResponse>;
  addToWhitelist(serverName: string, player: string): Promise<PlayerActionResponse>;
  removeFromWhitelist(serverName: string, player: string): Promise<PlayerActionResponse>;
  getBans(serverName: string): Promise<BannedPlayersResponse>;
  banPlayer(serverName: string, player: string, reason?: string): Promise<PlayerActionResponse>;
  unbanPlayer(serverName: string, player: string): Promise<PlayerActionResponse>;

  // OP management operations (with level support)
  getOpsWithLevel(serverName: string): Promise<OperatorsListResponse>;
  addOpWithLevel(serverName: string, player: string, level?: number): Promise<OperatorActionResponse>;
  updateOpLevel(serverName: string, player: string, level: number): Promise<OperatorActionResponse>;
  removeOp(serverName: string, player: string): Promise<OperatorActionResponse>;

  // Legacy OP operations (backwards compatibility)
  getOps(serverName: string): Promise<PlayerListResponse>;
  addOp(serverName: string, player: string): Promise<PlayerActionResponse>;

  // Hostname management operations
  getHostnames(serverName: string): Promise<HostnameResponse>;
  updateHostnames(serverName: string, customHostnames: string[]): Promise<UpdateHostnamesResponse>;
}
