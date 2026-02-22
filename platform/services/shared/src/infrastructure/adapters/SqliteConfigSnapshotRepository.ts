import type Database from 'better-sqlite3';
import type { IConfigSnapshotRepository } from '../../application/ports/outbound/IConfigSnapshotRepository.js';
import {
  ConfigSnapshot,
  type ConfigSnapshotRow,
} from '../../domain/entities/ConfigSnapshot.js';
import type { ConfigSnapshotFileData } from '../../domain/value-objects/ConfigSnapshotFile.js';
import type { ConfigSnapshotDatabase } from './ConfigSnapshotDatabase.js';

/**
 * Database row for config_snapshot_files table
 */
interface ConfigSnapshotFileRow {
  id: number;
  snapshot_id: string;
  path: string;
  hash: string;
  size: number;
}

/**
 * Database row for config_snapshots table (without files JSON)
 */
interface ConfigSnapshotDbRow {
  id: string;
  server_name: string;
  description: string | null;
  schedule_id: string | null;
  created_at: string;
}

/**
 * SqliteConfigSnapshotRepository
 * Implements IConfigSnapshotRepository using SQLite database storage.
 * Stores snapshot metadata in config_snapshots table and file metadata
 * in a separate config_snapshot_files table with CASCADE delete.
 */
export class SqliteConfigSnapshotRepository implements IConfigSnapshotRepository {
  private readonly db: Database.Database;

  constructor(database: ConfigSnapshotDatabase) {
    this.db = database.getDatabase();
  }

  /**
   * Save a config snapshot with its files in a transaction
   */
  async save(snapshot: ConfigSnapshot): Promise<void> {
    const insertSnapshot = this.db.prepare(`
      INSERT INTO config_snapshots (id, server_name, description, schedule_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertFile = this.db.prepare(`
      INSERT INTO config_snapshot_files (snapshot_id, path, hash, size)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      insertSnapshot.run(
        snapshot.id,
        snapshot.serverName.value,
        snapshot.description || null,
        snapshot.scheduleId ?? null,
        snapshot.createdAt.toISOString()
      );

      for (const file of snapshot.files) {
        insertFile.run(snapshot.id, file.path, file.hash, file.size);
      }
    });

    transaction();
  }

  /**
   * Find a config snapshot by ID, including its files
   */
  async findById(id: string): Promise<ConfigSnapshot | null> {
    const snapshotStmt = this.db.prepare<[string], ConfigSnapshotDbRow>(
      'SELECT * FROM config_snapshots WHERE id = ?'
    );
    const snapshotRow = snapshotStmt.get(id);

    if (!snapshotRow) {
      return null;
    }

    const filesStmt = this.db.prepare<[string], ConfigSnapshotFileRow>(
      'SELECT * FROM config_snapshot_files WHERE snapshot_id = ? ORDER BY id ASC'
    );
    const fileRows = filesStmt.all(id);

    return this.toEntity(snapshotRow, fileRows);
  }

  /**
   * Find all config snapshots with pagination (across all servers)
   * Ordered by created_at DESC (newest first)
   */
  async findAll(limit?: number, offset?: number): Promise<ConfigSnapshot[]> {
    let query = 'SELECT * FROM config_snapshots ORDER BY created_at DESC';
    const params: unknown[] = [];

    if (limit !== undefined) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    if (offset !== undefined) {
      query += ' OFFSET ?';
      params.push(offset);
    }

    const stmt = this.db.prepare<unknown[], ConfigSnapshotDbRow>(query);
    const rows = stmt.all(...params);

    return Promise.all(rows.map((row) => this.loadFiles(row)));
  }

  /**
   * Find config snapshots by server name with pagination
   * Ordered by created_at DESC (newest first)
   */
  async findByServer(
    serverName: string,
    limit?: number,
    offset?: number
  ): Promise<ConfigSnapshot[]> {
    let query = 'SELECT * FROM config_snapshots WHERE server_name = ? ORDER BY created_at DESC';
    const params: unknown[] = [serverName];

    if (limit !== undefined) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    if (offset !== undefined) {
      query += ' OFFSET ?';
      params.push(offset);
    }

    const stmt = this.db.prepare<unknown[], ConfigSnapshotDbRow>(query);
    const rows = stmt.all(...params);

    return Promise.all(rows.map((row) => this.loadFiles(row)));
  }

  /**
   * Count config snapshots for a server
   */
  async countByServer(serverName: string): Promise<number> {
    const stmt = this.db.prepare<[string], { count: number }>(
      'SELECT COUNT(*) as count FROM config_snapshots WHERE server_name = ?'
    );
    const result = stmt.get(serverName);
    return result?.count ?? 0;
  }

  /**
   * Delete a config snapshot by ID
   * Files are automatically deleted via CASCADE
   */
  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM config_snapshots WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Delete all config snapshots for a server
   * Files are automatically deleted via CASCADE
   */
  async deleteByServer(serverName: string): Promise<void> {
    const stmt = this.db.prepare(
      'DELETE FROM config_snapshots WHERE server_name = ?'
    );
    stmt.run(serverName);
  }

  /**
   * Load files for a snapshot row and convert to entity
   */
  private async loadFiles(row: ConfigSnapshotDbRow): Promise<ConfigSnapshot> {
    const filesStmt = this.db.prepare<[string], ConfigSnapshotFileRow>(
      'SELECT * FROM config_snapshot_files WHERE snapshot_id = ? ORDER BY id ASC'
    );
    const fileRows = filesStmt.all(row.id);

    return this.toEntity(row, fileRows);
  }

  /**
   * Convert database rows to ConfigSnapshot entity
   */
  private toEntity(
    row: ConfigSnapshotDbRow,
    fileRows: ConfigSnapshotFileRow[]
  ): ConfigSnapshot {
    const filesData: ConfigSnapshotFileData[] = fileRows.map((f) => ({
      path: f.path,
      hash: f.hash,
      size: f.size,
    }));

    const snapshotRow: ConfigSnapshotRow = {
      id: row.id,
      server_name: row.server_name,
      description: row.description ?? '',
      schedule_id: row.schedule_id,
      created_at: row.created_at,
      files: JSON.stringify(filesData),
    };

    return ConfigSnapshot.fromRaw(snapshotRow);
  }
}
