import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-whitelist-status-test');

// Set env vars BEFORE any imports
process.env.PLATFORM_PATH = TEST_PLATFORM_PATH;
process.env.AUTH_ACCESS_MODE = 'open';
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

// Mock Docker functions
vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual('@minecraft-docker/shared');
  return {
    ...actual,
    containerExists: vi.fn((containerName: string) => {
      const serverName = containerName.replace('mc-', '');
      const serverPath = join(TEST_PLATFORM_PATH, 'servers', serverName, 'docker-compose.yml');
      return existsSync(serverPath);
    }),
    getContainerStatus: vi.fn(() => 'stopped'),
  };
});

function setupServer(serverName: string, opts: { configEnv?: string; files?: Record<string, unknown> } = {}) {
  const serverDir = join(TEST_PLATFORM_PATH, 'servers', serverName);
  const dataDir = join(serverDir, 'data');
  mkdirSync(dataDir, { recursive: true });

  writeFileSync(
    join(serverDir, 'docker-compose.yml'),
    'services:\n  minecraft:\n    image: itzg/minecraft-server',
    'utf-8'
  );

  if (opts.configEnv) {
    writeFileSync(join(serverDir, 'config.env'), opts.configEnv, 'utf-8');
  }

  if (opts.files) {
    for (const [filename, content] of Object.entries(opts.files)) {
      writeFileSync(join(dataDir, filename), JSON.stringify(content, null, 2), 'utf-8');
    }
  }
}

describe('Whitelist Status API', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }

    mkdirSync(TEST_PLATFORM_PATH, { recursive: true });

    const { config } = await import('../src/config/index.js');
    (config as any).platformPath = TEST_PLATFORM_PATH;

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

  // ==================== GET /api/servers/:name/whitelist/status ====================

  describe('GET /api/servers/:name/whitelist/status', () => {
    it('should return enabled=true when ENABLE_WHITELIST=true', async () => {
      setupServer('test-server', { configEnv: 'ENABLE_WHITELIST=true\n' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/test-server/whitelist/status',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.enabled).toBe(true);
      expect(json.source).toBe('config');
    });

    it('should return enabled=false when ENABLE_WHITELIST=false', async () => {
      setupServer('test-server', { configEnv: 'ENABLE_WHITELIST=false\n' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/test-server/whitelist/status',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.enabled).toBe(false);
      expect(json.source).toBe('config');
    });

    it('should return enabled=false when ENABLE_WHITELIST is not set', async () => {
      setupServer('test-server', { configEnv: 'TYPE=PAPER\n' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/test-server/whitelist/status',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.enabled).toBe(false);
    });

    it('should return 404 if server does not exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/nonexistent/whitelist/status',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ==================== PUT /api/servers/:name/whitelist/status ====================

  describe('PUT /api/servers/:name/whitelist/status', () => {
    it('should enable whitelist and update config.env', async () => {
      setupServer('test-server', { configEnv: 'TYPE=PAPER\n' });

      const response = await app.inject({
        method: 'PUT',
        url: '/api/servers/test-server/whitelist/status',
        payload: { enabled: true },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.enabled).toBe(true);
      expect(json.source).toBe('config');

      // Verify config.env was updated
      const configPath = join(TEST_PLATFORM_PATH, 'servers', 'test-server', 'config.env');
      const content = readFileSync(configPath, 'utf-8');
      expect(content).toContain('ENABLE_WHITELIST=TRUE');
    });

    it('should disable whitelist and update config.env', async () => {
      setupServer('test-server', { configEnv: 'ENABLE_WHITELIST=TRUE\nTYPE=PAPER\n' });

      const response = await app.inject({
        method: 'PUT',
        url: '/api/servers/test-server/whitelist/status',
        payload: { enabled: false },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.enabled).toBe(false);

      const configPath = join(TEST_PLATFORM_PATH, 'servers', 'test-server', 'config.env');
      const content = readFileSync(configPath, 'utf-8');
      expect(content).toContain('ENABLE_WHITELIST=FALSE');
    });

    it('should preserve other config values', async () => {
      setupServer('test-server', { configEnv: 'TYPE=PAPER\nVERSION=1.21.1\n' });

      await app.inject({
        method: 'PUT',
        url: '/api/servers/test-server/whitelist/status',
        payload: { enabled: true },
      });

      const configPath = join(TEST_PLATFORM_PATH, 'servers', 'test-server', 'config.env');
      const content = readFileSync(configPath, 'utf-8');
      expect(content).toContain('TYPE=PAPER');
      expect(content).toContain('VERSION=1.21.1');
    });

    it('should return 404 if server does not exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/servers/nonexistent/whitelist/status',
        payload: { enabled: true },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if enabled field is missing', async () => {
      setupServer('test-server', { configEnv: 'TYPE=PAPER\n' });

      const response = await app.inject({
        method: 'PUT',
        url: '/api/servers/test-server/whitelist/status',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
