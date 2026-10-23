/**
 * World routes enforce the world-server assignment rules (#670, ADR-0002):
 * errorCode -> HTTP status, release fallback fields, assignmentWarnings.
 * Real temp platform dir; only the container runtime is faked.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-worlds-assignment-test');

process.env.MCCTL_ROOT = TEST_PLATFORM_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const runtime = vi.hoisted(() => ({ status: new Map<string, string>(), started: [] as string[] }));
vi.mock('@minecraft-docker/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@minecraft-docker/shared')>();
  class FakeRuntimeAdapter {
    // Ports pass a ServerName since #665; key the fake by container name
    getStatus(name: Parameters<typeof actual.workloadNameOf>[0]) {
      return runtime.status.get(actual.workloadNameOf(name)) ?? 'not_found';
    }
    async start(name: Parameters<typeof actual.workloadNameOf>[0]) {
      runtime.started.push(actual.workloadNameOf(name));
      return { success: true };
    }
  }
  return { ...actual, DockerComposeRuntimeAdapter: FakeRuntimeAdapter };
});

const UNIVERSE = 'EXTRA_ARGS=--universe /worlds/\n';

function world(name: string) {
  mkdirSync(join(TEST_PLATFORM_PATH, 'worlds', name), { recursive: true });
}

function server(name: string, configEnv: string): string {
  mkdirSync(join(TEST_PLATFORM_PATH, 'servers', name), { recursive: true });
  const file = join(TEST_PLATFORM_PATH, 'servers', name, 'config.env');
  writeFileSync(file, configEnv);
  return file;
}

describe('World routes - assignment rules (#670)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'backups', 'meta'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'worlds'), { recursive: true });
    runtime.status.clear();
    runtime.started.length = 0;

    const { config } = await import('../src/config/index.js');
    (config as Record<string, unknown>).mcctlRoot = TEST_PLATFORM_PATH;
    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
  });

  describe('GET /api/worlds assignmentWarnings', () => {
    it('is empty when every world has at most one server', async () => {
      world('alpha');
      server('alpha', `LEVEL=alpha\n${UNIVERSE}`);

      const response = await app.inject({ method: 'GET', url: '/api/worlds' });

      expect(response.statusCode).toBe(200);
      expect(response.json().assignmentWarnings).toEqual([]);
    });

    it('reports duplicate and undetermined assignments', async () => {
      world('shared');
      server('alpha', `LEVEL=shared\n${UNIVERSE}`);
      server('beta', `LEVEL=shared\n${UNIVERSE}`);
      server('broken', `LEVEL=../x\n${UNIVERSE}`);

      const { assignmentWarnings } = (await app.inject({ method: 'GET', url: '/api/worlds' })).json();

      expect(assignmentWarnings).toHaveLength(2);
      expect(assignmentWarnings[0]).toMatch(/'shared'.*'alpha', 'beta'/);
      expect(assignmentWarnings[1]).toMatch(/'broken'/);
    });
  });

  describe('POST /api/worlds/:name/assign', () => {
    const assign = (worldName: string, serverName: string) =>
      app.inject({ method: 'POST', url: `/api/worlds/${worldName}/assign`, payload: { serverName } });

    it('writes LEVEL and returns 200', async () => {
      world('free');
      const file = server('alpha', `LEVEL=alpha\n${UNIVERSE}`);

      const response = await assign('free', 'alpha');

      expect(response.statusCode).toBe(200);
      expect(readFileSync(file, 'utf-8')).toBe(`LEVEL=free\n${UNIVERSE}`);
    });

    it('returns 409 for a world another server uses (R1)', async () => {
      world('held');
      server('alpha', `LEVEL=held\n${UNIVERSE}`);
      const file = server('beta', `LEVEL=beta\n${UNIVERSE}`);

      const response = await assign('held', 'beta');

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: 'Conflict', message: expect.stringContaining("'alpha'") });
      expect(readFileSync(file, 'utf-8')).toBe(`LEVEL=beta\n${UNIVERSE}`);
    });

    it('returns 409 for a running server', async () => {
      world('free');
      server('alpha', `LEVEL=alpha\n${UNIVERSE}`);
      runtime.status.set('mc-alpha', 'running');

      const response = await assign('free', 'alpha');

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toContain('running');
    });

    it('returns 409 while a server is undetermined (R7)', async () => {
      world('free');
      server('alpha', `LEVEL=alpha\n${UNIVERSE}`);
      server('broken', `LEVEL=a/b\n${UNIVERSE}`);

      expect((await assign('free', 'alpha')).statusCode).toBe(409);
    });

    it('returns 400 for a name that cannot be a LEVEL', async () => {
      world('free_nether');
      server('alpha', `LEVEL=alpha\n${UNIVERSE}`);

      expect((await assign('free_nether', 'alpha')).statusCode).toBe(400);
    });

    it('returns 404 for a missing world or server', async () => {
      world('free');
      server('alpha', `LEVEL=alpha\n${UNIVERSE}`);

      expect((await assign('ghost', 'alpha')).statusCode).toBe(404);
      expect((await assign('free', 'ghost')).statusCode).toBe(404);
    });
  });

  describe('POST /api/worlds/:name/release', () => {
    it("switches the holder to its own world and says so", async () => {
      world('held');
      const file = server('alpha', `LEVEL=held\n${UNIVERSE}`);

      const response = await app.inject({ method: 'POST', url: '/api/worlds/held/release' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        worldName: 'held',
        previousServer: 'alpha',
        fallbackWorld: 'alpha',
        fallbackExists: false,
      });
      expect(readFileSync(file, 'utf-8')).toBe(`LEVEL=alpha\n${UNIVERSE}`);
    });

    it('returns 409 when the holder is running', async () => {
      world('held');
      server('alpha', `LEVEL=held\n${UNIVERSE}`);
      runtime.status.set('mc-alpha', 'running');

      expect((await app.inject({ method: 'POST', url: '/api/worlds/held/release?force=true' })).statusCode).toBe(409);
    });

    it('returns 404 for a world that does not exist', async () => {
      expect((await app.inject({ method: 'POST', url: '/api/worlds/ghost/release' })).statusCode).toBe(404);
    });

    it('returns 409 for a world no server uses', async () => {
      world('free');
      expect((await app.inject({ method: 'POST', url: '/api/worlds/free/release' })).statusCode).toBe(409);
    });
  });

  describe('DELETE /api/worlds/:name', () => {
    it('returns 409 for a world a server uses, even with force', async () => {
      world('held');
      server('alpha', `LEVEL=held\n${UNIVERSE}`);

      const response = await app.inject({ method: 'DELETE', url: '/api/worlds/held?force=true' });

      expect(response.statusCode).toBe(409);
      expect(existsSync(join(TEST_PLATFORM_PATH, 'worlds', 'held'))).toBe(true);
    });

    it('deletes an unassigned world', async () => {
      world('free');
      server('alpha', `LEVEL=alpha\n${UNIVERSE}`);

      expect((await app.inject({ method: 'DELETE', url: '/api/worlds/free' })).statusCode).toBe(200);
      expect(existsSync(join(TEST_PLATFORM_PATH, 'worlds', 'free'))).toBe(false);
    });
  });

  describe('POST /api/worlds with serverName', () => {
    it('returns 409 for a running server and creates nothing', async () => {
      server('alpha', `LEVEL=alpha\n${UNIVERSE}`);
      runtime.status.set('mc-alpha', 'running');

      const response = await app.inject({
        method: 'POST',
        url: '/api/worlds',
        payload: { name: 'fresh', serverName: 'alpha' },
      });

      expect(response.statusCode).toBe(409);
      expect(existsSync(join(TEST_PLATFORM_PATH, 'worlds', 'fresh'))).toBe(false);
    });

    it('creates the world and assigns it', async () => {
      const file = server('alpha', `LEVEL=alpha\n${UNIVERSE}`);

      const response = await app.inject({
        method: 'POST',
        url: '/api/worlds',
        payload: { name: 'fresh', serverName: 'alpha' },
      });

      expect(response.statusCode).toBe(201);
      expect(readFileSync(file, 'utf-8')).toBe(`LEVEL=fresh\n${UNIVERSE}`);
    });
  });
});
