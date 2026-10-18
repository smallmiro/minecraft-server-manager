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
