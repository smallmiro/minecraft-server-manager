import { Paths } from '@minecraft-docker/shared';
import {
  ClackPromptAdapter,
  ShellAdapter,
  ServerRepository,
  WorldRepository,
} from '../adapters/index.js';
import {
  CreateServerUseCase,
  DeleteServerUseCase,
  ServerStatusUseCase,
  WorldManagementUseCase,
  BackupUseCase,
  PlayerLookupUseCase,
} from '../../application/use-cases/index.js';
import type {
  IPromptPort,
  IShellPort,
  IServerRepository,
  IWorldRepository,
  ICreateServerUseCase,
  IDeleteServerUseCase,
  IServerStatusUseCase,
  IWorldManagementUseCase,
  IBackupUseCase,
  IPlayerLookupUseCase,
} from '../../application/ports/index.js';

/**
 * Dependency Injection Container
 * Manages creation and lifecycle of dependencies
 */
export class Container {
  private readonly paths: Paths;

  // Adapters (singleton)
  private _promptPort?: IPromptPort;
  private _shellPort?: IShellPort;
  private _serverRepo?: IServerRepository;
  private _worldRepo?: IWorldRepository;

  constructor(rootDir?: string) {
    this.paths = new Paths(rootDir);
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
      this._shellPort = new ShellAdapter(this.paths);
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

  // ========================================
  // Use Cases
  // ========================================

  get createServerUseCase(): ICreateServerUseCase {
    return new CreateServerUseCase(
      this.promptPort,
      this.shellPort,
      this.serverRepository
    );
  }

  get deleteServerUseCase(): IDeleteServerUseCase {
    return new DeleteServerUseCase(
      this.promptPort,
      this.shellPort,
      this.serverRepository
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

  // ========================================
  // Factory
  // ========================================

  /**
   * Create a container with default configuration
   */
  static create(rootDir?: string): Container {
    return new Container(rootDir);
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

/**
 * Get or create the global container
 */
export function getContainer(rootDir?: string): Container {
  if (!globalContainer) {
    globalContainer = Container.create(rootDir);
  }
  return globalContainer;
}

/**
 * Reset the global container (for testing)
 */
export function resetContainer(): void {
  globalContainer = null;
}
