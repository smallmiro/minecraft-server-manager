/**
 * Backup Use Case - Inbound Port
 * Manages world backups to GitHub
 */
export interface IBackupUseCase {
  /**
   * Set callback for saving configuration to .env
   */
  setConfigSaveCallback(callback: (config: Record<string, string | boolean>) => void | Promise<void>): void;

  /**
   * Interactive backup initialization
   */
  init(force?: boolean): Promise<BackupInitResult>;

  /**
   * Interactive backup push
   */
  push(): Promise<BackupPushResult>;

  /**
   * Push backup with message
   */
  pushWithMessage(message: string, options?: BackupPushOptions): Promise<BackupPushResult>;

  /**
   * Get backup status
   */
  status(): Promise<BackupStatusResult>;

  /**
   * Get backup history
   */
  history(): Promise<BackupHistoryResult[]>;

  /**
   * Interactive restore selection
   */
  restore(): Promise<BackupRestoreResult>;

  /**
   * Restore from specific commit
   */
  restoreFromCommit(commitHash: string): Promise<BackupRestoreResult>;
}

/**
 * Options for a non-interactive push
 */
export interface BackupPushOptions {
  /** Consent to drop worlds that are in the last backup but missing now. */
  allowMissing?: boolean;
  /** Wait this long for another backup operation (default 0). */
  lockWaitMs?: number;
}

/**
 * Backup push result
 */
export interface BackupPushResult {
  success: boolean;
  commitHash?: string;
  message?: string;
  worldsBackedUp?: string[];
  error?: string;
  /** IWorldBackupPort error code, when the push failed. */
  errorCode?: string;
  /** The backup succeeded without a new commit. */
  noChanges?: boolean;
  warnings?: string[];
}

/**
 * Backup status result
 */
export interface BackupStatusResult {
  configured: boolean;
  repository?: string;
  branch?: string;
  lastBackup?: Date;
  autoBackupEnabled?: boolean;
}

/**
 * Backup history entry
 */
export interface BackupHistoryResult {
  commitHash: string;
  message: string;
  date: Date;
  author: string;
}

/**
 * Backup restore result
 */
export interface BackupRestoreResult {
  success: boolean;
  commitHash: string;
  worldsRestored?: string[];
  error?: string;
  /** IWorldBackupPort error code, when the restore failed. */
  errorCode?: string;
  /** Where the replaced data was kept. */
  previousDir?: string;
}

/**
 * Backup init result
 */
export interface BackupInitResult {
  success: boolean;
  repository?: string;
  branch?: string;
  autoBackupEnabled?: boolean;
  error?: string;
}
