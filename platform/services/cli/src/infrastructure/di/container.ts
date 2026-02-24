import { join } from 'node:path';
import {
  Paths,
  // Infrastructure adapters from shared
  ShellAdapter,
  ServerRepository,
  WorldRepository,
  DocsAdapter,
  SqliteAuditLogRepository,
  SqliteBackupScheduleRepository,
  ConfigSnapshotDatabase,
  SqliteConfigSnapshotRepository,
  SqliteConfigSnapshotScheduleRepository,
  FileSystemConfigSnapshotStorage,
  FileSystemConfigFileCollector,
  // Use cases from shared
  CreateServerUseCase,
  DeleteServerUseCase,
  ServerStatusUseCase,
  WorldManagementUseCase,
  BackupUseCase,
  PlayerLookupUseCase,
  BackupScheduleUseCase,
  ConfigSnapshotUseCaseImpl,
  ConfigSnapshotScheduleUseCaseImpl,
  // Port types from shared
  type IPromptPort,
  type IShellPort,
  type IServerRepository,
  type IWorldRepository,
  type IDocProvider,
  type IAuditLogPort,
  type IModSourcePort,
  type ICreateServerUseCase,
  type IDeleteServerUseCase,
  type IServerStatusUseCase,
  type IWorldManagementUseCase,
  type IBackupUseCase,
  type IPlayerLookupUseCase,
  type IBackupScheduleUseCase,
  type IBackupScheduleRepository,
  type IConfigSnapshotUseCase,
  type IConfigSnapshotScheduleUseCase,
} from '@minecraft-docker/shared';
import { ModrinthAdapter } from '@minecraft-docker/mod-source-modrinth';
// CLI-specific adapter
import { ClackPromptAdapter } from '../adapters/ClackPromptAdapter.js';

export interface ContainerOptions {
  rootDir?: string;
  sudoPassword?: string;
}

/**
 * Dependency Injection Container
 * Manages creation and lifecycle of dependencies
 */
export class Container {
  private readonly paths: Paths;
  private readonly sudoPassword?: string;

  // Adapters (singleton)
  private _promptPort?: IPromptPort;
  private _shellPort?: IShellPort;
  private _serverRepo?: IServerRepository;
  private _worldRepo?: IWorldRepository;
  private _docProvider?: IDocProvider;
  private _auditLogPort?: IAuditLogPort;
  private _modSourcePort?: IModSourcePort;
  private _backupScheduleRepo?: IBackupScheduleRepository;
  private _configSnapshotDatabase?: ConfigSnapshotDatabase;
  private _configSnapshotUseCase?: IConfigSnapshotUseCase;
  private _configSnapshotScheduleUseCase?: IConfigSnapshotScheduleUseCase;

  constructor(options?: ContainerOptions | string) {
    if (typeof options === 'string') {
      // Backward compatibility: rootDir as string
      this.paths = new Paths(options);
      this.sudoPassword = undefined;
    } else if (options) {
      this.paths = new Paths(options.rootDir);
      this.sudoPassword = options.sudoPassword;
    } else {
      this.paths = new Paths();
      this.sudoPassword = undefined;
    }
  }

  // ========================================
  // Ports (Adapters)
  // ========================================

  get promptPort(): IPromptPort {
    if (!this._promptPort) {
      this._promptPort = new ClackPromptAdapter();
    }
    return this._promptPort;
  }

  get shellPort(): IShellPort {
    if (!this._shellPort) {
      this._shellPort = new ShellAdapter({
        paths: this.paths,
        sudoPassword: this.sudoPassword,
      });
    }
    return this._shellPort;
  }

  get serverRepository(): IServerRepository {
    if (!this._serverRepo) {
      this._serverRepo = new ServerRepository(this.paths);
    }
    return this._serverRepo;
  }

  get worldRepository(): IWorldRepository {
    if (!this._worldRepo) {
      this._worldRepo = new WorldRepository(this.paths);
    }
    return this._worldRepo;
  }

  get docProvider(): IDocProvider {
    if (!this._docProvider) {
      this._docProvider = new DocsAdapter(this.paths.root);
    }
    return this._docProvider;
  }

  get auditLogPort(): IAuditLogPort {
    if (!this._auditLogPort) {
      const dbPath = join(this.paths.root, 'data', 'audit.db');
      this._auditLogPort = new SqliteAuditLogRepository(dbPath);
    }
    return this._auditLogPort;
  }

  get modSourcePort(): IModSourcePort {
    if (!this._modSourcePort) {
      this._modSourcePort = new ModrinthAdapter();
    }
    return this._modSourcePort;
  }

