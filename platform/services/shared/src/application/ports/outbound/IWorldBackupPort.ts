import type { BackupRetentionPolicy } from '../../../domain/index.js';

/**
 * World Backup Port - Outbound Port (ADR-0001, "Backup Port (#732, S3)")
 *
 * Git backup of `worlds/` and server-internal worlds. Every method resolves;
 * a failure is `{ ok: false, error }`, never a rejection.
 */
export type WorldBackupErrorCode =
  | 'not_configured'
  | 'locked'
  | 'recovery_required'
  | 'runtime_unavailable'
  | 'servers_running'
  | 'flush_failed'
  | 'missing_worlds'
  | 'unsupported_layout'
  | 'restore_conflict'
  | 'commit_not_found'
  | 'empty_source'
  | 'auth_failed'
  | 'repo_not_found'
  | 'git_too_old'
  | 'timeout'
  | 'lease_conflict'
  | 'git_failed'
  | 'io_failed'
  | 'aborted';

export interface BackupLockHolder {
  pid: number;
  hostname: string;
  /** Host boot time in ms (Date.now() - uptime); detects a reboot. */
  bootTime: number;
  nonce: string;
  op: 'push' | 'restore' | 'prune';
  startedAt: string;
}

export interface WorldBackupError {
  code: WorldBackupErrorCode;
  message: string;
  paths?: string[];
  servers?: string[];
  holder?: BackupLockHolder;
}

export type WorldBackupResult<T> = { ok: true; value: T } | { ok: false; error: WorldBackupError };

export interface LockOptions {
  /** How long to wait for another backup operation. Default 0 (fail fast). */
  lockWaitMs?: number;
}

export interface WorldBackupStatus {
  /** BACKUP_GITHUB_TOKEN and BACKUP_GITHUB_REPO are both non-empty. */
  configured: boolean;
  repository?: string;
  branch: string;
  autoOnStop: boolean;
  /** Tip of the local cache (may be unpushed after a failed push). */
  lastBackup?: { commit: string; date: Date };
}

export interface WorldBackupCommit {
  /** Full hash. */
  hash: string;
  date: Date;
  author: string;
  message: string;
}

export interface WorldBackupPushOptions extends LockOptions {
  message?: string;
  /** Consent to drop worlds that are in the last backup but missing from the source. */
  allowMissing?: boolean;
  /**
   * Stop as soon as it is safe (before the next save-off, or at the next
   * copied file) and fail with `aborted`. Servers already flushed get save-on
   * before push resolves, so a process can abort and then exit (#734).
   */
  signal?: AbortSignal;
}

export interface WorldBackupPushOutcome {
  /** A new commit was created. */
  changed: boolean;
  commit?: string;
  /** Servers that were flushed (server names). */
  flushed: string[];
  /** Servers whose internal world was not backed up, with the reason. */
  skipped: string[];
  warnings: string[];
}

export interface WorldBackupRestoreOutcome {
  /** Full hash of the restored commit. */
  commit: string;
  /** Slot holding the replaced data. */
  previousDir: string;
  skipped: string[];
}

export interface WorldBackupPruneOutcome {
  removed: number;
  warnings: string[];
}

export interface IWorldBackupPort {
  status(): Promise<WorldBackupResult<WorldBackupStatus>>;
  /** Newest first, at most `limit` (default 20). [] when there is no cache. */
  history(limit?: number): Promise<WorldBackupResult<WorldBackupCommit[]>>;
  push(options?: WorldBackupPushOptions): Promise<WorldBackupResult<WorldBackupPushOutcome>>;
  restore(commit: string, options?: LockOptions): Promise<WorldBackupResult<WorldBackupRestoreOutcome>>;
  prune(policy: BackupRetentionPolicy, options?: LockOptions): Promise<WorldBackupResult<WorldBackupPruneOutcome>>;
  /** Checks token and repository with `git ls-remote`. Reads no .env and takes no lock. */
  testConnection(credentials: { token: string; repository: string }): Promise<WorldBackupResult<void>>;
}
