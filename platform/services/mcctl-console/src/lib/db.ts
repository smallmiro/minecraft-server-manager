import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';

/**
 * Get the database file path from environment or default location
 * Priority: DATABASE_URL > MCCTL_ROOT/data/mcctl.db > cwd/data/mcctl.db
 */
export function getDatabasePath(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Use MCCTL_ROOT if available (set by ecosystem.config.cjs via PM2)
  const rootDir = process.env.MCCTL_ROOT || process.cwd();
  const dataDir = path.join(rootDir, 'data');
  return path.join(dataDir, 'mcctl.db');
}

/**
 * Ensure the database directory exists
 */
function ensureDbDirectory(dbPath: string): void {
  if (dbPath === ':memory:') return;

  const dir = path.dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

const dbPath = getDatabasePath();
ensureDbDirectory(dbPath);

/**
 * SQLite database instance (better-sqlite3)
 */
export const sqlite = new Database(dbPath);

// Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Auto-create tables if they don't exist (e.g. first run or DB file recreated)
sqlite.exec(`
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
`);

/**
 * Drizzle ORM instance with schema
 */
export const db = drizzle(sqlite, { schema });

export type DB = typeof db;