  get backupScheduleRepository(): IBackupScheduleRepository {
    if (!this._backupScheduleRepo) {
      const dbPath = join(this.paths.root, 'backups', 'meta', 'backup-schedules.db');
      this._backupScheduleRepo = new SqliteBackupScheduleRepository(dbPath);
    }
    return this._backupScheduleRepo;
  }

  get configSnapshotDatabase(): ConfigSnapshotDatabase {
    if (!this._configSnapshotDatabase) {
      const dbPath = join(this.paths.root, 'backups', 'meta', 'config-snapshots.db');
      this._configSnapshotDatabase = new ConfigSnapshotDatabase(dbPath);
    }
    return this._configSnapshotDatabase;
  }

  get configSnapshotUseCase(): IConfigSnapshotUseCase {
    if (!this._configSnapshotUseCase) {
      const repository = new SqliteConfigSnapshotRepository(
        this.configSnapshotDatabase
      );
      const storageBasePath = join(
        this.paths.root,
        'backups',
        'meta',
        'config-snapshot-storage'
      );
      const storage = new FileSystemConfigSnapshotStorage(storageBasePath);
      const collector = new FileSystemConfigFileCollector(this.paths.servers);
      this._configSnapshotUseCase = new ConfigSnapshotUseCaseImpl(
        repository,
        storage,
        collector
      );
    }
    return this._configSnapshotUseCase;
  }

  get configSnapshotScheduleUseCase(): IConfigSnapshotScheduleUseCase {
    if (!this._configSnapshotScheduleUseCase) {
      const repository = new SqliteConfigSnapshotScheduleRepository(
        this.configSnapshotDatabase
      );
      this._configSnapshotScheduleUseCase =
        new ConfigSnapshotScheduleUseCaseImpl(repository);
    }
    return this._configSnapshotScheduleUseCase;
  }

  // ========================================
  // Use Cases
  // ========================================

  get createServerUseCase(): ICreateServerUseCase {
    return new CreateServerUseCase(
      this.promptPort,
      this.shellPort,
      this.serverRepository,
      this.paths,
      this.worldRepository,
      this.auditLogPort,
      this.modSourcePort
    );
  }

  get deleteServerUseCase(): IDeleteServerUseCase {
    return new DeleteServerUseCase(
      this.promptPort,
      this.shellPort,
      this.serverRepository,
      this.auditLogPort
    );
  }

  get serverStatusUseCase(): IServerStatusUseCase {
    return new ServerStatusUseCase(
      this.promptPort,
      this.shellPort,
      this.serverRepository
    );
  }

  get worldManagementUseCase(): IWorldManagementUseCase {
    return new WorldManagementUseCase(
      this.promptPort,
      this.shellPort,
      this.worldRepository,
      this.serverRepository
    );
  }

  get backupUseCase(): IBackupUseCase {
    return new BackupUseCase(this.promptPort, this.shellPort);
  }

  get playerLookupUseCase(): IPlayerLookupUseCase {
    return new PlayerLookupUseCase(this.promptPort, this.shellPort);
  }

  get backupScheduleUseCase(): IBackupScheduleUseCase {
    return new BackupScheduleUseCase(this.backupScheduleRepository);
  }

  // ========================================
  // Factory
  // ========================================

  /**
   * Create a container with default configuration
   */
  static create(options?: ContainerOptions | string): Container {
    return new Container(options);
  }

  /**
   * Create a container with custom adapters (for testing)
   */
  static createWithAdapters(
    promptPort: IPromptPort,
    shellPort: IShellPort,
    serverRepo: IServerRepository,
    worldRepo: IWorldRepository
  ): Container {
    const container = new Container();
    container._promptPort = promptPort;
    container._shellPort = shellPort;
    container._serverRepo = serverRepo;
    container._worldRepo = worldRepo;
    return container;
  }
}

/**
 * Global container instance
 */
let globalContainer: Container | null = null;
let globalContainerOptions: ContainerOptions | undefined = undefined;

/**
 * Get or create the global container
 */
export function getContainer(options?: ContainerOptions | string): Container {
  // Convert string to options for comparison
  const normalizedOptions: ContainerOptions | undefined =
    typeof options === 'string' ? { rootDir: options } : options;

  // Check if we need to recreate the container (options changed)
  const optionsChanged =
    globalContainerOptions?.rootDir !== normalizedOptions?.rootDir ||
    globalContainerOptions?.sudoPassword !== normalizedOptions?.sudoPassword;

  if (!globalContainer || optionsChanged) {
    globalContainer = Container.create(normalizedOptions);
    globalContainerOptions = normalizedOptions;
  }
  return globalContainer;
}

/**
 * Reset the global container (for testing)
 */
export function resetContainer(): void {
  globalContainer = null;
}
