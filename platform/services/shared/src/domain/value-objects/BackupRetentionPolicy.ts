/**
 * BackupRetentionPolicy Value Object
 * Defines how many backups to keep and for how long
 */

export interface BackupRetentionPolicyData {
  maxCount?: number;
  maxAgeDays?: number;
}

export class BackupRetentionPolicy {
  private readonly _maxCount: number | undefined;
  private readonly _maxAgeDays: number | undefined;

  private constructor(data: BackupRetentionPolicyData) {
    this._maxCount = data.maxCount;
    this._maxAgeDays = data.maxAgeDays;
  }

  get maxCount(): number | undefined {
    return this._maxCount;
  }

  get maxAgeDays(): number | undefined {
    return this._maxAgeDays;
  }

  /**
   * Create a BackupRetentionPolicy with validation
   */
  static create(data: BackupRetentionPolicyData): BackupRetentionPolicy {
    if (data.maxCount !== undefined) {
      if (!Number.isInteger(data.maxCount) || data.maxCount < 1) {
        throw new Error('maxCount must be a positive integer (>= 1)');
      }
    }
    if (data.maxAgeDays !== undefined) {
      if (!Number.isInteger(data.maxAgeDays) || data.maxAgeDays < 1) {
        throw new Error('maxAgeDays must be a positive integer (>= 1)');
      }
    }
    return new BackupRetentionPolicy(data);
  }

  /**
   * Create default retention policy: 10 backups, 30 days
   */
  static default(): BackupRetentionPolicy {
    return new BackupRetentionPolicy({ maxCount: 10, maxAgeDays: 30 });
  }

  /**
   * Determine if pruning is needed based on current backup state
   */
  shouldPrune(backupCount: number, oldestBackupDate: Date): boolean {
    if (this._maxCount !== undefined && backupCount > this._maxCount) {
      return true;
    }
    if (this._maxAgeDays !== undefined) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - this._maxAgeDays);
      if (oldestBackupDate < cutoff) {
        return true;
      }
    }
    return false;
  }

  toJSON(): BackupRetentionPolicyData {
    return {
      maxCount: this._maxCount,
      maxAgeDays: this._maxAgeDays,
    };
  }

  equals(other: BackupRetentionPolicy): boolean {
    return (
      this._maxCount === other._maxCount &&
      this._maxAgeDays === other._maxAgeDays
    );
  }
}
