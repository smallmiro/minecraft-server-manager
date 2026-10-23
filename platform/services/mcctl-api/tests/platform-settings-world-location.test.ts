/**
 * The platform EXTRA_ARGS reaches every server that inherits it (bare key in
 * servers/global.env), so changing it may move their worlds (#670): servers
 * whose assignment changes must be stopped and pass the assignment rules.
 * Real temp platform; only the container runtime is faked.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';

const TEST_PATH = join(import.meta.dirname, '.tmp-platform-settings-world-test');

process.env.MCCTL_ROOT = TEST_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const runtime = vi.hoisted(() => ({ status: new Map<string, string>() }));
vi.mock('@minecraft-docker/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@minecraft-docker/shared')>();
  class FakeRuntimeAdapter {
    // Ports pass a ServerName since #665; key the fake by container name
    getStatus(name: Parameters<typeof actual.workloadNameOf>[0]) {
      return runtime.status.get(actual.workloadNameOf(name)) ?? 'not_found';
    }
  }
  return { ...actual, DockerComposeRuntimeAdapter: FakeRuntimeAdapter };
});

const ADMIN = { 'x-role': 'admin', 'x-user': 'alice' };
const ENV = 'HOST_IP=192.168.1.10\nEXTRA_ARGS=--universe /worlds/\n';

function server(name: string, configEnv: string) {
  mkdirSync(join(TEST_PATH, 'servers', name), { recursive: true });
  writeFileSync(join(TEST_PATH, 'servers', name, 'config.env'), configEnv);
}

describe('PUT /api/platform-settings EXTRA_ARGS and world locations (#670)', () => {
  let app: FastifyInstance;
  const envPath = join(TEST_PATH, '.env');

  beforeEach(async () => {
    rmSync(TEST_PATH, { recursive: true, force: true });
    mkdirSync(join(TEST_PATH, 'servers'), { recursive: true });
    writeFileSync(envPath, ENV);
    writeFileSync(join(TEST_PATH, 'servers', 'global.env'), 'TZ\nEXTRA_ARGS\n');
    runtime.status.clear();
    const { config } = await import('../src/config/index.js');
    (config as any).mcctlRoot = TEST_PATH;
    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    rmSync(TEST_PATH, { recursive: true, force: true });
  });

  const put = async (body: { set?: Record<string, string>; remove?: string[] }) => {
    const { revision } = (await app.inject({ method: 'GET', url: '/api/platform-settings', headers: ADMIN })).json();
    return app.inject({
      method: 'PUT',
      url: '/api/platform-settings',
      headers: ADMIN,
      payload: { revision, set: body.set ?? {}, remove: body.remove ?? [] },
    });
  };

  it('refuses moving a running server that inherits EXTRA_ARGS, listing it', async () => {
    server('alpha', 'LEVEL=alpha\n');
    runtime.status.set('mc-alpha', 'running');

    const res = await put({ set: { EXTRA_ARGS: '--universe /data' } });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: 'Conflict', servers: ['alpha'] });
    expect(readFileSync(envPath, 'utf8')).toBe(ENV);
  });

  it('refuses removing EXTRA_ARGS while an inheriting server runs', async () => {
    server('alpha', 'LEVEL=alpha\n');
    runtime.status.set('mc-alpha', 'running');

    expect((await put({ remove: ['EXTRA_ARGS'] })).statusCode).toBe(409);
    expect(readFileSync(envPath, 'utf8')).toBe(ENV);
  });

  it('refuses a value that would put an inheriting server on a world another server uses', async () => {
    writeFileSync(envPath, 'HOST_IP=192.168.1.10\n');
    server('alpha', 'LEVEL=held\n'); // inherits nothing yet: internal
    server('beta', 'LEVEL=held_nether\nEXTRA_ARGS=--universe /worlds/\n');

    const res = await put({ set: { EXTRA_ARGS: '--universe /worlds/' } });

    expect(res.statusCode).toBe(409);
    expect(res.json().message).toContain("'beta'");
  });

  it('refuses an interpolated value that leaves inheriting servers undetermined', async () => {
    server('alpha', 'LEVEL=alpha\n');

    const res = await put({ set: { EXTRA_ARGS: '--universe ${WORLDS}' } });

    expect(res.statusCode).toBe(409);
    expect(readFileSync(envPath, 'utf8')).toBe(ENV);
  });

  it('saves a change that moves only stopped servers whose worlds are free', async () => {
    server('alpha', 'LEVEL=alpha\n');

    const res = await put({ set: { EXTRA_ARGS: '--universe /data' } });

    expect(res.statusCode).toBe(200);
    expect(readFileSync(envPath, 'utf8')).toContain('EXTRA_ARGS');
    expect(readFileSync(envPath, 'utf8')).toContain('/data');
  });

  it('saves a change that moves nobody, even with running servers', async () => {
    server('alpha', 'LEVEL=alpha\nEXTRA_ARGS=--universe /worlds/\n'); // own value wins
    runtime.status.set('mc-alpha', 'running');

    expect((await put({ set: { EXTRA_ARGS: '--universe /data' } })).statusCode).toBe(200);
  });
});
