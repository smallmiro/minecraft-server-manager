import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openSqlite, LazySqlite } from '../src/infrastructure/adapters/sqlite.js';
import { SQLITE_BUSY_TIMEOUT_MS } from '../src/utils/sqlite-settings.js';

describe('openSqlite (#673)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'open-sqlite-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('sets busy_timeout, WAL and synchronous=NORMAL, creating the parent directory', () => {
    const db = openSqlite(join(dir, 'nested', 'a.db'));
    try {
      expect(SQLITE_BUSY_TIMEOUT_MS).toBe(5000);
      expect(db.pragma('busy_timeout', { simple: true })).toBe(SQLITE_BUSY_TIMEOUT_MS);
      expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(db.pragma('synchronous', { simple: true })).toBe(1); // NORMAL
    } finally {
      db.close();
    }
  });

  test('runs init on the new handle and closes it when init throws', () => {
    let seen: { open: boolean } | undefined;
    expect(() =>
      openSqlite(join(dir, 'b.db'), (db) => {
        seen = db;
        throw new Error('migration failed');
      })
    ).toThrow('migration failed');
    expect(seen?.open).toBe(false);
  });
});

describe('LazySqlite (#673)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lazy-sqlite-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('opens on the first get() and returns the same handle after', () => {
    const path = join(dir, 'sub', 'c.db');
    const lazy = new LazySqlite(path);
    expect(existsSync(path)).toBe(false);
    const db = lazy.get();
    expect(lazy.get()).toBe(db);
    expect(existsSync(path)).toBe(true);
    lazy.close();
  });

  test('a path that cannot be opened fails get(), not the constructor, and is retried', () => {
    const blocker = join(dir, 'file');
    writeFileSync(blocker, '');
    const lazy = new LazySqlite(join(blocker, 'd.db')); // parent is a file
    expect(() => lazy.get()).toThrow();
    expect(() => lazy.get()).toThrow();
    lazy.close();
  });

  test('get() after close() throws instead of reopening', () => {
    const lazy = new LazySqlite(join(dir, 'e.db'));
    lazy.get();
    lazy.close();
    expect(() => lazy.get()).toThrow(/closed/);
    expect(() => lazy.close()).not.toThrow();
  });
});
