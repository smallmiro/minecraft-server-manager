import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import http from 'http';

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

import {
  serverExists,
  getContainerStatus,
  getContainerHealth,
} from '@minecraft-docker/shared';

const mockedServerExists = vi.mocked(serverExists);
const mockedGetContainerStatus = vi.mocked(getContainerStatus);
const mockedGetContainerHealth = vi.mocked(getContainerHealth);

/**
 * Helper to test SSE endpoints
 * Opens a real HTTP connection and captures data for a short duration
 */
async function testSSEEndpoint(
  app: FastifyInstance,
  url: string,
): Promise<{ headers: http.IncomingHttpHeaders; body: string; statusCode: number }> {
  await app.listen({ port: 0, host: '127.0.0.1' });
  const port = (app.server.address() as any).port;

  return new Promise((resolve, reject) => {
    let resolved = false;
    const req = http.get(`http://127.0.0.1:${port}${url}`, (res) => {
      let body = '';
      let dataTimeout: NodeJS.Timeout;

      res.on('data', (chunk) => {
        body += chunk.toString();
        // Wait a bit after receiving data to capture the full message
        clearTimeout(dataTimeout);
        dataTimeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            req.destroy();
            app.server.close();
            resolve({
              headers: res.headers,
              body,
              statusCode: res.statusCode || 0,
            });
          }
        }, 100);
      });

      res.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          app.server.close();
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      // Connection destroyed is expected after we receive data
      if ((err as any).code !== 'ECONNRESET' && !resolved) {
        resolved = true;
        app.server.close();
        reject(err);
      }
    });

    // Timeout in case no data received
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        req.destroy();
        app.server.close();
        reject(new Error('SSE test timeout'));
      }
    }, 3000);
  });
}

describe('Server Status Endpoint', () => {
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

  describe('GET /api/servers/:name/status (JSON mode)', () => {
    it('should return JSON status response for existing server', async () => {
      mockedServerExists.mockReturnValue(true);
      mockedGetContainerStatus.mockReturnValue('running');
      mockedGetContainerHealth.mockReturnValue('healthy');

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/survival/status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.serverName).toBe('survival');
      expect(body.status).toBe('running');
      expect(body.health).toBe('healthy');
      expect(body.timestamp).toBeDefined();
      // Validate ISO 8601 format
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });

    it('should return 404 for non-existent server', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/nonexistent/status',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
      expect(body.message).toContain('nonexistent');
    });

    it('should map container status to SSE-compatible status', async () => {
      mockedServerExists.mockReturnValue(true);
      mockedGetContainerStatus.mockReturnValue('not_found');
      mockedGetContainerHealth.mockReturnValue('none');

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/test/status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // not_found should be mapped to 'stopped' for frontend compatibility
      expect(body.status).toBe('stopped');
    });

    it('should map exited status correctly', async () => {
      mockedServerExists.mockReturnValue(true);
      mockedGetContainerStatus.mockReturnValue('exited');
      mockedGetContainerHealth.mockReturnValue('none');

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/test/status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('exited');
    });
  });

  describe('GET /api/servers/:name/status?follow=true (SSE mode)', () => {
    it('should establish SSE connection with correct headers', async () => {
      mockedServerExists.mockReturnValue(true);
      mockedGetContainerStatus.mockReturnValue('running');
      mockedGetContainerHealth.mockReturnValue('healthy');

      // Create a new app instance for SSE testing (to avoid port conflicts)
      const sseApp = await buildApp({ logger: false });

      try {
        const result = await testSSEEndpoint(sseApp, '/api/servers/survival/status?follow=true');

        expect(result.statusCode).toBe(200);
        expect(result.headers['content-type']).toBe('text/event-stream');
        expect(result.headers['cache-control']).toBe('no-cache');
        expect(result.headers['connection']).toBe('keep-alive');
      } finally {
        await sseApp.close();
      }
    });

    it('should send initial status event on connection', async () => {
      mockedServerExists.mockReturnValue(true);
      mockedGetContainerStatus.mockReturnValue('running');
      mockedGetContainerHealth.mockReturnValue('healthy');

      const sseApp = await buildApp({ logger: false });

      try {
        const result = await testSSEEndpoint(sseApp, '/api/servers/survival/status?follow=true');

        // Check for SSE event format
        expect(result.body).toContain('event: server-status');
        expect(result.body).toContain('"serverName":"survival"');
        expect(result.body).toContain('"status":"running"');
        expect(result.body).toContain('"health":"healthy"');
      } finally {
        await sseApp.close();
      }
    });

    it('should return 404 for non-existent server in SSE mode', async () => {
      mockedServerExists.mockReturnValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/nonexistent/status?follow=true',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should accept custom interval parameter', async () => {
      mockedServerExists.mockReturnValue(true);
      mockedGetContainerStatus.mockReturnValue('running');
      mockedGetContainerHealth.mockReturnValue('healthy');

      const sseApp = await buildApp({ logger: false });

      try {
        const result = await testSSEEndpoint(sseApp, '/api/servers/survival/status?follow=true&interval=10000');
        expect(result.statusCode).toBe(200);
      } finally {
        await sseApp.close();
      }
    });

    it('should reject interval below minimum (1000ms)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/survival/status?follow=true&interval=500',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject interval above maximum (60000ms)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/survival/status?follow=true&interval=120000',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Status Mapping', () => {
    const testCases = [
      { dockerStatus: 'running', expectedStatus: 'running' },
      { dockerStatus: 'exited', expectedStatus: 'exited' },
      { dockerStatus: 'created', expectedStatus: 'created' },
      { dockerStatus: 'paused', expectedStatus: 'stopped' },
      { dockerStatus: 'restarting', expectedStatus: 'unknown' },
      { dockerStatus: 'dead', expectedStatus: 'stopped' },
      { dockerStatus: 'not_found', expectedStatus: 'stopped' },
      { dockerStatus: 'not_created', expectedStatus: 'stopped' },
    ];

    testCases.forEach(({ dockerStatus, expectedStatus }) => {
      it(`should map Docker status '${dockerStatus}' to SSE status '${expectedStatus}'`, async () => {
        mockedServerExists.mockReturnValue(true);
        mockedGetContainerStatus.mockReturnValue(dockerStatus as any);
        mockedGetContainerHealth.mockReturnValue('none');

        const response = await app.inject({
          method: 'GET',
          url: '/api/servers/test/status',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.status).toBe(expectedStatus);
      });
    });
  });
});

describe('Server Status Endpoint - Response Format', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedServerExists.mockReturnValue(true);
    mockedGetContainerStatus.mockReturnValue('running');
    mockedGetContainerHealth.mockReturnValue('healthy');
  });

  it('should return JSON content type for non-SSE request', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/servers/survival/status',
    });

    expect(response.headers['content-type']).toContain('application/json');
  });

  it('should include CORS header for SSE', async () => {
    const sseApp = await buildApp({ logger: false });

    try {
      const result = await testSSEEndpoint(sseApp, '/api/servers/survival/status?follow=true');
      expect(result.headers['access-control-allow-origin']).toBe('*');
    } finally {
      await sseApp.close();
    }
  });
});
