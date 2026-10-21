import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { request as httpRequest } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';

vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const TEST_PLATFORM_PATH = mkdtempSync(join(tmpdir(), 'mcctl-api-world-params-'));

// Set env BEFORE imports so config + Paths resolve to the fixture.
process.env.MCCTL_ROOT = TEST_PLATFORM_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

// [raw URL segment, what the handler would see after decoding]
const UNSAFE_NAMES: Array<[string, string]> = [
  ['..', '..'],
  ['%2e%2e', '..'],
  ['.', '.'],
  ['%2e', '.'],
  ['..%2Fservers', '../servers'],
  ['%2e%2e%2F%2e%2e%2Fetc', '../../etc'],
  ['a%2Fb', 'a/b'],
  ['%2Fetc', '/etc'],
  ['a%5Cb', 'a\\b'],
  ['.locks', '.locks'],
  ['a%00b', 'NUL byte'],
  ['a%0Ab', 'newline'],
];

interface Sent {
  statusCode: number;
  body: Record<string, any>;
}

describe('World name path params (#720)', () => {
  let app: FastifyInstance;
  let port: number;

  // A real socket, not app.inject(): inject normalizes '..' and '%2e%2e'
  // segments away, while a raw HTTP request delivers them to :name.
  const send = (method: string, path: string, payload?: object) =>
    new Promise<Sent>((resolve, reject) => {
      const body = payload ? JSON.stringify(payload) : undefined;
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port,
          method,
          path,
          headers: body ? { 'content-type': 'application/json' } : {},
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve({ statusCode: res.statusCode!, body: JSON.parse(data) }));
        }
      );
      req.on('error', reject);
      req.end(body);
    });

  beforeAll(async () => {
    mkdirSync(join(TEST_PLATFORM_PATH, 'backups', 'meta'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'servers', 'survival'), { recursive: true });
    for (const name of ['world', 'My_World', 'survival-2', 'My World', 'world.old', '-lobby', '-old']) {
      mkdirSync(join(TEST_PLATFORM_PATH, 'worlds', name), { recursive: true });
    }

    const { config } = await import('../src/config/index.js');
    (config as any).mcctlRoot = TEST_PLATFORM_PATH;

    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
    port = (app.server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await app.close();
    rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
  });

  const requests = (segment: string): Array<[string, string, object?]> => [
    ['GET', `/api/worlds/${segment}`],
    ['GET', `/api/worlds/${segment}/info`],
    ['GET', `/api/worlds/${segment}/players`],
    ['POST', `/api/worlds/${segment}/assign`, { serverName: 'survival' }],
    ['POST', `/api/worlds/${segment}/release`],
    ['DELETE', `/api/worlds/${segment}?force=true`],
  ];

  it.each(UNSAFE_NAMES)('rejects %s (%s) with 400 on every world route', async (segment) => {
    for (const [method, path, payload] of requests(segment)) {
      const response = await send(method, path, payload);
      expect(response.statusCode, `${method} ${path}`).toBe(400);
      expect(response.body, `${method} ${path}`).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('params/name'),
      });
    }
  });

  it('rejects an empty name', async () => {
    const response = await send('GET', '/api/worlds//info');
    expect(response.statusCode).toBe(400);
  });

  it.each(['world', 'My_World', 'survival-2'])('accepts %s', async (name) => {
    const response = await send('GET', `/api/worlds/${name}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.world.name).toBe(name);
  });

  // Hand-made folders (legacy LEVEL values such as "My World", #649) are still
  // listed by GET /api/worlds, so their detail must stay reachable.
  it.each(['My World', 'world.old'])('keeps the existing world %s reachable', async (name) => {
    const response = await send('GET', `/api/worlds/${encodeURIComponent(name)}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.world.name).toBe(name);
  });

  // WORLD_NAME_PATTERN lets POST /api/worlds create '-lobby'. The world name
  // only reaches scripts as a positional argument (mcctl.sh world release ->
  // lock.sh), never as an option, so the world must stay manageable.
  describe('a world name starting with "-"', () => {
    it('is reachable', async () => {
      const response = await send('GET', '/api/worlds/-lobby');
      expect(response.statusCode).toBe(200);
      expect(response.body.world.name).toBe('-lobby');
    });

    it('is released by the real lock scripts', async () => {
      const lockFile = join(TEST_PLATFORM_PATH, 'worlds', '.locks', '-lobby.lock');
      mkdirSync(join(TEST_PLATFORM_PATH, 'worlds', '.locks'), { recursive: true });
      writeFileSync(lockFile, `survival:${Math.floor(Date.now() / 1000)}:1\n`);

      const response = await send('POST', '/api/worlds/-lobby/release');

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({ success: true, worldName: '-lobby', previousServer: 'survival' });
      expect(existsSync(lockFile)).toBe(false);
    });

    it('is deleted', async () => {
      const response = await send('DELETE', '/api/worlds/-old?force=true');
      expect(response.statusCode).toBe(200);
      expect(existsSync(join(TEST_PLATFORM_PATH, 'worlds', '-old'))).toBe(false);
    });
  });
});
