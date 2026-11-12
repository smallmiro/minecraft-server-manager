import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';

process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

vi.mock('../src/services/audit-log-service.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/audit-log-service.js')>()),
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
  purgeAuditLogs: vi.fn().mockResolvedValue({ deleted: 0, dryRun: true, message: 'ok' }),
}));

describe('DELETE /api/audit-logs', () => {
  let app: FastifyInstance;
  let purgeAuditLogs: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    purgeAuditLogs = (await import('../src/services/audit-log-service.js')).purgeAuditLogs as any;
    purgeAuditLogs.mockClear();
    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const purge = (headers: Record<string, string>) =>
    app.inject({ method: 'DELETE', url: '/api/audit-logs', headers, payload: { before: '2026-01-01T00:00:00.000Z', dryRun: true } });

  it.each([
    ['missing role', {}],
    ['user role', { 'x-role': 'user' }],
  ])('403 with %s and does not purge', async (_n, headers) => {
    const res = await purge(headers);
    expect(res.statusCode).toBe(403);
    expect(purgeAuditLogs).not.toHaveBeenCalled();
  });

  it('200 for admin', async () => {
    const res = await purge({ 'x-role': 'admin' });
    expect(res.statusCode).toBe(200);
    expect(purgeAuditLogs).toHaveBeenCalledWith('2026-01-01T00:00:00.000Z', true);
  });
});

describe('GET /api/audit-logs/stats and /:id read without loading every entry (#673)', () => {
  let app: FastifyInstance;
  let previousRoot: string;
  let root: string;

  beforeEach(async () => {
    const { mkdtempSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const { config } = await import('../src/config/index.js');
    previousRoot = config.mcctlRoot;
    root = mkdtempSync(join(tmpdir(), 'mcctl-api-audit-stats-'));
    (config as { mcctlRoot: string }).mcctlRoot = root;
    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    const { rmSync } = await import('node:fs');
    const { config } = await import('../src/config/index.js');
    (config as { mcctlRoot: string }).mcctlRoot = previousRoot;
    rmSync(root, { recursive: true, force: true });
  });

  it('returns the aggregates and the entry, never calling findAll without a limit', async () => {
    const repo = app.container.auditLogRepository();
    const base = { targetType: 'server', targetName: 's1', details: null } as const;
    await repo.log({ ...base, id: 'e1', action: 'server.start' as never, actor: 'admin', status: 'success', timestamp: new Date('2026-01-01T00:00:00.000Z') });
    await repo.log({ ...base, id: 'e2', action: 'server.stop' as never, actor: 'bob', status: 'failure', timestamp: new Date('2026-01-02T00:00:00.000Z') });
    const findAll = vi.spyOn(repo, 'findAll');

    const stats = await app.inject({ method: 'GET', url: '/api/audit-logs/stats' });
    expect(stats.statusCode).toBe(200);
    expect(stats.json()).toMatchObject({
      total: 2,
      byAction: { 'server.start': 1, 'server.stop': 1 },
      byStatus: { success: 1, failure: 1 },
      byActor: { admin: 1, bob: 1 },
      oldestEntry: '2026-01-01T00:00:00.000Z',
      newestEntry: '2026-01-02T00:00:00.000Z',
    });
    expect(stats.json().recentActivity.map((e: { id: string }) => e.id)).toEqual(['e2', 'e1']);

    const detail = await app.inject({ method: 'GET', url: '/api/audit-logs/e1' });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().log.id).toBe('e1');
    expect((await app.inject({ method: 'GET', url: '/api/audit-logs/missing' })).statusCode).toBe(404);

    for (const [options] of findAll.mock.calls) expect(options?.limit).toBeDefined();
  });
});
