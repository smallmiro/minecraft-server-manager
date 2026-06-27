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
    getModpackClientOnlyMods: vi.fn(),
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

    it('should pass modpack projectType filter to search when type=modpack', async () => {
      const adapter = ModSourceFactory.get('modrinth');
      (adapter.search as any).mockResolvedValue({ hits: [], totalHits: 0, offset: 0, limit: 10 });

      await app.inject({
        method: 'GET',
        url: '/api/mods/search?q=cobblemon&type=modpack',
      });

      expect(adapter.search).toHaveBeenCalledWith(
        'cobblemon',
        expect.objectContaining({ projectType: 'modpack' })
      );
    });
  });

  // ============================================================
  // GET /api/mods/:slug/versions
  // ============================================================

  describe('GET /api/mods/:slug/versions', () => {
    const sampleVersions = [
      {
        id: 'v-neoforge',
        projectId: 'proj-1',
        name: 'NeoForge 2.0',
        versionNumber: '2.0.0',
        versionType: 'release',
        gameVersions: ['1.21.1'],
        loaders: ['neoforge'],
        files: [],
        dependencies: [],
        downloads: 100,
        datePublished: '2024-06-01T00:00:00Z',
      },
      {
        id: 'v-forge',
        projectId: 'proj-1',
        name: 'Forge 1.0',
        versionNumber: '1.0.0',
        versionType: 'release',
        gameVersions: ['1.19.2'],
        loaders: ['forge'],
        files: [],
        dependencies: [],
        downloads: 50,
        datePublished: '2024-01-01T00:00:00Z',
      },
    ];

    it('should return a compatibility matrix for a modpack slug', async () => {
      const adapter = ModSourceFactory.get('modrinth');
      (adapter.getVersions as any).mockResolvedValue(sampleVersions);

      const response = await app.inject({
        method: 'GET',
        url: '/api/mods/cobblemon/versions',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.slug).toBe('cobblemon');
      expect(body.loaders.sort()).toEqual(['forge', 'neoforge']);
      expect(body.byLoader.neoforge.gameVersions).toEqual(['1.21.1']);
      expect(body.byLoader.neoforge.recommended['1.21.1']).toBe('2.0.0');
      expect(body.byLoader.forge.gameVersions).toEqual(['1.19.2']);
    });

    it('should return 404 when project has no versions (unknown slug)', async () => {
      const adapter = ModSourceFactory.get('modrinth');
      (adapter.getVersions as any).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/mods/does-not-exist/versions',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ============================================================
  // POST /api/servers - modpack compatibility validation
  // ============================================================

  describe('POST /api/servers modpack validation', () => {
    const compatVersions = [
      {
        id: 'v-neoforge',
        projectId: 'proj-1',
        name: 'NeoForge 2.0',
        versionNumber: '2.0.0',
        versionType: 'release',
        gameVersions: ['1.21.1'],
        loaders: ['neoforge'],
        files: [],
        dependencies: [],
        downloads: 100,
        datePublished: '2024-06-01T00:00:00Z',
      },
    ];

    it('should return 400 when modLoader+version combination is incompatible', async () => {
      mockedServerExists.mockReturnValue(false);
      const adapter = ModSourceFactory.get('modrinth');
      (adapter.getVersions as any).mockResolvedValue(compatVersions);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        payload: {
          name: 'mc-bad',
          type: 'MODRINTH',
          modpack: 'cobblemon',
          modLoader: 'forge',
          version: '1.21.1',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('BadRequest');
    });

    it('should allow a compatible modLoader+version combination', async () => {
      mockedServerExists.mockReturnValue(false);
      const adapter = ModSourceFactory.get('modrinth');
      (adapter.getVersions as any).mockResolvedValue(compatVersions);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        payload: {
          name: 'mc-good',
          type: 'MODRINTH',
          modpack: 'cobblemon',
          modLoader: 'neoforge',
          version: '1.21.1',
        },
      });

      expect(response.statusCode).not.toBe(400);
    });

    it('should return 400 when modpack slug contains shell metacharacters', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        payload: {
          name: 'mc-inject',
          type: 'MODRINTH',
          // Quotes/semicolons must be rejected by schema before reaching the shell.
          modpack: 'cobblemon"; rm -rf / #',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should accept a modpack URL form (slug/id/url pattern)', async () => {
      mockedServerExists.mockReturnValue(false);
      const adapter = ModSourceFactory.get('modrinth');
      (adapter.getVersions as any).mockResolvedValue([]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        payload: {
          name: 'mc-url',
          type: 'MODRINTH',
          modpack: 'https://modrinth.com/modpack/cobblemon',
        },
      });

      // URL form passes schema validation; not a 400 from pattern rejection.
      expect(response.statusCode).not.toBe(400);
    });
  });

  // ============================================================
  // GET /api/servers/:name/mods/installed
  // ============================================================

  describe('GET /api/servers/:name/mods/installed', () => {
    it('should return 404 if server does not exist', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/nonexistent/mods/installed',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return empty list when mods directory does not exist', async () => {
      mockedServerExists.mockReturnValue(true);
      const { readdirSync, statSync } = await import('fs');
      vi.mocked(readdirSync).mockReturnValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/myserver/mods/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.mods).toEqual([]);
    });

    it('should return jar file list with excluded status', async () => {
      mockedServerExists.mockReturnValue(true);
      const { readdirSync } = await import('fs');

      const mockDirents = [
        { name: 'sodium-1.0.jar', isFile: () => true, isDirectory: () => false },
        { name: 'lithium-0.5.jar', isFile: () => true, isDirectory: () => false },
        { name: 'status-effect-bars-client.jar', isFile: () => true, isDirectory: () => false },
        { name: 'somefolder', isFile: () => false, isDirectory: () => true },
      ] as any;

      vi.mocked(readdirSync).mockReturnValue(mockDirents);

      // Config has MODRINTH_EXCLUDE_FILES=status-effect-bars-client.jar
      mockReadFileSync.mockReturnValue(`TYPE=MODRINTH
MODRINTH_MODPACK=cobblemon
MODRINTH_EXCLUDE_FILES=status-effect-bars-client.jar
`);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/myserver/mods/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.mods).toHaveLength(3);

      const sodium = body.mods.find((m: any) => m.filename === 'sodium-1.0.jar');
      expect(sodium).toBeDefined();
      expect(sodium.excluded).toBe(false);

      const clientMod = body.mods.find((m: any) => m.filename === 'status-effect-bars-client.jar');
      expect(clientMod).toBeDefined();
      expect(clientMod.excluded).toBe(true);
    });

    it('should handle missing config.env gracefully (no excludes)', async () => {
      mockedServerExists.mockReturnValue(true);
      const { readdirSync, existsSync } = await import('fs');

      vi.mocked(existsSync).mockImplementation((p: any) => {
        const pathStr = String(p);
        // config.env does not exist, but mods dir does
        if (pathStr.includes('config.env')) return false;
        return true;
      });

      const mockDirents = [
        { name: 'sodium-1.0.jar', isFile: () => true, isDirectory: () => false },
      ] as any;
      vi.mocked(readdirSync).mockReturnValue(mockDirents);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/myserver/mods/installed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.mods[0].excluded).toBe(false);
    });
  });

  // ============================================================
  // PATCH /api/servers/:name/mods/installed/:filename/exclude
  // ============================================================

  describe('PATCH /api/servers/:name/mods/installed/:filename/exclude', () => {
    it('should return 404 if server does not exist', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/nonexistent/mods/installed/sodium-1.0.jar/exclude',
        payload: { excluded: true },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should exclude a mod by adding to MODRINTH_EXCLUDE_FILES', async () => {
      mockedServerExists.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(`TYPE=MODRINTH
MODRINTH_MODPACK=cobblemon
`);
      const { readdirSync } = await import('fs');
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'sodium-1.0.jar', isFile: () => true, isDirectory: () => false },
      ] as any);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/myserver/mods/installed/sodium-1.0.jar/exclude',
        payload: { excluded: true },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.filename).toBe('sodium-1.0.jar');
      expect(body.excluded).toBe(true);
      expect(body.restartRequired).toBe(true);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should un-exclude a mod by removing from MODRINTH_EXCLUDE_FILES', async () => {
      mockedServerExists.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(`TYPE=MODRINTH
MODRINTH_MODPACK=cobblemon
MODRINTH_EXCLUDE_FILES=sodium-1.0.jar,lithium-0.5.jar
`);
      const { readdirSync } = await import('fs');
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'sodium-1.0.jar', isFile: () => true, isDirectory: () => false },
        { name: 'lithium-0.5.jar', isFile: () => true, isDirectory: () => false },
      ] as any);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/myserver/mods/installed/sodium-1.0.jar/exclude',
        payload: { excluded: false },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.excluded).toBe(false);
      expect(body.restartRequired).toBe(true);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should use CF_EXCLUDE_MODS for CurseForge servers', async () => {
      mockedServerExists.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(`TYPE=AUTO_CURSEFORGE
CF_SLUG=cobblemon
`);
      const { readdirSync } = await import('fs');
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'client-mod.jar', isFile: () => true, isDirectory: () => false },
      ] as any);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/myserver/mods/installed/client-mod.jar/exclude',
        payload: { excluded: true },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      // The written content should contain CF_EXCLUDE_MODS
      const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
      expect(writtenContent).toContain('CF_EXCLUDE_MODS=client-mod.jar');
    });

    it('should return 400 if excluded field is missing', async () => {
      mockedServerExists.mockReturnValue(true);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/myserver/mods/installed/sodium-1.0.jar/exclude',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    // ── Security: filename validation ─────────────────────────────

    it('should return 400 for filename with newline injection', async () => {
      mockedServerExists.mockReturnValue(true);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/myserver/mods/installed/test.jar%0AEULA%3DFALSE/exclude',
        payload: { excluded: true },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('BadRequest');
    });

    it('should return 400 for filename with semicolon (shell metachar)', async () => {
      mockedServerExists.mockReturnValue(true);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/myserver/mods/installed/mod;rm+-rf.jar/exclude',
        payload: { excluded: true },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('BadRequest');
    });

    it('should return 400 for filename with backtick (shell metachar)', async () => {
      mockedServerExists.mockReturnValue(true);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/myserver/mods/installed/mod%60id%60.jar/exclude',
        payload: { excluded: true },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('BadRequest');
    });

    it('should return 400 for filename with path traversal (../)', async () => {
      mockedServerExists.mockReturnValue(true);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/myserver/mods/installed/..%2F..%2Fetc%2Fpasswd/exclude',
        payload: { excluded: true },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('BadRequest');
    });

    it('should return 400 for filename without .jar extension', async () => {
      mockedServerExists.mockReturnValue(true);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/myserver/mods/installed/config.env/exclude',
        payload: { excluded: true },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('BadRequest');
    });

    it('should return 404 for filename not in installed jar list', async () => {
      mockedServerExists.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(`TYPE=MODRINTH\nMODRINTH_MODPACK=cobblemon\n`);

      const { readdirSync } = await import('fs');
      // Only sodium-1.0.jar is installed
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'sodium-1.0.jar', isFile: () => true, isDirectory: () => false },
      ] as any);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/myserver/mods/installed/ghost-mod.jar/exclude',
        payload: { excluded: true },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
    });

    it('should accept a valid jar filename with plus/underscore/hyphen/dot', async () => {
      mockedServerExists.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(`TYPE=MODRINTH\nMODRINTH_MODPACK=cobblemon\n`);

      const { readdirSync } = await import('fs');
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'my_mod+extra-1.2.3.jar', isFile: () => true, isDirectory: () => false },
      ] as any);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/myserver/mods/installed/my_mod%2Bextra-1.2.3.jar/exclude',
        payload: { excluded: true },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/mods/:slug/client-only', () => {
    it('should return the detected client-only mod names', async () => {
      const adapter = ModSourceFactory.get('modrinth');
      (adapter.getModpackClientOnlyMods as any).mockResolvedValue([
        'searchables-1.21.1-1.0',
        'statuseffectbars-1.21.1',
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/mods/create-plus/client-only?version=abc123',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.slug).toBe('create-plus');
      expect(body.clientOnly).toEqual(['searchables-1.21.1-1.0', 'statuseffectbars-1.21.1']);
      expect(adapter.getModpackClientOnlyMods).toHaveBeenCalledWith('create-plus', 'abc123');
    });

    it('should return 502 when detection fails', async () => {
      const adapter = ModSourceFactory.get('modrinth');
      (adapter.getModpackClientOnlyMods as any).mockRejectedValue(new Error('download failed'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/mods/create-plus/client-only',
      });

      expect(response.statusCode).toBe(502);
    });
  });
});
