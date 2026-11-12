// @vitest-environment node
import { describe, it, expect, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = mkdtempSync(join(tmpdir(), 'console-db-'));
process.env.DATABASE_URL = join(dir, 'mcctl.db');

vi.mock('@minecraft-docker/shared/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@minecraft-docker/shared/utils')>();
  return { ...actual, applySqliteSettings: vi.fn(actual.applySqliteSettings) };
});

describe('console sqlite handle (#673)', () => {
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('uses the shared SQLite settings', async () => {
    const { sqlite } = await import('../db');
    const { applySqliteSettings } = await import('@minecraft-docker/shared/utils');
    expect(applySqliteSettings).toHaveBeenCalledWith(sqlite);
    expect(sqlite.pragma('busy_timeout', { simple: true })).toBe(5000);
    expect(sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(sqlite.pragma('synchronous', { simple: true })).toBe(1);
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    sqlite.close();
  });
});
