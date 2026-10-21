import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, mkdtempSync, rmSync } from 'fs';
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

// [encoded URL segment, what the handler would see after decoding]
const UNSAFE_NAMES: Array<[string, string]> = [
  ['%2e%2e', '..'],
  ['%2e', '.'],
  ['..%2Fservers', '../servers'],
  ['%2e%2e%2F%2e%2e%2Fetc', '../../etc'],
  ['a%2Fb', 'a/b'],
  ['%2Fetc', '/etc'],
  ['a%5Cb', 'a\\b'],
  ['.locks', '.locks'],
  ['-rf', '-rf'],
  ['a%00b', 'NUL byte'],
  ['a%0Ab', 'newline'],
];

describe('World name path params (#720)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    mkdirSync(join(TEST_PLATFORM_PATH, 'backups', 'meta'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'servers', 'survival'), { recursive: true });
    for (const name of ['world', 'My_World', 'survival-2', 'My World', 'world.old']) {
      mkdirSync(join(TEST_PLATFORM_PATH, 'worlds', name), { recursive: true });
    }

    const { config } = await import('../src/config/index.js');
    (config as any).mcctlRoot = TEST_PLATFORM_PATH;

    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
  });

  const requests = (segment: string) => [
    { method: 'GET' as const, url: `/api/worlds/${segment}` },
    { method: 'GET' as const, url: `/api/worlds/${segment}/info` },
    { method: 'GET' as const, url: `/api/worlds/${segment}/players` },
    { method: 'POST' as const, url: `/api/worlds/${segment}/assign`, payload: { serverName: 'survival' } },
    { method: 'POST' as const, url: `/api/worlds/${segment}/release` },
    { method: 'DELETE' as const, url: `/api/worlds/${segment}?force=true` },
  ];

  it.each(UNSAFE_NAMES)('rejects %s (%s) with 400 on every world route', async (segment) => {
    for (const request of requests(segment)) {
      const response = await app.inject(request);
      expect(response.statusCode, `${request.method} ${request.url}`).toBe(400);
      expect(response.json(), `${request.method} ${request.url}`).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('params/name'),
      });
    }
  });

  it('rejects an empty name', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/worlds//info' });
    expect(response.statusCode).toBe(400);
  });

  it.each(['world', 'My_World', 'survival-2'])('accepts %s', async (name) => {
    const response = await app.inject({ method: 'GET', url: `/api/worlds/${name}` });
    expect(response.statusCode).toBe(200);
    expect(response.json().world.name).toBe(name);
  });

  // Hand-made folders (legacy LEVEL values such as "My World", #649) are still
  // listed by GET /api/worlds, so their detail must stay reachable.
  it.each(['My World', 'world.old'])('keeps the existing world %s reachable', async (name) => {
    const response = await app.inject({ method: 'GET', url: `/api/worlds/${encodeURIComponent(name)}` });
    expect(response.statusCode).toBe(200);
    expect(response.json().world.name).toBe(name);
  });
});
