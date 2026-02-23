/**
 * ConfigSnapshotFile Value Object
 * Represents a single file captured in a config snapshot
 * Equality is based on path + hash
 */

export interface ConfigSnapshotFileData {
  path: string;
  hash: string;
  size: number;
}

export class ConfigSnapshotFile {
  private readonly _path: string;
  private readonly _hash: string;
  private readonly _size: number;

  private constructor(data: ConfigSnapshotFileData) {
    this._path = data.path;
    this._hash = data.hash;
    this._size = data.size;
    Object.freeze(this);
  }

  get path(): string {
    return this._path;
  }

  get hash(): string {
    return this._hash;
  }

  get size(): number {
    return this._size;
  }

  /**
   * Create a validated ConfigSnapshotFile
   */
  static create(data: ConfigSnapshotFileData): ConfigSnapshotFile {
    const trimmedPath = data.path.trim();
    if (!trimmedPath) {
      throw new Error('path cannot be empty');
    }

    const trimmedHash = data.hash.trim();
    if (!trimmedHash) {
      throw new Error('hash cannot be empty');
    }

    if (!Number.isInteger(data.size)) {
      throw new Error('size must be a non-negative integer');
    }

    if (data.size < 0) {
      throw new Error('size must be non-negative');
    }

    return new ConfigSnapshotFile({
      path: trimmedPath,
      hash: trimmedHash,
      size: data.size,
    });
  }

  /**
   * Equality based on path + hash
   */
  equals(other: ConfigSnapshotFile): boolean {
    return this._path === other._path && this._hash === other._hash;
  }

  toJSON(): ConfigSnapshotFileData {
    return {
      path: this._path,
      hash: this._hash,
      size: this._size,
    };
  }

  toString(): string {
    return `${this._path} (${this._hash.substring(0, 8)}..., ${this._size} bytes)`;
  }
}
