import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-ops-test');

// Set env vars BEFORE any imports
process.env.PLATFORM_PATH = TEST_PLATFORM_PATH;
process.env.AUTH_ACCESS_MODE = 'open';
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

// Mock audit-log-service
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock Docker functions
vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual('@minecraft-docker/shared');
  return {
    ...actual,
    containerExists: vi.fn((containerName: string) => {
      // Assume container exists if server directory exists
      const serverName = containerName.replace('mc-', '');
      const serverPath = join(TEST_PLATFORM_PATH, 'servers', serverName, 'docker-compose.yml');
      return existsSync(serverPath);
    }),
    getContainerStatus: vi.fn(() => 'stopped'), // Assume servers are stopped
  };
});

// Mock Mojang API
global.fetch = vi.fn((url: string) => {
  const urlStr = String(url);
  if (urlStr.includes('mojang.com')) {
    const username = urlStr.split('/').pop();
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        id: '069a79f444e94726a5befca90e38aaf5',
        name: username,
      }),
    } as Response);
  }
  return Promise.reject(new Error('Unknown URL'));
});

function setupServer(serverName: string, files: Record<string, unknown>) {
  const serverDir = join(TEST_PLATFORM_PATH, 'servers', serverName);
  const dataDir = join(serverDir, 'data');
  mkdirSync(dataDir, { recursive: true });

  // Create docker-compose.yml (필수)
  writeFileSync(
    join(serverDir, 'docker-compose.yml'),
    'services:\n  minecraft:\n    image: itzg/minecraft-server',
    'utf-8'
  );

  for (const [filename, content] of Object.entries(files)) {
    writeFileSync(join(dataDir, filename), JSON.stringify(content, null, 2), 'utf-8');
  }
}

describe('OP Level Management API', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Clean up first
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }

    mkdirSync(TEST_PLATFORM_PATH, { recursive: true });

    // Import and override config
    const { config } = await import('../src/config/index.js');
    (config as any).platformPath = TEST_PLATFORM_PATH;

    // Import buildApp AFTER config override
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

  // ==================== GET /api/servers/:name/ops ====================

  describe('GET /api/servers/:name/ops', () => {
    it('should return operators with level and role information', async () => {
      setupServer('test-server', {
        'ops.json': [
          {
            uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
            name: 'Notch',
            level: 4,
            bypassesPlayerLimit: false,
          },
          {
            uuid: '8667ba71-b85a-4004-af54-457a9734eed7',
            name: 'Steve',
            level: 2,
            bypassesPlayerLimit: false,
          },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/test-server/ops',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json).toHaveProperty('operators');
      expect(json).toHaveProperty('count');
      expect(json.operators).toHaveLength(2);

      // Check level and role
      const notch = json.operators.find((op: any) => op.name === 'Notch');
      expect(notch).toBeDefined();
      expect(notch.level).toBe(4);
      expect(notch.role).toBe('Owner');
      expect(notch.uuid).toBe('069a79f4-44e9-4726-a5be-fca90e38aaf5');

      const steve = json.operators.find((op: any) => op.name === 'Steve');
      expect(steve).toBeDefined();
      expect(steve.level).toBe(2);
      expect(steve.role).toBe('Gamemaster');
    });

    it('should return empty list if ops.json does not exist', async () => {
      setupServer('test-server', {});

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/test-server/ops',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json.operators).toEqual([]);
      expect(json.count).toBe(0);
    });

    it('should return 404 if server does not exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/nonexistent/ops',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ==================== POST /api/servers/:name/ops ====================

  describe('POST /api/servers/:name/ops', () => {
    it('should add operator with default level 4', async () => {
      setupServer('test-server', { 'ops.json': [] });

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/test-server/ops',
        payload: {
          player: 'TestPlayer',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json.success).toBe(true);
      expect(json.operator).toBeDefined();
      expect(json.operator.name).toBe('TestPlayer');
      expect(json.operator.level).toBe(4);
      expect(json.operator.role).toBe('Owner');

      // Verify ops.json was written
      const opsPath = join(TEST_PLATFORM_PATH, 'servers', 'test-server', 'data', 'ops.json');
      const opsContent = JSON.parse(readFileSync(opsPath, 'utf-8'));
      expect(opsContent).toHaveLength(1);
      expect(opsContent[0].name).toBe('TestPlayer');
      expect(opsContent[0].level).toBe(4);
    });

    it('should add operator with specified level', async () => {
      setupServer('test-server', { 'ops.json': [] });

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/test-server/ops',
        payload: {
          player: 'Moderator1',
          level: 2,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json.success).toBe(true);
      expect(json.operator).toBeDefined();
      expect(json.operator.name).toBe('Moderator1');
      expect(json.operator.level).toBe(2);
      expect(json.operator.role).toBe('Gamemaster');
    });

    it('should reject invalid level (below 1)', async () => {
      setupServer('test-server', { 'ops.json': [] });

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/test-server/ops',
        payload: {
          player: 'BadLevel',
          level: 0,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid level (above 4)', async () => {
      setupServer('test-server', { 'ops.json': [] });

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/test-server/ops',
        payload: {
          player: 'BadLevel',
          level: 5,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ==================== PATCH /api/servers/:name/ops/:player ====================

  describe('PATCH /api/servers/:name/ops/:player', () => {
    it('should update operator level', async () => {
      setupServer('test-server', {
        'ops.json': [
          {
            uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
            name: 'Notch',
            level: 4,
            bypassesPlayerLimit: false,
          },
        ],
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/test-server/ops/Notch',
        payload: {
          level: 2,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json.success).toBe(true);
      expect(json.operator).toBeDefined();
      expect(json.operator.name).toBe('Notch');
      expect(json.operator.level).toBe(2);
      expect(json.operator.role).toBe('Gamemaster');

      // Verify ops.json was updated
      const opsPath = join(TEST_PLATFORM_PATH, 'servers', 'test-server', 'data', 'ops.json');
      const opsContent = JSON.parse(readFileSync(opsPath, 'utf-8'));
      expect(opsContent[0].level).toBe(2);
    });

    it('should return 404 if operator not found', async () => {
      setupServer('test-server', { 'ops.json': [] });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/test-server/ops/NonExistent',
        payload: {
          level: 3,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should reject invalid level', async () => {
      setupServer('test-server', {
        'ops.json': [
          {
            uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
            name: 'Notch',
            level: 4,
            bypassesPlayerLimit: false,
          },
        ],
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/test-server/ops/Notch',
        payload: {
          level: 10,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ==================== DELETE /api/servers/:name/ops/:player ====================

  describe('DELETE /api/servers/:name/ops/:player', () => {
    it('should remove operator', async () => {
      setupServer('test-server', {
        'ops.json': [
          {
            uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
            name: 'Notch',
            level: 4,
            bypassesPlayerLimit: false,
          },
        ],
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/servers/test-server/ops/Notch',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json.success).toBe(true);

      // Verify ops.json was updated
      const opsPath = join(TEST_PLATFORM_PATH, 'servers', 'test-server', 'data', 'ops.json');
      const opsContent = JSON.parse(readFileSync(opsPath, 'utf-8'));
      expect(opsContent).toHaveLength(0);
    });
  });
});
