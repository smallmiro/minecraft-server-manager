/**
 * Degraded mode (#673): when the SQLite files cannot be opened, the API still
 * starts; the features backed by them fail, and audit writes do not fail the
 * action that was already done.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { FastifyInstance } from 'fastify';
import { AuditActionEnum } from '@minecraft-docker/shared';

process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

const ROOT = mkdtempSync(join(tmpdir(), 'mcctl-api-degraded-'));
// data/ and backups/ are files, so data/*.db and backups/meta/*.db cannot be opened
writeFileSync(join(ROOT, 'data'), '');
writeFileSync(join(ROOT, 'backups'), '');

describe('API with unopenable SQLite files (#673)', () => {
  let app: FastifyInstance;
  let previousRoot: string;

  beforeAll(async () => {
    const { config } = await import('../src/config/index.js');
    previousRoot = config.mcctlRoot;
    (config as { mcctlRoot: string }).mcctlRoot = ROOT;
    const { buildApp } = await import('../src/app.js');
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    const { config } = await import('../src/config/index.js');
    (config as { mcctlRoot: string }).mcctlRoot = previousRoot;
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('starts and answers /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it.each(['/api/audit-logs', '/api/audit-logs/stats', '/api/backup/schedules', '/api/config-snapshot-schedules'])(
    'GET %s fails with 500',
    async (url) => {
      const res = await app.inject({ method: 'GET', url, headers: { 'x-role': 'admin' } });
      expect(res.statusCode).toBe(500);
    }
  );

  it('writeAuditLog resolves when audit.db cannot be opened', async () => {
    const { writeAuditLog } = await import('../src/services/audit-log-service.js');
    await expect(
      writeAuditLog({
        action: AuditActionEnum.SERVER_START,
        actor: 'test',
        targetType: 'server',
        targetName: 'x',
        status: 'success',
      })
    ).resolves.toBeUndefined();
  });
});
