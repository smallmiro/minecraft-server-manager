import type Database from 'better-sqlite3';
import { LazySqlite } from './sqlite.js';

/**
 * ConfigSnapshotDatabase
 * Manages SQLite database initialization and schema for Config Snapshot feature.
 * Provides shared database connection for snapshot and schedule repositories.
 */
export class ConfigSnapshotDatabase {
  private readonly sqlite: LazySqlite;

  /**
   * Create a new ConfigSnapshotDatabase
   * @param dbPath - Path to the SQLite database file, or ':memory:' for in-memory
   */
  constructor(dbPath: string) {
    this.sqlite = new LazySqlite(dbPath, (db) => this.migrate(db));
  }

  /** The database handle, opened with the shared settings on first use (#673). */
  private get db(): Database.Database {
    return this.sqlite.get();
  }

  /**
   * Get the underlying database connection
   */
  getDatabase(): Database.Database {
    return this.db;
  }

  /**
   * Run database migrations
   * Creates tables and indexes if they don't exist
   */
  private migrate(db: Database.Database): void {
    // Snapshots reference schedules and files reference snapshots
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE IF NOT EXISTS config_snapshot_schedules (
        id TEXT PRIMARY KEY,
        server_name TEXT NOT NULL,
        name TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        retention_count INTEGER NOT NULL DEFAULT 10,
        last_run_at TEXT,
        last_run_status TEXT CHECK(last_run_status IS NULL OR last_run_status IN ('success', 'failure')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_schedules_server ON config_snapshot_schedules(server_name);
      CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON config_snapshot_schedules(enabled);

      CREATE TABLE IF NOT EXISTS config_snapshots (
        id TEXT PRIMARY KEY,
        server_name TEXT NOT NULL,
        description TEXT,
        schedule_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (schedule_id) REFERENCES config_snapshot_schedules(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_config_snapshots_server ON config_snapshots(server_name);
      CREATE INDEX IF NOT EXISTS idx_config_snapshots_created ON config_snapshots(created_at DESC);

      CREATE TABLE IF NOT EXISTS config_snapshot_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id TEXT NOT NULL,
        path TEXT NOT NULL,
        hash TEXT NOT NULL,
        size INTEGER NOT NULL,
        FOREIGN KEY (snapshot_id) REFERENCES config_snapshots(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_snapshot_files_snapshot ON config_snapshot_files(snapshot_id);
    `);
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.sqlite.close();
  }
}
