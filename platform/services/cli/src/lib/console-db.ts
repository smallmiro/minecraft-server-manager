import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

// ============================================================
// Types
// ============================================================

export interface ConsoleUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  banned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConsoleUserParams {
  email: string;
  name: string;
  password: string;
  role?: string;
}

// ============================================================
// Password hashing (Better Auth compatible)
// ============================================================
// Better Auth uses @noble/hashes/scrypt with:
//   N=16384, r=16, p=1, dkLen=64
//   Format: hex(salt):hex(derivedKey)
//   Password normalized with NFKC

const SCRYPT_N = 16384;
const SCRYPT_R = 16;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_MAXMEM = 128 * SCRYPT_N * SCRYPT_R * 2;

function hashPassword(password: string): string {
  // Better Auth uses hex-encoded salt STRING as the scrypt salt parameter,
  // NOT raw bytes. We must match this behavior for compatibility.
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password.normalize('NFKC'), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return `${salt}:${key.toString('hex')}`;
}

function verifyPasswordHash(hash: string, password: string): boolean {
  const [salt, keyHex] = hash.split(':');
  if (!salt || !keyHex) return false;

  const expectedKey = Buffer.from(keyHex, 'hex');
  // Use hex string directly as salt (matching Better Auth's behavior)
  const derivedKey = scryptSync(password.normalize('NFKC'), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });

  return timingSafeEqual(derivedKey, expectedKey);
}

// ============================================================
// Schema SQL
// ============================================================

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  banned INTEGER DEFAULT 0,
  ban_reason TEXT,
  ban_expires INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS user_servers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'view',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS user_server_idx ON user_servers(user_id, server_id);
`;

// ============================================================
// ConsoleDatabase
// ============================================================

/**
 * Direct access to the mcctl-console Better Auth SQLite database.
 * Used by CLI to create/manage admin users without requiring
 * the console service to be running.
 */
export class ConsoleDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure parent directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * Create all Better Auth tables if they don't exist.
   */
  ensureSchema(): void {
    this.db.exec(SCHEMA_SQL);
  }

  /**
   * Create a new user with credential-based authentication.
   * Inserts into both `users` and `accounts` tables.
   */
  createUser(params: CreateConsoleUserParams): ConsoleUser {
    const { email, name, password, role = 'user' } = params;
    const now = Math.floor(Date.now() / 1000);
    const userId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    const accountId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    const passwordHash = hashPassword(password);

    const insertUser = this.db.prepare(`
      INSERT INTO users (id, name, email, email_verified, role, banned, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, 0, ?, ?)
    `);

    const insertAccount = this.db.prepare(`
      INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
      VALUES (?, ?, 'credential', ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      insertUser.run(userId, name, email, role, now, now);
      insertAccount.run(accountId, userId, userId, passwordHash, now, now);
    });

    transaction();

    return {
      id: userId,
      name,
      email,
      emailVerified: true,
      role,
      banned: false,
      createdAt: new Date(now * 1000),
      updatedAt: new Date(now * 1000),
    };
  }

  /**
   * Find a user by email address.
   */
  findUserByEmail(email: string): ConsoleUser | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email) as any;

    if (!row) return null;

    return this.mapRow(row);
  }

  /**
   * Get all users.
   */
  findAllUsers(): ConsoleUser[] {
    const rows = this.db
      .prepare('SELECT * FROM users ORDER BY created_at DESC')
      .all() as any[];

    return rows.map((row) => this.mapRow(row));
  }

  /**
   * Delete a user by ID. Cascades to accounts, sessions.
   */
  deleteUser(id: string): void {
    this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  /**
   * Update a user's role.
   */
  updateUserRole(id: string, role: string): void {
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
      .run(role, now, id);
  }

  /**
   * Update a user's password in the accounts table.
   */
  updatePassword(userId: string, newPassword: string): void {
    const now = Math.floor(Date.now() / 1000);
    const passwordHash = hashPassword(newPassword);
    this.db
      .prepare(
        "UPDATE accounts SET password = ?, updated_at = ? WHERE user_id = ? AND provider_id = 'credential'"
      )
      .run(passwordHash, now, userId);
  }

  /**
   * Verify a password against the stored hash.
   */
  verifyPassword(userId: string, password: string): boolean {
    const row = this.db
      .prepare(
        "SELECT password FROM accounts WHERE user_id = ? AND provider_id = 'credential'"
      )
      .get(userId) as { password: string } | undefined;

    if (!row?.password) return false;

    return verifyPasswordHash(row.password, password);
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }

  private mapRow(row: any): ConsoleUser {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      emailVerified: Boolean(row.email_verified),
      role: row.role,
      banned: Boolean(row.banned),
      createdAt: new Date(row.created_at * 1000),
      updatedAt: new Date(row.updated_at * 1000),
    };
  }
}
