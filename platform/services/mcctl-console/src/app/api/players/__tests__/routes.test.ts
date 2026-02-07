import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks (vi.mock factories are hoisted - no external variable references) ---

const mockHeaders = new Headers({ cookie: 'session=test' });

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ cookie: 'session=test' })),
}));

vi.mock('@/lib/auth-utils', () => {
  class AuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 401) {
      super(message);
      this.name = 'AuthError';
      this.statusCode = statusCode;
    }
  }
  return {
    requireAuth: vi.fn(),
    requireAdmin: vi.fn(),
    requireServerPermission: vi.fn(),
    AuthError,
  };
});

const mockExecCommand = vi.fn();
const mockGetServers = vi.fn();
const mockGetServer = vi.fn();

vi.mock('@/adapters/McctlApiAdapter', () => {
  class McctlApiError extends Error {
    statusCode: number;
    error: string;
    constructor(statusCode: number, error: string, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.error = error;
    }
  }
  return {
    createMcctlApiClient: vi.fn(() => ({
      execCommand: mockExecCommand,
      getServers: mockGetServers,
      getServer: mockGetServer,
    })),
    McctlApiError,
    UserContext: undefined,
  };
});

import { requireAuth, requireServerPermission, AuthError } from '@/lib/auth-utils';

const mockRequireAuth = vi.mocked(requireAuth);
const mockRequireServerPermission = vi.mocked(requireServerPermission);

// --- Fixtures ---

const mockSession = {
  user: {
    id: 'user-1',
    name: 'TestUser',
    email: 'test@example.com',
    role: 'user',
  },
  session: { id: 'session-1', token: 'test-token' },
};

// --- Helpers ---

function makeGetRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

function makePostRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeDeleteRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'DELETE' });
}

// --- Tests ---

