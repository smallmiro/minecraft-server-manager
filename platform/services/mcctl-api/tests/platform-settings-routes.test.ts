import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_PATH = join(import.meta.dirname, '.tmp-platform-settings-routes-test');

process.env.MCCTL_ROOT = TEST_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const ENV = 'HOST_IP=192.168.1.10\nRCON_PASSWORD=topsecretvalue\nLOG_LEVEL=info\nMINECRAFT_NETWORK=net\n';
const ADMIN = { 'x-role': 'admin', 'x-user': 'alice' };

describe('Platform settings routes', () => {
  let app: FastifyInstance;
  let writeAuditLog: ReturnType<typeof vi.fn>;
  const envPath = join(TEST_PATH, '.env');

  beforeEach(async () => {
    rmSync(TEST_PATH, { recursive: true, force: true });
    mkdirSync(TEST_PATH, { recursive: true });
    writeFileSync(envPath, ENV);
    const { config } = await import('../src/config/index.js');
    (config as any).platformPath = TEST_PATH;
    (config as any).mcctlRoot = TEST_PATH;
    writeAuditLog = (await import('../src/services/audit-log-service.js')).writeAuditLog as any;
    writeAuditLog.mockClear();
    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    if (existsSync(TEST_PATH)) rmSync(TEST_PATH, { recursive: true, force: true });
  });

  const get = (headers: Record<string, string> = ADMIN) => app.inject({ method: 'GET', url: '/api/platform-settings', headers });
  const put = (payload: unknown, headers: Record<string, string> = ADMIN) =>
    app.inject({ method: 'PUT', url: '/api/platform-settings', headers, payload: payload as any });

  it.each([
    ['missing role', {}],
    ['user role', { 'x-role': 'user' }],
  ])('403 on GET and PUT with %s', async (_n, headers) => {
    expect((await get(headers)).statusCode).toBe(403);
    const r = await put({ revision: 'x', set: { HOST_IP: '1.1.1.1' }, remove: [] }, headers);
    expect(r.statusCode).toBe(403);
    expect(readFileSync(envPath, 'utf8')).toBe(ENV);
  });

  it('GET 200 for admin with no-store and masked secrets', async () => {
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).not.toContain('topsecretvalue');
    const body = res.json();
    expect(body.revision).toMatch(/^[0-9a-f]{64}$/);
    expect(body.settings.find((s: any) => s.key === 'RCON_PASSWORD')).toMatchObject({ secret: true, configured: true });
  });

  it('GET 404 when .env is missing', async () => {
    rmSync(envPath);
    const res = await get();
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toContain('mcctl init');
  });

  it('PUT 200 updates, audits keys and scopes only', async () => {
    const { revision } = (await get()).json();
    const res = await put({ revision, set: { HOST_IP: '10.0.0.9', RCON_PASSWORD: 'newsecretvalue' }, remove: [] });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).not.toContain('newsecretvalue');
    expect(res.json().changedKeys.sort()).toEqual(['HOST_IP', 'RCON_PASSWORD']);
    expect(readFileSync(envPath, 'utf8')).toContain('HOST_IP=10.0.0.9');
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
    const entry = writeAuditLog.mock.calls[0]![0];
    expect(entry).toMatchObject({ action: 'platform.settings.update', actor: 'api:alice', targetType: 'platform', targetName: '.env', status: 'success' });
    expect(JSON.stringify(entry)).not.toMatch(/newsecretvalue|10\.0\.0\.9|topsecretvalue/);
    expect(entry.details.restartScopes.sort()).toEqual(['next-create', 'servers']);
  });

  it('PUT 409 on stale revision, file unchanged, failure audited', async () => {
    const res = await put({ revision: 'stale', set: { HOST_IP: '10.0.0.9' }, remove: [] });
    expect(res.statusCode).toBe(409);
    expect(res.json().currentRevision).toMatch(/^[0-9a-f]{64}$/);
    expect(readFileSync(envPath, 'utf8')).toBe(ENV);
    expect(writeAuditLog.mock.calls[0]![0].status).toBe('failure');
  });

  it('PUT 400 with field errors, no values in response/audit', async () => {
    const { revision } = (await get()).json();
    const res = await put({ revision, set: { HOST_IP: 'not-an-ip-SECRETISH', MINECRAFT_NETWORK: 'x' }, remove: [] });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors.map((e: any) => e.key).sort()).toEqual(['HOST_IP', 'MINECRAFT_NETWORK']);
    expect(JSON.stringify(writeAuditLog.mock.calls[0]![0])).not.toContain('SECRETISH');
    expect(readFileSync(envPath, 'utf8')).toBe(ENV);
  });

  it('PUT 400 on malformed body', async () => {
    expect((await put({ set: {} })).statusCode).toBe(400);
  });

  it('PUT 404 when .env is missing', async () => {
    rmSync(envPath);
    expect((await put({ revision: 'x', set: { HOST_IP: '1.1.1.1' }, remove: [] })).statusCode).toBe(404);
  });

  it('is documented in swagger tags', async () => {
    const spec = (await app.inject({ method: 'GET', url: '/docs/json' })).json();
    expect(spec.paths['/api/platform-settings'].get.tags).toContain('platform-settings');
    expect(spec.paths['/api/platform-settings'].put).toBeDefined();
  });
});
