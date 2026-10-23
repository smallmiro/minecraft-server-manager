// Re-export all types (legacy types for backward compatibility)
export {
  type ContainerStatus,
  type HealthStatus,
  type ServerInfo,
  type RouterInfo,
  type AvahiInfo,
  type PlatformStatus,
  type McctlConfig,
  type ServerType as LegacyServerType,
  type ServerConfig as LegacyServerConfig,
  type EnvConfig,
  type LockStatus,
  type WorldLock as LegacyWorldLock,
  type BackupInfo,
  type BackupStatus,
  type PlayerInfo,
  type CommandResult,
  // New detailed types
  type ContainerStats,
  type PlayerListResult,
  type DetailedServerInfo,
  type RouterDetailInfo,
  type RouteInfo,
  // playit.gg types
  type PlayitAgentStatus,
  type PlayitServerInfo,
} from './types/index.js';

// Re-export utilities
export { Paths, Config, colors, log, getPackageRoot, formatWorldBytes, isTelemetryEnabled, resolveMcctlRoot } from './utils/index.js';

// Re-export docker utilities
export {
  checkDocker,
  checkDockerCompose,
  getContainerStatus,
  getContainerHealth,
  containerExists,
  getContainerHostname,
  getMcContainers,
  getRunningMcContainers,
  getServerInfo,
  getRouterInfo,
  getAvahiStatus,
  getPlatformStatus,
  startContainer,
  stopContainer,
  getContainerLogs,
  execScript,
  execScriptInteractive,
  // New detailed functions
  getContainerStats,
  getContainerUptime,
  getOnlinePlayers,
  parseRconPlayerList,
  getDetailedServerInfo,
  getDetailedServerInfoWithPlayers,
  getRouterDetailInfo,
  formatBytes,
  // Configured servers from filesystem
  getConfiguredServers,
  getServerInfoFromConfig,
  getAllServers,
  getServersDir,
  readServerConfigEnv,
  serverExists,
  getDetailedServerInfoFromConfig,
  getServerDetailedInfo,
  getDockerVersion,
  getDockerComposeVersion,
  // playit.gg Docker helpers
  getPlayitAgentStatus,
  startPlayitAgent,
  stopPlayitAgent,
  getServerPlayitDomain,
  setServerPlayitDomain,
  parseRouterHosts,
  replaceRouterHosts,
  resolvePlayitDomain,
} from './docker/index.js';

// Re-export domain layer (Value Objects and Entities)
export {
  // Value Objects
  ServerName,
  SERVER_NAME_PATTERN,
  SERVER_NAME_MIN_LENGTH,
  SERVER_NAME_MAX_LENGTH,
  RESERVED_SERVER_NAMES,
  EXISTING_SERVER_NAME_PATTERN,
  WorldName,
  WORLD_NAME_PATTERN,
  EXISTING_WORLD_NAME_PATTERN,
  configuredWorldName,
  resolveWorldName,
  ServerType,
  ServerTypeEnum,
  type ServerTypeInfo,
  McVersion,
  Memory,
  WorldOptions,
  WorldSetupType,
  type WorldOptionsData,
  UserId,
  Username,
  Role,
  RoleEnum,
  // Service management value objects
  ServiceStatus,
  ServiceStatusEnum,
  ProcessInfo,
  type ProcessInfoData,
  type ProcessMetrics,
  // World assignment rules (#670)
  WorldAssignmentError,
  holdersOf,
  checkAssign,
  checkProposed,
  checkRemoval,
  checkReset,
  planRelease,
  findDuplicates,
  formatAssignmentWarnings,
  type WorldAssignment,
  type WorldAssignmentSnapshot,
  type WorldAssignmentErrorCode,
  // ServerSpec (#675, ADR-0003)
  ServerSpecError,
  SERVER_SPEC_VERSION,
  SERVER_SPEC_MANAGED_ENV_KEYS,
  validateServerSpecDocument,
  assertServerSpecDocument,
  validateHostname,
  routerHosts,
  setEnvKeys,
  type SpecEnvChanges,
  MC_VERSION_INPUT_PATTERN,
  buildCreateSpec,
  DEFAULT_SERVER_IMAGE,
  type CreateSpecInput,
  type ServerSpecDocument,
  type ServerSpecErrorCode,
  type ServerSpecIssue,
  type ServerSpecRules,
  type WorldStorage,
  // Entities
  Server,
  ServerStatus,
  type ServerConfig,
  World,
  WorldLockStatus,
  type WorldLock,
  User,
  type UserData,
  // Audit log
  AuditLog,
  type AuditLogData,
  type AuditLogRow,
  AuditActionEnum,
  // Operator
  Operator,
  type OperatorData,
  type MinecraftOpsJson,
  OpLevel,
  // Backup schedule
  CronExpression,
  BackupRetentionPolicy,
  type BackupRetentionPolicyData,
  BackupSchedule,
  type BackupScheduleData,
  type BackupScheduleRow,
  // Config snapshot
  ConfigSnapshot,
  type ConfigSnapshotData,
  type ConfigSnapshotRow,
  ConfigSnapshotSchedule,
  type ConfigSnapshotScheduleData,
  type ConfigSnapshotScheduleRow,
  ConfigSnapshotFile,
  type ConfigSnapshotFileData,
  FileDiff,
  type FileDiffStatus,
  type FileDiffData,
  SnapshotDiff,
  type SnapshotDiffData,
  type SnapshotDiffSummary,
  // World block stats (#531)
  isAir,
  isOre,
  aggregateBlockCounts,
  type BlockCount,
  type BlockStatsResult,
  // Player stats (#528, Phase 2)
  PlayerStats,
  type PlayerStatsProps,
  type PlayerStatsJson,
  // Player NBT data (#528, Phase 3)
  PlayerData,
  type PlayerDataProps,
  type PlayerDataJson,
  type PlayerInventorySummary,
  type InventoryItemSummary,
  // Player session history (#528, Phase 4)
  PlayerSession,
  type PlayerSessionProps,
  type PlayerSessionJson,
  parsePlayerSessionEvent,
  parseDockerLogTimestamp,
  type PlayerSessionEvent,
} from './domain/index.js';

// Re-export mod domain models
export type {
  ModSideSupport,
  ModProjectType,
  ModVersionType,
  ModDependencyType,
  ModSearchIndex,
  ModSearchOptions,
  ModVersionOptions,
  ModProject,
  ModVersion,
  ModFile,
  ModFileHashes,
  ModDependency,
  ModSearchResult,
} from './domain/mod/index.js';

// Re-export modpack compatibility matrix utilities (value + types)
export {
  buildModpackCompatibilityMatrix,
  isModpackCompatible,
} from './domain/mod/index.js';
export type {
  ModpackCompatibilityMatrix,
  LoaderCompatibility,
} from './domain/mod/index.js';

// Re-export ModSourceFactory
export { ModSourceFactory } from './infrastructure/factories/index.js';

// Re-export application layer (ports and use-cases)
export * from './application/index.js';

// Re-export infrastructure layer (adapters)
export * from './infrastructure/index.js';

// Re-export prerequisite checker
export * from './prerequisite/index.js';
