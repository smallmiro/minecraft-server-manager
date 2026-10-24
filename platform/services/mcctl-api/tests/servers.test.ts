import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { fakeProvision, type ProvisionCall } from './fake-provision.js';

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

const summaryMocks = vi.hoisted(() => ({
  execute: vi.fn(),
  ctorArgs: vi.fn(),
}));

// Mock @minecraft-docker/shared module
vi.mock('@minecraft-docker/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@minecraft-docker/shared')>()),
  GetServerSummariesUseCase: class {
    constructor(...args: unknown[]) {
      summaryMocks.ctorArgs(...args);
    }
    execute(servers: unknown) {
      return summaryMocks.execute(servers);
    }
  },
  getAllServers: vi.fn(),
  getServerInfoFromConfig: vi.fn(),
  getServerDetailedInfo: vi.fn(),
  getContainerLogs: vi.fn(),
  containerExists: vi.fn(),
  serverExists: vi.fn(),
  getContainerStatus: vi.fn(),
  getContainerHealth: vi.fn(),
  stopContainer: vi.fn(),
  getServerPlayitDomain: vi.fn(),
  AuditActionEnum: {
    SERVER_CREATE: 'SERVER_CREATE',
    SERVER_DELETE: 'SERVER_DELETE',
    SERVER_START: 'SERVER_START',
    SERVER_STOP: 'SERVER_STOP',
    SERVER_RESTART: 'SERVER_RESTART',
  },
  ModSourceFactory: {
    get: vi.fn(),
    getOrNull: vi.fn(),
    isSupported: vi.fn(),
    getSupportedSources: vi.fn().mockReturnValue([]),
    getAllAdapters: vi.fn().mockReturnValue([]),
    getDefaultSource: vi.fn().mockReturnValue('modrinth'),
    register: vi.fn(),
    clear: vi.fn(),
  },
}));

// Mock @minecraft-docker/mod-source-modrinth (auto-register)
vi.mock('@minecraft-docker/mod-source-modrinth', () => ({}));

// Mock fs module to control script existence checks
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true), // Assume scripts always exist
  };
});

// Mock audit log service
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import {
  getAllServers,
  getServerInfoFromConfig,
  getServerDetailedInfo,
  getContainerLogs,
  containerExists,
  serverExists,
  getServerPlayitDomain,
} from '@minecraft-docker/shared';
import { spawn } from 'node:child_process';

const mockedGetAllServers = vi.mocked(getAllServers);
const mockedGetServerInfoFromConfig = vi.mocked(getServerInfoFromConfig);
const mockedGetServerDetailedInfo = vi.mocked(getServerDetailedInfo);
const mockedGetServerPlayitDomain = vi.mocked(getServerPlayitDomain);
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

  describe('GET /api/servers?include=summary (#764)', () => {
    const base = (name: string) => ({
      name,
      container: `mc-${name}`,
      status: 'running' as const,
      health: 'healthy' as const,
      hostname: `${name}.local`,
    });

    beforeEach(() => {
      mockedGetAllServers.mockReturnValue(['survival', 'creative']);
      mockedGetServerInfoFromConfig.mockImplementation(base);
    });

    it('keeps the default response unchanged without include', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/servers' });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Object.keys(body).sort()).toEqual(['servers', 'total']);
      for (const item of body.servers) {
        expect(Object.keys(item).sort()).toEqual(['container', 'health', 'hostname', 'name', 'status']);
      }
      expect(summaryMocks.execute).not.toHaveBeenCalled();
    });

    it('returns summaries and totals, passing the base list to the use case', async () => {
      summaryMocks.execute.mockImplementation(async (servers: ReturnType<typeof base>[]) => ({
        servers: [
          { ...servers[0], type: 'PAPER', version: '1.21.1', memory: '4G', players: { online: 2, max: 20, players: ['a', 'b'] }, stats: { memoryUsage: 100, memoryLimit: 200 } },
          { ...servers[1], status: 'exited', type: 'FORGE', players: null },
        ],
        totals: { playersOnline: 2, playersMax: 20, running: 1 },
      }));

      const response = await app.inject({ method: 'GET', url: '/api/servers?include=summary' });

      expect(response.statusCode).toBe(200);
      expect(summaryMocks.execute).toHaveBeenCalledWith([base('survival'), base('creative')]);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(2);
      expect(body.totals).toEqual({ playersOnline: 2, playersMax: 20, running: 1 });
      expect(body.servers[0]).toMatchObject({
        name: 'survival', type: 'PAPER', version: '1.21.1', memory: '4G',
        players: { online: 2, max: 20, players: ['a', 'b'] },
        stats: { memoryUsage: 100, memoryLimit: 200 },
      });
      expect(body.servers[1].players).toBeNull();
      expect(body.servers[1]).not.toHaveProperty('stats');
    });

    it('rejects an unknown include value with 400', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/servers?include=bogus' });

      expect(response.statusCode).toBe(400);
      expect(summaryMocks.execute).not.toHaveBeenCalled();
    });

    it('returns 500 with the error shape when the use case fails', async () => {
      summaryMocks.execute.mockRejectedValue(new Error('boom'));

      const response = await app.inject({ method: 'GET', url: '/api/servers?include=summary' });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: 'InternalServerError',
        message: 'Failed to list servers',
      });
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
      mockedGetServerPlayitDomain.mockReturnValue(null);

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

