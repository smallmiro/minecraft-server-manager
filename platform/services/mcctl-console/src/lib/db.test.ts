import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'fs';
import path from 'path';

// Mock better-sqlite3 for testing
vi.mock('better-sqlite3', () => {
  const mockDb = {
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(),
    }),
    exec: vi.fn(),
    close: vi.fn(),
    pragma: vi.fn(),
  };
  return {
    default: vi.fn(() => mockDb),
  };
});

describe('db', () => {
  beforeEach(() => {
    vi.resetModules();
    // Set test database path
    process.env.DATABASE_URL = ':memory:';
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it('should export db instance', async () => {
    const { db } = await import('./db');
    expect(db).toBeDefined();
  });

  it('should export sqlite instance', async () => {
    const { sqlite } = await import('./db');
    expect(sqlite).toBeDefined();
  });

  it('should use DATABASE_URL environment variable', async () => {
    // Use :memory: to avoid file system operations
    process.env.DATABASE_URL = ':memory:';
    const { getDatabasePath } = await import('./db');
    expect(getDatabasePath()).toBe(':memory:');
  });

  it('should default to data/mcctl.db when DATABASE_URL is not set', async () => {
    delete process.env.DATABASE_URL;
    const { getDatabasePath } = await import('./db');
    const dbPath = getDatabasePath();
    expect(dbPath).toContain('data');
    expect(dbPath).toContain('mcctl.db');
  });
});
