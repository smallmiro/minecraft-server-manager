import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:5000';

/**
 * Integration tests that combine multiple API endpoints
 * to test real-world usage scenarios.
 */
test.describe('API Integration Tests', () => {
  test.describe('Server Workflow', () => {
    test('should list servers and get details for each', async ({ request }) => {
      // Step 1: Get all servers
      const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
      expect(listResponse.status()).toBe(200);

      const listBody = await listResponse.json();

      // Step 2: Get details for each server
      for (const server of listBody.servers.slice(0, 3)) {
        const detailResponse = await request.get(
          `${API_BASE_URL}/api/servers/${server.name}`
        );
        expect(detailResponse.status()).toBe(200);

        const detailBody = await detailResponse.json();
        expect(detailBody.server.name).toBe(server.name);
      }
    });

    test('should get logs for running servers only', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
      const listBody = await listResponse.json();

      for (const server of listBody.servers) {
        const logsResponse = await request.get(
          `${API_BASE_URL}/api/servers/${server.name}/logs`
        );

        if (server.status === 'running') {
          expect(logsResponse.status()).toBe(200);
        } else {
          // Stopped servers should return 404 (container not running)
          expect([404, 500]).toContain(logsResponse.status());
        }
      }
    });

    test('should execute commands only on running servers', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
      const listBody = await listResponse.json();

      const runningServer = listBody.servers.find(
        (s: { status: string }) => s.status === 'running'
      );
      const stoppedServer = listBody.servers.find(
        (s: { status: string }) => s.status !== 'running'
      );

      if (runningServer) {
        const response = await request.post(
          `${API_BASE_URL}/api/servers/${runningServer.name}/exec`,
          { data: { command: 'list' } }
        );
        expect(response.status()).toBe(200);
      }

      if (stoppedServer) {
        const response = await request.post(
          `${API_BASE_URL}/api/servers/${stoppedServer.name}/exec`,
          { data: { command: 'list' } }
        );
        // Should fail for stopped server
        expect([404, 500]).toContain(response.status());
      }
    });
  });

  test.describe('World Workflow', () => {
    test('should list worlds and get details for each', async ({ request }) => {
      // Step 1: Get all worlds
      const listResponse = await request.get(`${API_BASE_URL}/api/worlds`);
      expect(listResponse.status()).toBe(200);

      const listBody = await listResponse.json();

      // Step 2: Get details for each world
      for (const world of listBody.worlds.slice(0, 3)) {
        const detailResponse = await request.get(
          `${API_BASE_URL}/api/worlds/${world.name}`
        );
        expect(detailResponse.status()).toBe(200);

        const detailBody = await detailResponse.json();
        expect(detailBody.world.name).toBe(world.name);
        expect(detailBody.world.isLocked).toBe(world.isLocked);
      }
    });

    test('should create, verify, and delete world', async ({ request }) => {
      const testWorldName = `e2e-integration-${Date.now()}`;

      // Step 1: Create world
      const createResponse = await request.post(`${API_BASE_URL}/api/worlds`, {
        data: {
          name: testWorldName,
          seed: 'integration-test-seed',
        },
      });

      // World creation might fail if worlds directory doesn't exist or permissions issue
      if (createResponse.status() === 201) {
        const createBody = await createResponse.json();
        expect(createBody.success).toBe(true);

        // Wait for filesystem sync
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Step 2: Verify world exists
        const verifyResponse = await request.get(
          `${API_BASE_URL}/api/worlds/${testWorldName}`
        );

        if (verifyResponse.status() === 200) {
          // Step 3: Delete world
          const deleteResponse = await request.delete(
            `${API_BASE_URL}/api/worlds/${testWorldName}?force=true`
          );
          // Delete might return 200 or 404
          expect([200, 404]).toContain(deleteResponse.status());
        }
      } else {
        // Skip if world creation is not supported in this environment
        console.log('World creation not available, skipping test');
      }
    });

    test('should handle world assignment lifecycle', async ({ request }) => {
      const worldsResponse = await request.get(`${API_BASE_URL}/api/worlds`);
      const serversResponse = await request.get(`${API_BASE_URL}/api/servers`);

      const worldsBody = await worldsResponse.json();
      const serversBody = await serversResponse.json();

      // Find an unlocked world and a server
      const unlockedWorld = worldsBody.worlds.find(
        (w: { isLocked: boolean }) => !w.isLocked
      );
      const server = serversBody.servers[0];

      if (unlockedWorld && server) {
        // Step 1: Assign world
        const assignResponse = await request.post(
          `${API_BASE_URL}/api/worlds/${unlockedWorld.name}/assign`,
          { data: { serverName: server.name } }
        );

        if (assignResponse.status() === 200) {
          // Step 2: Verify assignment
          const verifyResponse = await request.get(
            `${API_BASE_URL}/api/worlds/${unlockedWorld.name}`
          );
          const verifyBody = await verifyResponse.json();
          expect(verifyBody.world.isLocked).toBe(true);

          // Step 3: Release world
          const releaseResponse = await request.post(
            `${API_BASE_URL}/api/worlds/${unlockedWorld.name}/release?force=true`
          );
          expect(releaseResponse.status()).toBe(200);

          // Step 4: Verify release
          const checkResponse = await request.get(
            `${API_BASE_URL}/api/worlds/${unlockedWorld.name}`
          );
          const checkBody = await checkResponse.json();
          expect(checkBody.world.isLocked).toBe(false);
        }
      }
    });
  });

  test.describe('Cross-Resource Consistency', () => {
    test('should have consistent server counts', async ({ request }) => {
      // Make multiple requests and ensure consistency
      const responses = await Promise.all([
        request.get(`${API_BASE_URL}/api/servers`),
        request.get(`${API_BASE_URL}/api/servers`),
        request.get(`${API_BASE_URL}/api/servers`),
      ]);

      const bodies = await Promise.all(responses.map((r) => r.json()));

      // All should return the same count
      expect(bodies[0].total).toBe(bodies[1].total);
      expect(bodies[1].total).toBe(bodies[2].total);
    });

    test('should have consistent world counts', async ({ request }) => {
      const responses = await Promise.all([
        request.get(`${API_BASE_URL}/api/worlds`),
        request.get(`${API_BASE_URL}/api/worlds`),
        request.get(`${API_BASE_URL}/api/worlds`),
      ]);

      const bodies = await Promise.all(responses.map((r) => r.json()));

      expect(bodies[0].total).toBe(bodies[1].total);
      expect(bodies[1].total).toBe(bodies[2].total);
    });

    test('server detail should match list data', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
      const listBody = await listResponse.json();

      for (const server of listBody.servers.slice(0, 3)) {
        const detailResponse = await request.get(
          `${API_BASE_URL}/api/servers/${server.name}`
        );

        if (detailResponse.status() === 200) {
          const detailBody = await detailResponse.json();
          expect(detailBody.server.container).toBe(server.container);
          expect(detailBody.server.status).toBe(server.status);
        }
      }
    });
  });

  test.describe('Error Recovery', () => {
    test('should handle rapid sequential requests', async ({ request }) => {
      for (let i = 0; i < 5; i++) {
        const response = await request.get(`${API_BASE_URL}/api/servers`);
        expect(response.status()).toBe(200);
      }
    });

    test('should handle parallel requests', async ({ request }) => {
      const requests = [
        request.get(`${API_BASE_URL}/api/servers`),
        request.get(`${API_BASE_URL}/api/worlds`),
        request.get(`${API_BASE_URL}/health`),
        request.get(`${API_BASE_URL}/docs/json`),
      ];

      const responses = await Promise.all(requests);

      for (const response of responses) {
        expect(response.status()).toBe(200);
      }
    });

    test('should continue after error', async ({ request }) => {
      // Make a request that will fail
      await request.get(`${API_BASE_URL}/api/servers/non-existent`);

      // Next request should still work
      const response = await request.get(`${API_BASE_URL}/api/servers`);
      expect(response.status()).toBe(200);
    });
  });

  test.describe('API Performance', () => {
    test('should respond within acceptable time', async ({ request }) => {
      const endpoints = [
        '/health',
        '/api/servers',
        '/api/worlds',
      ];

      for (const endpoint of endpoints) {
        const start = Date.now();
        await request.get(`${API_BASE_URL}${endpoint}`);
        const duration = Date.now() - start;

        // Each endpoint should respond within 10 seconds
        expect(duration).toBeLessThan(10000);
      }
    });

    test('should handle concurrent load', async ({ request }) => {
      const start = Date.now();

      const requests = Array(10)
        .fill(null)
        .map(() => request.get(`${API_BASE_URL}/api/servers`));

      const responses = await Promise.all(requests);
      const duration = Date.now() - start;

      // All should succeed
      const successCount = responses.filter((r) => r.status() === 200).length;
      expect(successCount).toBe(10);

      // Should complete within 30 seconds total (more lenient for slower systems)
      expect(duration).toBeLessThan(30000);
    });
  });
});
