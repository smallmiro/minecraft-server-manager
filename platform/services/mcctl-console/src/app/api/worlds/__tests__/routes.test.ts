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

const mockGetWorlds = vi.fn();
const mockGetWorld = vi.fn();
const mockCreateWorld = vi.fn();
const mockDeleteWorld = vi.fn();
const mockAssignWorld = vi.fn();
const mockReleaseWorld = vi.fn();

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
      getWorlds: mockGetWorlds,
      getWorld: mockGetWorld,
      createWorld: mockCreateWorld,
      deleteWorld: mockDeleteWorld,
      assignWorld: mockAssignWorld,
      releaseWorld: mockReleaseWorld,
    })),
    McctlApiError,
    UserContext: undefined,
  };
});

import { requireAuth, requireAdmin, AuthError } from '@/lib/auth-utils';

const mockRequireAuth = vi.mocked(requireAuth);
const mockRequireAdmin = vi.mocked(requireAdmin);

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

const mockAdminSession = {
  user: {
    id: 'admin-1',
    name: 'AdminUser',
    email: 'admin@example.com',
    role: 'admin',
  },
  session: { id: 'session-2', token: 'admin-token' },
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

describe('Worlds BFF Routes - Permission Wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockSession as never);
    mockRequireAdmin.mockResolvedValue(mockAdminSession as never);
    mockGetWorlds.mockResolvedValue({ worlds: [] });
    mockGetWorld.mockResolvedValue({ world: { name: 'test-world' } });
    mockCreateWorld.mockResolvedValue({ world: { name: 'new-world' } });
    mockDeleteWorld.mockResolvedValue({ success: true });
    mockAssignWorld.mockResolvedValue({ success: true });
    mockReleaseWorld.mockResolvedValue({ success: true });
  });

  // ===== /api/worlds (GET) =====
  describe('GET /api/worlds', () => {
    it('should call requireAuth', async () => {
      const { GET } = await import('../route');

      await GET();

      expect(mockRequireAuth).toHaveBeenCalledWith(mockHeaders);
    });

    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockRejectedValue(new AuthError('Unauthorized', 401));
      const { GET } = await import('../route');

      const res = await GET();

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should return worlds on success', async () => {
      mockGetWorlds.mockResolvedValue({ worlds: [{ name: 'world1' }] });
      const { GET } = await import('../route');

      const res = await GET();

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.worlds).toHaveLength(1);
    });
  });

  // ===== /api/worlds (POST) =====
  describe('POST /api/worlds', () => {
    it('should call requireAuth', async () => {
      const { POST } = await import('../route');
      const req = makePostRequest('http://localhost:5000/api/worlds', { name: 'new-world' });

      await POST(req);

      expect(mockRequireAuth).toHaveBeenCalledWith(mockHeaders);
    });

    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockRejectedValue(new AuthError('Unauthorized', 401));
      const { POST } = await import('../route');
      const req = makePostRequest('http://localhost:5000/api/worlds', { name: 'new-world' });

      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it('should return 201 on success', async () => {
      const { POST } = await import('../route');
      const req = makePostRequest('http://localhost:5000/api/worlds', { name: 'new-world' });

      const res = await POST(req);

      expect(res.status).toBe(201);
      expect(mockCreateWorld).toHaveBeenCalledWith({ name: 'new-world' });
    });
  });

  // ===== /api/worlds/[name] (GET) =====
  describe('GET /api/worlds/[name]', () => {
    const routeParams = { params: Promise.resolve({ name: 'test-world' }) };

    it('should call requireAuth', async () => {
      const { GET } = await import('../[name]/route');
      const req = makeGetRequest('http://localhost:5000/api/worlds/test-world');

      await GET(req, routeParams);

      expect(mockRequireAuth).toHaveBeenCalledWith(mockHeaders);
    });

    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockRejectedValue(new AuthError('Unauthorized', 401));
      const { GET } = await import('../[name]/route');
      const req = makeGetRequest('http://localhost:5000/api/worlds/test-world');

      const res = await GET(req, routeParams);

      expect(res.status).toBe(401);
    });

    it('should return world details on success', async () => {
      const { GET } = await import('../[name]/route');
      const req = makeGetRequest('http://localhost:5000/api/worlds/test-world');

      const res = await GET(req, routeParams);

      expect(res.status).toBe(200);
      expect(mockGetWorld).toHaveBeenCalledWith('test-world');
    });
  });

  // ===== /api/worlds/[name] (DELETE) =====
  describe('DELETE /api/worlds/[name]', () => {
    const routeParams = { params: Promise.resolve({ name: 'test-world' }) };

    it('should call requireAdmin', async () => {
      const { DELETE } = await import('../[name]/route');
      const req = makeDeleteRequest('http://localhost:5000/api/worlds/test-world');

      await DELETE(req, routeParams);

      expect(mockRequireAdmin).toHaveBeenCalledWith(mockHeaders);
    });

    it('should return 403 when not admin', async () => {
      mockRequireAdmin.mockRejectedValue(
        new AuthError('Forbidden: Admin access required', 403)
      );
      const { DELETE } = await import('../[name]/route');
      const req = makeDeleteRequest('http://localhost:5000/api/worlds/test-world');

      const res = await DELETE(req, routeParams);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('Forbidden');
    });

    it('should delete world on success', async () => {
      const { DELETE } = await import('../[name]/route');
      const req = makeDeleteRequest('http://localhost:5000/api/worlds/test-world?force=true');

      const res = await DELETE(req, routeParams);

      expect(res.status).toBe(200);
      expect(mockDeleteWorld).toHaveBeenCalledWith('test-world', true);
    });
  });

  // ===== /api/worlds/[name]/[action] (POST) =====
  describe('POST /api/worlds/[name]/[action]', () => {
    it('should call requireAuth for assign action', async () => {
      const routeParams = {
        params: Promise.resolve({ name: 'test-world', action: 'assign' }),
      };
      const { POST } = await import('../[name]/[action]/route');
      const req = makePostRequest('http://localhost:5000/api/worlds/test-world/assign', {
        serverName: 'sv1',
      });

      await POST(req, routeParams);

      expect(mockRequireAuth).toHaveBeenCalledWith(mockHeaders);
    });

    it('should call requireAuth for release action', async () => {
      const routeParams = {
        params: Promise.resolve({ name: 'test-world', action: 'release' }),
      };
      const { POST } = await import('../[name]/[action]/route');
      const req = makePostRequest('http://localhost:5000/api/worlds/test-world/release', {});

      await POST(req, routeParams);

      expect(mockRequireAuth).toHaveBeenCalledWith(mockHeaders);
    });

    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockRejectedValue(new AuthError('Unauthorized', 401));
      const routeParams = {
        params: Promise.resolve({ name: 'test-world', action: 'assign' }),
      };
      const { POST } = await import('../[name]/[action]/route');
      const req = makePostRequest('http://localhost:5000/api/worlds/test-world/assign', {
        serverName: 'sv1',
      });

      const res = await POST(req, routeParams);

      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid action', async () => {
      const routeParams = {
        params: Promise.resolve({ name: 'test-world', action: 'invalid' }),
      };
      const { POST } = await import('../[name]/[action]/route');
      const req = makePostRequest('http://localhost:5000/api/worlds/test-world/invalid', {});

      const res = await POST(req, routeParams);

      expect(res.status).toBe(400);
    });

    it('should proxy assign action on success', async () => {
      const routeParams = {
        params: Promise.resolve({ name: 'test-world', action: 'assign' }),
      };
      const { POST } = await import('../[name]/[action]/route');
      const req = makePostRequest('http://localhost:5000/api/worlds/test-world/assign', {
        serverName: 'sv1',
      });

      const res = await POST(req, routeParams);

      expect(res.status).toBe(200);
      expect(mockAssignWorld).toHaveBeenCalledWith('test-world', 'sv1');
    });

    it('should proxy release action on success', async () => {
      const routeParams = {
        params: Promise.resolve({ name: 'test-world', action: 'release' }),
      };
      const { POST } = await import('../[name]/[action]/route');
      const req = makePostRequest(
        'http://localhost:5000/api/worlds/test-world/release?force=true',
        {}
      );

      const res = await POST(req, routeParams);

      expect(res.status).toBe(200);
      expect(mockReleaseWorld).toHaveBeenCalledWith('test-world', true);
    });
  });
});
