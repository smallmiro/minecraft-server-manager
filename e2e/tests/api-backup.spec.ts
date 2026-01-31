import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:5000';

test.describe('Backup API', () => {
  test.describe('GET /api/backup/status - Backup Status', () => {
    test('should return backup status with correct structure', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/backup/status`);

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('configured');
      expect(typeof body.configured).toBe('boolean');
    });

    test('should include repository info when configured', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/backup/status`);
      const body = await response.json();

      if (body.configured) {
        expect(body).toHaveProperty('repository');
        expect(body).toHaveProperty('branch');
        expect(typeof body.repository).toBe('string');
        expect(typeof body.branch).toBe('string');
      }
    });

    test('should include lastBackup when available', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/backup/status`);
      const body = await response.json();

      if (body.configured && body.lastBackup) {
        expect(typeof body.lastBackup).toBe('string');
        // lastBackup should be ISO date format
        expect(new Date(body.lastBackup).toISOString()).toBe(body.lastBackup);
      }
    });

    test('should have correct content-type header', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/backup/status`);
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });
  });

  test.describe('POST /api/backup/push - Push Backup', () => {
    test('should return 400 when backup not configured', async ({ request }) => {
      // First check if backup is configured
      const statusResponse = await request.get(`${API_BASE_URL}/api/backup/status`);
      const statusBody = await statusResponse.json();

      if (!statusBody.configured) {
        const response = await request.post(`${API_BASE_URL}/api/backup/push`, {
          data: {},
        });

        expect(response.status()).toBe(400);

        const body = await response.json();
        expect(body).toHaveProperty('error', 'BadRequest');
        expect(body.message).toContain('not configured');
      }
    });

    test('should accept optional message parameter', async ({ request }) => {
      const statusResponse = await request.get(`${API_BASE_URL}/api/backup/status`);
      const statusBody = await statusResponse.json();

      if (statusBody.configured) {
        const response = await request.post(`${API_BASE_URL}/api/backup/push`, {
          data: { message: 'Test backup from e2e' },
        });

        // Should return 200 or handle "nothing to commit" gracefully
        expect([200, 400, 500]).toContain(response.status());

        const body = await response.json();
        if (response.status() === 200) {
          expect(body).toHaveProperty('success', true);
          expect(body).toHaveProperty('message');
        }
      }
    });

    test('should return response with correct structure on success', async ({ request }) => {
      const statusResponse = await request.get(`${API_BASE_URL}/api/backup/status`);
      const statusBody = await statusResponse.json();

      if (statusBody.configured) {
        const response = await request.post(`${API_BASE_URL}/api/backup/push`, {
          data: {},
        });

        if (response.status() === 200) {
          const body = await response.json();
          expect(body).toHaveProperty('success');
          expect(body).toHaveProperty('message');
          // commitHash is optional
          if (body.commitHash) {
            expect(typeof body.commitHash).toBe('string');
          }
        }
      }
    });
  });

  test.describe('GET /api/backup/history - Backup History', () => {
    test('should return 400 when backup not configured', async ({ request }) => {
      const statusResponse = await request.get(`${API_BASE_URL}/api/backup/status`);
      const statusBody = await statusResponse.json();

      if (!statusBody.configured) {
        const response = await request.get(`${API_BASE_URL}/api/backup/history`);

        expect(response.status()).toBe(400);

        const body = await response.json();
        expect(body).toHaveProperty('error', 'BadRequest');
      }
    });

    test('should return history with correct structure', async ({ request }) => {
      const statusResponse = await request.get(`${API_BASE_URL}/api/backup/status`);
      const statusBody = await statusResponse.json();

      if (statusBody.configured) {
        const response = await request.get(`${API_BASE_URL}/api/backup/history`);

        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty('commits');
        expect(body).toHaveProperty('total');
        expect(Array.isArray(body.commits)).toBe(true);
        expect(typeof body.total).toBe('number');
      }
    });

    test('should return commits with required fields', async ({ request }) => {
      const statusResponse = await request.get(`${API_BASE_URL}/api/backup/status`);
      const statusBody = await statusResponse.json();

      if (statusBody.configured) {
        const response = await request.get(`${API_BASE_URL}/api/backup/history`);
        const body = await response.json();

        if (body.commits.length > 0) {
          const commit = body.commits[0];
          expect(commit).toHaveProperty('hash');
          expect(commit).toHaveProperty('message');
          expect(commit).toHaveProperty('date');
          expect(typeof commit.hash).toBe('string');
          expect(typeof commit.message).toBe('string');
          expect(typeof commit.date).toBe('string');
        }
      }
    });
  });

  test.describe('POST /api/backup/restore - Restore Backup', () => {
    test('should return 400 when backup not configured', async ({ request }) => {
      const statusResponse = await request.get(`${API_BASE_URL}/api/backup/status`);
      const statusBody = await statusResponse.json();

      if (!statusBody.configured) {
        const response = await request.post(`${API_BASE_URL}/api/backup/restore`, {
          data: { commitHash: 'abc1234' },
        });

        expect(response.status()).toBe(400);

        const body = await response.json();
        expect(body).toHaveProperty('error', 'BadRequest');
      }
    });

    test('should require commitHash in body', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/backup/restore`, {
        data: {},
      });

      expect(response.status()).toBe(400);
    });

    test('should validate commitHash minimum length', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/backup/restore`, {
        data: { commitHash: 'abc' },
      });

      expect(response.status()).toBe(400);
    });

    test('should return correct structure on restore attempt', async ({ request }) => {
      const statusResponse = await request.get(`${API_BASE_URL}/api/backup/status`);
      const statusBody = await statusResponse.json();

      if (statusBody.configured) {
        // Get a valid commit hash from history
        const historyResponse = await request.get(`${API_BASE_URL}/api/backup/history`);
        const historyBody = await historyResponse.json();

        if (historyBody.commits.length > 0) {
          const commitHash = historyBody.commits[0].hash;
          const response = await request.post(`${API_BASE_URL}/api/backup/restore`, {
            data: { commitHash },
          });

          // Restore might succeed or fail depending on state
          expect([200, 400, 500]).toContain(response.status());

          const body = await response.json();
          if (response.status() === 200) {
            expect(body).toHaveProperty('success', true);
            expect(body).toHaveProperty('message');
          }
        }
      }
    });
  });
});
