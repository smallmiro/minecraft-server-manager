import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:5000';

test.describe('Servers API', () => {
  test.describe('GET /api/servers - List Servers', () => {
    test('should return servers list with correct structure', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/servers`);

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('servers');
      expect(body).toHaveProperty('total');
      expect(Array.isArray(body.servers)).toBe(true);
      expect(typeof body.total).toBe('number');
    });

    test('should return servers with required fields', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/servers`);
      const body = await response.json();

      if (body.servers.length > 0) {
        const server = body.servers[0];
        expect(server).toHaveProperty('name');
        expect(server).toHaveProperty('container');
        expect(server).toHaveProperty('status');
      }
    });

    test('should have correct content-type header', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/servers`);
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });
  });

  test.describe('GET /api/servers/:name - Server Details', () => {
    test('should return 404 for non-existent server', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/servers/non-existent-server-12345`);

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'NotFound');
      expect(body).toHaveProperty('message');
    });

    test('should return server details for existing server', async ({ request }) => {
      // First get list of servers
      const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
      const listBody = await listResponse.json();

      if (listBody.servers.length > 0) {
        const serverName = listBody.servers[0].name;
        const response = await request.get(`${API_BASE_URL}/api/servers/${serverName}`);

        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty('server');
        expect(body.server).toHaveProperty('name', serverName);
        expect(body.server).toHaveProperty('container');
        expect(body.server).toHaveProperty('status');
        expect(body.server).toHaveProperty('type');
        expect(body.server).toHaveProperty('version');
        expect(body.server).toHaveProperty('memory');
      }
    });

    test('should handle special characters in server name', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/servers/test%20server`);

      // Should either return 404 (not found) or 400 (invalid name)
      expect([400, 404]).toContain(response.status());
    });
  });

  test.describe('POST /api/servers/:name/start - Start Server', () => {
    test('should return error for non-existent server', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/servers/non-existent-server/start`);

      // Should return 400 or 500 for non-existent server
      expect([400, 404, 500]).toContain(response.status());

      const body = await response.json();
      expect(body.success).toBe(false);
    });

    test('should return correct response structure', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
      const listBody = await listResponse.json();

      if (listBody.servers.length > 0) {
        const serverName = listBody.servers[0].name;
        const response = await request.post(`${API_BASE_URL}/api/servers/${serverName}/start`);

        const body = await response.json();
        expect(body).toHaveProperty('success');
        expect(body).toHaveProperty('server');
        expect(body).toHaveProperty('action', 'start');
        expect(body).toHaveProperty('timestamp');
      }
    });

    test('should validate server name format', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/servers/invalid@name!/start`);

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid server name');
    });
  });

  test.describe('POST /api/servers/:name/stop - Stop Server', () => {
    test('should handle non-existent server gracefully', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/servers/non-existent-server/stop`);

      // Stop might return 200 (already stopped), 400, 404, or 500
      expect([200, 400, 404, 500]).toContain(response.status());

      const body = await response.json();
      expect(body).toHaveProperty('server');
      expect(body).toHaveProperty('action', 'stop');
    });

    test('should return correct response structure', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
      const listBody = await listResponse.json();

      if (listBody.servers.length > 0) {
        const serverName = listBody.servers[0].name;
        const response = await request.post(`${API_BASE_URL}/api/servers/${serverName}/stop`);

        const body = await response.json();
        expect(body).toHaveProperty('success');
        expect(body).toHaveProperty('server');
        expect(body).toHaveProperty('action', 'stop');
        expect(body).toHaveProperty('timestamp');
      }
    });
  });

  test.describe('POST /api/servers/:name/restart - Restart Server', () => {
    test('should return error for non-existent server', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/servers/non-existent-server/restart`);

      expect([400, 404, 500]).toContain(response.status());

      const body = await response.json();
      expect(body.success).toBe(false);
    });

    test('should return correct response structure', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
      const listBody = await listResponse.json();

      if (listBody.servers.length > 0) {
        const serverName = listBody.servers[0].name;
        const response = await request.post(`${API_BASE_URL}/api/servers/${serverName}/restart`);

        const body = await response.json();
        expect(body).toHaveProperty('success');
        expect(body).toHaveProperty('server');
        expect(body).toHaveProperty('action', 'restart');
        expect(body).toHaveProperty('timestamp');
      }
    });
  });

  test.describe('GET /api/servers/:name/logs - Server Logs', () => {
    test('should return 404 for non-existent server', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/servers/non-existent-server/logs`);

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'NotFound');
    });

    test('should return logs for existing running server', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
      const listBody = await listResponse.json();

      // Find a running server
      const runningServer = listBody.servers.find(
        (s: { status: string }) => s.status === 'running'
      );

      if (runningServer) {
        const response = await request.get(
          `${API_BASE_URL}/api/servers/${runningServer.name}/logs`
        );

        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty('logs');
        expect(body).toHaveProperty('lines');
        expect(typeof body.logs).toBe('string');
        expect(typeof body.lines).toBe('number');
      }
    });

    test('should respect lines query parameter', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
      const listBody = await listResponse.json();

      const runningServer = listBody.servers.find(
        (s: { status: string }) => s.status === 'running'
      );

      if (runningServer) {
        const response = await request.get(
          `${API_BASE_URL}/api/servers/${runningServer.name}/logs?lines=10`
        );

        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body.lines).toBeLessThanOrEqual(10);
      }
    });

    test('should return SSE stream with follow=true', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
      const listBody = await listResponse.json();

      const runningServer = listBody.servers.find(
        (s: { status: string }) => s.status === 'running'
      );

      if (runningServer) {
        // Note: Playwright's request API doesn't fully support SSE,
        // so we just verify the endpoint accepts the parameter
        const response = await request.get(
          `${API_BASE_URL}/api/servers/${runningServer.name}/logs?follow=true`,
          { timeout: 5000 }
        ).catch(() => null);

        // SSE endpoint should either return 200 with text/event-stream
        // or we catch the timeout (which is expected for streaming)
        if (response) {
          const contentType = response.headers()['content-type'];
          expect(contentType).toContain('text/event-stream');
        }
      }
    });
  });

  test.describe('POST /api/servers/:name/exec - Execute RCON Command', () => {
    test('should return 404 for non-existent server', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/servers/non-existent-server/exec`, {
        data: { command: 'list' },
      });

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'NotFound');
    });

    test('should require command in body', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
      const listBody = await listResponse.json();

      if (listBody.servers.length > 0) {
        const serverName = listBody.servers[0].name;
        const response = await request.post(`${API_BASE_URL}/api/servers/${serverName}/exec`, {
          data: {},
        });

        expect(response.status()).toBe(400);
      }
    });

    test('should execute command on running server', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
      const listBody = await listResponse.json();

      const runningServer = listBody.servers.find(
        (s: { status: string }) => s.status === 'running'
      );

      if (runningServer) {
        const response = await request.post(
          `${API_BASE_URL}/api/servers/${runningServer.name}/exec`,
          {
            data: { command: 'list' },
          }
        );

        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty('success', true);
        expect(body).toHaveProperty('output');
      }
    });
  });
});
