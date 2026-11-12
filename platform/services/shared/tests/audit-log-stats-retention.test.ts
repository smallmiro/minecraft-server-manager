import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AuditActionEnum } from '../src/domain/value-objects/AuditAction.js';
import type { AuditLogData } from '../src/domain/entities/AuditLog.js';
import { SqliteAuditLogRepository } from '../src/infrastructure/adapters/SqliteAuditLogRepository.js';

const entry = (over: Partial<AuditLogData>): AuditLogData => ({
  action: AuditActionEnum.SERVER_START,
  actor: 'admin',
  targetType: 'server',
  targetName: 's1',
  details: null,
  status: 'success',
  ...over,
});

describe('SqliteAuditLogRepository stats and findById (#673)', () => {
  let dir: string;
  let repo: SqliteAuditLogRepository;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'audit-stats-'));
    repo = new SqliteAuditLogRepository(join(dir, 'audit.db'));
  });

  afterEach(() => {
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  });

  test('stats() aggregates in SQL', async () => {
    const now = Date.now();
    await repo.log(entry({ timestamp: new Date(now - 3000) }));
    await repo.log(entry({ actor: 'bob', status: 'failure', timestamp: new Date(now - 2000) }));
    await repo.log(entry({ action: AuditActionEnum.SERVER_STOP, actor: 'bob', timestamp: new Date(now - 1000) }));

    expect(await repo.stats()).toEqual({
      total: 3,
      byAction: { 'server.start': 2, 'server.stop': 1 },
      byStatus: { success: 2, failure: 1 },
      byActor: { admin: 1, bob: 2 },
      oldest: new Date(now - 3000),
      newest: new Date(now - 1000),
    });
  });

  test('stats() on an empty table', async () => {
    expect(await repo.stats()).toEqual({
      total: 0,
      byAction: {},
      byStatus: { success: 0, failure: 0 },
      byActor: {},
      oldest: null,
      newest: null,
    });
  });

  test('findById() returns the entry or null', async () => {
    await repo.log(entry({ id: 'a1', targetName: 'found' }));
    expect((await repo.findById('a1'))?.targetName).toBe('found');
    expect(await repo.findById('missing')).toBeNull();
  });
});

describe('SqliteAuditLogRepository retention default (#673)', () => {
  let dir: string;
  let dbPath: string;
  const saved = { cleanup: process.env.AUDIT_AUTO_CLEANUP, days: process.env.AUDIT_RETENTION_DAYS };

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'audit-retention-'));
    dbPath = join(dir, 'audit.db');
    delete process.env.AUDIT_RETENTION_DAYS;
    process.env.AUDIT_AUTO_CLEANUP = 'false'; // seeding must not prune
    const seed = new SqliteAuditLogRepository(dbPath);
    await seed.log(entry({ id: 'old', timestamp: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) }));
    await seed.log(entry({ id: 'new' }));
    seed.close();
    delete process.env.AUDIT_AUTO_CLEANUP;
  });

  afterEach(() => {
    for (const [key, value] of [['AUDIT_AUTO_CLEANUP', saved.cleanup], ['AUDIT_RETENTION_DAYS', saved.days]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  const idsAfterOpen = async () => {
    const repo = new SqliteAuditLogRepository(dbPath);
    try {
      return (await repo.findAll()).map((l) => l.id).sort();
    } finally {
      repo.close();
    }
  };

  test('deletes entries older than 90 days on open with no settings', async () => {
    expect(await idsAfterOpen()).toEqual(['new']);
  });

  test('an invalid AUDIT_RETENTION_DAYS falls back to 90', async () => {
    process.env.AUDIT_RETENTION_DAYS = 'abc';
    expect(await idsAfterOpen()).toEqual(['new']);
  });

  test('AUDIT_RETENTION_DAYS widens the window', async () => {
    process.env.AUDIT_RETENTION_DAYS = '365';
    expect(await idsAfterOpen()).toEqual(['new', 'old']);
  });

  test('AUDIT_AUTO_CLEANUP=false keeps everything', async () => {
    process.env.AUDIT_AUTO_CLEANUP = 'false';
    expect(await idsAfterOpen()).toEqual(['new', 'old']);
  });
});
