/**
 * Infrastructure Adapters
 * Concrete implementations of application ports
 */

export { ShellAdapter, type ShellAdapterOptions } from './ShellAdapter.js';
export { ServerRepository } from './ServerRepository.js';
export { WorldRepository } from './WorldRepository.js';
export { DocsAdapter } from './DocsAdapter.js';
export { YamlUserRepository } from './YamlUserRepository.js';
export { SqliteUserRepository } from './SqliteUserRepository.js';
export { SqliteAuditLogRepository } from './SqliteAuditLogRepository.js';
export {
  ApiPromptAdapter,
  ApiModeError,
  type ApiPromptOptions,
  type WorldSetupType,
  type MessageType,
  type CollectedMessage,
} from './ApiPromptAdapter.js';
export { SqliteBackupScheduleRepository } from './SqliteBackupScheduleRepository.js';
export { ConfigSnapshotDatabase } from './ConfigSnapshotDatabase.js';
export { SqliteConfigSnapshotRepository } from './SqliteConfigSnapshotRepository.js';
export { SqliteConfigSnapshotScheduleRepository } from './SqliteConfigSnapshotScheduleRepository.js';
export { FileSystemConfigSnapshotStorage } from './FileSystemConfigSnapshotStorage.js';
export { FileSystemConfigFileCollector } from './FileSystemConfigFileCollector.js';
