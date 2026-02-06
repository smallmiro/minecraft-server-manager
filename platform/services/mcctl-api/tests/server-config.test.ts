import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

// Mock child_process module first
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

  return {
    ...actual,
    exec: mockExec,
  };
});

// Mock node:child_process for spawn
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

// Mock @minecraft-docker/shared module
vi.mock('@minecraft-docker/shared', () => ({
  getAllServers: vi.fn(),
  getServerInfoFromConfig: vi.fn(),
  getServerDetailedInfo: vi.fn(),
  getContainerLogs: vi.fn(),
  containerExists: vi.fn(),
  serverExists: vi.fn(),
  getContainerStatus: vi.fn(),
  getContainerHealth: vi.fn(),
  stopContainer: vi.fn(),
}));

// Mock fs module with path-aware logic
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
  getContainerStatus,
} from '@minecraft-docker/shared';
import { existsSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'fs';

const mockedServerExists = vi.mocked(serverExists);
const mockedGetContainerStatus = vi.mocked(getContainerStatus);
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockRmSync = vi.mocked(rmSync);

describe('Server Config Routes', () => {
  let app: FastifyInstance;

  // Sample config.env content
  const sampleConfigContent = `# Server Configuration
MOTD=A Minecraft Server
MAX_PLAYERS=20
DIFFICULTY=normal
GAMEMODE=survival
PVP=true
VIEW_DISTANCE=10
SPAWN_PROTECTION=16
MEMORY=4G
USE_AIKAR_FLAGS=true
LEVEL=world
`;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockExistsSync.mockImplementation((path: string) => {
      // Default: all paths exist unless specified otherwise in test
      return true;
    });

    mockReadFileSync.mockImplementation((path: string) => {
      return sampleConfigContent;
    });

    mockWriteFileSync.mockImplementation(() => {});
    mockReaddirSync.mockReturnValue([]);
    mockRmSync.mockImplementation(() => {});
  });

  describe('GET /api/servers/:name/config', () => {
    it('should return 404 if server does not exist', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/nonexistent/config',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
      expect(body.message).toContain("Server 'nonexistent' not found");
    });

    it('should return 404 if config.env does not exist', async () => {
      mockedServerExists.mockReturnValue(true);

      // Make existsSync return false for config.env path
      mockExistsSync.mockImplementation((path: string) => {
        const pathStr = String(path);
        if (pathStr.includes('config.env')) {
          return false;
        }
        return true;
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/testserver/config',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
      expect(body.message).toContain("Configuration for server 'testserver' not found");
    });

    it('should return 200 with parsed config when config.env exists', async () => {
      mockedServerExists.mockReturnValue(true);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleConfigContent);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/testserver/config',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.config).toBeDefined();
      expect(body.config.motd).toBe('A Minecraft Server');
      expect(body.config.maxPlayers).toBe(20);
      expect(body.config.difficulty).toBe('normal');
      expect(body.config.gameMode).toBe('survival');
      expect(body.config.pvp).toBe(true);
      expect(body.config.viewDistance).toBe(10);
      expect(body.config.spawnProtection).toBe(16);
      expect(body.config.memory).toBe('4G');
      expect(body.config.useAikarFlags).toBe(true);
    });

    it('should return 500 on internal error', async () => {
      mockedServerExists.mockReturnValue(true);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/testserver/config',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('InternalServerError');
      expect(body.message).toBe('Failed to get server configuration');
    });
  });

  describe('PATCH /api/servers/:name/config', () => {
    it('should return 404 if server does not exist', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/nonexistent/config',
        payload: {
          motd: 'New MOTD',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
      expect(body.message).toContain("Server 'nonexistent' not found");
    });

    it('should return 200 with updated config and changedFields', async () => {
      mockedServerExists.mockReturnValue(true);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleConfigContent);

      let writtenContent = '';
      mockWriteFileSync.mockImplementation((path: any, content: any) => {
        writtenContent = String(content);
      });

      // After write, readFileSync should return updated content
      mockReadFileSync.mockImplementation((path: string) => {
        if (writtenContent) {
          return writtenContent;
        }
        return sampleConfigContent;
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/testserver/config',
        payload: {
          motd: 'Updated MOTD',
          maxPlayers: 50,
          difficulty: 'hard',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.changedFields).toContain('motd');
      expect(body.changedFields).toContain('maxPlayers');
      expect(body.changedFields).toContain('difficulty');
      expect(body.restartRequired).toBe(false);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should set restartRequired=true when memory is changed', async () => {
      mockedServerExists.mockReturnValue(true);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleConfigContent);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/testserver/config',
        payload: {
          memory: '8G',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.changedFields).toContain('memory');
      expect(body.restartRequired).toBe(true);
    });

    it('should set restartRequired=true when useAikarFlags is changed', async () => {
      mockedServerExists.mockReturnValue(true);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleConfigContent);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/testserver/config',
        payload: {
          useAikarFlags: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.changedFields).toContain('useAikarFlags');
      expect(body.restartRequired).toBe(true);
    });

    it('should handle no actual changes (empty changedFields)', async () => {
      mockedServerExists.mockReturnValue(true);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleConfigContent);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/testserver/config',
        payload: {
          motd: 'A Minecraft Server', // Same as existing
          maxPlayers: 20, // Same as existing
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.changedFields).toHaveLength(0);
      expect(body.restartRequired).toBe(false);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/servers/:name/world/reset', () => {
    it('should return 404 if server does not exist', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/nonexistent/world/reset',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
      expect(body.message).toContain("Server 'nonexistent' not found");
    });

    it('should return 409 if server is running', async () => {
      mockedServerExists.mockReturnValue(true);
      mockedGetContainerStatus.mockReturnValue('running');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/testserver/world/reset',
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Conflict');
      expect(body.message).toContain('Server must be stopped before resetting world');
      expect(body.message).toContain('running');
    });

    it('should return 409 if server is in created state', async () => {
      mockedServerExists.mockReturnValue(true);
      mockedGetContainerStatus.mockReturnValue('created');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/testserver/world/reset',
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Conflict');
      expect(body.message).toContain('Server must be stopped before resetting world');
    });

    it('should return 404 if world does not exist', async () => {
      mockedServerExists.mockReturnValue(true);
      mockedGetContainerStatus.mockReturnValue('exited');
      mockExistsSync.mockImplementation((path: string) => {
        const pathStr = String(path);
        // Config exists but world doesn't
        if (pathStr.includes('worlds/world')) {
          return false;
        }
        return true;
      });
      mockReadFileSync.mockReturnValue(sampleConfigContent);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/testserver/world/reset',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
      expect(body.message).toContain("World 'world' not found");
    });

    it('should return 400 for path traversal attempt', async () => {
      mockedServerExists.mockReturnValue(true);
      mockedGetContainerStatus.mockReturnValue('exited');
      mockExistsSync.mockReturnValue(true);

      // Mock config with path traversal in LEVEL
      const maliciousConfig = `LEVEL=../../etc`;
      mockReadFileSync.mockReturnValue(maliciousConfig);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/testserver/world/reset',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('BadRequest');
      expect(body.message).toContain('Invalid world name in server configuration');
    });

    it('should return 200 and reset world when server is stopped', async () => {
      mockedServerExists.mockReturnValue(true);
      mockedGetContainerStatus.mockReturnValue('exited');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleConfigContent);

      // Mock world directory contents
      mockReaddirSync.mockReturnValue([
        { name: 'level.dat', isDirectory: () => false },
        { name: 'region', isDirectory: () => true },
        { name: 'data', isDirectory: () => true },
        { name: '.meta', isDirectory: () => false },
      ] as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/testserver/world/reset',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.message).toContain('World data has been reset');
      expect(body.worldName).toBe('world');

      // Verify rmSync was called for each entry except .meta
      expect(mockRmSync).toHaveBeenCalledTimes(3);
      expect(mockRmSync).not.toHaveBeenCalledWith(
        expect.stringContaining('.meta'),
        expect.anything()
      );
    });

    it('should preserve .meta file during world reset', async () => {
      mockedServerExists.mockReturnValue(true);
      mockedGetContainerStatus.mockReturnValue('exited');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleConfigContent);

      // Mock world directory with .meta file
      mockReaddirSync.mockReturnValue([
        { name: 'level.dat', isDirectory: () => false },
        { name: '.meta', isDirectory: () => false },
        { name: 'region', isDirectory: () => true },
      ] as any);

      await app.inject({
        method: 'POST',
        url: '/api/servers/testserver/world/reset',
      });

      // Verify rmSync was called exactly twice (not for .meta)
      expect(mockRmSync).toHaveBeenCalledTimes(2);

      // Verify .meta was NOT deleted
      const rmSyncCalls = mockRmSync.mock.calls;
      const metaDeleted = rmSyncCalls.some(([path]) => String(path).endsWith('.meta'));
      expect(metaDeleted).toBe(false);
    });

    it('should accept exited status as valid for reset', async () => {
      mockedServerExists.mockReturnValue(true);
      mockedGetContainerStatus.mockReturnValue('exited');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleConfigContent);
      mockReaddirSync.mockReturnValue([
        { name: 'level.dat', isDirectory: () => false },
      ] as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/testserver/world/reset',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should accept not_found status as valid for reset', async () => {
      mockedServerExists.mockReturnValue(true);
      mockedGetContainerStatus.mockReturnValue('not_found');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleConfigContent);
      mockReaddirSync.mockReturnValue([
        { name: 'level.dat', isDirectory: () => false },
      ] as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/testserver/world/reset',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('Response Format', () => {
    it('should return JSON content type for GET config', async () => {
      mockedServerExists.mockReturnValue(true);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleConfigContent);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/testserver/config',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should return JSON content type for PATCH config', async () => {
      mockedServerExists.mockReturnValue(true);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleConfigContent);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/servers/testserver/config',
        payload: { motd: 'Test' },
      });

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should return JSON content type for POST world reset', async () => {
      mockedServerExists.mockReturnValue(true);
      mockedGetContainerStatus.mockReturnValue('exited');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleConfigContent);
      mockReaddirSync.mockReturnValue([]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/testserver/world/reset',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });
  });
});
