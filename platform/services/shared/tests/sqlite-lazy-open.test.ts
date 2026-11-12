/**
 * Every SQLite repository opens its database on first use (#673): a path that
 * cannot be opened fails the call that needs it, not the constructor.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SqliteAuditLogRepository } from '../src/infrastructure/adapters/SqliteAuditLogRepository.js';
import { SqliteBackupScheduleRepository } from '../src/infrastructure/adapters/SqliteBackupScheduleRepository.js';
import { SqliteUserRepository } from '../src/infrastructure/adapters/SqliteUserRepository.js';
import { SqlitePlayerSessionRepository } from '../src/infrastructure/adapters/SqlitePlayerSessionRepository.js';
import { ConfigSnapshotDatabase } from '../src/infrastructure/adapters/ConfigSnapshotDatabase.js';
import { SqliteConfigSnapshotRepository } from '../src/infrastructure/adapters/SqliteConfigSnapshotRepository.js';
import { SqliteConfigSnapshotScheduleRepository } from '../src/infrastructure/adapters/SqliteConfigSnapshotScheduleRepository.js';

interface Case {
  name: string;
  create: (path: string) => { close(): void };
  use: (repo: never) => Promise<unknown>;
}

const cases: Case[] = [
  { name: 'SqliteAuditLogRepository', create: (p) => new SqliteAuditLogRepository(p), use: (r: SqliteAuditLogRepository) => r.count() },
  { name: 'SqliteBackupScheduleRepository', create: (p) => new SqliteBackupScheduleRepository(p), use: (r: SqliteBackupScheduleRepository) => r.findAll() },
  { name: 'SqliteUserRepository', create: (p) => new SqliteUserRepository(p), use: (r: SqliteUserRepository) => r.count() },
  { name: 'SqlitePlayerSessionRepository', create: (p) => new SqlitePlayerSessionRepository(p), use: (r: SqlitePlayerSessionRepository) => r.listSessions('s', 'p') },
  { name: 'ConfigSnapshotDatabase', create: (p) => new ConfigSnapshotDatabase(p), use: async (d: ConfigSnapshotDatabase) => d.getDatabase() },
] as Case[];

describe('SQLite repositories open lazily (#673)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sqlite-lazy-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test.each(cases)('$name creates the file on first use, not in the constructor', async ({ create, use }) => {
    const path = join(dir, 'sub', 'x.db');
    const repo = create(path);
    try {
      expect(existsSync(path)).toBe(false);
      await use(repo as never);
      expect(existsSync(path)).toBe(true);
    } finally {
      repo.close();
    }
  });

  test.each(cases)('$name with an unopenable path fails the call, not the constructor', async ({ create, use }) => {
    const blocker = join(dir, 'file');
    writeFileSync(blocker, '');
    const repo = create(join(blocker, 'x.db'));
    await expect(Promise.resolve().then(() => use(repo as never))).rejects.toThrow();
    expect(() => repo.close()).not.toThrow();
  });

  test('config snapshot repositories do not open the database when built', () => {
    const blocker = join(dir, 'file');
    writeFileSync(blocker, '');
    const database = new ConfigSnapshotDatabase(join(blocker, 'x.db'));
    expect(() => new SqliteConfigSnapshotRepository(database)).not.toThrow();
    expect(() => new SqliteConfigSnapshotScheduleRepository(database)).not.toThrow();
  });
});
