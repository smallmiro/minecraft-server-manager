import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:5000';

test.describe('Router API', () => {
  test.describe('GET /api/router/status - Router Status', () => {
    test('should return router status with correct structure', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/router/status`);

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('router');
      expect(body.router).toHaveProperty('name');
      expect(body.router).toHaveProperty('status');
      expect(body.router).toHaveProperty('health');
    });

    test('should return router with expected fields', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/router/status`);
      const body = await response.json();

      expect(body.router).toHaveProperty('name', 'mc-router');
      expect(['running', 'stopped', 'not_found']).toContain(body.router.status);
      expect(['healthy', 'unhealthy', 'unknown']).toContain(body.router.health);
    });

    test('should include port and uptime when running', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/router/status`);
      const body = await response.json();

      if (body.router.status === 'running') {
        expect(body.router).toHaveProperty('port');
        expect(body.router).toHaveProperty('uptime');
        expect(typeof body.router.port).toBe('number');
        expect(typeof body.router.uptime).toBe('string');
      }
    });

    test('should include routes array when running', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/router/status`);
      const body = await response.json();

      if (body.router.status === 'running') {
        expect(body.router).toHaveProperty('routes');
        expect(Array.isArray(body.router.routes)).toBe(true);
      }
    });

    test('should have correct content-type header', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/router/status`);
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });
  });
});
