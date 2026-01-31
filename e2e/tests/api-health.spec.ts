import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:5000';

test.describe('Health & System API', () => {
  test.describe('GET /health - Health Check', () => {
    test('should return 200 OK', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);

      expect(response.status()).toBe(200);
    });

    test('should return status ok', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);
      const body = await response.json();

      expect(body).toHaveProperty('status', 'ok');
    });

    test('should include timestamp', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);
      const body = await response.json();

      expect(body).toHaveProperty('timestamp');
      // Timestamp should be a valid ISO date string
      const timestamp = new Date(body.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    test('should have correct content-type header', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });

    test('should respond quickly (under 1 second)', async ({ request }) => {
      const start = Date.now();
      await request.get(`${API_BASE_URL}/health`);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });

  test.describe('API Documentation', () => {
    test('should serve Swagger UI at /docs', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/docs`);

      // Swagger UI redirects or serves HTML
      expect([200, 302]).toContain(response.status());
    });

    test('should serve OpenAPI spec at /docs/json', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/docs/json`);

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('openapi');
      expect(body).toHaveProperty('info');
      expect(body).toHaveProperty('paths');
    });

    test('should have correct OpenAPI version', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/docs/json`);
      const body = await response.json();

      expect(body.openapi).toMatch(/^3\./);
    });

    test('should include API info', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/docs/json`);
      const body = await response.json();

      expect(body.info).toHaveProperty('title');
      expect(body.info).toHaveProperty('version');
    });
  });

  test.describe('Error Handling', () => {
    test('should return 404 for non-existent endpoints', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/non-existent-endpoint`);

      expect(response.status()).toBe(404);
    });

    test('should return proper error format', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/non-existent-endpoint`);
      const body = await response.json();

      // Should have some error indication
      expect(body.error || body.message || body.statusCode).toBeDefined();
    });

    test('should handle invalid JSON in request body', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/worlds`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: 'invalid json{',
      }).catch(() => null);

      if (response) {
        expect([400, 415]).toContain(response.status());
      }
    });

    test('should handle method not allowed', async ({ request }) => {
      // PUT on /health which only supports GET
      const response = await request.put(`${API_BASE_URL}/health`, {
        data: {},
      });

      expect([404, 405]).toContain(response.status());
    });
  });

  test.describe('CORS', () => {
    test('should allow CORS requests', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`, {
        headers: {
          Origin: 'http://localhost:5000',
        },
      });

      expect(response.status()).toBe(200);

      const corsHeader = response.headers()['access-control-allow-origin'];
      expect(corsHeader).toBeDefined();
    });

    test('should handle OPTIONS preflight request', async ({ request }) => {
      const response = await request.fetch(`${API_BASE_URL}/api/servers`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      });

      // Should return 200 or 204 for OPTIONS
      expect([200, 204]).toContain(response.status());
    });
  });

  test.describe('Security', () => {
    test('should not expose server version in X-Powered-By', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);
      const headers = response.headers();

      expect(headers['x-powered-by']).toBeUndefined();
    });

    test('should handle multiple rapid requests', async ({ request }) => {
      const requests = Array(10)
        .fill(null)
        .map(() => request.get(`${API_BASE_URL}/health`));

      const responses = await Promise.all(requests);

      // All requests should succeed
      const successCount = responses.filter((r) => r.status() === 200).length;
      expect(successCount).toBe(10);
    });
  });
});
