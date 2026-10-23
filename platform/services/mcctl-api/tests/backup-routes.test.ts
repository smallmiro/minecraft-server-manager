/**
 * Backup routes on the world backup port (#732).
 * The routes no longer look for <root>/scripts/backup.sh (#7); the port does the
 * work, so these tests inject a fake port.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-backup-routes-test');

process.env.MCCTL_ROOT = TEST_PLATFORM_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const HASH = 'abc1234def5678901234567890abcdef12345678';

const { port, adapterOptions } = vi.hoisted(() => ({
  port: {
    status: vi.fn(),
    history: vi.fn(),
    push: vi.fn(),
    restore: vi.fn(),
    prune: vi.fn(),
    testConnection: vi.fn(),
  },
  adapterOptions: [] as Array<{ root: string }>,
}));

import { BackupSchedule, type IBackupScheduleRepository } from '@minecraft-docker/shared';

class InMemoryBackupScheduleRepository implements IBackupScheduleRepository {
  private store: Map<string, BackupSchedule> = new Map();
  async save(schedule: BackupSchedule) { this.store.set(schedule.id, schedule); }
  async findAll() { return Array.from(this.store.values()); }
  async findById(id: string) { return this.store.get(id) ?? null; }
  async findEnabled() { return Array.from(this.store.values()).filter((s) => s.enabled); }
  async delete(id: string) { this.store.delete(id); }
  close() { this.store.clear(); }
}

vi.mock('@minecraft-docker/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@minecraft-docker/shared')>();
  return {
    ...actual,
    GitWorldBackupAdapter: vi.fn().mockImplementation((options: { root: string }) => {
      adapterOptions.push(options);
      return port;
    }),
    SqliteBackupScheduleRepository: vi.fn().mockImplementation(() => new InMemoryBackupScheduleRepository()),
    ConfigSnapshotDatabase: vi.fn().mockImplementation(() => ({
      getDb: () => ({ prepare: vi.fn().mockReturnValue({ run: vi.fn(), all: vi.fn().mockReturnValue([]), get: vi.fn() }), exec: vi.fn() }),
      close: vi.fn(),
    })),
    SqliteConfigSnapshotRepository: vi.fn().mockImplementation(() => ({
      findAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    })),
    SqliteConfigSnapshotScheduleRepository: vi.fn().mockImplementation(() => ({
      findAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      findByServer: vi.fn().mockResolvedValue([]),
      findEnabled: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
      delete: vi.fn(),
    })),
  };
});

import { buildApp } from '../src/app.js';
import { config } from '../src/config/index.js';

const fail = (code: string, message: string, extra: Record<string, unknown> = {}) => ({
  ok: false as const,
  error: { code, message, ...extra },
});

describe('Backup routes on the world backup port (#732)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    for (const d of ['data', 'servers', 'worlds']) mkdirSync(join(TEST_PLATFORM_PATH, d), { recursive: true });
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    if (app) await app.close();
    rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
  });

  beforeEach(() => {
    for (const fn of Object.values(port)) fn.mockReset();
    port.status.mockResolvedValue({
      ok: true,
      value: {
        configured: true,
        repository: 'user/worlds',
        branch: 'main',
        autoOnStop: false,
        lastBackup: { commit: HASH, date: new Date('2026-10-20T10:00:00Z') },
      },
    });
    port.push.mockResolvedValue({
      ok: true,
      value: { changed: true, commit: HASH, flushed: ['a'], skipped: [], warnings: [] },
    });
    port.history.mockResolvedValue({
      ok: true,
      value: [{ hash: HASH, date: new Date('2026-10-20T10:00:00Z'), author: 'Minecraft Backup', message: 'a | "b"' }],
    });
    port.restore.mockResolvedValue({
      ok: true,
      value: { commit: HASH, previousDir: join(TEST_PLATFORM_PATH, 'backups', 'restore-previous', 'x'), skipped: [] },
    });
  });

  it('builds the adapter for the platform root, with no scripts/backup.sh lookup (#7)', () => {
    expect(adapterOptions.length).toBeGreaterThan(0);
    for (const options of adapterOptions) expect(options.root).toBe(config.mcctlRoot);
    expect(existsSync(join(config.mcctlRoot, 'scripts', 'backup.sh'))).toBe(false);
  });

  describe('GET /api/backup/status', () => {
    it('reports the port status', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/backup/status' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        configured: true,
        repository: 'user/worlds',
        branch: 'main',
        lastBackup: '2026-10-20T10:00:00.000Z',
      });
    });

    it('reports not configured', async () => {
      port.status.mockResolvedValue({ ok: true, value: { configured: false, branch: 'main', autoOnStop: false } });
      const res = await app.inject({ method: 'GET', url: '/api/backup/status' });
      expect(res.json()).toEqual({ configured: false, branch: 'main' });
    });

    it('returns 500 when the status cannot be read', async () => {
      port.status.mockResolvedValue(fail('io_failed', 'Cannot read .env'));
      const res = await app.inject({ method: 'GET', url: '/api/backup/status' });
      expect(res.statusCode).toBe(500);
    });
  });

  describe('POST /api/backup/push', () => {
    it('pushes through the port and returns a short hash', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/backup/push', payload: { message: 'before upgrade' } });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true, commitHash: 'abc1234', message: 'Backup pushed successfully' });
      expect(port.push).toHaveBeenCalledWith({ message: 'before upgrade', allowMissing: false });
    });

    it('passes allowMissing', async () => {
      await app.inject({ method: 'POST', url: '/api/backup/push', payload: { allowMissing: true } });
      expect(port.push).toHaveBeenCalledWith({ message: undefined, allowMissing: true });
    });

    it('reports "no changes" as success (#8)', async () => {
      port.push.mockResolvedValue({
        ok: true,
        value: { changed: false, commit: HASH, flushed: [], skipped: [], warnings: [] },
      });
      const res = await app.inject({ method: 'POST', url: '/api/backup/push', payload: {} });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ success: true, message: 'No changes to backup' });
    });

    it.each([
      ['locked', 409],
      ['missing_worlds', 400],
      ['not_configured', 400],
      ['runtime_unavailable', 503],
      ['git_failed', 500],
    ])('maps %s to %i', async (code, status) => {
      port.push.mockResolvedValue(fail(code, `failure ${code}`));
      const res = await app.inject({ method: 'POST', url: '/api/backup/push', payload: {} });
      expect(res.statusCode).toBe(status);
      expect(res.json().message).toBe(`failure ${code}`);
    });
  });

  describe('GET /api/backup/history', () => {
    it('keeps the 7-character hash contract', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/backup/history' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        commits: [{ hash: 'abc1234', message: 'a | "b"', date: '2026-10-20T10:00:00.000Z', author: 'Minecraft Backup' }],
        total: 1,
      });
    });

    it('returns 400 when backup is not configured', async () => {
      port.status.mockResolvedValue({ ok: true, value: { configured: false, branch: 'main', autoOnStop: false } });
      const res = await app.inject({ method: 'GET', url: '/api/backup/history' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/backup/restore', () => {
    it('restores through the port without waiting for input (#4)', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/backup/restore', payload: { commitHash: 'abc1234' } });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true, message: 'Restored to commit abc1234' });
      expect(port.restore).toHaveBeenCalledWith('abc1234');
    });

    it.each([
      ['servers_running', 409],
      ['restore_conflict', 409],
      ['recovery_required', 409],
      ['commit_not_found', 404],
      ['unsupported_layout', 400],
    ])('maps %s to %i', async (code, status) => {
      port.restore.mockResolvedValue(fail(code, `failure ${code}`));
      const res = await app.inject({ method: 'POST', url: '/api/backup/restore', payload: { commitHash: 'abc1234' } });
      expect(res.statusCode).toBe(status);
      expect(res.json()).toMatchObject({ message: `failure ${code}` });
    });
  });
});
