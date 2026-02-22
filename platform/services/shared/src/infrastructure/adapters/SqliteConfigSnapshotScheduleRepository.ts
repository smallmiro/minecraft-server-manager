import type Database from 'better-sqlite3';
import type { IConfigSnapshotScheduleRepository } from '../../application/ports/outbound/IConfigSnapshotScheduleRepository.js';
import {
  ConfigSnapshotSchedule,
  type ConfigSnapshotScheduleRow,
} from '../../domain/entities/ConfigSnapshotSchedule.js';
import type { ConfigSnapshotDatabase } from './ConfigSnapshotDatabase.js';

/**
 * SqliteConfigSnapshotScheduleRepository
 * Implements IConfigSnapshotScheduleRepository using SQLite database storage.
 */
export class SqliteConfigSnapshotScheduleRepository
  implements IConfigSnapshotScheduleRepository
{
  private readonly db: Database.Database;

  constructor(database: ConfigSnapshotDatabase) {
    this.db = database.getDatabase();
  }

  /**
   * Save (insert) a config snapshot schedule
   */
  async save(schedule: ConfigSnapshotSchedule): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO config_snapshot_schedules (
        id, server_name, name, cron_expression, enabled,
        retention_count, last_run_at, last_run_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      schedule.id,
      schedule.serverName.value,
      schedule.name,
      schedule.cronExpression.expression,
      schedule.enabled ? 1 : 0,
      schedule.retentionCount,
      schedule.lastRunAt?.toISOString() ?? null,
      schedule.lastRunStatus,
      schedule.createdAt.toISOString(),
      schedule.updatedAt.toISOString()
    );
  }

  /**
   * Find a config snapshot schedule by ID
   */
  async findById(id: string): Promise<ConfigSnapshotSchedule | null> {
    const stmt = this.db.prepare<[string], ConfigSnapshotScheduleRow>(
      'SELECT * FROM config_snapshot_schedules WHERE id = ?'
    );
    const row = stmt.get(id);
    return row ? ConfigSnapshotSchedule.fromRaw(row) : null;
  }

  /**
   * Find config snapshot schedules by server name
   */
  async findByServer(
    serverName: string
  ): Promise<ConfigSnapshotSchedule[]> {
    const stmt = this.db.prepare<[string], ConfigSnapshotScheduleRow>(
      'SELECT * FROM config_snapshot_schedules WHERE server_name = ? ORDER BY created_at DESC'
    );
    const rows = stmt.all(serverName);
    return rows.map((row) => ConfigSnapshotSchedule.fromRaw(row));
  }

  /**
   * Find all enabled config snapshot schedules
   */
  async findAllEnabled(): Promise<ConfigSnapshotSchedule[]> {
    const stmt = this.db.prepare<[], ConfigSnapshotScheduleRow>(
      'SELECT * FROM config_snapshot_schedules WHERE enabled = 1 ORDER BY created_at ASC'
    );
    const rows = stmt.all();
    return rows.map((row) => ConfigSnapshotSchedule.fromRaw(row));
  }

  /**
   * Update an existing config snapshot schedule
   */
  async update(schedule: ConfigSnapshotSchedule): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE config_snapshot_schedules SET
        server_name = ?,
        name = ?,
        cron_expression = ?,
        enabled = ?,
        retention_count = ?,
        last_run_at = ?,
        last_run_status = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      schedule.serverName.value,
      schedule.name,
      schedule.cronExpression.expression,
      schedule.enabled ? 1 : 0,
      schedule.retentionCount,
      schedule.lastRunAt?.toISOString() ?? null,
      schedule.lastRunStatus,
      schedule.updatedAt.toISOString(),
      schedule.id
    );
  }

  /**
   * Delete a config snapshot schedule by ID
   */
  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare(
      'DELETE FROM config_snapshot_schedules WHERE id = ?'
    );
    stmt.run(id);
  }
}
