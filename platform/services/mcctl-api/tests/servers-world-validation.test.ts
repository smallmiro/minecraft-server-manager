/**
 * Tests for POST /api/servers world-option validation (#491).
 *
 * Coverage:
 *  - seed + worldName together → 400 (mutual exclusion, previously a 500 from bash)
 *  - worldName that does not exist → 400
 *  - worldName already mapped to a server → 409
 *
 * Uses the real app + a temp platform dir (servers.test.ts mocks shared, which
 * is unrelated and currently broken). Only the validation paths that return
 * BEFORE create-server.sh is spawned are exercised, so no Docker is needed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-servers-world-test');

process.env.MCCTL_ROOT = TEST_PLATFORM_PATH;
process.env.PLATFORM_PATH = TEST_PLATFORM_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

describe('POST /api/servers - world option validation', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
    mkdirSync(join(TEST_PLATFORM_PATH, 'backups', 'meta'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'worlds'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'servers'), { recursive: true });

    const { config } = await import('../src/config/index.js');
    (config as Record<string, unknown>).platformPath = TEST_PLATFORM_PATH;
    (config as Record<string, unknown>).mcctlRoot = TEST_PLATFORM_PATH;

    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
  });

  it('returns 400 when seed and worldName are both provided', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/servers',
      payload: { name: 'test-srv', type: 'PAPER', version: '1.21.1', seed: '123', worldName: 'whatever' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: string }>().error).toBe('BadRequest');
  });

  it('returns 400 when worldName does not exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/servers',
      payload: { name: 'test-srv', type: 'PAPER', version: '1.21.1', worldName: 'ghost-world' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ message: string }>().message).toContain('not found');
  });

  it('returns 409 when worldName is already mapped to a server', async () => {
    // A world that an existing server points at via LEVEL.
    mkdirSync(join(TEST_PLATFORM_PATH, 'worlds', 'mapped-world'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'servers', 'owner-srv'), { recursive: true });
    writeFileSync(
      join(TEST_PLATFORM_PATH, 'servers', 'owner-srv', 'config.env'),
      'LEVEL=mapped-world\n',
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/servers',
      payload: { name: 'test-srv', type: 'PAPER', version: '1.21.1', worldName: 'mapped-world' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe('Conflict');
  });
});
