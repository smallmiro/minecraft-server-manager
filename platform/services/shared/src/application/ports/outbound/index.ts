export type {
  IPromptPort,
  TextPromptOptions,
  SelectPromptOptions,
  SelectOption,
  ConfirmPromptOptions,
  PasswordPromptOptions,
  Spinner,
} from './IPromptPort.js';

export type {
  IDocProvider,
  DocServerTypeInfo,
  DocEnvVarInfo,
  DocVersionInfo,
  DocMemoryInfo,
} from './IDocProvider.js';

export type {
  IServerRepository,
  ServerConfigData,
} from './IServerRepository.js';

export type {
  IWorldRepository,
  WorldWithServerStatus,
  ServerStatus,
  WorldAvailabilityCategory,
} from './IWorldRepository.js';

export type { IModSourcePort } from './IModSourcePort.js';

export type { IUserRepository } from './IUserRepository.js';

export type {
  IServiceManagerPort,
  ServiceStartOptions,
  ServiceStopOptions,
  ServiceRestartOptions,
  ServiceLogsOptions,
} from './IServiceManagerPort.js';

export type { IAuditLogPort, AuditLogQueryOptions } from './IAuditLogPort.js';

export type { IOperatorPort } from './IOperatorPort.js';

export type { IBackupScheduleRepository } from './IBackupScheduleRepository.js';

export type { IConfigSnapshotRepository } from './IConfigSnapshotRepository.js';
export type { IConfigSnapshotScheduleRepository } from './IConfigSnapshotScheduleRepository.js';
export type { IConfigFileCollector } from './IConfigFileCollector.js';
export type { IConfigSnapshotStorage } from './IConfigSnapshotStorage.js';

export type { IWorldDataReader } from './IWorldDataReader.js';
export type { IPlayerRepository, UserCacheEntry } from './IPlayerRepository.js';
export type {
  IPlayerSessionRepository,
  PlayerSessionSummary,
} from './IPlayerSessionRepository.js';
export type { IRconPort } from './IRconPort.js';
export type { IPlatformSettingsPort } from './IPlatformSettingsPort.js';
export type {
  IMapRenderer,
  MapRenderProgress,
  MapRenderResult,
  MapRenderOptions,
} from './IMapRenderer.js';
export type {
  IBlockScanner,
  BlockScanProgress,
  BlockScanOutcome,
  BlockScanOptions,
} from './IBlockScanner.js';

// Runtime ports (ADR-0001)
export type { IContainerRuntimePort, RuntimeActionResult } from './IContainerRuntimePort.js';
export type {
  IServerConsolePort,
  ConsoleCommandResult,
  ConsoleEndpoint,
} from './IServerConsolePort.js';
export type { IRouterStatusPort } from './IRouterStatusPort.js';
export type { IPlayitAgentPort } from './IPlayitAgentPort.js';
export type { IHostnameRegistrarPort, HostnameRegistrarStatus, HostnameChangeResult } from './IHostnameRegistrarPort.js';
export type { IRuntimeEnvironmentPort, ToolVersion } from './IRuntimeEnvironmentPort.js';
export type {
  IServerSpecRepository,
  ServerSpec,
  LoadedServerSpec,
  WriteServerSpecOptions,
  DeleteServerSpecOptions,
  ServerSpecDeleteResult,
} from './IServerSpecRepository.js';
export type { IWorldAssignmentPort, WorldAssignment, WorldAssignmentSnapshot } from './IWorldAssignmentPort.js';

// Backup port (ADR-0001, #732)
export type {
  IWorldBackupPort,
  WorldBackupErrorCode,
  WorldBackupError,
  WorldBackupResult,
  BackupLockHolder,
  LockOptions,
  WorldBackupStatus,
  WorldBackupCommit,
  WorldBackupPushOptions,
  WorldBackupPushOutcome,
  WorldBackupRestoreOutcome,
  WorldBackupPruneOutcome,
} from './IWorldBackupPort.js';
