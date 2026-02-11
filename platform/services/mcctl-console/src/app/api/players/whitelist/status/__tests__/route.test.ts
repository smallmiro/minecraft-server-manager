import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks ---

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
    requireServerPermission: vi.fn(),
    AuthError,
  };
});

const mockGetWhitelistStatus = vi.fn();
const mockSetWhitelistStatus = vi.fn();

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
      getWhitelistStatus: mockGetWhitelistStatus,
      setWhitelistStatus: mockSetWhitelistStatus,
    })),
    McctlApiError,
    UserContext: undefined,
  };
});

import { requireServerPermission, AuthError } from '@/lib/auth-utils';

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

function makePutRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// --- Tests ---

describe('Whitelist Status BFF Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireServerPermission.mockResolvedValue(mockSession as never);
    mockGetWhitelistStatus.mockResolvedValue({ enabled: true, source: 'config' });
    mockSetWhitelistStatus.mockResolvedValue({ enabled: true, source: 'config' });
  });

  // ===== GET /api/players/whitelist/status =====

  describe('GET /api/players/whitelist/status', () => {
    it('should call requireServerPermission with view level', async () => {
      const { GET } = await import('../route');
      const req = makeGetRequest('http://localhost:5000/api/players/whitelist/status?server=sv1');

      await GET(req);

      expect(mockRequireServerPermission).toHaveBeenCalledWith(mockHeaders, 'sv1', 'view');
    });

    it('should return 400 when server param missing', async () => {
      const { GET } = await import('../route');
      const req = makeGetRequest('http://localhost:5000/api/players/whitelist/status');

      const res = await GET(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('BadRequest');
    });

    it('should return 403 when permission denied', async () => {
      mockRequireServerPermission.mockRejectedValue(new AuthError('Forbidden', 403));
      const { GET } = await import('../route');
      const req = makeGetRequest('http://localhost:5000/api/players/whitelist/status?server=sv1');

      const res = await GET(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('Forbidden');
    });

    it('should proxy to mcctl-api on success', async () => {
      mockGetWhitelistStatus.mockResolvedValue({ enabled: false, source: 'config' });
      const { GET } = await import('../route');
      const req = makeGetRequest('http://localhost:5000/api/players/whitelist/status?server=sv1');

      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.enabled).toBe(false);
      expect(body.source).toBe('config');
      expect(mockGetWhitelistStatus).toHaveBeenCalledWith('sv1');
    });
  });

  // ===== PUT /api/players/whitelist/status =====

  describe('PUT /api/players/whitelist/status', () => {
    it('should call requireServerPermission with manage level', async () => {
      const { PUT } = await import('../route');
      const req = makePutRequest('http://localhost:5000/api/players/whitelist/status', {
        server: 'sv1',
        enabled: true,
      });

      await PUT(req);

      expect(mockRequireServerPermission).toHaveBeenCalledWith(mockHeaders, 'sv1', 'manage');
    });

    it('should return 400 when server is missing', async () => {
      const { PUT } = await import('../route');
      const req = makePutRequest('http://localhost:5000/api/players/whitelist/status', {
        enabled: true,
      });

      const res = await PUT(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when enabled is not boolean', async () => {
      const { PUT } = await import('../route');
      const req = makePutRequest('http://localhost:5000/api/players/whitelist/status', {
        server: 'sv1',
        enabled: 'yes',
      });

      const res = await PUT(req);

      expect(res.status).toBe(400);
    });

    it('should return 403 when permission denied', async () => {
      mockRequireServerPermission.mockRejectedValue(new AuthError('Forbidden', 403));
      const { PUT } = await import('../route');
      const req = makePutRequest('http://localhost:5000/api/players/whitelist/status', {
        server: 'sv1',
        enabled: true,
      });

      const res = await PUT(req);

      expect(res.status).toBe(403);
    });

    it('should proxy to mcctl-api on success', async () => {
      mockSetWhitelistStatus.mockResolvedValue({ enabled: false, source: 'config' });
      const { PUT } = await import('../route');
      const req = makePutRequest('http://localhost:5000/api/players/whitelist/status', {
        server: 'sv1',
        enabled: false,
      });

      const res = await PUT(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.enabled).toBe(false);
      expect(mockSetWhitelistStatus).toHaveBeenCalledWith('sv1', false);
    });
  });
});
