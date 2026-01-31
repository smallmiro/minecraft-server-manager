import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:5000';

test.describe('Players API', () => {
  // Helper to get a running server
  async function getRunningServer(request: any) {
    const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
    const listBody = await listResponse.json();
    return listBody.servers.find((s: { status: string }) => s.status === 'running');
  }

  // Helper to get any server
  async function getAnyServer(request: any) {
    const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
    const listBody = await listResponse.json();
    return listBody.servers[0];
  }

  test.describe('GET /api/servers/:name/players - Online Players', () => {
    test('should return 404 for non-existent server', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/servers/non-existent-server/players`);

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'NotFound');
    });

    test('should return 400 for non-running server', async ({ request }) => {
      const listResponse = await request.get(`${API_BASE_URL}/api/servers`);
      const listBody = await listResponse.json();
      const stoppedServer = listBody.servers.find((s: { status: string }) => s.status !== 'running');

      if (stoppedServer) {
        const response = await request.get(`${API_BASE_URL}/api/servers/${stoppedServer.name}/players`);

        expect(response.status()).toBe(400);

        const body = await response.json();
        expect(body).toHaveProperty('error', 'BadRequest');
      }
    });

    test('should return player list for running server', async ({ request }) => {
      const runningServer = await getRunningServer(request);

      if (runningServer) {
        const response = await request.get(`${API_BASE_URL}/api/servers/${runningServer.name}/players`);

        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty('online');
        expect(body).toHaveProperty('max');
        expect(body).toHaveProperty('players');
        expect(typeof body.online).toBe('number');
        expect(typeof body.max).toBe('number');
        expect(Array.isArray(body.players)).toBe(true);
      }
    });
  });

  test.describe('GET /api/players/:username - Player Info', () => {
    test('should return 404 for non-existent player', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/players/this_player_does_not_exist_12345`);

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'NotFound');
    });

    test('should return player info for valid username', async ({ request }) => {
      // Use a well-known player username for testing
      const response = await request.get(`${API_BASE_URL}/api/players/Notch`);

      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('username');
        expect(body).toHaveProperty('uuid');
        expect(body).toHaveProperty('skinUrl');
        expect(body.username.toLowerCase()).toBe('notch');
        expect(body.uuid).toMatch(/^[0-9a-f-]{36}$/i);
      }
    });
  });

  test.describe('GET /api/servers/:name/whitelist - Whitelist', () => {
    test('should return 404 for non-existent server', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/servers/non-existent-server/whitelist`);

      expect(response.status()).toBe(404);
    });

    test('should return whitelist for running server', async ({ request }) => {
      const runningServer = await getRunningServer(request);

      if (runningServer) {
        const response = await request.get(`${API_BASE_URL}/api/servers/${runningServer.name}/whitelist`);

        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty('players');
        expect(body).toHaveProperty('total');
        expect(Array.isArray(body.players)).toBe(true);
        expect(typeof body.total).toBe('number');
      }
    });
  });

  test.describe('POST /api/servers/:name/whitelist - Add to Whitelist', () => {
    test('should return 404 for non-existent server', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/servers/non-existent-server/whitelist`, {
        data: { player: 'testplayer' },
      });

      expect(response.status()).toBe(404);
    });

    test('should require player in body', async ({ request }) => {
      const runningServer = await getRunningServer(request);

      if (runningServer) {
        const response = await request.post(`${API_BASE_URL}/api/servers/${runningServer.name}/whitelist`, {
          data: {},
        });

        expect(response.status()).toBe(400);
      }
    });
  });

  test.describe('DELETE /api/servers/:name/whitelist/:player - Remove from Whitelist', () => {
    test('should return 404 for non-existent server', async ({ request }) => {
      const response = await request.delete(`${API_BASE_URL}/api/servers/non-existent-server/whitelist/testplayer`);

      expect(response.status()).toBe(404);
    });
  });

  test.describe('GET /api/servers/:name/bans - Ban List', () => {
    test('should return 404 for non-existent server', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/servers/non-existent-server/bans`);

      expect(response.status()).toBe(404);
    });

    test('should return ban list for running server', async ({ request }) => {
      const runningServer = await getRunningServer(request);

      if (runningServer) {
        const response = await request.get(`${API_BASE_URL}/api/servers/${runningServer.name}/bans`);

        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty('players');
        expect(body).toHaveProperty('total');
        expect(Array.isArray(body.players)).toBe(true);
      }
    });
  });

  test.describe('POST /api/servers/:name/bans - Ban Player', () => {
    test('should return 404 for non-existent server', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/servers/non-existent-server/bans`, {
        data: { player: 'testplayer' },
      });

      expect(response.status()).toBe(404);
    });

    test('should require player in body', async ({ request }) => {
      const runningServer = await getRunningServer(request);

      if (runningServer) {
        const response = await request.post(`${API_BASE_URL}/api/servers/${runningServer.name}/bans`, {
          data: {},
        });

        expect(response.status()).toBe(400);
      }
    });
  });

  test.describe('DELETE /api/servers/:name/bans/:player - Unban Player', () => {
    test('should return 404 for non-existent server', async ({ request }) => {
      const response = await request.delete(`${API_BASE_URL}/api/servers/non-existent-server/bans/testplayer`);

      expect(response.status()).toBe(404);
    });
  });

  test.describe('POST /api/servers/:name/kick - Kick Player', () => {
    test('should return 404 for non-existent server', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/servers/non-existent-server/kick`, {
        data: { player: 'testplayer' },
      });

      expect(response.status()).toBe(404);
    });

    test('should require player in body', async ({ request }) => {
      const runningServer = await getRunningServer(request);

      if (runningServer) {
        const response = await request.post(`${API_BASE_URL}/api/servers/${runningServer.name}/kick`, {
          data: {},
        });

        expect(response.status()).toBe(400);
      }
    });
  });

  test.describe('GET /api/servers/:name/ops - Operators List', () => {
    test('should return 404 for non-existent server', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/servers/non-existent-server/ops`);

      expect(response.status()).toBe(404);
    });

    test('should return ops list for running server', async ({ request }) => {
      const runningServer = await getRunningServer(request);

      if (runningServer) {
        const response = await request.get(`${API_BASE_URL}/api/servers/${runningServer.name}/ops`);

        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty('players');
        expect(body).toHaveProperty('total');
        expect(Array.isArray(body.players)).toBe(true);
      }
    });
  });

  test.describe('POST /api/servers/:name/ops - Add Operator', () => {
    test('should return 404 for non-existent server', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/servers/non-existent-server/ops`, {
        data: { player: 'testplayer' },
      });

      expect(response.status()).toBe(404);
    });

    test('should require player in body', async ({ request }) => {
      const runningServer = await getRunningServer(request);

      if (runningServer) {
        const response = await request.post(`${API_BASE_URL}/api/servers/${runningServer.name}/ops`, {
          data: {},
        });

        expect(response.status()).toBe(400);
      }
    });
  });

  test.describe('DELETE /api/servers/:name/ops/:player - Remove Operator', () => {
    test('should return 404 for non-existent server', async ({ request }) => {
      const response = await request.delete(`${API_BASE_URL}/api/servers/non-existent-server/ops/testplayer`);

      expect(response.status()).toBe(404);
    });
  });
});