/** The `data` of each SSE event in a streamed response body. */
function sseEvents(body: string): Array<{ type: string; data: Record<string, any> }> {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map((event: string) => {
      const dataMatch = event.match(/^data: (.+)$/m);
      return dataMatch ? JSON.parse(dataMatch[1]!) : null;
    })
    .filter(Boolean);
}

describe('POST /api/servers - Server Creation', () => {
  let app: FastifyInstance;
  let provisions: ProvisionCall[];

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    provisions = fakeProvision();
  });

  describe('Standard JSON mode (follow=false)', () => {
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
      expect(provisions).toEqual([]);
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

    it('creates through the provisioning use case and answers 201 (#675)', async () => {
      mockedServerExists.mockReturnValue(false);
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        payload: { name: 'json-create', type: 'PAPER', version: '1.21.1', memory: '2G', autoStart: false },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        success: true,
        server: { name: 'json-create', container: 'mc-json-create', status: 'created' },
      });
      expect(provisions[0]!.config).toMatchObject({ name: 'json-create', type: 'PAPER', version: '1.21.1', memory: '2G', autoStart: false });
    });

    it('answers 201 with status created and a warning when the start fails (#675, decision 1)', async () => {
      mockedServerExists.mockReturnValue(false);
      fakeProvision(async (config) => {
        const { Server, ServerName, ServerType, McVersion, Memory, WorldOptions, ServerStartError } = await import('@minecraft-docker/shared');
        const server = Server.create({
          name: ServerName.create(config.name),
          type: ServerType.create('PAPER'),
          version: McVersion.create('1.21.1'),
          memory: Memory.default(),
          worldOptions: WorldOptions.default(),
        });
        throw new ServerStartError(server, 'port is already allocated');
      });
      const response = await app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'nostart', type: 'PAPER' } });
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.server.status).toBe('created');
      expect(body.warning).toMatch(/port is already allocated/);
    });

    it.each([
      ['invalid_spec', 400],
      ['already_exists', 409],
      ['locked', 409],
    ] as const)('maps ServerSpecError %s to %i', async (code, status) => {
      mockedServerExists.mockReturnValue(false);
      const { ServerSpecError } = await import('@minecraft-docker/shared');
      fakeProvision(async () => {
        throw new ServerSpecError(code, `spec ${code}`, 'bad');
      });
      const response = await app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'bad', type: 'PAPER' } });
      expect(response.statusCode).toBe(status);
      expect(response.json().message).toContain(`spec ${code}`);
    });

    it.each(['/api/servers', '/api/servers?follow=true'])(
      'answers %s with 400 for an input the create use case refuses, before any stream or write (#675)',
      async (url) => {
        mockedServerExists.mockReturnValue(false);
        const payload = { name: 'lowmem', type: 'PAPER', memory: '256M' }; // passes the schema pattern

        const response = await app.inject({ method: 'POST', url, payload });

        expect(response.statusCode).toBe(400);
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expect(response.json()).toEqual({ error: 'BadRequest', message: expect.stringContaining('at least 512M') });
        expect(provisions).toEqual([]);
      }
    );

    it.each(['/api/servers', '/api/servers?follow=true'])(
      'answers %s with 400 for a seed config.env cannot hold, before any stream or write (#675)',
      async (url) => {
        mockedServerExists.mockReturnValue(false);
        const response = await app.inject({ method: 'POST', url, payload: { name: 'seedy', type: 'PAPER', seed: "$x'" } });

        expect(response.statusCode).toBe(400);
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expect(response.json()).toEqual({ error: 'BadRequest', message: expect.stringContaining('env.SEED') });
        expect(provisions).toEqual([]);
      }
    );

    it('still accepts a snapshot version the provisioning writes as given', async () => {
      mockedServerExists.mockReturnValue(false);
      const response = await app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'snap', type: 'PAPER', version: '24w14a' } });
      expect(response.statusCode).toBe(201);
    });

    it('answers 400 for a value config.env cannot hold (#675)', async () => {
      mockedServerExists.mockReturnValue(false);
      const { EnvValueError } = await import('@minecraft-docker/shared/utils');
      fakeProvision(async () => {
        throw new EnvValueError('SEED', 'SEED cannot be written');
      });
      const response = await app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'seedy', type: 'PAPER' } });
      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('SEED cannot be written');
    });

    it('maps a world conflict found while provisioning to 409', async () => {
      mockedServerExists.mockReturnValue(false);
      const { WorldAssignmentError } = await import('@minecraft-docker/shared');
      fakeProvision(async () => {
        throw new WorldAssignmentError('conflict', "World 'w' is assigned to 'other'", ['other']);
      });
      const response = await app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'clash', type: 'PAPER' } });
      expect(response.statusCode).toBe(409);
    });
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

    it('streams initializing, creating, configuring, starting, completed (#658)', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers?follow=true',
        payload: {
          name: 'streamtest',
          type: 'PAPER',
        },
      });

      const statuses = sseEvents(response.body).filter((e) => e.type === 'server-create').map((e) => e.data.status);
      expect(statuses).toEqual(['initializing', 'creating', 'configuring', 'starting', 'completed']);
      expect(sseEvents(response.body).at(-1)!.data.server).toEqual({
        name: 'streamtest',
        container: 'mc-streamtest',
        status: 'starting',
      });
    });

    it('sends log lines as server-create-log and never treats their text as a failure (#658)', async () => {
      mockedServerExists.mockReturnValue(false);
      fakeProvision(async (_config, run) => {
        run.onLog?.('Warning: mDNS registration of error-test.local skipped: sudo failed');
      });
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers?follow=true',
        payload: { name: 'error-test', type: 'PAPER' },
      });
      const events = sseEvents(response.body);
      expect(events.some((e) => e.type === 'server-create-log' && e.data.log.includes('skipped'))).toBe(true);
      expect(events.at(-1)!.data.status).toBe('completed');
    });

    it('should return error event when provisioning fails', async () => {
      mockedServerExists.mockReturnValue(false);
      fakeProvision(async () => {
        throw new Error('servers/compose.yml does not parse');
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers?follow=true',
        payload: {
          name: 'failtest',
          type: 'PAPER',
        },
      });

      const lastEvent = sseEvents(response.body).at(-1);
      expect(lastEvent?.data?.status).toBe('error');
      expect(lastEvent?.data?.message).toContain('servers/compose.yml does not parse');
    });

    it('completes with status created and a warning when the start fails (#675, decision 1)', async () => {
      mockedServerExists.mockReturnValue(false);
      fakeProvision(async (config, run) => {
        run.onProgress?.('starting', 'Starting container...');
        const { Server, ServerName, ServerType, McVersion, Memory, WorldOptions, ServerStartError } = await import('@minecraft-docker/shared');
        throw new ServerStartError(
          Server.create({
            name: ServerName.create(config.name),
            type: ServerType.create('PAPER'),
            version: McVersion.create('1.21.1'),
            memory: Memory.default(),
            worldOptions: WorldOptions.default(),
          }),
          'image pull failed'
        );
      });
      const response = await app.inject({ method: 'POST', url: '/api/servers?follow=true', payload: { name: 'nostart', type: 'PAPER' } });
      const last = sseEvents(response.body).at(-1)!;
      expect(last.data.status).toBe('completed');
      expect(last.data.server.status).toBe('created');
      expect(last.data.warning).toMatch(/image pull failed/);
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

    it('hands the sudo password to the avahi adapter option, not to a child environment (#682)', async () => {
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
      await app.inject({ method: 'POST', url: '/api/servers?follow=true', payload: { name: 'test-nosudo', type: 'PAPER' } });

      expect(provisions.map((p) => p.sudoPassword)).toEqual(['ssepassword', undefined]);
      expect(mockedSpawn).not.toHaveBeenCalled();
    });
  });
});

