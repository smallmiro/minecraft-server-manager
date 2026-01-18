/**
 * WorldOptions Value Object
 * Represents world configuration options for server creation
 */
export enum WorldSetupType {
  NEW = 'new',
  EXISTING = 'existing',
  DOWNLOAD = 'download',
}

export interface WorldOptionsData {
  setupType: WorldSetupType;
  seed?: string;
  worldName?: string;
  downloadUrl?: string;
}

export class WorldOptions {
  private constructor(private readonly _data: WorldOptionsData) {
    Object.freeze(this);
    Object.freeze(this._data);
  }

  get setupType(): WorldSetupType {
    return this._data.setupType;
  }

  get seed(): string | undefined {
    return this._data.seed;
  }

  get worldName(): string | undefined {
    return this._data.worldName;
  }

  get downloadUrl(): string | undefined {
    return this._data.downloadUrl;
  }

  get isNewWorld(): boolean {
    return this._data.setupType === WorldSetupType.NEW;
  }

  get isExistingWorld(): boolean {
    return this._data.setupType === WorldSetupType.EXISTING;
  }

  get isDownloadWorld(): boolean {
    return this._data.setupType === WorldSetupType.DOWNLOAD;
  }

  /**
   * Convert to CLI arguments for create-server.sh
   */
  toCliArgs(): string[] {
    const args: string[] = [];

    switch (this._data.setupType) {
      case WorldSetupType.NEW:
        if (this._data.seed) {
          args.push('-s', this._data.seed);
        }
        break;
      case WorldSetupType.EXISTING:
        if (this._data.worldName) {
          args.push('-w', this._data.worldName);
        }
        break;
      case WorldSetupType.DOWNLOAD:
        if (this._data.downloadUrl) {
          args.push('-u', this._data.downloadUrl);
        }
        break;
    }

    return args;
  }

  /**
   * Create new world options (optionally with seed)
   */
  static newWorld(seed?: string): WorldOptions {
    if (seed !== undefined) {
      const trimmedSeed = seed.trim();
      if (!trimmedSeed) {
        throw new Error('World seed cannot be empty if provided');
      }
      // Seed can be any string or number
      return new WorldOptions({
        setupType: WorldSetupType.NEW,
        seed: trimmedSeed,
      });
    }

    return new WorldOptions({
      setupType: WorldSetupType.NEW,
    });
  }

  /**
   * Use existing world from worlds/ directory
   */
  static existingWorld(worldName: string): WorldOptions {
    const trimmed = worldName.trim();

    if (!trimmed) {
      throw new Error('World name cannot be empty');
    }

    // World name validation: lowercase letters, numbers, hyphens, underscores
    if (!/^[a-z0-9_-]+$/i.test(trimmed)) {
      throw new Error(
        'World name can only contain letters, numbers, hyphens, and underscores'
      );
    }

    return new WorldOptions({
      setupType: WorldSetupType.EXISTING,
      worldName: trimmed,
    });
  }

  /**
   * Download world from URL (ZIP file)
   */
  static downloadWorld(url: string): WorldOptions {
    const trimmed = url.trim();

    if (!trimmed) {
      throw new Error('Download URL cannot be empty');
    }

    // Basic URL validation
    try {
      const parsedUrl = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Download URL must use HTTP or HTTPS protocol');
      }
    } catch (error) {
      // Re-throw if it's our protocol error
      if (error instanceof Error && error.message.includes('HTTP or HTTPS')) {
        throw error;
      }
      throw new Error(`Invalid download URL: ${trimmed}`);
    }

    return new WorldOptions({
      setupType: WorldSetupType.DOWNLOAD,
      downloadUrl: trimmed,
    });
  }

  /**
   * Default: new world without seed
   */
  static default(): WorldOptions {
    return WorldOptions.newWorld();
  }

  equals(other: WorldOptions): boolean {
    return (
      this._data.setupType === other._data.setupType &&
      this._data.seed === other._data.seed &&
      this._data.worldName === other._data.worldName &&
      this._data.downloadUrl === other._data.downloadUrl
    );
  }

  toString(): string {
    switch (this._data.setupType) {
      case WorldSetupType.NEW:
        return this._data.seed ? `New world (seed: ${this._data.seed})` : 'New world';
      case WorldSetupType.EXISTING:
        return `Existing world: ${this._data.worldName}`;
      case WorldSetupType.DOWNLOAD:
        return `Download from: ${this._data.downloadUrl}`;
    }
  }
}
