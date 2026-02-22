/**
 * FileDiff Value Object
 * Represents the difference of a single file between two snapshots
 */

export type FileDiffStatus = 'added' | 'modified' | 'deleted';

const VALID_STATUSES: FileDiffStatus[] = ['added', 'modified', 'deleted'];

export interface FileDiffData {
  path: string;
  status: FileDiffStatus;
  oldContent?: string;
  newContent?: string;
  oldHash?: string;
  newHash?: string;
}

export class FileDiff {
  private readonly _path: string;
  private readonly _status: FileDiffStatus;
  private readonly _oldContent?: string;
  private readonly _newContent?: string;
  private readonly _oldHash?: string;
  private readonly _newHash?: string;

  private constructor(data: FileDiffData) {
    this._path = data.path;
    this._status = data.status;
    this._oldContent = data.oldContent;
    this._newContent = data.newContent;
    this._oldHash = data.oldHash;
    this._newHash = data.newHash;
    Object.freeze(this);
  }

  get path(): string {
    return this._path;
  }

  get status(): FileDiffStatus {
    return this._status;
  }

  get oldContent(): string | undefined {
    return this._oldContent;
  }

  get newContent(): string | undefined {
    return this._newContent;
  }

  get oldHash(): string | undefined {
    return this._oldHash;
  }

  get newHash(): string | undefined {
    return this._newHash;
  }

  /**
   * Create a validated FileDiff
   */
  static create(data: FileDiffData): FileDiff {
    const trimmedPath = data.path.trim();
    if (!trimmedPath) {
      throw new Error('path cannot be empty');
    }

    if (!VALID_STATUSES.includes(data.status)) {
      throw new Error(
        `Invalid status: "${data.status}". Must be one of: ${VALID_STATUSES.join(', ')}`
      );
    }

    return new FileDiff({
      ...data,
      path: trimmedPath,
    });
  }

  toJSON(): FileDiffData {
    return {
      path: this._path,
      status: this._status,
      oldContent: this._oldContent,
      newContent: this._newContent,
      oldHash: this._oldHash,
      newHash: this._newHash,
    };
  }
}
