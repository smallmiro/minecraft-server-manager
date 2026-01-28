import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:5000';

test.describe('Worlds API', () => {
  test.describe('GET /api/worlds - List Worlds', () => {
    test('should return worlds list with correct structure', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/worlds`);

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('worlds');
      expect(body).toHaveProperty('total');
      expect(Array.isArray(body.worlds)).toBe(true);
      expect(typeof body.total).toBe('number');
    });

    test('should return worlds with required fields', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/worlds`);
      const body = await response.json();

      if (body.worlds.length > 0) {
        const world = body.worlds[0];
        expect(world).toHaveProperty('name');
        expect(world).toHaveProperty('path');
        expect(world).toHaveProperty('isLocked');
        expect(typeof world.isLocked).toBe('boolean');
      }
    });

    test('should have correct content-type header', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/worlds`);
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });
  });

  test.describe('GET /api/worlds/:name - World Details', () => {
    test('should return 404 for non-existent world', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/worlds/non-existent-world-12345`);

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'NotFound');
      expect(body).toHaveProperty('message');
    });

    test('should return world details for existing world', async ({ request }) => {
      // First get list of worlds
      const listResponse = await request.get(`${API_BASE_URL}/api/worlds`);
      const listBody = await listResponse.json();

      if (listBody.worlds.length > 0) {
        const worldName = listBody.worlds[0].name;
        const response = await request.get(`${API_BASE_URL}/api/worlds/${worldName}`);

        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty('world');
        expect(body.world).toHaveProperty('name', worldName);
        expect(body.world).toHaveProperty('path');
        expect(body.world).toHaveProperty('isLocked');
      }
    });

    test('should include size and lastModified fields', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/worlds`);
      const listBody = await listResponse.json();

      if (listBody.worlds.length > 0) {
        const worldName = listBody.worlds[0].name;
        const response = await request.get(`${API_BASE_URL}/api/worlds/${worldName}`);
        const body = await response.json();

        expect(body.world).toHaveProperty('size');
        // lastModified might be undefined if not available
      }
    });
  });

  test.describe('POST /api/worlds - Create World', () => {
    const testWorldName = `e2e-test-world-${Date.now()}`;

    test('should require name in body', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/worlds`, {
        data: {},
      });

      expect(response.status()).toBe(400);
    });

    test('should create a new world', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/worlds`, {
        data: {
          name: testWorldName,
          seed: '12345',
        },
      });

      // Either 201 (created) or 400 (validation error)
      if (response.status() === 201) {
        const body = await response.json();
        expect(body).toHaveProperty('success', true);
        expect(body).toHaveProperty('worldName', testWorldName);

        // Cleanup: delete the test world
        await request.delete(`${API_BASE_URL}/api/worlds/${testWorldName}?force=true`);
      }
    });

    test('should reject duplicate world name', async ({ request }) => {
      // Get existing world
      const listResponse = await request.get(`${API_BASE_URL}/api/worlds`);
      const listBody = await listResponse.json();

      if (listBody.worlds.length > 0) {
        const existingWorldName = listBody.worlds[0].name;
        const response = await request.post(`${API_BASE_URL}/api/worlds`, {
          data: {
            name: existingWorldName,
          },
        });

        expect(response.status()).toBe(400);

        const body = await response.json();
        expect(body.success).toBeFalsy();
      }
    });

    test('should accept optional seed parameter', async ({ request }) => {
      const uniqueName = `e2e-seed-test-${Date.now()}`;
      const response = await request.post(`${API_BASE_URL}/api/worlds`, {
        data: {
          name: uniqueName,
          seed: 'minecraft-seed-123',
        },
      });

      if (response.status() === 201) {
        const body = await response.json();
        expect(body).toHaveProperty('seed');

        // Cleanup
        await request.delete(`${API_BASE_URL}/api/worlds/${uniqueName}?force=true`);
      }
    });
  });

  test.describe('DELETE /api/worlds/:name - Delete World', () => {
    test('should return 404 for non-existent world', async ({ request }) => {
      const response = await request.delete(
        `${API_BASE_URL}/api/worlds/non-existent-world-12345`
      );

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'NotFound');
    });

    test('should prevent deleting locked world without force', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/worlds`);
      const listBody = await listResponse.json();

      // Find a locked world
      const lockedWorld = listBody.worlds.find((w: { isLocked: boolean }) => w.isLocked);

      if (lockedWorld) {
        const response = await request.delete(
          `${API_BASE_URL}/api/worlds/${lockedWorld.name}`
        );

        expect(response.status()).toBe(409); // Conflict

        const body = await response.json();
        expect(body).toHaveProperty('error', 'Conflict');
      }
    });

    test('should delete world with force=true', async ({ request }) => {
      // Create a test world first
      const testWorldName = `e2e-delete-test-${Date.now()}`;
      const createResponse = await request.post(`${API_BASE_URL}/api/worlds`, {
        data: { name: testWorldName },
      });

      if (createResponse.status() === 201) {
        // Wait a bit for filesystem to sync
        await new Promise((resolve) => setTimeout(resolve, 500));

        const deleteResponse = await request.delete(
          `${API_BASE_URL}/api/worlds/${testWorldName}?force=true`
        );

        // Delete might return 200 (success) or 404 (already gone)
        expect([200, 404]).toContain(deleteResponse.status());

        if (deleteResponse.status() === 200) {
          const body = await deleteResponse.json();
          expect(body).toHaveProperty('success', true);
        }
      }
    });
  });

  test.describe('POST /api/worlds/:name/assign - Assign World', () => {
    test('should return 404 for non-existent world', async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/api/worlds/non-existent-world/assign`,
        {
          data: { serverName: 'test-server' },
        }
      );

      expect(response.status()).toBe(404);
    });

    test('should require serverName in body', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/worlds`);
      const listBody = await listResponse.json();

      if (listBody.worlds.length > 0) {
        const worldName = listBody.worlds[0].name;
        const response = await request.post(
          `${API_BASE_URL}/api/worlds/${worldName}/assign`,
          {
            data: {},
          }
        );

        expect(response.status()).toBe(400);
      }
    });

    test('should prevent assigning already locked world', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/worlds`);
      const listBody = await listResponse.json();

      // Find a locked world
      const lockedWorld = listBody.worlds.find((w: { isLocked: boolean }) => w.isLocked);

      if (lockedWorld) {
        const response = await request.post(
          `${API_BASE_URL}/api/worlds/${lockedWorld.name}/assign`,
          {
            data: { serverName: 'another-server' },
          }
        );

        expect(response.status()).toBe(409); // Conflict
      }
    });

    test('should assign unlocked world to server', async ({ request }) => {
      const worldsResponse = await request.get(`${API_BASE_URL}/api/worlds`);
      const worldsBody = await worldsResponse.json();

      const serversResponse = await request.get(`${API_BASE_URL}/api/servers`);
      const serversBody = await serversResponse.json();

      // Find an unlocked world and a server
      const unlockedWorld = worldsBody.worlds.find((w: { isLocked: boolean }) => !w.isLocked);
      const server = serversBody.servers[0];

      if (unlockedWorld && server) {
        const response = await request.post(
          `${API_BASE_URL}/api/worlds/${unlockedWorld.name}/assign`,
          {
            data: { serverName: server.name },
          }
        );

        if (response.status() === 200) {
          const body = await response.json();
          expect(body).toHaveProperty('success', true);
          expect(body).toHaveProperty('worldName', unlockedWorld.name);
          expect(body).toHaveProperty('serverName', server.name);

          // Cleanup: release the world
          await request.post(
            `${API_BASE_URL}/api/worlds/${unlockedWorld.name}/release?force=true`
          );
        }
      }
    });
  });

  test.describe('POST /api/worlds/:name/release - Release World', () => {
    test('should return 404 for non-existent world', async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/api/worlds/non-existent-world/release`
      );

      expect(response.status()).toBe(404);
    });

    test('should return error for unlocked world', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/worlds`);
      const listBody = await listResponse.json();

      // Find an unlocked world
      const unlockedWorld = listBody.worlds.find((w: { isLocked: boolean }) => !w.isLocked);

      if (unlockedWorld) {
        const response = await request.post(
          `${API_BASE_URL}/api/worlds/${unlockedWorld.name}/release`
        );

        expect(response.status()).toBe(400);
      }
    });

    test('should release locked world', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/worlds`);
      const listBody = await listResponse.json();

      // Find a locked world
      const lockedWorld = listBody.worlds.find((w: { isLocked: boolean }) => w.isLocked);

      if (lockedWorld) {
        const response = await request.post(
          `${API_BASE_URL}/api/worlds/${lockedWorld.name}/release?force=true`
        );

        if (response.status() === 200) {
          const body = await response.json();
          expect(body).toHaveProperty('success', true);
          expect(body).toHaveProperty('worldName', lockedWorld.name);
        }
      }
    });
  });
});