describe('POST /api/servers - Modrinth Modpack Support', () => {
  let app: FastifyInstance;
  let provisions: ProvisionCall[];

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    provisions = fakeProvision();
  });

  describe('Schema Validation', () => {
    it.each([
      ['MODRINTH', 'adrenaline'],
      ['AUTO_CURSEFORGE', 'enigmatica6'],
    ])('should accept %s type', async (type, modpack) => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers?follow=true',
        payload: { name: 'pack-test', type, modpack },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/event-stream');
    });

    it.each(['MODRINTH', 'AUTO_CURSEFORGE'])('should return 400 if %s type without modpack', async (type) => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        payload: { name: 'nopack', type },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message.toLowerCase()).toContain('modpack');
      expect(provisions).toEqual([]);
    });

    it('should allow PAPER type without modpack', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers?follow=true',
        payload: {
          name: 'paper-test',
          type: 'PAPER',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Create options', () => {
    it('passes the modpack options to the use case', async () => {
      mockedServerExists.mockReturnValue(false);

      await app.inject({
        method: 'POST',
        url: '/api/servers?follow=true',
        payload: {
          name: 'modpack-args',
          type: 'MODRINTH',
          modpack: 'adrenaline',
          modpackVersion: '1.2.3',
          modLoader: 'fabric',
          excludeFiles: ['statuseffectbars', 'jei'],
        },
      });

      expect(provisions[0]!.config).toMatchObject({
        name: 'modpack-args',
        type: 'MODRINTH',
        modpackSlug: 'adrenaline',
        modpackVersion: '1.2.3',
        modLoader: 'fabric',
        modpackExcludeFiles: ['statuseffectbars', 'jei'],
      });
    });

    it('passes only the modpack slug when version and loader are not provided', async () => {
      mockedServerExists.mockReturnValue(false);

      await app.inject({
        method: 'POST',
        url: '/api/servers?follow=true',
        payload: { name: 'modpack-slug-only', type: 'MODRINTH', modpack: 'adrenaline' },
      });

      const config = provisions[0]!.config;
      expect(config.modpackSlug).toBe('adrenaline');
      expect(config.modpackVersion).toBeUndefined();
      expect(config.modLoader).toBeUndefined();
      expect(config.modpackExcludeFiles).toBeUndefined();
    });

    it('should reject excludeFiles entries with shell metacharacters (400)', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers?follow=true',
        payload: {
          name: 'modpack-bad-exclude',
          type: 'MODRINTH',
          modpack: 'create-plus',
          excludeFiles: ['statuseffectbars; rm -rf /'],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Audit Logging', () => {
    it('writes a success entry with the modpack', async () => {
      mockedServerExists.mockReturnValue(false);
      const { writeAuditLog } = await import('../src/services/audit-log-service.js');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers?follow=true',
        payload: { name: 'modpack-audit', type: 'MODRINTH', modpack: 'adrenaline' },
      });

      expect(sseEvents(response.body).find((e) => e.data?.status === 'completed')).toBeDefined();
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', targetName: 'modpack-audit', details: expect.objectContaining({ modpack: 'adrenaline' }) })
      );
    });
  });
});
