import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

// Mock audit-log-service
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock child_process so no real docker compose runs
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    exec: vi.fn(),
    execFile: vi.fn(),
  };
});

import { exec, execFile } from 'child_process';

const mockedExec = vi.mocked(exec);
const mockedExecFile = vi.mocked(execFile);

/** Answer docker compose calls (exec or execFile) through their callback. */
function mockCompose(error: Error | null, stdout: string, stderr = '') {
  const reply = (...args: unknown[]) => {
    const callback = args[args.length - 1];
    if (typeof callback === 'function') {
      callback(error, stdout, stderr);
    }
    return {} as ReturnType<typeof exec>;
  };
  mockedExec.mockImplementation(reply as never);
  mockedExecFile.mockImplementation(reply as never);
}

describe('Server Action Routes', () => {
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

  describe('POST /api/servers/:name/start', () => {
    it('should start a server successfully', async () => {
      // Mock successful docker compose up
      mockCompose(null, 'Starting mc-myserver...\nmc-myserver Started', '');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/myserver/start',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.server).toBe('myserver');
      expect(body.action).toBe('start');
    });

    it('should return 400 for invalid server name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/invalid server!/start',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should return 500 when docker compose fails', async () => {
      mockCompose(new Error('Container not found'), '', 'Error: No such container');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/nonexistent/start',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });
  });

  describe('POST /api/servers/:name/stop', () => {
    it('should stop a server successfully', async () => {
      mockCompose(null, 'Stopping mc-myserver...', '');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/myserver/stop',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.server).toBe('myserver');
      expect(body.action).toBe('stop');
    });

    it('should return 500 when stop fails', async () => {
      mockCompose(new Error('Permission denied'), '', 'Error: Permission denied');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/myserver/stop',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/servers/:name/restart', () => {
    it('should restart a server successfully', async () => {
      mockCompose(null, 'Restarting mc-myserver...', '');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/myserver/restart',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.server).toBe('myserver');
      expect(body.action).toBe('restart');
    });

    it('should return 500 when restart fails', async () => {
      mockCompose(new Error('Docker daemon not running'), '', 'Cannot connect to Docker daemon');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/myserver/restart',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('Server name validation', () => {
    it('should reject names with special characters', async () => {
      const invalidNames = ['my server', 'server@test', 'server/name', 'server;cmd'];

      for (const name of invalidNames) {
        const response = await app.inject({
          method: 'POST',
          url: `/api/servers/${encodeURIComponent(name)}/start`,
        });

        expect(response.statusCode).toBe(400);
      }
    });

    it('should accept valid server names', async () => {
      mockCompose(null, 'Started', '');

      const validNames = ['myserver', 'my-server', 'server123', 'My_Server'];

      for (const name of validNames) {
        const response = await app.inject({
          method: 'POST',
          url: `/api/servers/${name}/start`,
        });

        expect(response.statusCode).toBe(200);
      }
    });
  });
});

describe('Server Action Routes - Response Format', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCompose(null, 'Success', '');
  });

  it('should return JSON content type', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/servers/myserver/start',
    });

    expect(response.headers['content-type']).toContain('application/json');
  });

  it('should include timestamp in response', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/servers/myserver/start',
    });

    const body = JSON.parse(response.body);
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
