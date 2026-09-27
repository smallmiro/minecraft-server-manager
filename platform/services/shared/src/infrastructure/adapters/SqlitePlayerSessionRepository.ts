import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  IPlayerSessionRepository,
  PlayerSessionSummary,
} from '../../application/ports/outbound/IPlayerSessionRepository.js';
import { PlayerSession } from '../../domain/entities/PlayerSession.js';

interface PlayerSessionRow {
  id: number;
  server_name: string;
  player_name: string;
  joined_at: string;
  left_at: string | null;
}

/**
 * SqlitePlayerSessionRepository
 * Implements IPlayerSessionRepository using SQLite database storage with
 * better-sqlite3 (#528, Phase 4). Follows the same raw-SQL pattern as
 * `SqliteAuditLogRepository`.
 */
export class SqlitePlayerSessionRepository implements IPlayerSessionRepository {
  private readonly db: Database.Database;

  /**
   * Create a new SqlitePlayerSessionRepository
   * @param dbPath - Path to the SQLite database file
   */
  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS player_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_name TEXT NOT NULL,
        player_name TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        left_at TEXT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_player_sessions_server_player
        ON player_sessions(server_name, player_name COLLATE NOCASE);

      CREATE TABLE IF NOT EXISTS player_session_cursors (
        server_name TEXT PRIMARY KEY,
        last_ts TEXT NOT NULL
      );
    `);
  }

  async recordJoin(serverName: string, playerName: string, at: Date): Promise<void> {
    // Defensive: close any dangling open session first (e.g. a missed leave event).
    this.db
      .prepare(
        `UPDATE player_sessions SET left_at = ?
         WHERE server_name = ? AND player_name = ? COLLATE NOCASE AND left_at IS NULL`
      )
      .run(at.toISOString(), serverName, playerName);

    this.db
      .prepare(
        `INSERT INTO player_sessions (server_name, player_name, joined_at, left_at)
         VALUES (?, ?, ?, NULL)`
      )
      .run(serverName, playerName, at.toISOString());
  }

  async recordLeave(serverName: string, playerName: string, at: Date): Promise<void> {
    this.db
      .prepare(
        `UPDATE player_sessions SET left_at = ?
         WHERE server_name = ? AND player_name = ? COLLATE NOCASE AND left_at IS NULL`
      )
      .run(at.toISOString(), serverName, playerName);
  }

  async closeOpenSessions(serverName: string, at: Date): Promise<void> {
    this.db
      .prepare(`UPDATE player_sessions SET left_at = ? WHERE server_name = ? AND left_at IS NULL`)
      .run(at.toISOString(), serverName);
  }

  async listSessions(
    serverName: string,
    playerName: string,
    limit?: number
  ): Promise<PlayerSession[]> {
    let query = `SELECT * FROM player_sessions
                 WHERE server_name = ? AND player_name = ? COLLATE NOCASE
                 ORDER BY joined_at DESC`;
    const params: unknown[] = [serverName, playerName];
    if (limit !== undefined) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const rows = this.db.prepare<unknown[], PlayerSessionRow>(query).all(...params);
    return rows.map(toPlayerSession);
  }

  async getSummary(
    serverName: string,
    playerName: string,
    now: Date
  ): Promise<PlayerSessionSummary> {
    const rows = this.db
      .prepare<[string, string], PlayerSessionRow>(
        `SELECT * FROM player_sessions WHERE server_name = ? AND player_name = ? COLLATE NOCASE`
      )
      .all(serverName, playerName);

    if (rows.length === 0) {
      return { visitCount: 0, totalPlaytimeSeconds: 0, lastSeen: null };
    }

    let totalPlaytimeSeconds = 0;
    let lastSeen = -Infinity;
    for (const row of rows) {
      const joinedAt = new Date(row.joined_at).getTime();
      const end = row.left_at ? new Date(row.left_at).getTime() : now.getTime();
      totalPlaytimeSeconds += Math.max(0, Math.round((end - joinedAt) / 1000));
      if (end > lastSeen) lastSeen = end;
    }

    return {
      visitCount: rows.length,
      totalPlaytimeSeconds,
      lastSeen: new Date(lastSeen),
    };
  }

  async getCursor(serverName: string): Promise<Date | null> {
    const row = this.db
      .prepare<[string], { last_ts: string }>(
        `SELECT last_ts FROM player_session_cursors WHERE server_name = ?`
      )
      .get(serverName);
    return row ? new Date(row.last_ts) : null;
  }

  async setCursor(serverName: string, at: Date): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO player_session_cursors (server_name, last_ts) VALUES (?, ?)
         ON CONFLICT(server_name) DO UPDATE SET last_ts = excluded.last_ts`
      )
      .run(serverName, at.toISOString());
  }

  /** Close the database connection. */
  close(): void {
    this.db.close();
  }
}

function toPlayerSession(row: PlayerSessionRow): PlayerSession {
  return PlayerSession.create({
    id: row.id,
    serverName: row.server_name,
    playerName: row.player_name,
    joinedAt: new Date(row.joined_at),
    leftAt: row.left_at ? new Date(row.left_at) : null,
  });
}
