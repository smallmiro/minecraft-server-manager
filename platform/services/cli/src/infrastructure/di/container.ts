import { join } from 'node:path';
import {
  Paths,
  Config,
  // Infrastructure adapters from shared
  ShellAdapter,
  DockerServerConsoleAdapter,
  ServerRepository,
  WorldRepository,
  ConfigEnvWorldAssignmentAdapter,
  FileServerSpecRepository,
  AvahiHostnameRegistrarAdapter,
  resolveHostIps,
  DockerComposeRuntimeAdapter,
  DocsAdapter,
  SqliteAuditLogRepository,
  SqliteBackupScheduleRepository,
  ConfigSnapshotDatabase,
  SqliteConfigSnapshotRepository,
  SqliteConfigSnapshotScheduleRepository,
  FileSystemConfigSnapshotStorage,
  FileSystemConfigFileCollector,
  GitWorldBackupAdapter,
  DockerRuntimeEnvironmentAdapter,
  // Use cases from shared
  CreateServerUseCase,
  DeleteServerUseCase,
  WorldManagementUseCase,
  BackupUseCase,
  BackupScheduleUseCase,
  ConfigSnapshotUseCaseImpl,
  ConfigSnapshotScheduleUseCaseImpl,
  // Port types from shared
  type IPromptPort,
  type IShellPort,
  type IContainerRuntimePort,
  type IServerConsolePort,
  type IWorldBackupPort,
  type IServerRepository,
  type IWorldRepository,
  type IWorldAssignmentPort,
  type IDocProvider,
  type IAuditLogPort,
  type IModSourcePort,
  type ICreateServerUseCase,
  type IDeleteServerUseCase,
  type IBackupUseCase,
  type IBackupScheduleUseCase,
  type IBackupScheduleRepository,
  type IConfigSnapshotUseCase,
  type IConfigSnapshotScheduleUseCase,
} from '@minecraft-docker/shared';
import { ModrinthAdapter } from '@minecraft-docker/mod-source-modrinth';
// CLI-specific adapter
import { ClackPromptAdapter } from '../adapters/ClackPromptAdapter.js';
import { BestEffortAuditLogAdapter } from '../adapters/BestEffortAuditLogAdapter.js';

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
  private _worldBackupPort?: IWorldBackupPort;
  private _serverRepo?: IServerRepository;
  private _worldRepo?: IWorldRepository;
  private _worldAssignmentPort?: IWorldAssignmentPort;
  private _serverSpecRepo?: FileServerSpecRepository;
  private _containerRuntime?: IContainerRuntimePort;
  private _serverConsole?: IServerConsolePort;
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

  /** Same adapter as {@link containerRuntime} (kept for the logs command). */
  get runtimePort(): IContainerRuntimePort {
    return this.containerRuntime;
  }

  get serverRepository(): IServerRepository {
    if (!this._serverRepo) {
      this._serverRepo = new ServerRepository(this.paths, this.containerRuntime);
    }
    return this._serverRepo;
  }

  get worldRepository(): IWorldRepository {
    if (!this._worldRepo) {
      this._worldRepo = new WorldRepository(this.paths, this.worldAssignmentPort, this.containerRuntime);
    }
    return this._worldRepo;
  }

  get worldAssignmentPort(): IWorldAssignmentPort {
    if (!this._worldAssignmentPort) {
      // LEVEL and SEED writes go through the ServerSpec repository (#675), which checks the server is stopped
      this._worldAssignmentPort = new ConfigEnvWorldAssignmentAdapter(this.paths, this.serverSpecRepository);
    }
    return this._worldAssignmentPort;
  }

  /** Concrete type: `mcctl migrate spec --force` also uses importServer(). */
  get serverSpecRepository(): FileServerSpecRepository {
    if (!this._serverSpecRepo) {
      this._serverSpecRepo = new FileServerSpecRepository(this.paths, undefined, this.containerRuntime);
    }
    return this._serverSpecRepo;
  }

  get containerRuntime(): IContainerRuntimePort {
    if (!this._containerRuntime) {
      this._containerRuntime = new DockerComposeRuntimeAdapter({ root: this.paths.root });
    }
    return this._containerRuntime;
  }

  /** RCON access to a server (`mcctl rcon`, `mcctl console <server>`). */
  get serverConsolePort(): IServerConsolePort {
    if (!this._serverConsole) {
      this._serverConsole = new DockerServerConsoleAdapter();
    }
    return this._serverConsole;
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
      // Audit logging is auxiliary: never let a repository failure (e.g. better-sqlite3
      // ABI mismatch) turn a successful command into an error.
      this._auditLogPort = new BestEffortAuditLogAdapter(
        () => new SqliteAuditLogRepository(dbPath)
      );
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
        collector,
        this.worldAssignmentPort,
        this.containerRuntime
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
      new Config(this.paths),
      this.worldRepository,
      this.auditLogPort,
      this.modSourcePort,
      this.worldAssignmentPort,
      {
        specRepo: this.serverSpecRepository,
        hostnames: new AvahiHostnameRegistrarAdapter({ sudoPassword: this.sudoPassword }),
        // The first start can pull the image: create-server.sh ran compose up without a timeout.
        runtime: new DockerComposeRuntimeAdapter({ root: this.paths.root, startTimeoutMs: 30 * 60_000 }),
        hostIps: () => resolveHostIps(this.paths),
      }
    );
  }

  get deleteServerUseCase(): IDeleteServerUseCase {
    return new DeleteServerUseCase(
      this.promptPort,
      this.shellPort,
      this.serverRepository,
      this.auditLogPort,
      this.serverConsolePort,
      this.containerRuntime
    );
  }

  get worldManagementUseCase(): WorldManagementUseCase {
    return new WorldManagementUseCase(
      this.promptPort,
      undefined, // no shell since mcctl.sh was removed (#734)
      this.worldRepository,
      this.serverRepository,
      this.worldAssignmentPort,
      this.containerRuntime
    );
  }

  /** Git world backup (ADR-0001 "Backup Port", #732) */
  get worldBackupPort(): IWorldBackupPort {
    if (!this._worldBackupPort) {
      const root = this.paths.root;
      this._worldBackupPort = new GitWorldBackupAdapter({
        root,
        runtime: new DockerComposeRuntimeAdapter({ root }),
        environment: new DockerRuntimeEnvironmentAdapter(),
        console: this.serverConsolePort,
      });
    }
    return this._worldBackupPort;
  }

  get backupUseCase(): IBackupUseCase {
    return new BackupUseCase(this.promptPort, this.worldBackupPort);
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
