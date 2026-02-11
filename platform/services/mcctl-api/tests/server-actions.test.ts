import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

// Mock audit-log-service
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock child_process module with both spawn and exec
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    exec: vi.fn(),
  };
});

import { exec } from 'child_process';

const mockedExec = vi.mocked(exec);

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
      mockedExec.mockImplementation((_cmd, _opts, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'Starting mc-myserver...\nmc-myserver Started', '');
        }
        return {} as ReturnType<typeof exec>;
      });

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
      mockedExec.mockImplementation((_cmd, _opts, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Container not found'), '', 'Error: No such container');
        }
        return {} as ReturnType<typeof exec>;
      });

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
      mockedExec.mockImplementation((_cmd, _opts, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'Stopping mc-myserver...', '');
        }
        return {} as ReturnType<typeof exec>;
      });

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
      mockedExec.mockImplementation((_cmd, _opts, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Permission denied'), '', 'Error: Permission denied');
        }
        return {} as ReturnType<typeof exec>;
      });

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
      mockedExec.mockImplementation((_cmd, _opts, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'Restarting mc-myserver...', '');
        }
        return {} as ReturnType<typeof exec>;
      });

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
      mockedExec.mockImplementation((_cmd, _opts, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Docker daemon not running'), '', 'Cannot connect to Docker daemon');
        }
        return {} as ReturnType<typeof exec>;
      });

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
      mockedExec.mockImplementation((_cmd, _opts, callback) => {
        if (typeof callback === 'function') {
          callback(null, 'Started', '');
        }
        return {} as ReturnType<typeof exec>;
      });

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
    mockedExec.mockImplementation((_cmd, _opts, callback) => {
      if (typeof callback === 'function') {
        callback(null, 'Success', '');
      }
      return {} as ReturnType<typeof exec>;
    });
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
