import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

// Mock child_process module
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const EventEmitter = require('events');
  const { promisify } = require('util');

  const mockExec = Object.assign(
    vi.fn((cmd: any, opts: any, callback: any) => {
      process.nextTick(() => {
        callback(null, 'Command executed', '');
      });
      const mockProcess = new EventEmitter();
      (mockProcess as any).kill = vi.fn();
      return mockProcess;
    }),
    {
      [promisify.custom]: vi.fn((cmd: any, opts: any) => {
        return Promise.resolve({ stdout: 'Command executed', stderr: '' });
      }),
    }
  );

  return { ...actual, exec: mockExec };
});

vi.mock('node:child_process', async (importOriginal) => {
  const EventEmitter = require('events');
  const actual = await importOriginal<typeof import('node:child_process')>();

  return {
    ...actual,
    spawn: vi.fn((command: string, args: string[]) => {
      const mockProcess = new EventEmitter();
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = vi.fn();
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Server creation started\n'));
        mockProcess.emit('close', 0);
      }, 10);
      return mockProcess;
    }),
  };
});

// Mock audit-log-service
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock @minecraft-docker/shared module
vi.mock('@minecraft-docker/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@minecraft-docker/shared')>();

  // Create a mock adapter
  const mockAdapter = {
    sourceName: 'modrinth',
    displayName: 'Modrinth',
    getEnvKey: () => 'MODRINTH_PROJECTS',
    formatForEnv: (project: any) => project.slug,
    search: vi.fn(),
    getProject: vi.fn(),
    getVersions: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
  };

  // Override ModSourceFactory
  const mockFactory = {
    get: vi.fn().mockReturnValue(mockAdapter),
    getOrNull: vi.fn().mockReturnValue(mockAdapter),
    isSupported: vi.fn().mockReturnValue(true),
    getSupportedSources: vi.fn().mockReturnValue(['modrinth']),
    getAllAdapters: vi.fn().mockReturnValue([mockAdapter]),
    getDefaultSource: vi.fn().mockReturnValue('modrinth'),
    register: vi.fn(),
    clear: vi.fn(),
  };

  return {
    ...actual,
    getAllServers: vi.fn(),
    getServerInfoFromConfig: vi.fn(),
    getServerDetailedInfo: vi.fn(),
    getContainerLogs: vi.fn(),
    containerExists: vi.fn(),
    serverExists: vi.fn(),
    getContainerStatus: vi.fn(),
    getContainerHealth: vi.fn(),
    stopContainer: vi.fn(),
    ModSourceFactory: mockFactory,
  };
});

// Mock @minecraft-docker/mod-source-modrinth (auto-register)
vi.mock('@minecraft-docker/mod-source-modrinth', () => ({}));

// Mock fs module
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    rmSync: vi.fn(),
  };
});

import {
  serverExists,
  ModSourceFactory,
} from '@minecraft-docker/shared';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const mockedServerExists = vi.mocked(serverExists);
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);

describe('Server Mods Routes', () => {
  let app: FastifyInstance;

  const sampleConfigWithMods = `# Server Configuration
TYPE=FABRIC
VERSION=1.21.1
MODRINTH_PROJECTS=sodium,lithium,iris
MEMORY=4G
`;

  const sampleConfigWithoutMods = `# Server Configuration
TYPE=FABRIC
VERSION=1.21.1
MEMORY=4G
`;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(sampleConfigWithMods);
    mockWriteFileSync.mockImplementation(() => {});
  });

  // ============================================================
  // GET /api/servers/:name/mods
  // ============================================================

  describe('GET /api/servers/:name/mods', () => {
    it('should return 404 if server does not exist', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/nonexistent/mods',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return empty mods if config has no mod entries', async () => {
      mockedServerExists.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleConfigWithoutMods);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/myserver/mods',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.mods).toBeDefined();
    });

    it('should return mods list from config.env', async () => {
      mockedServerExists.mockReturnValue(true);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/myserver/mods',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.mods.modrinth).toEqual(['sodium', 'lithium', 'iris']);
    });
  });

  // ============================================================
  // POST /api/servers/:name/mods
  // ============================================================

  describe('POST /api/servers/:name/mods', () => {
    it('should return 404 if server does not exist', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/nonexistent/mods',
        payload: { slugs: ['fabric-api'] },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if slugs is empty', async () => {
      mockedServerExists.mockReturnValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/myserver/mods',
        payload: { slugs: [] },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should add mods to config.env', async () => {
      mockedServerExists.mockReturnValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/myserver/mods',
        payload: { slugs: ['fabric-api', 'modmenu'] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.added).toEqual(['fabric-api', 'modmenu']);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should not duplicate existing mods', async () => {
      mockedServerExists.mockReturnValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/myserver/mods',
        payload: { slugs: ['sodium', 'fabric-api'] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.added).toEqual(['fabric-api']); // sodium already exists
    });
  });

  // ============================================================
  // DELETE /api/servers/:name/mods/:slug
  // ============================================================

  describe('DELETE /api/servers/:name/mods/:slug', () => {
    it('should return 404 if server does not exist', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/servers/nonexistent/mods/sodium',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if mod is not installed', async () => {
      mockedServerExists.mockReturnValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/servers/myserver/mods/nonexistent-mod',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should remove a mod from config.env', async () => {
      mockedServerExists.mockReturnValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/servers/myserver/mods/lithium',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.removed).toBe('lithium');
      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  // ============================================================
  // GET /api/mods/search
  // ============================================================

  describe('GET /api/mods/search', () => {
    it('should return 400 if query is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/mods/search',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return search results', async () => {
      const mockSearchResult = {
        hits: [{ slug: 'sodium', title: 'Sodium', description: 'Perf mod', downloads: 1000000 }],
        totalHits: 1,
        offset: 0,
        limit: 10,
      };

      const adapter = ModSourceFactory.get('modrinth');
      (adapter.search as any).mockResolvedValue(mockSearchResult);

      const response = await app.inject({
        method: 'GET',
        url: '/api/mods/search?q=sodium',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hits).toHaveLength(1);
      expect(body.hits[0].slug).toBe('sodium');
    });

    it('should pass limit and offset to search', async () => {
      const adapter = ModSourceFactory.get('modrinth');
      (adapter.search as any).mockResolvedValue({ hits: [], totalHits: 0, offset: 5, limit: 5 });

      await app.inject({
        method: 'GET',
        url: '/api/mods/search?q=test&limit=5&offset=5',
      });

      expect(adapter.search).toHaveBeenCalledWith('test', { limit: 5, offset: 5 });
    });
  });
});
