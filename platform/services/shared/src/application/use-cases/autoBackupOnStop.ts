import type {
  IWorldBackupPort,
  WorldBackupError,
  WorldBackupPushOutcome,
} from '../ports/outbound/IWorldBackupPort.js';

/** How long an auto-backup waits for another backup operation (same as `backup push --auto`). */
export const AUTO_BACKUP_LOCK_WAIT_MS = 600_000;

/**
 * How long mcctl-api's close waits for running auto-backups. The backup's
 * finally re-enables auto-save (save-on) on servers it flushed; shutdown
 * must not cut that off, so close aborts a backup still running near the end
 * of this wait and waits for its save-on.
 */
export const AUTO_BACKUP_CLOSE_WAIT_MS = 120_000;

/** PM2 kill_timeout for mcctl-api: the close wait plus a margin, so PM2 does not SIGKILL it first. */
export const API_PM2_KILL_TIMEOUT_MS = AUTO_BACKUP_CLOSE_WAIT_MS + 10_000;

export type AutoBackupOnStopResult =
  | { status: 'skipped' }
  | { status: 'done'; outcome: WorldBackupPushOutcome }
  | { status: 'failed'; error: WorldBackupError };

/**
 * Back up the worlds after `server` stopped, when BACKUP_AUTO_ON_STOP=true and
 * the backup is configured (#734; was `mcctl.sh stop`). Waits for the backup
 * lock, never consents to dropping worlds, never rejects: the caller reports a
 * failure without failing the stop (#732 B-Q9).
 */
export async function autoBackupOnStop(
  backup: IWorldBackupPort,
  server: string,
  options: { signal?: AbortSignal } = {}
): Promise<AutoBackupOnStopResult> {
  try {
    const status = await backup.status();
    if (!status.ok) return { status: 'failed', error: status.error };
    if (!status.value.configured || !status.value.autoOnStop) return { status: 'skipped' };

    const pushed = await backup.push({
      message: `Auto-backup after stopping ${server}`,
      lockWaitMs: AUTO_BACKUP_LOCK_WAIT_MS,
      signal: options.signal,
    });
    return pushed.ok ? { status: 'done', outcome: pushed.value } : { status: 'failed', error: pushed.error };
  } catch (error) {
    return { status: 'failed', error: { code: 'io_failed', message: error instanceof Error ? error.message : String(error) } };
  }
}
