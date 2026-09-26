import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import http from 'http';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-players-roster-test');

// Set env vars BEFORE any imports. PlayerRepository (shared) resolves its data
// root from MCCTL_ROOT, while mcctl-api config resolves from PLATFORM_PATH —
// both must point at the same fixture dir (mirrors tests/world-info.test.ts).
process.env.MCCTL_ROOT = TEST_PLATFORM_PATH;
process.env.PLATFORM_PATH = TEST_PLATFORM_PATH;
process.env.AUTH_ACCESS_MODE = 'open';
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

// Mock audit-log-service (unused by these read-only endpoints, but keep parity
// with other players.ts tests in case a shared plugin writes on startup).
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock Docker functions: containerExists reflects whether docker-compose.yml
// was written for the fixture server; getContainerStatus is controlled per-test.
let containerStatus: 'running' | 'stopped' = 'stopped';
vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual('@minecraft-docker/shared');
  return {
    ...actual,
    containerExists: vi.fn((containerName: string) => {
      const serverName = containerName.replace('mc-', '');
      const serverPath = join(TEST_PLATFORM_PATH, 'servers', serverName, 'docker-compose.yml');
      return existsSync(serverPath);
    }),
    getContainerStatus: vi.fn(() => containerStatus),
  };
});

// Mock RCON: keep the real parsePlayerList, control execRconCommand per-test.
vi.mock('../src/lib/rcon.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/rcon.js')>();
  return {
    ...actual,
    execRconCommand: vi.fn(),
  };
});

function setupServer(serverName: string, opts: { files?: Record<string, unknown> } = {}) {
  const serverDir = join(TEST_PLATFORM_PATH, 'servers', serverName);
  const dataDir = join(serverDir, 'data');
  mkdirSync(dataDir, { recursive: true });

  writeFileSync(
    join(serverDir, 'docker-compose.yml'),
    'services:\n  minecraft:\n    image: itzg/minecraft-server',
    'utf-8'
  );
  // checkServerDefined() → shared serverExists() falls back to config.env on
  // disk via its own internal (unmocked) containerExists call — the
  // consumer-side containerExists mock above only patches players.ts's own
  // direct calls, not serverExists's internal one (mirrors world-info.test.ts).
  writeFileSync(join(serverDir, 'config.env'), 'TYPE=PAPER\n', 'utf-8');

  for (const [filename, content] of Object.entries(opts.files ?? {})) {
    writeFileSync(join(dataDir, filename), JSON.stringify(content, null, 2), 'utf-8');
  }
}

/** Opens a real HTTP connection and captures SSE data for a short duration. */
async function testSSEEndpoint(
  app: FastifyInstance,
  url: string
): Promise<{ headers: http.IncomingHttpHeaders; body: string; statusCode: number }> {
  await app.listen({ port: 0, host: '127.0.0.1' });
  const port = (app.server.address() as any).port;

  return new Promise((resolve, reject) => {
    let resolved = false;
    const req = http.get(`http://127.0.0.1:${port}${url}`, (res) => {
      let body = '';
      let dataTimeout: NodeJS.Timeout;

      res.on('data', (chunk) => {
        body += chunk.toString();
        clearTimeout(dataTimeout);
        dataTimeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            req.destroy();
            app.server.close();
            resolve({ headers: res.headers, body, statusCode: res.statusCode || 0 });
          }
        }, 100);
      });

      res.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          app.server.close();
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      if ((err as any).code !== 'ECONNRESET' && !resolved) {
        resolved = true;
        app.server.close();
        reject(err);
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        req.destroy();
        app.server.close();
        reject(new Error('SSE test timeout'));
      }
    }, 3000);
  });
}

