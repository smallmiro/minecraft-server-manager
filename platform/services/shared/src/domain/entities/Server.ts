import { ServerName } from '../value-objects/ServerName.js';
import { ServerType } from '../value-objects/ServerType.js';
import { McVersion } from '../value-objects/McVersion.js';
import { Memory } from '../value-objects/Memory.js';
import { WorldOptions } from '../value-objects/WorldOptions.js';

/**
 * Server status enumeration
 */
export enum ServerStatus {
  RUNNING = 'running',
  STOPPED = 'stopped',
  STARTING = 'starting',
  STOPPING = 'stopping',
  ERROR = 'error',
  UNKNOWN = 'unknown',
}

/**
 * Server configuration interface
 */
export interface ServerConfig {
  name: ServerName;
  type: ServerType;
  version: McVersion;
  memory: Memory;
  worldOptions: WorldOptions;
  rconPassword?: string;
  autoStart?: boolean;
}

/**
 * Server entity
 * Represents a Minecraft server instance
 */
export class Server {
  private readonly _config: ServerConfig;
  private _status: ServerStatus;
  private _playerCount: number;

  constructor(config: ServerConfig) {
    this._config = { ...config };
    this._status = ServerStatus.UNKNOWN;
    this._playerCount = 0;
  }

  // Getters for configuration
  get name(): ServerName {
    return this._config.name;
  }

  get type(): ServerType {
    return this._config.type;
  }

  get version(): McVersion {
    return this._config.version;
  }

  get memory(): Memory {
    return this._config.memory;
  }

  get worldOptions(): WorldOptions {
    return this._config.worldOptions;
  }

  get rconPassword(): string | undefined {
    return this._config.rconPassword;
  }

  get autoStart(): boolean {
    return this._config.autoStart ?? true;
  }

  // Status management
  get status(): ServerStatus {
    return this._status;
  }

  get playerCount(): number {
    return this._playerCount;
  }

  get isRunning(): boolean {
    return this._status === ServerStatus.RUNNING;
  }

  get isStopped(): boolean {
    return this._status === ServerStatus.STOPPED;
  }

  get hasPlayers(): boolean {
    return this._playerCount > 0;
  }

  // Status setters (called by infrastructure layer)
  setStatus(status: ServerStatus): void {
    this._status = status;
  }

  setPlayerCount(count: number): void {
    if (count < 0) {
      throw new Error('Player count cannot be negative');
    }
    this._playerCount = count;
  }

  /**
   * Container name for Docker
   */
  get containerName(): string {
    return this._config.name.containerName;
  }

  /**
   * Hostname for mc-router connection
   */
  get hostname(): string {
    return this._config.name.hostname;
  }

  /**
   * Convert to CLI arguments for create-server.sh
   */
  toCreateArgs(): string[] {
    const args: string[] = [];

    args.push('-t', this._config.type.value);
    args.push('-v', this._config.version.value);

    // Add world options
    args.push(...this._config.worldOptions.toCliArgs());

    if (!this.autoStart) {
      args.push('--no-start');
    }

    return args;
  }

  /**
   * Convert to environment variables for config.env
   */
  toEnvVars(): Record<string, string> {
    return {
      TYPE: this._config.type.value,
      VERSION: this._config.version.value,
      MEMORY: this._config.memory.value,
      ...(this._config.rconPassword && { RCON_PASSWORD: this._config.rconPassword }),
    };
  }

  /**
   * Create a new server with the given configuration
   */
  static create(config: ServerConfig): Server {
    return new Server(config);
  }

  /**
   * Create a minimal server configuration (for listing/status)
   */
  static fromStatus(
    name: string,
    type: string,
    version: string,
    status: ServerStatus,
    playerCount: number
  ): Server {
    const server = new Server({
      name: ServerName.create(name),
      type: ServerType.create(type),
      version: McVersion.create(version),
      memory: Memory.default(),
      worldOptions: WorldOptions.default(),
    });
    server.setStatus(status);
    server.setPlayerCount(playerCount);
    return server;
  }
}
