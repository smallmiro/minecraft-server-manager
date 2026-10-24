import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:5001';

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

  test.describe('GET /api/router/status - optional detail fields (#768)', () => {
    test('new fields are absent or well-typed', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/router/status`);
      expect(response.status()).toBe(200);
      const { router } = await response.json();

      if (router.image !== undefined) expect(typeof router.image).toBe('string');
      if (router.autoScale !== undefined) {
        expect(typeof router.autoScale.up).toBe('boolean');
        expect(typeof router.autoScale.down).toBe('boolean');
        if (router.autoScale.downAfter !== undefined) expect(typeof router.autoScale.downAfter).toBe('string');
        if (router.autoScale.asleepMotd !== undefined) expect(typeof router.autoScale.asleepMotd).toBe('string');
      }
      if (router.resolver !== undefined) {
        expect(Array.isArray(router.resolver.hostIps)).toBe(true);
        if (router.resolver.hostIp !== undefined) expect(typeof router.resolver.hostIp).toBe('string');
      }
      for (const route of router.routes ?? []) {
        for (const key of ['autoScaleUp', 'autoScaleDown', 'discoveredByRouter']) {
          if (route[key] !== undefined) expect(typeof route[key]).toBe('boolean');
        }
      }
    });
  });

  test.describe('POST /api/router/restart - Auth (#768)', () => {
    // Only meaningful when the stack enforces auth; with AUTH_MODE=disabled this
    // request would really restart mc-router, so it is opt-in.
    test('should reject unauthenticated requests with 401', async ({ request }) => {
      test.skip(process.env.E2E_API_AUTH_ENABLED !== 'true', 'API auth is disabled in this stack');
      const response = await request.post(`${API_BASE_URL}/api/router/restart`);
      expect(response.status()).toBe(401);
    });
  });
});
