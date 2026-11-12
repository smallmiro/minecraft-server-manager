import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { applySqliteSettings } from '../../utils/sqlite-settings.js';

/**
 * Open a SQLite database with the shared settings (#673), creating its
 * directory. `init` (migrations) runs on the new handle; if it throws, the
 * handle is closed and the error is rethrown.
 */
export function openSqlite(dbPath: string, init?: (db: Database.Database) => void): Database.Database {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  try {
    applySqliteSettings(db);
    init?.(db);
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}

/**
 * One SQLite handle opened on first use (#673). A database that cannot be
 * opened fails the calls that need it, not the constructor, and the next call
 * tries again. After `close()` it does not reopen.
 */
export class LazySqlite {
  private db: Database.Database | undefined;
  private closed = false;

  constructor(
    private readonly dbPath: string,
    private readonly init?: (db: Database.Database) => void
  ) {}

  get(): Database.Database {
    if (this.closed) throw new Error(`SQLite database is closed: ${this.dbPath}`);
    return (this.db ??= openSqlite(this.dbPath, this.init));
  }

  close(): void {
    this.closed = true;
    this.db?.close();
    this.db = undefined;
  }
}
