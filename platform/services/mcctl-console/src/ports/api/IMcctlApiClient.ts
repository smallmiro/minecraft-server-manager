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
    players: string[];
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
export type LevelType = 'default' | 'flat' | 'largeBiomes' | 'amplified' | 'buffet';

export interface ServerConfig {
  // ── Gameplay ──
  difficulty?: Difficulty;
  gameMode?: GameMode;
  maxPlayers?: number;
  pvp?: boolean;
  forceGamemode?: boolean;
  hardcore?: boolean;
  allowFlight?: boolean;
  allowNether?: boolean;
  enableCommandBlock?: boolean;
  spawnProtection?: number;
  spawnAnimals?: boolean;
  spawnMonsters?: boolean;
  spawnNpcs?: boolean;

  // ── World ──
  motd?: string;
  level?: string;
  levelType?: LevelType;
  seed?: string;
  generateStructures?: boolean;
  maxWorldSize?: number;
  icon?: string;

  // ── Security ──
  onlineMode?: boolean;
  enableWhitelist?: boolean;
  enforceWhitelist?: boolean;
  enforceSecureProfile?: boolean;

  // ── Performance & JVM ──
  memory?: string;
  useAikarFlags?: boolean;
  viewDistance?: number;
  simulationDistance?: number;
  maxTickTime?: number;
  initMemory?: string;
  maxMemory?: string;
  jvmXxOpts?: string;

  // ── Auto-pause / Auto-stop ──
  enableAutopause?: boolean;
  autopauseTimeoutEst?: number;
  autopauseTimeoutInit?: number;
  autopausePeriod?: number;
  enableAutostop?: boolean;
  autostopTimeoutEst?: number;

  // ── System ──
  tz?: string;
  resourcePack?: string;
  enableRcon?: boolean;
  resourcePackSha1?: string;
  resourcePackEnforce?: boolean;
  resourcePackPrompt?: string;
  rconPassword?: string;
  rconPort?: number;
  stopDuration?: number;
  uid?: number;
  gid?: number;
}

export interface ServerConfigResponse {
  config: ServerConfig;
}

export type UpdateServerConfigRequest = Partial<ServerConfig>;

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
// Playit.gg Types
// ============================================================

export interface PlayitServerInfo {
  serverName: string;
  playitDomain: string | null;
  lanHostname: string;
}

export interface PlayitAgentStatus {
  enabled: boolean;
  agentRunning: boolean;
  secretKeyConfigured: boolean;
  containerStatus: ContainerStatus;
  uptime?: string;
  uptimeSeconds?: number;
  servers: PlayitServerInfo[];
}

export interface PlayitActionResponse {
  success: boolean;
  message: string;
}

// ============================================================
// Mod Management Types
// ============================================================

export interface ModListResponse {
  mods: Record<string, string[]>;
}

export interface AddModsRequest {
  slugs: string[];
  source?: string;
}

export interface AddModsResponse {
  success: boolean;
  added: string[];
  mods: string[];
}

export interface RemoveModResponse {
  success: boolean;
  removed: string;
}

export interface ModProjectDetail {
  slug: string;
  title: string;
  description: string;
  downloads: number;
  iconUrl: string | null;
  author: string;
  categories: string[];
  sourceUrl: string;
}

export interface ModProjectsResponse {
  projects: Record<string, ModProjectDetail | null>;
}

export interface ModSearchHit {
  slug: string;
  title: string;
  description: string;
  downloads: number;
  iconUrl: string | null;
  author: string;
  categories: string[];
}

export interface ModSearchResponse {
  hits: ModSearchHit[];
  totalHits: number;
  offset: number;
  limit: number;
}

// ============================================================
// File Management Types
// ============================================================

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
}

export interface FileListResponse {
  path: string;
  files: FileEntry[];
}

export interface FileContentResponse {
  path: string;
  content: string;
  size: number;
  modifiedAt: string;
}

export interface FileWriteResponse {
  success: boolean;
  path: string;
  size: number;
  modifiedAt: string;
}

export interface FileActionResponse {
  success: boolean;
  path: string;
}

export interface FileRenameResponse {
  success: boolean;
  oldPath: string;
  newPath: string;
}

