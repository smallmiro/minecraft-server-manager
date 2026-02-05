import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { IAuditLogPort, AuditLogQueryOptions } from '../../application/ports/outbound/IAuditLogPort.js';
import { AuditLog, type AuditLogData, type AuditLogRow } from '../../domain/entities/AuditLog.js';
import type { AuditActionEnum } from '../../domain/value-objects/AuditAction.js';

/**
 * SqliteAuditLogRepository
 * Implements IAuditLogPort using SQLite database storage with better-sqlite3
 */
export class SqliteAuditLogRepository implements IAuditLogPort {
  private readonly db: Database.Database;
  private logCallCount = 0;
  private lastCleanupTime = Date.now();

  // Auto-cleanup configuration from environment
  private readonly autoCleanupEnabled: boolean;
  private readonly retentionDays: number;
  private readonly cleanupCheckInterval = 100; // Check every 100 log calls
  private readonly cleanupTimeThreshold = 24 * 60 * 60 * 1000; // 24 hours in ms

  /**
   * Create a new SqliteAuditLogRepository
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

    // Initialize auto-cleanup settings from environment
    this.autoCleanupEnabled = process.env.AUDIT_AUTO_CLEANUP === 'true';
    this.retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '90', 10);
  }

  /**
   * Run database migrations
   * Creates tables and indexes if they don't exist
   */
  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_name TEXT NOT NULL,
        details TEXT,
        status TEXT NOT NULL CHECK(status IN ('success', 'failure')),
        error_message TEXT,
        timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_name);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
    `);
  }

  /**
   * Log an audit entry
   */
  async log(entry: AuditLogData): Promise<void> {
    // Create AuditLog entity to ensure id and timestamp are set
    const log = AuditLog.create(entry);

    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (id, action, actor, target_type, target_name, details, status, error_message, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      log.id,
      log.action,
      log.actor,
      log.targetType,
      log.targetName,
      log.details ? JSON.stringify(log.details) : null,
      log.status,
      log.errorMessage ?? null,
      log.timestamp.toISOString()
    );

    // Increment call count and check if cleanup is needed
    this.logCallCount++;
    this.checkAndRunAutoCleanup();
  }

  /**
   * Check if auto-cleanup should run and execute it if needed
   */
  private checkAndRunAutoCleanup(): void {
    if (!this.autoCleanupEnabled) {
      return;
    }

    const now = Date.now();
    const timeSinceLastCleanup = now - this.lastCleanupTime;

    // Run cleanup if either:
    // 1. We've logged enough entries since last cleanup
    // 2. Enough time has passed since last cleanup
    if (
      this.logCallCount >= this.cleanupCheckInterval ||
      timeSinceLastCleanup >= this.cleanupTimeThreshold
    ) {
      const cutoffDate = new Date(now - this.retentionDays * 24 * 60 * 60 * 1000);
      this.deleteOlderThan(cutoffDate).catch((error) => {
        // Log error but don't throw - auto-cleanup is best-effort
        console.error('Auto-cleanup failed:', error);
      });

      this.logCallCount = 0;
      this.lastCleanupTime = now;
    }
  }

  /**
   * Find all audit logs with optional filtering
   */
  async findAll(options?: AuditLogQueryOptions): Promise<AuditLog[]> {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: unknown[] = [];

    if (options) {
      if (options.action !== undefined) {
        query += ' AND action = ?';
        params.push(options.action);
      }
      if (options.actor !== undefined) {
        query += ' AND actor = ?';
        params.push(options.actor);
      }
      if (options.targetType !== undefined) {
        query += ' AND target_type = ?';
        params.push(options.targetType);
      }
      if (options.targetName !== undefined) {
        query += ' AND target_name = ?';
        params.push(options.targetName);
      }
      if (options.status !== undefined) {
        query += ' AND status = ?';
        params.push(options.status);
      }
      if (options.from !== undefined) {
        query += ' AND timestamp >= ?';
        params.push(options.from.toISOString());
      }
      if (options.to !== undefined) {
        query += ' AND timestamp <= ?';
        params.push(options.to.toISOString());
      }
    }

    query += ' ORDER BY timestamp DESC';

    if (options?.limit !== undefined) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset !== undefined) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const stmt = this.db.prepare<unknown[], AuditLogRow>(query);
    const rows = stmt.all(...params);

    return rows.map((row) => AuditLog.fromRaw(row));
  }

  /**
   * Find audit logs by target
   */
  async findByTarget(targetType: string, targetName: string): Promise<AuditLog[]> {
    const stmt = this.db.prepare<[string, string], AuditLogRow>(
      'SELECT * FROM audit_logs WHERE target_type = ? AND target_name = ? ORDER BY timestamp DESC'
    );
    const rows = stmt.all(targetType, targetName);

    return rows.map((row) => AuditLog.fromRaw(row));
  }

  /**
   * Find audit logs by action
   */
  async findByAction(action: AuditActionEnum): Promise<AuditLog[]> {
    const stmt = this.db.prepare<[string], AuditLogRow>(
      'SELECT * FROM audit_logs WHERE action = ? ORDER BY timestamp DESC'
    );
    const rows = stmt.all(action);

    return rows.map((row) => AuditLog.fromRaw(row));
  }

  /**
   * Find audit logs by actor
   */
  async findByActor(actor: string): Promise<AuditLog[]> {
    const stmt = this.db.prepare<[string], AuditLogRow>(
      'SELECT * FROM audit_logs WHERE actor = ? ORDER BY timestamp DESC'
    );
    const rows = stmt.all(actor);

    return rows.map((row) => AuditLog.fromRaw(row));
  }

  /**
   * Count audit logs with optional filtering
   */
  async count(options?: AuditLogQueryOptions): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1';
    const params: unknown[] = [];

    if (options) {
      if (options.action !== undefined) {
        query += ' AND action = ?';
        params.push(options.action);
      }
      if (options.actor !== undefined) {
        query += ' AND actor = ?';
        params.push(options.actor);
      }
      if (options.targetType !== undefined) {
        query += ' AND target_type = ?';
        params.push(options.targetType);
      }
      if (options.targetName !== undefined) {
        query += ' AND target_name = ?';
        params.push(options.targetName);
      }
      if (options.status !== undefined) {
        query += ' AND status = ?';
        params.push(options.status);
      }
      if (options.from !== undefined) {
        query += ' AND timestamp >= ?';
        params.push(options.from.toISOString());
      }
      if (options.to !== undefined) {
        query += ' AND timestamp <= ?';
        params.push(options.to.toISOString());
      }
    }

    const stmt = this.db.prepare<unknown[], { count: number }>(query);
    const result = stmt.get(...params);

    return result?.count ?? 0;
  }

  /**
   * Delete audit logs older than the specified date
   * @returns The number of logs deleted
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const stmt = this.db.prepare(
      'DELETE FROM audit_logs WHERE timestamp < ?'
    );
    const result = stmt.run(date.toISOString());

    return result.changes;
  }

  /**
   * Close the database connection
   * Should be called when the repository is no longer needed
   */
  close(): void {
    this.db.close();
  }
}
