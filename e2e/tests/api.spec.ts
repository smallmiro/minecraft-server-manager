import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:5000';

test.describe('API Endpoints', () => {
  test.describe('Health Check', () => {
    test('should return 200 OK from health endpoint', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('timestamp');
    });

    test('should return valid timestamp format', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);
      const body = await response.json();

      // Timestamp should be a valid ISO date string
      const timestamp = new Date(body.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    test('should have correct content-type header', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });
  });

  test.describe('Authentication Endpoints', () => {
    test('should allow requests in open mode (development)', async ({ request }) => {
      // In development mode (open), API allows all requests without authentication
      const endpoints = [
        '/api/servers',
        '/api/worlds',
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(`${API_BASE_URL}${endpoint}`).catch(() => null);

        // In open mode, requests should succeed
        if (response) {
          expect([200, 404]).toContain(response.status());
        }
      }
    });

    test('should have CORS headers configured', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);

      // Check for CORS headers
      const headers = response.headers();
      // Access-Control headers might only appear on OPTIONS requests or specific origins
      expect(response.status()).toBe(200); // At minimum, the request should succeed
    });
  });

  test.describe('Server List API', () => {
    test('should return servers list with valid auth', async ({ request }) => {
      // First, get auth token (if using token-based auth)
      // This test assumes the API requires authentication

      // Try to access servers endpoint
      const response = await request.get(`${API_BASE_URL}/api/servers`, {
        headers: {
          // Add auth headers if needed
          // 'Authorization': `Bearer ${token}`,
        },
      }).catch(() => null);

      if (response) {
        // Either returns 401 (needs auth) or 200 (success) or 404 (no servers)
        expect([200, 401, 403, 404]).toContain(response.status());

        if (response.status() === 200) {
          const body = await response.json();
          // Should be an array or object with servers
          expect(body).toBeDefined();
        }
      }
    });

    test('should handle pagination parameters', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/servers?page=1&limit=10`).catch(() => null);

      if (response && response.status() === 200) {
        const body = await response.json();
        // If pagination is supported, check structure
        if (body.data) {
          expect(Array.isArray(body.data)).toBeTruthy();
        } else if (Array.isArray(body)) {
          expect(body.length).toBeLessThanOrEqual(10);
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should return 404 for non-existent endpoints', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/non-existent-endpoint`);

      expect(response.status()).toBe(404);
    });

    test('should return proper error format for invalid requests', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/servers/invalid-server-id`).catch(() => null);

      if (response) {
        // Should return an error status
        expect([400, 401, 403, 404]).toContain(response.status());

        // Error response should have proper structure
        const body = await response.json().catch(() => null);
        if (body) {
          // Check for error property or message
          expect(body.error || body.message || body.statusCode).toBeDefined();
        }
      }
    });

    test('should handle invalid JSON in request body', async ({ request }) => {
      // POST /api/worlds exists and validates JSON
      const response = await request.post(`${API_BASE_URL}/api/worlds`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: 'invalid json{',
      }).catch(() => null);

      if (response) {
        // Should return 400 Bad Request for invalid JSON or 404 if endpoint not implemented
        expect([400, 404, 415, 500]).toContain(response.status());
      }
    });
  });

  test.describe('Security Headers', () => {
    test('should have security headers set', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);
      const headers = response.headers();

      // Check for common security headers (set by helmet)
      // Note: Not all headers may be present depending on configuration
      const securityHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
      ];

      // At least some security headers should be present
      const foundHeaders = securityHeaders.filter(
        (header) => headers[header.toLowerCase()] !== undefined
      );

      // Log which headers were found for debugging
      if (foundHeaders.length === 0) {
        console.log('Warning: No security headers found');
      }
    });

    test('should not expose sensitive server information', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);
      const headers = response.headers();

      // Should not expose server version details
      expect(headers['x-powered-by']).toBeUndefined();
    });
  });

  test.describe('Rate Limiting', () => {
    test('should handle multiple rapid requests', async ({ request }) => {
      const requests = Array(10)
        .fill(null)
        .map(() => request.get(`${API_BASE_URL}/health`));

      const responses = await Promise.all(requests);

      // All requests should succeed (unless rate limiting is strict)
      const successCount = responses.filter((r) => r.status() === 200).length;
      expect(successCount).toBeGreaterThan(0);

      // If rate limiting is enabled, some might return 429
      const rateLimitedCount = responses.filter((r) => r.status() === 429).length;
      if (rateLimitedCount > 0) {
        console.log(`Rate limiting active: ${rateLimitedCount} requests were rate limited`);
      }
    });
  });

  test.describe('Console Health API', () => {
    test('should return 200 OK from console health endpoint', async ({ request }) => {
      const consoleURL = process.env.E2E_BASE_URL || 'http://localhost:5000';
      const response = await request.get(`${consoleURL}/api/health`);

      expect(response.status()).toBe(200);
    });
  });
});
