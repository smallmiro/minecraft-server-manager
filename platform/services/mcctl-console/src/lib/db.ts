import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';

/**
 * Get the database file path from environment or default location
 */
export function getDatabasePath(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Default to data/mcctl.db in the project root
  const dataDir = path.join(process.cwd(), 'data');
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

/**
 * Drizzle ORM instance with schema
 */
export const db = drizzle(sqlite, { schema });

export type DB = typeof db;
