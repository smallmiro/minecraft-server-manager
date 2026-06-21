import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-worlds-servers-test');

// Set env BEFORE imports so config + Paths resolve to the fixture.
process.env.MCCTL_ROOT = TEST_PLATFORM_PATH;
process.env.PLATFORM_PATH = TEST_PLATFORM_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

function makeWorld(name: string) {
  mkdirSync(join(TEST_PLATFORM_PATH, 'worlds', name), { recursive: true });
}

function makeServer(name: string, env: Record<string, string>) {
  const dir = join(TEST_PLATFORM_PATH, 'servers', name);
  mkdirSync(dir, { recursive: true });
  const content = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  writeFileSync(join(dir, 'config.env'), content, 'utf-8');
}

describe('GET /api/worlds - servers using each world', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
    // Backup-schedule plugin needs a writable meta dir for its sqlite db.
    mkdirSync(join(TEST_PLATFORM_PATH, 'backups', 'meta'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'worlds'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'servers'), { recursive: true });

    makeWorld('shared-world');
    makeWorld('solo');
    makeServer('alpha', { TYPE: 'PAPER', LEVEL: 'shared-world' });
    makeServer('beta', { TYPE: 'PAPER', LEVEL: 'shared-world' });
    makeServer('solo', { TYPE: 'PAPER' }); // no LEVEL → owns worlds/solo

    const { config } = await import('../src/config/index.js');
    (config as any).platformPath = TEST_PLATFORM_PATH;
    (config as any).mcctlRoot = TEST_PLATFORM_PATH;

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

  it('includes the list of servers using each world in the list response', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/worlds' });
    expect(response.statusCode).toBe(200);

    const json = response.json();
    const shared = json.worlds.find((w: { name: string }) => w.name === 'shared-world');
    const solo = json.worlds.find((w: { name: string }) => w.name === 'solo');

    expect(shared.servers.sort()).toEqual(['alpha', 'beta']);
    expect(solo.servers).toEqual(['solo']);
  });

  it('includes the servers list in the world detail response', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/worlds/shared-world' });
    expect(response.statusCode).toBe(200);

    const json = response.json();
    expect(json.world.servers.sort()).toEqual(['alpha', 'beta']);
  });
});
