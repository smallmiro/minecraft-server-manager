import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, rmSync, existsSync, copyFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-world-info-test');
const BACKUP = join(import.meta.dirname, '..', '..', '..', 'backups', 'worlds', 'worlds');

process.env.MCCTL_ROOT = TEST_PLATFORM_PATH;
process.env.PLATFORM_PATH = TEST_PLATFORM_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

function seedWorld(name: string) {
  const dir = join(TEST_PLATFORM_PATH, 'worlds', name);
  mkdirSync(join(dir, 'playerdata'), { recursive: true });
  mkdirSync(join(dir, 'region'), { recursive: true });
  mkdirSync(join(dir, 'DIM-1'), { recursive: true });
  mkdirSync(join(dir, 'DIM1'), { recursive: true });
  copyFileSync(join(BACKUP, 'factory', 'level.dat'), join(dir, 'level.dat'));
  copyFileSync(
    join(BACKUP, 'botagent', 'playerdata', '91091459-b299-302c-b521-a17fae71bce3.dat'),
    join(dir, 'playerdata', '91091459-b299-302c-b521-a17fae71bce3.dat')
  );
}

function makeServer(name: string, env: Record<string, string>) {
  const dir = join(TEST_PLATFORM_PATH, 'servers', name);
  mkdirSync(dir, { recursive: true });
  const content = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  writeFileSync(join(dir, 'config.env'), content, 'utf-8');
}

describe('World Info API (#525)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
    mkdirSync(join(TEST_PLATFORM_PATH, 'backups', 'meta'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'worlds'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'servers'), { recursive: true });

    seedWorld('factory');
    makeServer('survival', { TYPE: 'PAPER', LEVEL: 'factory' });

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

  describe('GET /api/worlds/:name/info', () => {
    it('returns parsed level.dat metadata and structure', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/worlds/factory/info' });
      expect(res.statusCode).toBe(200);
      const { info } = res.json();
      expect(info.name).toBe('factory');
      expect(info.level.seed).toBe('618742839476293847');
      expect(info.level.versionName).toBe('1.21.1');
      expect(info.level.gameMode).toBe('survival');
      expect(info.dimensions).toEqual({ overworld: true, nether: true, end: true });
      expect(info.regionCount).toBe(0);
      expect(typeof info.sizeBytes).toBe('number');
    });

    it('returns 404 for an unknown world', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/worlds/nope/info' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/worlds/:name/players', () => {
    it('returns offline player locations', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/worlds/factory/players' });
      expect(res.statusCode).toBe(200);
      const { players } = res.json();
      expect(players.length).toBe(1);
      expect(players[0].online).toBe(false);
      expect(players[0].dimension).toBe('overworld');
    });
  });

  describe('GET /api/servers/:name/players/live', () => {
    it('returns empty list gracefully when the server is stopped', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/servers/survival/players/live' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ players: [] });
    });

    it('returns 404 for an unknown server', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/servers/ghost/players/live' });
      expect(res.statusCode).toBe(404);
    });
  });
});
