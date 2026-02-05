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
      // Call callback asynchronously to simulate real exec behavior
      // exec callback signature: (error, stdout, stderr)
      process.nextTick(() => {
        callback(null, 'Server created successfully', '');
      });

      // Return a mock ChildProcess
      const mockProcess = new EventEmitter();
      (mockProcess as any).kill = vi.fn();
      return mockProcess;
    }),
    {
      // Add custom promisify symbol to return { stdout, stderr }
      [promisify.custom]: vi.fn((cmd: any, opts: any) => {
        return Promise.resolve({ stdout: 'Server created successfully', stderr: '' });
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

      // Check if this is a failure scenario (invalid type, etc.)
      const isFailureCase = args.some(arg => arg.includes('INVALID_TYPE') || arg === 'failtest');

      if (isFailureCase) {
        // Simulate failed server creation
        setTimeout(() => {
          mockProcess.stderr.emit('data', Buffer.from('Error: Invalid server type\n'));
        }, 10);

        setTimeout(() => {
          mockProcess.emit('close', 1);
        }, 20);
      } else {
        // Simulate successful server creation
        setTimeout(() => {
          mockProcess.stdout.emit('data', Buffer.from('Creating server directory...\n'));
        }, 10);

        setTimeout(() => {
          mockProcess.stdout.emit('data', Buffer.from('Writing docker-compose.yml...\n'));
        }, 20);

        setTimeout(() => {
          mockProcess.stdout.emit('data', Buffer.from('Starting container...\n'));
        }, 30);

        setTimeout(() => {
          mockProcess.emit('close', 0);
        }, 50);
      }

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

// Mock fs module to control script existence checks
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true), // Assume scripts always exist
  };
});

import {
  getAllServers,
  getServerInfoFromConfig,
  getServerDetailedInfo,
  getContainerLogs,
  containerExists,
  serverExists,
} from '@minecraft-docker/shared';
import { spawn } from 'node:child_process';

const mockedGetAllServers = vi.mocked(getAllServers);
const mockedGetServerInfoFromConfig = vi.mocked(getServerInfoFromConfig);
const mockedGetServerDetailedInfo = vi.mocked(getServerDetailedInfo);
const mockedGetContainerLogs = vi.mocked(getContainerLogs);
const mockedContainerExists = vi.mocked(containerExists);
const mockedServerExists = vi.mocked(serverExists);
const mockedSpawn = vi.mocked(spawn);

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
      const mockServerNames = ['survival', 'creative'];
      mockedGetAllServers.mockReturnValue(mockServerNames);
      mockedGetServerInfoFromConfig.mockImplementation((serverName: string) => ({
        name: serverName,
        container: `mc-${serverName}`,
        status: 'running' as const,
        health: 'healthy' as const,
        hostname: `${serverName}.local`,
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
      mockedGetAllServers.mockReturnValue([]);

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
      mockedGetAllServers.mockImplementation(() => {
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
      mockedServerExists.mockReturnValue(true);
      mockedGetServerDetailedInfo.mockResolvedValue({
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
      mockedServerExists.mockReturnValue(false);

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
    mockedGetAllServers.mockReturnValue([]);
  });

  it('should return JSON content type', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/servers',
    });

    expect(response.headers['content-type']).toContain('application/json');
  });
});

describe('POST /api/servers - Server Creation', () => {
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

  describe('Standard JSON mode (follow=false)', () => {
    it.skip('should create server and return success response', async () => {
      // Skipped: Requires integration test with actual script execution
      // TODO: Refactor to use dependency injection for testability
    });

    it('should return 409 if server already exists', async () => {
      mockedServerExists.mockReturnValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        payload: {
          name: 'existing',
          type: 'PAPER',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Conflict');
    });

    it('should validate server name pattern', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        payload: {
          name: 'INVALID_NAME',
          type: 'PAPER',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    // Note: sudoPassword env tests for standard mode are covered by SSE mode tests below.
    // Both paths use the same env construction logic. The standard mode uses promisify(exec)
    // which bypasses the mock (see skipped test above), so we test via SSE spawn instead.
  });

  describe('SSE streaming mode (follow=true)', () => {
    it('should return text/event-stream content type', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers?follow=true',
        payload: {
          name: 'streamtest',
          type: 'PAPER',
        },
      });

      expect(response.headers['content-type']).toBe('text/event-stream');
    });

    it('should stream creation progress events', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers?follow=true',
        payload: {
          name: 'streamtest',
          type: 'PAPER',
        },
      });

      const events = response.body
        .split('\n\n')
        .filter(Boolean)
        .map((event: string) => {
          const dataMatch = event.match(/^data: (.+)$/m);
          return dataMatch ? JSON.parse(dataMatch[1]) : null;
        })
        .filter(Boolean);

      // Should have at least initializing, creating, configuring, starting, completed events
      const eventTypes = events.map((e: any) => e.data?.status);
      expect(eventTypes).toContain('initializing');
      expect(eventTypes[eventTypes.length - 1]).toBe('completed');
    });

    it('should return error event on script failure', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers?follow=true',
        payload: {
          name: 'failtest',
          type: 'PAPER', // Use valid type, failure is simulated by spawn mock checking for 'failtest' name
        },
      });

      const events = response.body
        .split('\n\n')
        .filter(Boolean)
        .map((event: string) => {
          const dataMatch = event.match(/^data: (.+)$/m);
          return dataMatch ? JSON.parse(dataMatch[1]) : null;
        })
        .filter(Boolean);

      const lastEvent = events[events.length - 1];
      // console.log('Events:', JSON.stringify(events, null, 2));
      expect(lastEvent?.data?.status).toBe('error');
    });

    it('should still return 409 if server exists', async () => {
      mockedServerExists.mockReturnValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers?follow=true',
        payload: {
          name: 'existing',
          type: 'PAPER',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Conflict');
    });

    it('should pass MCCTL_SUDO_PASSWORD env when sudoPassword is provided', async () => {
      mockedServerExists.mockReturnValue(false);

      await app.inject({
        method: 'POST',
        url: '/api/servers?follow=true',
        payload: {
          name: 'test-sudo-sse',
          type: 'PAPER',
          sudoPassword: 'ssepassword',
        },
      });

      expect(mockedSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            MCCTL_SUDO_PASSWORD: 'ssepassword',
          }),
        })
      );
    });

    it('should not include MCCTL_SUDO_PASSWORD env when sudoPassword is not provided', async () => {
      mockedServerExists.mockReturnValue(false);

      await app.inject({
        method: 'POST',
        url: '/api/servers?follow=true',
        payload: {
          name: 'test-nosudo-sse',
          type: 'PAPER',
        },
      });

      const lastCall = mockedSpawn.mock.calls[mockedSpawn.mock.calls.length - 1];
      const options = lastCall[2] as any;
      expect(options.env).not.toHaveProperty('MCCTL_SUDO_PASSWORD');
    });
  });
});
