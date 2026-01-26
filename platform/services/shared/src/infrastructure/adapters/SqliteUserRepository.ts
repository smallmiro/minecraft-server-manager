import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import * as bcrypt from 'bcryptjs';
import type { IUserRepository } from '../../application/ports/outbound/IUserRepository.js';
import { User } from '../../domain/entities/User.js';
import { UserId } from '../../domain/value-objects/UserId.js';
import { Username } from '../../domain/value-objects/Username.js';

/**
 * Database row structure for users table
 */
interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  created_at: string;
  updated_at: string;
}

/**
 * SqliteUserRepository
 * Implements IUserRepository using SQLite database storage with better-sqlite3
 */
export class SqliteUserRepository implements IUserRepository {
  private static readonly SALT_ROUNDS = 10;
  private readonly db: Database.Database;

  /**
   * Create a new SqliteUserRepository
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
   * Creates tables and indexes if they don't exist
   */
  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'viewer')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    `);
  }

  /**
   * Find a user by their unique ID
   */
  async findById(id: UserId): Promise<User | null> {
    const stmt = this.db.prepare<[string], UserRow>(
      'SELECT * FROM users WHERE id = ?'
    );
    const row = stmt.get(id.value);

    if (!row) {
      return null;
    }

    return this.toUser(row);
  }

  /**
   * Find a user by their username (case-insensitive)
   */
  async findByUsername(username: Username): Promise<User | null> {
    // SQLite COLLATE NOCASE handles case-insensitive comparison
    const stmt = this.db.prepare<[string], UserRow>(
      'SELECT * FROM users WHERE username = ?'
    );
    const row = stmt.get(username.value);

    if (!row) {
      return null;
    }

    return this.toUser(row);
  }

  /**
   * Get all users in the system
   */
  async findAll(): Promise<User[]> {
    const stmt = this.db.prepare<[], UserRow>(
      'SELECT * FROM users ORDER BY created_at ASC'
    );
    const rows = stmt.all();

    return rows.map((row) => this.toUser(row));
  }

  /**
   * Save a user (create or update)
   * Uses INSERT OR REPLACE for upsert behavior
   */
  async save(user: User): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        password_hash = excluded.password_hash,
        role = excluded.role,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      user.id.value,
      user.username.value,
      user.passwordHash,
      user.role.value,
      user.createdAt.toISOString(),
      user.updatedAt.toISOString()
    );
  }

  /**
   * Delete a user by their ID
   */
  async delete(id: UserId): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    stmt.run(id.value);
  }

  /**
   * Get the total count of users
   */
  async count(): Promise<number> {
    const stmt = this.db.prepare<[], { count: number }>(
      'SELECT COUNT(*) as count FROM users'
    );
    const result = stmt.get();

    return result?.count ?? 0;
  }

  /**
   * Hash a password using bcrypt
   * @param password - Plain text password to hash
   * @returns Hashed password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SqliteUserRepository.SALT_ROUNDS);
  }

  /**
   * Verify a password against a hash
   * @param password - Plain text password to verify
   * @param hash - Password hash to verify against
   * @returns True if password matches, false otherwise
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Close the database connection
   * Should be called when the repository is no longer needed
   */
  close(): void {
    this.db.close();
  }

  /**
   * Convert a database row to a User entity
   */
  private toUser(row: UserRow): User {
    return User.fromRaw({
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
