import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, rmSync, existsSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-world-stats-test');
const FIXTURE = join(import.meta.dirname, 'fixtures', 'world-info', 'factory');

process.env.MCCTL_ROOT = TEST_PLATFORM_PATH;
process.env.PLATFORM_PATH = TEST_PLATFORM_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

function seedWorld(name: string) {
  const dir = join(TEST_PLATFORM_PATH, 'worlds', name);
  mkdirSync(join(dir, 'region'), { recursive: true });
  copyFileSync(join(FIXTURE, 'level.dat'), join(dir, 'level.dat'));
  const regionFixture = join(FIXTURE, 'region', 'r.-1.-1.mca');
  if (existsSync(regionFixture)) {
    copyFileSync(regionFixture, join(dir, 'region', 'r.-1.-1.mca'));
  }
}

describe('World Stats API (#531)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
    mkdirSync(join(TEST_PLATFORM_PATH, 'worlds'), { recursive: true });
    seedWorld('factory');

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

  describe('GET /api/worlds/:name/stats', () => {
    it('404 when never analyzed', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/worlds/factory/stats' });
      expect(res.statusCode).toBe(404);
    });

    it('returns the cached result once analyzed', async () => {
      // Pre-seed a cache file directly.
      mkdirSync(join(TEST_PLATFORM_PATH, 'stats'), { recursive: true });
      writeFileSync(
        join(TEST_PLATFORM_PATH, 'stats', 'factory.json'),
        JSON.stringify({
          world: 'factory',
          analyzedAt: '2026-06-27T00:00:00.000Z',
          durationMs: 1234,
          dimensions: ['overworld'],
          regionsScanned: 1,
          totalBlocks: 100,
          blockTypeCount: 2,
          ores: { 'minecraft:diamond_ore': 3 },
          topBlocks: [{ id: 'minecraft:stone', count: 80 }],
        }),
        'utf-8'
      );
      const res = await app.inject({ method: 'GET', url: '/api/worlds/factory/stats' });
      expect(res.statusCode).toBe(200);
      expect(res.json().ores['minecraft:diamond_ore']).toBe(3);
    });
  });

  describe('POST /api/worlds/:name/stats/analyze', () => {
    it('404 for a missing world', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/worlds/ghost/stats/analyze' });
      expect(res.statusCode).toBe(404);
    });

    it('runs synchronously and caches the result', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/worlds/factory/stats/analyze' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.world).toBe('factory');
      expect(typeof body.totalBlocks).toBe('number');
      expect(typeof body.ores).toBe('object');
      // cached
      expect(existsSync(join(TEST_PLATFORM_PATH, 'stats', 'factory.json'))).toBe(true);
      // GET now returns it
      const get = await app.inject({ method: 'GET', url: '/api/worlds/factory/stats' });
      expect(get.statusCode).toBe(200);
    });
  });
});
