// Re-export from shared package for backward compatibility
export {
  // Ports - Inbound
  type ICreateServerUseCase,
  type CreateServerConfig,
  type IDeleteServerUseCase,
  type IServerStatusUseCase,
  type IWorldManagementUseCase,
  type IBackupUseCase,
  type IPlayerLookupUseCase,
  // Ports - Outbound
  type IPromptPort,
  type IShellPort,
  type CreateServerOptions,
  type LogsOptions,
  type ShellResult,
  type IServerRepository,
  type ServerConfigData,
  type IWorldRepository,
  type WorldLockData,
  type IDocProvider,
  type DocServerTypeInfo,
  type DocEnvVarInfo,
  type DocVersionInfo,
  type DocMemoryInfo,
  // Use Cases
  CreateServerUseCase,
  DeleteServerUseCase,
  ServerStatusUseCase,
  WorldManagementUseCase,
  BackupUseCase,
  PlayerLookupUseCase,
} from '@minecraft-docker/shared';
