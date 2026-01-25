import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

// Mock child_process module first
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    exec: vi.fn(),
  };
});

// Mock @minecraft-docker/shared module
vi.mock('@minecraft-docker/shared', () => ({
  getMcContainers: vi.fn(),
  getServerInfo: vi.fn(),
  getDetailedServerInfoWithPlayers: vi.fn(),
  getContainerLogs: vi.fn(),
  containerExists: vi.fn(),
}));

import {
  getMcContainers,
  getServerInfo,
  getDetailedServerInfoWithPlayers,
  getContainerLogs,
  containerExists,
} from '@minecraft-docker/shared';

const mockedGetMcContainers = vi.mocked(getMcContainers);
const mockedGetServerInfo = vi.mocked(getServerInfo);
const mockedGetDetailedServerInfoWithPlayers = vi.mocked(getDetailedServerInfoWithPlayers);
const mockedGetContainerLogs = vi.mocked(getContainerLogs);
const mockedContainerExists = vi.mocked(containerExists);

describe('Server Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/servers', () => {
    it('should return list of servers', async () => {
      const mockContainers = ['mc-survival', 'mc-creative'];
      mockedGetMcContainers.mockReturnValue(mockContainers);
      mockedGetServerInfo.mockImplementation((container: string) => ({
        name: container.replace('mc-', ''),
        container,
        status: 'running' as const,
        health: 'healthy' as const,
        hostname: `${container.replace('mc-', '')}.local`,
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.servers).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.servers[0].name).toBe('survival');
      expect(body.servers[1].name).toBe('creative');
    });

    it('should return empty list when no servers', async () => {
      mockedGetMcContainers.mockReturnValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.servers).toHaveLength(0);
      expect(body.total).toBe(0);
    });

    it('should return 500 on error', async () => {
      mockedGetMcContainers.mockImplementation(() => {
        throw new Error('Docker not available');
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('InternalServerError');
    });
  });

  describe('GET /api/servers/:name', () => {
    it('should return server details', async () => {
      mockedContainerExists.mockReturnValue(true);
      mockedGetDetailedServerInfoWithPlayers.mockResolvedValue({
        name: 'survival',
        container: 'mc-survival',
        status: 'running' as const,
        health: 'healthy' as const,
        hostname: 'survival.local',
        type: 'PAPER',
        version: '1.20.4',
        memory: '4G',
        uptime: '2h 30m',
        uptimeSeconds: 9000,
        players: {
          online: 5,
          max: 20,
          players: ['Steve', 'Alex'],
        },
        stats: {
          memoryUsage: 2147483648,
          memoryLimit: 4294967296,
          memoryPercent: 50,
          cpuPercent: 25,
        },
        worldName: 'world',
        worldSize: '500MB',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/survival',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.server.name).toBe('survival');
      expect(body.server.type).toBe('PAPER');
      expect(body.server.players.online).toBe(5);
    });

    it('should return 404 for non-existent server', async () => {
      mockedContainerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
    });
  });

  describe('GET /api/servers/:name/logs', () => {
    it('should return server logs', async () => {
      mockedContainerExists.mockReturnValue(true);
      mockedGetContainerLogs.mockReturnValue('Line 1\nLine 2\nLine 3');

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/survival/logs',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.logs).toContain('Line 1');
      expect(body.lines).toBe(3);
    });

    it('should accept lines query parameter', async () => {
      mockedContainerExists.mockReturnValue(true);
      mockedGetContainerLogs.mockReturnValue('Line 1\nLine 2');

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/survival/logs?lines=50',
      });

      expect(response.statusCode).toBe(200);
      expect(mockedGetContainerLogs).toHaveBeenCalledWith('mc-survival', 50);
    });

    it('should return 404 for non-existent server', async () => {
      mockedContainerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/nonexistent/logs',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/servers/:name/exec', () => {
    it('should execute RCON command', async () => {
      mockedContainerExists.mockReturnValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/survival/exec',
        payload: { command: 'list' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should return 404 for non-existent server', async () => {
      mockedContainerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/nonexistent/exec',
        payload: { command: 'list' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should validate command is required', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/survival/exec',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });
});

describe('Server Routes - Response Format', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetMcContainers.mockReturnValue([]);
  });

  it('should return JSON content type', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/servers',
    });

    expect(response.headers['content-type']).toContain('application/json');
  });
});
