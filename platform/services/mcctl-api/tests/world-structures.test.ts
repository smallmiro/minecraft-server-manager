import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, rmSync, existsSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-world-structures-test');
const FIXTURE = join(import.meta.dirname, 'fixtures', 'world-info', 'factory');

process.env.MCCTL_ROOT = TEST_PLATFORM_PATH;
process.env.PLATFORM_PATH = TEST_PLATFORM_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

/** Seed a world with the committed factory fixture (incl. a region file). */
function seedWorld(name: string) {
  const dir = join(TEST_PLATFORM_PATH, 'worlds', name);
  mkdirSync(join(dir, 'region'), { recursive: true });
  copyFileSync(join(FIXTURE, 'level.dat'), join(dir, 'level.dat'));
  // Region fixture may or may not contain structures; the route should still 200.
  const regionFixture = join(FIXTURE, 'region', 'r.-1.-1.mca');
  if (existsSync(regionFixture)) {
    copyFileSync(regionFixture, join(dir, 'region', 'r.-1.-1.mca'));
  }
}

/** Seed a rendered webroot for a world (overworld map dir + index.html). */
function seedRenderedMap(name: string) {
  const web = join(TEST_PLATFORM_PATH, 'maps', name, 'web');
  mkdirSync(join(web, 'maps', 'overworld'), { recursive: true });
  writeFileSync(join(web, 'index.html'), '<html>BlueMap</html>', 'utf-8');
}

describe('World Structures API (#530)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
    mkdirSync(join(TEST_PLATFORM_PATH, 'worlds'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'maps'), { recursive: true });
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

  describe('GET /api/worlds/:name/structures', () => {
    it('returns a structures array', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/worlds/factory/structures' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.structures)).toBe(true);
      expect(body.total).toBe(body.structures.length);
    });

    it('returns 404 for a missing world', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/worlds/ghost/structures' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/worlds/:name/map/markers', () => {
    it('409 when the map has not been rendered', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/worlds/factory/map/markers' });
      expect(res.statusCode).toBe(409);
    });

    it('404 for a missing world', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/worlds/ghost/map/markers' });
      expect(res.statusCode).toBe(404);
    });

    it('writes markers.json into the rendered webroot', async () => {
      seedRenderedMap('factory');
      const res = await app.inject({ method: 'POST', url: '/api/worlds/factory/map/markers' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(typeof body.total).toBe('number');
      expect(
        existsSync(join(TEST_PLATFORM_PATH, 'maps', 'factory', 'web', 'maps', 'overworld', 'live', 'markers.json'))
      ).toBe(true);
    });
  });
});
