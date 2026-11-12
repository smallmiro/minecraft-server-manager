import type Database from 'better-sqlite3';

/**
 * busy_timeout for every SQLite handle (#673): how long a statement waits on a
 * database another connection has locked before failing with SQLITE_BUSY.
 * It equals better-sqlite3's own default (lib/database.js), now stated here.
 */
export const SQLITE_BUSY_TIMEOUT_MS = 5000;

/**
 * Connection settings shared by every SQLite handle (#673): wait on a locked
 * database instead of failing at once, WAL so readers don't block the writer,
 * and synchronous=NORMAL, which SQLite documents as safe under WAL. Type-only
 * import, so mcctl-console can use it without bundling the driver from here.
 */
export function applySqliteSettings(db: Database.Database): void {
  db.pragma(`busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
}