describe('Players BFF Routes - Permission Wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockSession as never);
    mockRequireServerPermission.mockResolvedValue(mockSession as never);
    mockExecCommand.mockResolvedValue({ output: 'Success' });
    mockGetServers.mockResolvedValue({ servers: [] });
    mockGetServer.mockResolvedValue({ server: { players: { list: [] } } });
  });

  // ===== /api/players (GET) =====
  describe('GET /api/players', () => {
    it('should call requireAuth', async () => {
      const { GET } = await import('../route');
      const req = makeGetRequest('http://localhost:5000/api/players');

      await GET(req);

      expect(mockRequireAuth).toHaveBeenCalledWith(mockHeaders);
    });

    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockRejectedValue(new AuthError('Unauthorized', 401));
      const { GET } = await import('../route');
      const req = makeGetRequest('http://localhost:5000/api/players');

      const res = await GET(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should return servers with players on success', async () => {
      mockGetServers.mockResolvedValue({
        servers: [{ name: 'sv1', status: 'running', health: 'healthy' }],
      });
      mockGetServer.mockResolvedValue({
        server: { players: { list: ['Steve'] } },
      });
      const { GET } = await import('../route');
      const req = makeGetRequest('http://localhost:5000/api/players');

      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.servers).toHaveLength(1);
      expect(body.servers[0].players[0].name).toBe('Steve');
    });
  });

  // ===== /api/players/whitelist =====
  describe('Whitelist routes', () => {
    describe('GET /api/players/whitelist', () => {
      it('should call requireServerPermission with view level', async () => {
        const { GET } = await import('../whitelist/route');
        const req = makeGetRequest('http://localhost:5000/api/players/whitelist?server=sv1');

        await GET(req);

        expect(mockRequireServerPermission).toHaveBeenCalledWith(mockHeaders, 'sv1', 'view');
      });

      it('should return 400 when server param missing', async () => {
        const { GET } = await import('../whitelist/route');
        const req = makeGetRequest('http://localhost:5000/api/players/whitelist');

        const res = await GET(req);

        expect(res.status).toBe(400);
      });

      it('should return 403 when permission denied', async () => {
        mockRequireServerPermission.mockRejectedValue(new AuthError('Forbidden', 403));
        const { GET } = await import('../whitelist/route');
        const req = makeGetRequest('http://localhost:5000/api/players/whitelist?server=sv1');

        const res = await GET(req);

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe('Forbidden');
      });

      it('should proxy to mcctl-api on success', async () => {
        mockExecCommand.mockResolvedValue({ output: 'There are 2 whitelisted players: Alice, Bob' });
        const { GET } = await import('../whitelist/route');
        const req = makeGetRequest('http://localhost:5000/api/players/whitelist?server=sv1');

        const res = await GET(req);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.players).toHaveLength(2);
        expect(mockExecCommand).toHaveBeenCalledWith('sv1', 'whitelist list');
      });
    });

    describe('POST /api/players/whitelist', () => {
      it('should call requireServerPermission with manage level', async () => {
        const { POST } = await import('../whitelist/route');
        const req = makePostRequest('http://localhost:5000/api/players/whitelist', {
          player: 'Steve',
          server: 'sv1',
        });

        await POST(req);

        expect(mockRequireServerPermission).toHaveBeenCalledWith(mockHeaders, 'sv1', 'manage');
      });

      it('should return 400 when player or server missing', async () => {
        const { POST } = await import('../whitelist/route');
        const req = makePostRequest('http://localhost:5000/api/players/whitelist', {
          player: 'Steve',
        });

        const res = await POST(req);

        expect(res.status).toBe(400);
      });

      it('should return 403 when permission denied', async () => {
        mockRequireServerPermission.mockRejectedValue(new AuthError('Forbidden', 403));
        const { POST } = await import('../whitelist/route');
        const req = makePostRequest('http://localhost:5000/api/players/whitelist', {
          player: 'Steve',
          server: 'sv1',
        });

        const res = await POST(req);

        expect(res.status).toBe(403);
      });

      it('should proxy to mcctl-api on success', async () => {
        const { POST } = await import('../whitelist/route');
        const req = makePostRequest('http://localhost:5000/api/players/whitelist', {
          player: 'Steve',
          server: 'sv1',
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(mockExecCommand).toHaveBeenCalledWith('sv1', 'whitelist add Steve');
      });
    });

    describe('DELETE /api/players/whitelist', () => {
      it('should call requireServerPermission with manage level', async () => {
        const { DELETE } = await import('../whitelist/route');
        const req = makeDeleteRequest(
          'http://localhost:5000/api/players/whitelist?player=Steve&server=sv1'
        );

        await DELETE(req);

        expect(mockRequireServerPermission).toHaveBeenCalledWith(mockHeaders, 'sv1', 'manage');
      });

      it('should return 400 when player or server missing', async () => {
        const { DELETE } = await import('../whitelist/route');
        const req = makeDeleteRequest('http://localhost:5000/api/players/whitelist?server=sv1');

        const res = await DELETE(req);

        expect(res.status).toBe(400);
      });

      it('should return 403 when permission denied', async () => {
        mockRequireServerPermission.mockRejectedValue(new AuthError('Forbidden', 403));
        const { DELETE } = await import('../whitelist/route');
        const req = makeDeleteRequest(
          'http://localhost:5000/api/players/whitelist?player=Steve&server=sv1'
        );

        const res = await DELETE(req);

        expect(res.status).toBe(403);
      });

      it('should proxy to mcctl-api on success', async () => {
        const { DELETE } = await import('../whitelist/route');
        const req = makeDeleteRequest(
          'http://localhost:5000/api/players/whitelist?player=Steve&server=sv1'
        );

        const res = await DELETE(req);

        expect(res.status).toBe(200);
        expect(mockExecCommand).toHaveBeenCalledWith('sv1', 'whitelist remove Steve');
      });
    });
  });

  // ===== /api/players/ban =====
  describe('Ban routes', () => {
    describe('GET /api/players/ban', () => {
      it('should call requireServerPermission with view level', async () => {
        const { GET } = await import('../ban/route');
        const req = makeGetRequest('http://localhost:5000/api/players/ban?server=sv1');

        await GET(req);

        expect(mockRequireServerPermission).toHaveBeenCalledWith(mockHeaders, 'sv1', 'view');
      });

      it('should return 403 when permission denied', async () => {
        mockRequireServerPermission.mockRejectedValue(new AuthError('Forbidden', 403));
        const { GET } = await import('../ban/route');
        const req = makeGetRequest('http://localhost:5000/api/players/ban?server=sv1');

        const res = await GET(req);

        expect(res.status).toBe(403);
      });

      it('should proxy to mcctl-api on success', async () => {
        mockExecCommand.mockResolvedValue({ output: 'There are 1 banned players: Griefer' });
        const { GET } = await import('../ban/route');
        const req = makeGetRequest('http://localhost:5000/api/players/ban?server=sv1');

        const res = await GET(req);

        expect(res.status).toBe(200);
        expect(mockExecCommand).toHaveBeenCalledWith('sv1', 'banlist players');
      });
    });

    describe('POST /api/players/ban', () => {
      it('should call requireServerPermission with manage level', async () => {
        const { POST } = await import('../ban/route');
        const req = makePostRequest('http://localhost:5000/api/players/ban', {
          player: 'Griefer',
          server: 'sv1',
        });

        await POST(req);

        expect(mockRequireServerPermission).toHaveBeenCalledWith(mockHeaders, 'sv1', 'manage');
      });

      it('should return 403 when permission denied', async () => {
        mockRequireServerPermission.mockRejectedValue(new AuthError('Forbidden', 403));
        const { POST } = await import('../ban/route');
        const req = makePostRequest('http://localhost:5000/api/players/ban', {
          player: 'Griefer',
          server: 'sv1',
        });

        const res = await POST(req);

        expect(res.status).toBe(403);
      });

      it('should proxy to mcctl-api on success', async () => {
        const { POST } = await import('../ban/route');
        const req = makePostRequest('http://localhost:5000/api/players/ban', {
          player: 'Griefer',
          server: 'sv1',
          reason: 'griefing',
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(mockExecCommand).toHaveBeenCalledWith('sv1', 'ban Griefer griefing');
      });
    });

    describe('DELETE /api/players/ban', () => {
      it('should call requireServerPermission with manage level', async () => {
        const { DELETE } = await import('../ban/route');
        const req = makeDeleteRequest(
          'http://localhost:5000/api/players/ban?player=Griefer&server=sv1'
        );

        await DELETE(req);

        expect(mockRequireServerPermission).toHaveBeenCalledWith(mockHeaders, 'sv1', 'manage');
      });

      it('should return 403 when permission denied', async () => {
        mockRequireServerPermission.mockRejectedValue(new AuthError('Forbidden', 403));
        const { DELETE } = await import('../ban/route');
        const req = makeDeleteRequest(
          'http://localhost:5000/api/players/ban?player=Griefer&server=sv1'
        );

        const res = await DELETE(req);

        expect(res.status).toBe(403);
      });

      it('should proxy to mcctl-api on success', async () => {
        const { DELETE } = await import('../ban/route');
        const req = makeDeleteRequest(
          'http://localhost:5000/api/players/ban?player=Griefer&server=sv1'
        );

        const res = await DELETE(req);

        expect(res.status).toBe(200);
        expect(mockExecCommand).toHaveBeenCalledWith('sv1', 'pardon Griefer');
      });
    });
  });

  // ===== /api/players/kick =====
  describe('Kick routes', () => {
    describe('POST /api/players/kick', () => {
      it('should call requireServerPermission with manage level', async () => {
        const { POST } = await import('../kick/route');
        const req = makePostRequest('http://localhost:5000/api/players/kick', {
          player: 'Steve',
          server: 'sv1',
        });

        await POST(req);

        expect(mockRequireServerPermission).toHaveBeenCalledWith(mockHeaders, 'sv1', 'manage');
      });

      it('should return 400 when player or server missing', async () => {
        const { POST } = await import('../kick/route');
        const req = makePostRequest('http://localhost:5000/api/players/kick', { player: 'Steve' });

        const res = await POST(req);

        expect(res.status).toBe(400);
      });

      it('should return 403 when permission denied', async () => {
        mockRequireServerPermission.mockRejectedValue(new AuthError('Forbidden', 403));
        const { POST } = await import('../kick/route');
        const req = makePostRequest('http://localhost:5000/api/players/kick', {
          player: 'Steve',
          server: 'sv1',
        });

        const res = await POST(req);

        expect(res.status).toBe(403);
      });

      it('should proxy to mcctl-api on success', async () => {
        const { POST } = await import('../kick/route');
        const req = makePostRequest('http://localhost:5000/api/players/kick', {
          player: 'Steve',
          server: 'sv1',
          reason: 'AFK',
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(mockExecCommand).toHaveBeenCalledWith('sv1', 'kick Steve AFK');
      });
    });
  });

  // ===== /api/players/op =====
  describe('Op routes', () => {
    describe('GET /api/players/op', () => {
      it('should call requireServerPermission with view level', async () => {
        const { GET } = await import('../op/route');
        const req = makeGetRequest('http://localhost:5000/api/players/op?server=sv1');

        await GET(req);

        expect(mockRequireServerPermission).toHaveBeenCalledWith(mockHeaders, 'sv1', 'view');
      });

      it('should return 400 when server param missing', async () => {
        const { GET } = await import('../op/route');
        const req = makeGetRequest('http://localhost:5000/api/players/op');

        const res = await GET(req);

        expect(res.status).toBe(400);
      });

      it('should return 403 when permission denied', async () => {
        mockRequireServerPermission.mockRejectedValue(new AuthError('Forbidden', 403));
        const { GET } = await import('../op/route');
        const req = makeGetRequest('http://localhost:5000/api/players/op?server=sv1');

        const res = await GET(req);

        expect(res.status).toBe(403);
      });

      it('should return operators on success', async () => {
        const { GET } = await import('../op/route');
        const req = makeGetRequest('http://localhost:5000/api/players/op?server=sv1');

        const res = await GET(req);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.operators).toBeDefined();
      });
    });

    describe('POST /api/players/op', () => {
      it('should call requireServerPermission with admin level', async () => {
        const { POST } = await import('../op/route');
        const req = makePostRequest('http://localhost:5000/api/players/op', {
          player: 'Steve',
          server: 'sv1',
        });

        await POST(req);

        expect(mockRequireServerPermission).toHaveBeenCalledWith(mockHeaders, 'sv1', 'admin');
      });

      it('should return 400 when player or server missing', async () => {
        const { POST } = await import('../op/route');
        const req = makePostRequest('http://localhost:5000/api/players/op', { player: 'Steve' });

        const res = await POST(req);

        expect(res.status).toBe(400);
      });

      it('should return 403 when permission denied', async () => {
        mockRequireServerPermission.mockRejectedValue(new AuthError('Forbidden', 403));
        const { POST } = await import('../op/route');
        const req = makePostRequest('http://localhost:5000/api/players/op', {
          player: 'Steve',
          server: 'sv1',
        });

        const res = await POST(req);

        expect(res.status).toBe(403);
      });

      it('should proxy to mcctl-api on success', async () => {
        const { POST } = await import('../op/route');
        const req = makePostRequest('http://localhost:5000/api/players/op', {
          player: 'Steve',
          server: 'sv1',
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(mockExecCommand).toHaveBeenCalledWith('sv1', 'op Steve');
      });
    });

    describe('DELETE /api/players/op', () => {
      it('should call requireServerPermission with admin level', async () => {
        const { DELETE } = await import('../op/route');
        const req = makeDeleteRequest(
          'http://localhost:5000/api/players/op?player=Steve&server=sv1'
        );

        await DELETE(req);

        expect(mockRequireServerPermission).toHaveBeenCalledWith(mockHeaders, 'sv1', 'admin');
      });

      it('should return 400 when player or server missing', async () => {
        const { DELETE } = await import('../op/route');
        const req = makeDeleteRequest('http://localhost:5000/api/players/op?server=sv1');

        const res = await DELETE(req);

        expect(res.status).toBe(400);
      });

      it('should return 403 when permission denied', async () => {
        mockRequireServerPermission.mockRejectedValue(new AuthError('Forbidden', 403));
        const { DELETE } = await import('../op/route');
        const req = makeDeleteRequest(
          'http://localhost:5000/api/players/op?player=Steve&server=sv1'
        );

        const res = await DELETE(req);

        expect(res.status).toBe(403);
      });

      it('should proxy to mcctl-api on success', async () => {
        const { DELETE } = await import('../op/route');
        const req = makeDeleteRequest(
          'http://localhost:5000/api/players/op?player=Steve&server=sv1'
        );

        const res = await DELETE(req);

        expect(res.status).toBe(200);
        expect(mockExecCommand).toHaveBeenCalledWith('sv1', 'deop Steve');
      });
    });
  });
});
