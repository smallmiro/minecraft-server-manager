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
const mockGetWhitelist = vi.fn();
const mockAddToWhitelist = vi.fn();
const mockRemoveFromWhitelist = vi.fn();
const mockGetBans = vi.fn();
const mockBanPlayer = vi.fn();
const mockUnbanPlayer = vi.fn();
const mockGetOpsWithLevel = vi.fn();
const mockAddOpWithLevel = vi.fn();
const mockRemoveOp = vi.fn();

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
      getWhitelist: mockGetWhitelist,
      addToWhitelist: mockAddToWhitelist,
      removeFromWhitelist: mockRemoveFromWhitelist,
      getBans: mockGetBans,
      banPlayer: mockBanPlayer,
      unbanPlayer: mockUnbanPlayer,
      getOpsWithLevel: mockGetOpsWithLevel,
      addOpWithLevel: mockAddOpWithLevel,
      removeOp: mockRemoveOp,
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
    mockGetWhitelist.mockResolvedValue({ players: [{ name: 'Player1', uuid: 'uuid1' }], total: 1, source: 'file' });
    mockAddToWhitelist.mockResolvedValue({ success: true, message: 'Added', source: 'file' });
    mockRemoveFromWhitelist.mockResolvedValue({ success: true, message: 'Removed', source: 'file' });
    mockGetBans.mockResolvedValue({ players: [{ name: 'Griefer', uuid: 'uuid2', reason: 'Griefing', created: '2025-01-01', source: 'Server', expires: 'forever' }], total: 1, source: 'file' });
    mockBanPlayer.mockResolvedValue({ success: true, message: 'Banned', source: 'file' });
    mockUnbanPlayer.mockResolvedValue({ success: true, message: 'Unbanned', source: 'file' });
    mockGetOpsWithLevel.mockResolvedValue({ operators: [{ name: 'Admin', uuid: 'uuid3', level: 4, role: 'Owner', bypassesPlayerLimit: false }], count: 1, source: 'file' });
    mockAddOpWithLevel.mockResolvedValue({ success: true, operator: { name: 'Admin', uuid: 'uuid3', level: 4, role: 'Owner', bypassesPlayerLimit: false }, source: 'file' });
    mockRemoveOp.mockResolvedValue({ success: true, message: 'Removed', source: 'file' });
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
        mockGetWhitelist.mockResolvedValue({ players: [{ name: 'Alice', uuid: 'uuid-alice' }, { name: 'Bob', uuid: 'uuid-bob' }], total: 2, source: 'file' });
        const { GET } = await import('../whitelist/route');
        const req = makeGetRequest('http://localhost:5000/api/players/whitelist?server=sv1');

        const res = await GET(req);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.players).toHaveLength(2);
        expect(mockGetWhitelist).toHaveBeenCalledWith('sv1');
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
        expect(mockAddToWhitelist).toHaveBeenCalledWith('sv1', 'Steve');
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
        expect(mockRemoveFromWhitelist).toHaveBeenCalledWith('sv1', 'Steve');
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
        mockGetBans.mockResolvedValue({ players: [{ name: 'Griefer', uuid: 'uuid-griefer', reason: 'Griefing', created: '2025-01-01', source: 'Server', expires: 'forever' }], total: 1, source: 'file' });
        const { GET } = await import('../ban/route');
        const req = makeGetRequest('http://localhost:5000/api/players/ban?server=sv1');

        const res = await GET(req);

        expect(res.status).toBe(200);
        expect(mockGetBans).toHaveBeenCalledWith('sv1');
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
        expect(mockBanPlayer).toHaveBeenCalledWith('sv1', 'Griefer', 'griefing');
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
        expect(mockUnbanPlayer).toHaveBeenCalledWith('sv1', 'Griefer');
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
        expect(mockAddOpWithLevel).toHaveBeenCalledWith('sv1', 'Steve', 4);
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
        expect(mockRemoveOp).toHaveBeenCalledWith('sv1', 'Steve');
      });
    });
  });
});