describe('Player roster API (#528)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
    mkdirSync(join(TEST_PLATFORM_PATH, 'servers'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'worlds'), { recursive: true });
    containerStatus = 'stopped';

    const { config } = await import('../src/config/index.js');
    (config as any).platformPath = TEST_PLATFORM_PATH;
    (config as any).mcctlRoot = TEST_PLATFORM_PATH;

    const { buildApp } = await import('../src/app.js');
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
  });

  describe('GET /api/servers/:name/players', () => {
    it('returns 404 when the server is not defined', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/servers/nonexistent/players' });
      expect(response.statusCode).toBe(404);
    });

    it('returns the file-based roster when the server is stopped (no longer 400)', async () => {
      setupServer('test-server', {
        files: {
          'usercache.json': [
            { uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5', name: 'Notch', expiresOn: '2099-01-01T00:00:00Z' },
            { uuid: '8667ba71-b85a-4004-af54-457a9734eed7', name: 'Steve', expiresOn: '2099-01-01T00:00:00Z' },
          ],
          'ops.json': [{ uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5', name: 'Notch', level: 4 }],
        },
      });
      containerStatus = 'stopped';

      const response = await app.inject({ method: 'GET', url: '/api/servers/test-server/players' });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.serverName).toBe('test-server');
      expect(body.running).toBe(false);
      expect(body.online).toBe(0);
      expect(body.max).toBe(0);
      expect(body.players).toEqual([]);
      expect(body.roster).toHaveLength(2);

      const notch = body.roster.find((p: any) => p.name === 'Notch');
      expect(notch).toMatchObject({
        uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
        name: 'Notch',
        isOp: true,
        isBanned: false,
        isWhitelisted: false,
        online: false,
      });
      expect(notch.lastSeen).toBeNull();
    });

    it('merges RCON online names into the roster when running', async () => {
      setupServer('test-server', {
        files: {
          'usercache.json': [
            { uuid: '8667ba71-b85a-4004-af54-457a9734eed7', name: 'Steve', expiresOn: '2099-01-01T00:00:00Z' },
          ],
        },
      });
      containerStatus = 'running';

      const { execRconCommand } = await import('../src/lib/rcon.js');
      vi.mocked(execRconCommand).mockResolvedValue(
        'There are 1 of a max of 20 players online: Steve'
      );

      const response = await app.inject({ method: 'GET', url: '/api/servers/test-server/players' });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.running).toBe(true);
      expect(body.online).toBe(1);
      expect(body.max).toBe(20);
      expect(body.players).toEqual(['Steve']);
      const steve = body.roster.find((p: any) => p.name === 'Steve');
      expect(steve.online).toBe(true);
    });

    it('treats RCON failure as no online players instead of 500', async () => {
      setupServer('test-server', { files: {} });
      containerStatus = 'running';

      const { execRconCommand } = await import('../src/lib/rcon.js');
      vi.mocked(execRconCommand).mockRejectedValue(new Error('RCON connection refused'));

      const response = await app.inject({ method: 'GET', url: '/api/servers/test-server/players' });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.running).toBe(true);
      expect(body.online).toBe(0);
      expect(body.players).toEqual([]);
    });
  });

  describe('GET /api/servers/:name/players?follow=true (SSE)', () => {
    it('streams a "players" event with the roster payload', async () => {
      setupServer('test-server', {
        files: {
          'usercache.json': [
            { uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5', name: 'Notch', expiresOn: '2099-01-01T00:00:00Z' },
          ],
        },
      });
      containerStatus = 'stopped';

      const result = await testSSEEndpoint(app, '/api/servers/test-server/players?follow=true');

      expect(result.statusCode).toBe(200);
      expect(result.headers['content-type']).toBe('text/event-stream');
      expect(result.body).toContain('event: players');
      expect(result.body).toContain('"serverName":"test-server"');
      expect(result.body).toContain('"name":"Notch"');
    });
  });

  describe('GET /api/servers/:name/players/:uuid', () => {
    const NOTCH_UUID = '069a79f4-44e9-4726-a5be-fca90e38aaf5';

    it('returns 404 when the server is not defined', async () => {
      const response = await app.inject({ method: 'GET', url: `/api/servers/nonexistent/players/${NOTCH_UUID}` });
      expect(response.statusCode).toBe(404);
    });

    it('returns 404 when the player is unknown', async () => {
      setupServer('test-server', { files: {} });
      const response = await app.inject({ method: 'GET', url: `/api/servers/test-server/players/${NOTCH_UUID}` });
      expect(response.statusCode).toBe(404);
    });

    it('returns 400 for a malformed uuid', async () => {
      setupServer('test-server', { files: {} });
      const response = await app.inject({ method: 'GET', url: '/api/servers/test-server/players/not-a-uuid' });
      expect(response.statusCode).toBe(400);
    });

    it('returns the player summary when known', async () => {
      setupServer('test-server', {
        files: {
          'usercache.json': [{ uuid: NOTCH_UUID, name: 'Notch', expiresOn: '2099-01-01T00:00:00Z' }],
          'whitelist.json': [{ uuid: NOTCH_UUID, name: 'Notch' }],
        },
      });

      const response = await app.inject({ method: 'GET', url: `/api/servers/test-server/players/${NOTCH_UUID}` });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toMatchObject({
        uuid: NOTCH_UUID,
        name: 'Notch',
        isWhitelisted: true,
        isOp: false,
        isBanned: false,
        online: false,
      });
    });

    it('does not shadow the /players/live static route', async () => {
      setupServer('test-server', { files: {} });
      containerStatus = 'stopped';

      const response = await app.inject({ method: 'GET', url: '/api/servers/test-server/players/live' });

      // The dedicated live-locations route (routes/servers.ts, #525) must
      // handle this request, not our :uuid route (which would 400 on "live"
      // failing the uuid pattern, or 404 with a "Player 'live' not found").
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('players');
      expect(Array.isArray(body.players)).toBe(true);
    });
  });
});
