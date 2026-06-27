import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-world-map-test');

process.env.MCCTL_ROOT = TEST_PLATFORM_PATH;
process.env.PLATFORM_PATH = TEST_PLATFORM_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

/** Seed a fake rendered webroot for a world. */
function seedRenderedMap(name: string) {
  const web = join(TEST_PLATFORM_PATH, 'maps', name, 'web');
  mkdirSync(join(web, 'maps', 'overworld', 'tiles'), { recursive: true });
  mkdirSync(join(web, 'maps', 'nether'), { recursive: true });
  mkdirSync(join(web, 'assets'), { recursive: true });
  writeFileSync(join(web, 'index.html'), '<html>BlueMap</html>', 'utf-8');
  writeFileSync(join(web, 'assets', 'app.js'), 'console.log(1)', 'utf-8');
  writeFileSync(
    join(web, 'maps', 'overworld', 'tiles', 't.prbm'),
    'tiledata',
    'utf-8'
  );
}

describe('World Map API (#529)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
    mkdirSync(join(TEST_PLATFORM_PATH, 'worlds'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'maps'), { recursive: true });
    // A secret file OUTSIDE any webroot, used to verify traversal defense.
    writeFileSync(join(TEST_PLATFORM_PATH, 'maps', 'SECRET.txt'), 'top-secret', 'utf-8');

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

  describe('GET /api/worlds/:name/map/status', () => {
    it('reports not rendered when no map exists', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/worlds/survival/map/status' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ rendered: false, maps: [] });
    });

    it('reports rendered dimensions when a map exists', async () => {
      seedRenderedMap('survival');
      const res = await app.inject({ method: 'GET', url: '/api/worlds/survival/map/status' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.rendered).toBe(true);
      expect(body.maps.sort()).toEqual(['nether', 'overworld']);
      expect(typeof body.lastModified).toBe('string');
    });
  });

  describe('GET /api/worlds/:name/map/web/*', () => {
    it('serves index.html', async () => {
      seedRenderedMap('survival');
      const res = await app.inject({ method: 'GET', url: '/api/worlds/survival/map/web/index.html' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.body).toContain('BlueMap');
    });

    it('serves nested tile assets', async () => {
      seedRenderedMap('survival');
      const res = await app.inject({
        method: 'GET',
        url: '/api/worlds/survival/map/web/maps/overworld/tiles/t.prbm',
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe('tiledata');
    });

    it('returns 404 for a missing file', async () => {
      seedRenderedMap('survival');
      const res = await app.inject({ method: 'GET', url: '/api/worlds/survival/map/web/nope.js' });
      expect(res.statusCode).toBe(404);
    });

    it('blocks path traversal outside the webroot', async () => {
      seedRenderedMap('survival');
      const res = await app.inject({
        method: 'GET',
        url: '/api/worlds/survival/map/web/..%2f..%2fSECRET.txt',
      });
      expect(res.statusCode).not.toBe(200);
      expect(res.body).not.toContain('top-secret');
    });
  });

  describe('POST /api/worlds/:name/map/render', () => {
    it('returns 404 for a non-existent world', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/worlds/ghost/map/render',
        payload: {},
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
