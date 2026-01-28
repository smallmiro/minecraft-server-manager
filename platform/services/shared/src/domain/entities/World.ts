/**
 * World lock status
 */
export enum WorldLockStatus {
  UNLOCKED = 'unlocked',
  LOCKED = 'locked',
}

/**
 * World lock information
 */
export interface WorldLock {
  serverName: string;
  timestamp: Date;
  pid?: number;
}

/**
 * World entity
 * Represents a Minecraft world with lock management
 */
export class World {
  private readonly _name: string;
  private readonly _path: string;
  private _lockStatus: WorldLockStatus;
  private _lock?: WorldLock;
  private _sizeBytes?: number;
  private _lastModified?: Date;
  private _seed?: string;

  constructor(name: string, path: string) {
    this._name = name;
    this._path = path;
    this._lockStatus = WorldLockStatus.UNLOCKED;
  }

  get name(): string {
    return this._name;
  }

  get path(): string {
    return this._path;
  }

  get lockStatus(): WorldLockStatus {
    return this._lockStatus;
  }

  get lock(): WorldLock | undefined {
    return this._lock;
  }

  get isLocked(): boolean {
    return this._lockStatus === WorldLockStatus.LOCKED;
  }

  get isUnlocked(): boolean {
    return this._lockStatus === WorldLockStatus.UNLOCKED;
  }

  get lockedBy(): string | undefined {
    return this._lock?.serverName;
  }

  get sizeBytes(): number | undefined {
    return this._sizeBytes;
  }

  get lastModified(): Date | undefined {
    return this._lastModified;
  }

  get seed(): string | undefined {
    return this._seed;
  }

  /**
   * Get human-readable size
   */
  get sizeFormatted(): string {
    if (!this._sizeBytes) return 'Unknown';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = this._sizeBytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  /**
   * Lock the world to a server
   */
  lockTo(serverName: string, pid?: number): void {
    if (this._lockStatus === WorldLockStatus.LOCKED) {
      throw new Error(
        `World '${this._name}' is already locked by '${this._lock?.serverName}'`
      );
    }

    this._lockStatus = WorldLockStatus.LOCKED;
    this._lock = {
      serverName,
      timestamp: new Date(),
      pid,
    };
  }

  /**
   * Release the lock
   */
  release(): void {
    this._lockStatus = WorldLockStatus.UNLOCKED;
    this._lock = undefined;
  }

  /**
   * Force release (for stale locks)
   */
  forceRelease(): void {
    this._lockStatus = WorldLockStatus.UNLOCKED;
    this._lock = undefined;
  }

  /**
   * Set world metadata
   */
  setMetadata(sizeBytes: number, lastModified: Date, seed?: string): void {
    this._sizeBytes = sizeBytes;
    this._lastModified = lastModified;
    if (seed !== undefined) {
      this._seed = seed;
    }
  }

  /**
   * Set world seed
   */
  setSeed(seed: string): void {
    this._seed = seed;
  }

  /**
   * Check if lock is stale (older than specified minutes)
   */
  isLockStale(maxAgeMinutes: number = 60): boolean {
    if (!this._lock) return false;

    const now = new Date();
    const lockAge = (now.getTime() - this._lock.timestamp.getTime()) / (1000 * 60);
    return lockAge > maxAgeMinutes;
  }

  /**
   * Create world from directory listing
   */
  static fromDirectory(name: string, basePath: string): World {
    return new World(name, `${basePath}/${name}`);
  }

  /**
   * Create world with lock status
   */
  static withLock(
    name: string,
    path: string,
    serverName: string,
    timestamp: Date,
    pid?: number
  ): World {
    const world = new World(name, path);
    world._lockStatus = WorldLockStatus.LOCKED;
    world._lock = { serverName, timestamp, pid };
    return world;
  }
}
