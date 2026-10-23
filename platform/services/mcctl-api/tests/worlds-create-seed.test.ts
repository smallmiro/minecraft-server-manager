import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-worlds-create-seed-test');
const CONFIG_ENV = join(TEST_PLATFORM_PATH, 'servers', 'alpha', 'config.env');
const ORIGINAL_CONFIG = 'TYPE=PAPER\nLEVEL=world\nSEED=1\n';

// Set env BEFORE imports so config + Paths resolve to the fixture.
process.env.MCCTL_ROOT = TEST_PLATFORM_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

describe('POST /api/worlds seed must be a single line (#726)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'backups', 'meta'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'worlds'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'servers', 'alpha'), { recursive: true });
    writeFileSync(CONFIG_ENV, ORIGINAL_CONFIG, 'utf-8');

    const { config } = await import('../src/config/index.js');
    (config as any).mcctlRoot = TEST_PLATFORM_PATH;

    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
  });

  it.each([
    'x\nMODS=http://evil/x.jar',
    'x\rMODS=http://evil/x.jar',
    'x\u0000y',
    'x\u001by',
  ])('rejects seed %j with 400 and leaves config.env alone', async (seed) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/worlds',
      payload: { name: 'new-world', seed, serverName: 'alpha' },
    });

    expect(response.statusCode).toBe(400);
    expect(readFileSync(CONFIG_ENV, 'utf-8')).toBe(ORIGINAL_CONFIG);
    expect(existsSync(join(TEST_PLATFORM_PATH, 'worlds', 'new-world'))).toBe(false);
  });

  it('rejects a seed longer than 256 characters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/worlds',
      payload: { name: 'new-world', seed: 'x'.repeat(257) },
    });

    expect(response.statusCode).toBe(400);
  });

  it.each(['-9223372036854775808', 'a text seed with spaces, commas & symbols!'])(
    'accepts seed %j',
    async (seed) => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/worlds',
        payload: { name: 'new-world', seed },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().seed).toBe(seed);
    }
  );
});
