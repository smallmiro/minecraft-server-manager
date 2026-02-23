/**
 * SnapshotDiff Value Object
 * Represents the differences between two config snapshots
 */

import { FileDiff, type FileDiffData } from './FileDiff.js';

export interface SnapshotDiffData {
  baseSnapshotId: string;
  compareSnapshotId: string;
  changes: FileDiff[];
}

export interface SnapshotDiffSummary {
  added: number;
  modified: number;
  deleted: number;
}

export class SnapshotDiff {
  private readonly _baseSnapshotId: string;
  private readonly _compareSnapshotId: string;
  private readonly _changes: readonly FileDiff[];

  private constructor(data: SnapshotDiffData) {
    this._baseSnapshotId = data.baseSnapshotId;
    this._compareSnapshotId = data.compareSnapshotId;
    this._changes = Object.freeze([...data.changes]);
    Object.freeze(this);
  }

  get baseSnapshotId(): string {
    return this._baseSnapshotId;
  }

  get compareSnapshotId(): string {
    return this._compareSnapshotId;
  }

  get changes(): readonly FileDiff[] {
    return this._changes;
  }

  /**
   * Computed summary of changes by status
   */
  get summary(): SnapshotDiffSummary {
    let added = 0;
    let modified = 0;
    let deleted = 0;

    for (const change of this._changes) {
      switch (change.status) {
        case 'added':
          added++;
          break;
        case 'modified':
          modified++;
          break;
        case 'deleted':
          deleted++;
          break;
      }
    }

    return { added, modified, deleted };
  }

  /**
   * Whether there are any changes
   */
  get hasChanges(): boolean {
    return this._changes.length > 0;
  }

  /**
   * Create a validated SnapshotDiff
   */
  static create(data: SnapshotDiffData): SnapshotDiff {
    if (!data.baseSnapshotId.trim()) {
      throw new Error('baseSnapshotId cannot be empty');
    }

    if (!data.compareSnapshotId.trim()) {
      throw new Error('compareSnapshotId cannot be empty');
    }

    return new SnapshotDiff(data);
  }

  toJSON(): {
    baseSnapshotId: string;
    compareSnapshotId: string;
    changes: FileDiffData[];
    summary: SnapshotDiffSummary;
    hasChanges: boolean;
  } {
    return {
      baseSnapshotId: this._baseSnapshotId,
      compareSnapshotId: this._compareSnapshotId,
      changes: this._changes.map((c) => c.toJSON()),
      summary: this.summary,
      hasChanges: this.hasChanges,
    };
  }
}
