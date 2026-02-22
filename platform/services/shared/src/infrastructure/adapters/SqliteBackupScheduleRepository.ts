import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { IBackupScheduleRepository } from '../../application/ports/outbound/IBackupScheduleRepository.js';
import {
  BackupSchedule,
  type BackupScheduleRow,
} from '../../domain/entities/BackupSchedule.js';

/**
 * SqliteBackupScheduleRepository
 * Implements IBackupScheduleRepository using SQLite database storage
 */
export class SqliteBackupScheduleRepository
  implements IBackupScheduleRepository
{
  private readonly db: Database.Database;

  /**
   * Create a new SqliteBackupScheduleRepository
   * @param dbPath - Path to the SQLite database file
   */
  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Open database connection
    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');

    // Run migrations
    this.migrate();
  }

  /**
   * Run database migrations
   */
  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backup_schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        retention_max_count INTEGER,
        retention_max_age_days INTEGER,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_run_at TEXT,
        last_run_status TEXT CHECK(last_run_status IS NULL OR last_run_status IN ('success', 'failure')),
        last_run_message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_backup_schedules_enabled ON backup_schedules(enabled);
      CREATE INDEX IF NOT EXISTS idx_backup_schedules_created_at ON backup_schedules(created_at);
    `);
  }

  /**
   * Save (insert or update) a backup schedule
   */
  async save(schedule: BackupSchedule): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO backup_schedules (
        id, name, cron_expression, retention_max_count, retention_max_age_days,
        enabled, last_run_at, last_run_status, last_run_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        cron_expression = excluded.cron_expression,
        retention_max_count = excluded.retention_max_count,
        retention_max_age_days = excluded.retention_max_age_days,
        enabled = excluded.enabled,
        last_run_at = excluded.last_run_at,
        last_run_status = excluded.last_run_status,
        last_run_message = excluded.last_run_message,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      schedule.id,
      schedule.name,
      schedule.cronExpression.expression,
      schedule.retentionPolicy.maxCount ?? null,
      schedule.retentionPolicy.maxAgeDays ?? null,
      schedule.enabled ? 1 : 0,
      schedule.lastRunAt?.toISOString() ?? null,
      schedule.lastRunStatus,
      schedule.lastRunMessage,
      schedule.createdAt.toISOString(),
      schedule.updatedAt.toISOString()
    );
  }

  /**
   * Find all backup schedules
   */
  async findAll(): Promise<BackupSchedule[]> {
    const stmt = this.db.prepare<[], BackupScheduleRow>(
      'SELECT * FROM backup_schedules ORDER BY created_at DESC'
    );
    const rows = stmt.all();
    return rows.map((row) => BackupSchedule.fromRaw(row));
  }

  /**
   * Find a backup schedule by ID
   */
  async findById(id: string): Promise<BackupSchedule | null> {
    const stmt = this.db.prepare<[string], BackupScheduleRow>(
      'SELECT * FROM backup_schedules WHERE id = ?'
    );
    const row = stmt.get(id);
    return row ? BackupSchedule.fromRaw(row) : null;
  }

  /**
   * Find all enabled backup schedules
   */
  async findEnabled(): Promise<BackupSchedule[]> {
    const stmt = this.db.prepare<[], BackupScheduleRow>(
      'SELECT * FROM backup_schedules WHERE enabled = 1 ORDER BY created_at ASC'
    );
    const rows = stmt.all();
    return rows.map((row) => BackupSchedule.fromRaw(row));
  }

  /**
   * Delete a backup schedule by ID
   */
  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM backup_schedules WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