export interface FileUploadResponse {
  success: boolean;
  path: string;
  files: string[];
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
// Backup Schedule Types
// ============================================================

export interface BackupScheduleItem {
  id: string;
  name: string;
  cronExpression: string;
  cronHumanReadable: string;
  retentionPolicy: {
    maxCount?: number;
    maxAgeDays?: number;
  };
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'failure' | null;
  lastRunMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupScheduleListResponse {
  schedules: BackupScheduleItem[];
  total: number;
}

export interface CreateBackupScheduleRequest {
  name: string;
  cron: string;
  maxCount?: number;
  maxAgeDays?: number;
  enabled?: boolean;
}

export interface UpdateBackupScheduleRequest {
  name?: string;
  cron?: string;
  maxCount?: number;
  maxAgeDays?: number;
}

export interface ToggleBackupScheduleRequest {
  enabled: boolean;
}

export interface BackupScheduleActionResponse {
  success: boolean;
  message: string;
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
  enabled?: boolean;
}

export interface WhitelistStatusResponse {
  enabled: boolean;
  source: 'config';
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

// ============================================================
// Config Snapshot Types
// ============================================================

export interface ConfigSnapshotFile {
  path: string;
  hash: string;
  size: number;
}

export interface ConfigSnapshotItem {
  id: string;
  serverName: string;
  createdAt: string;
  description: string;
  files: ConfigSnapshotFile[];
  scheduleId?: string;
}

export interface ConfigSnapshotListResponse {
  snapshots: ConfigSnapshotItem[];
  total: number;
}

export type FileDiffStatus = 'added' | 'modified' | 'deleted';

export interface FileDiff {
  path: string;
  status: FileDiffStatus;
  oldContent?: string;
  newContent?: string;
  oldHash?: string;
  newHash?: string;
}

export interface ConfigSnapshotDiffSummary {
  added: number;
  modified: number;
  deleted: number;
}

export interface ConfigSnapshotDiffResponse {
  baseSnapshotId: string;
  compareSnapshotId: string;
  changes: FileDiff[];
  summary: ConfigSnapshotDiffSummary;
  hasChanges: boolean;
}

export interface RestoreSnapshotOptions {
  createSnapshotBeforeRestore?: boolean;
  force?: boolean;
}

export interface RestoreConfigSnapshotResponse {
  restored: ConfigSnapshotItem;
  safetySnapshot?: ConfigSnapshotItem;
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

  // Backup schedule operations
  getBackupSchedules(): Promise<BackupScheduleListResponse>;
  getBackupSchedule(id: string): Promise<BackupScheduleItem>;
  createBackupSchedule(request: CreateBackupScheduleRequest): Promise<BackupScheduleItem>;
  updateBackupSchedule(id: string, request: UpdateBackupScheduleRequest): Promise<BackupScheduleItem>;
  toggleBackupSchedule(id: string, enabled: boolean): Promise<BackupScheduleItem>;
  deleteBackupSchedule(id: string): Promise<BackupScheduleActionResponse>;

  // Player management operations
  getWhitelist(serverName: string): Promise<WhitelistResponse>;
  getWhitelistStatus(serverName: string): Promise<WhitelistStatusResponse>;
  setWhitelistStatus(serverName: string, enabled: boolean): Promise<WhitelistStatusResponse>;
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

  // Mod management operations
  getServerMods(serverName: string): Promise<ModListResponse>;
  addServerMods(serverName: string, slugs: string[], source?: string): Promise<AddModsResponse>;
  removeServerMod(serverName: string, slug: string): Promise<RemoveModResponse>;
  searchMods(query: string, limit?: number, offset?: number): Promise<ModSearchResponse>;
  getModProjects(slugs: string[], source?: string): Promise<ModProjectsResponse>;

  // Playit.gg operations
  getPlayitStatus(): Promise<PlayitAgentStatus>;
  startPlayit(): Promise<PlayitActionResponse>;
  stopPlayit(): Promise<PlayitActionResponse>;

  // File management operations
  listFiles(serverName: string, path: string): Promise<FileListResponse>;
  readFile(serverName: string, path: string): Promise<FileContentResponse>;
  writeFile(serverName: string, path: string, content: string): Promise<FileWriteResponse>;
  deleteFile(serverName: string, path: string): Promise<FileActionResponse>;
  createDirectory(serverName: string, path: string): Promise<FileActionResponse>;
  renameFile(serverName: string, oldPath: string, newPath: string): Promise<FileRenameResponse>;

  // Config snapshot operations
  listConfigSnapshots(serverName: string, limit?: number, offset?: number): Promise<ConfigSnapshotListResponse>;
  getConfigSnapshot(serverName: string, snapshotId: string): Promise<ConfigSnapshotItem>;
  createConfigSnapshot(serverName: string, description?: string): Promise<ConfigSnapshotItem>;
  deleteConfigSnapshot(serverName: string, snapshotId: string): Promise<void>;
  getConfigSnapshotDiff(snapshotId1: string, snapshotId2: string): Promise<ConfigSnapshotDiffResponse>;
  restoreConfigSnapshot(serverName: string, snapshotId: string, options?: RestoreSnapshotOptions): Promise<RestoreConfigSnapshotResponse>;
}
