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
} from './types/index.js';

// Re-export utilities
export { Paths, Config, colors, log, getPackageRoot } from './utils/index.js';

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
  getDetailedServerInfo,
  getDetailedServerInfoWithPlayers,
  getRouterDetailInfo,
  formatBytes,
} from './docker/index.js';

// Re-export domain layer (Value Objects and Entities)
export {
  // Value Objects
  ServerName,
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
  // Entities
  Server,
  ServerStatus,
  type ServerConfig,
  World,
  WorldLockStatus,
  type WorldLock,
  User,
  type UserData,
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

// Re-export ModSourceFactory
export { ModSourceFactory } from './infrastructure/factories/index.js';

// Re-export application layer (ports and use-cases)
export * from './application/index.js';

// Re-export infrastructure layer (adapters)
export * from './infrastructure/index.js';
