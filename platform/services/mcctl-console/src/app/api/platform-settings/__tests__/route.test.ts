import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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
  return { requireAdmin: vi.fn(), AuthError };
});

const mockGet = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/adapters/McctlApiAdapter', () => {
  class McctlApiError extends Error {
    statusCode: number;
    error: string;
    body?: unknown;
    constructor(statusCode: number, error: string, message: string, body?: unknown) {
      super(message);
      this.statusCode = statusCode;
      this.error = error;
      this.body = body;
    }
  }
  return {
    createMcctlApiClient: vi.fn(() => ({
      getPlatformSettings: mockGet,
      updatePlatformSettings: mockUpdate,
    })),
    McctlApiError,
  };
});

import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { McctlApiError } from '@/adapters/McctlApiAdapter';

const mockRequireAdmin = vi.mocked(requireAdmin);

const adminSession = {
  user: { id: 'a', name: 'Admin', email: 'a@x.com', role: 'admin' },
};

function put(body: unknown): NextRequest {
  return new NextRequest('http://localhost:5000/api/platform-settings', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('BFF /api/platform-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(adminSession as never);
  });

  describe('GET', () => {
    it('requires admin and returns settings with no-store', async () => {
      mockGet.mockResolvedValue({ revision: 'r1', settings: [], runtime: [] });
      const { GET } = await import('../route');

      const res = await GET();

      expect(mockRequireAdmin).toHaveBeenCalledWith(mockHeaders);
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(await res.json()).toEqual({ revision: 'r1', settings: [], runtime: [] });
    });

    it('maps AuthError 401', async () => {
      mockRequireAdmin.mockRejectedValue(new AuthError('Unauthorized', 401));
      const { GET } = await import('../route');

      const res = await GET();

      expect(res.status).toBe(401);
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('maps AuthError 403 for non-admin', async () => {
      mockRequireAdmin.mockRejectedValue(new AuthError('Admin access required', 403));
      const { GET } = await import('../route');

      const res = await GET();

      expect(res.status).toBe(403);
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('maps upstream errors', async () => {
      mockGet.mockRejectedValue(new McctlApiError(404, 'NotFound', 'Platform not initialized (run mcctl init)'));
      const { GET } = await import('../route');

      const res = await GET();

      expect(res.status).toBe(404);
      expect((await res.json()).message).toContain('mcctl init');
    });
  });

  describe('PUT', () => {
    const payload = { revision: 'r1', set: { TZ: 'Asia/Seoul' }, remove: [] };

    it('forwards the body and returns result with no-store', async () => {
      const result = { revision: 'r2', changedKeys: ['TZ'], removedKeys: [], restartScopes: ['servers'] };
      mockUpdate.mockResolvedValue(result);
      const { PUT } = await import('../route');

      const res = await PUT(put(payload));

      expect(mockUpdate).toHaveBeenCalledWith(payload);
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(await res.json()).toEqual(result);
    });

    it('returns 403 for non-admin without calling the API', async () => {
      mockRequireAdmin.mockRejectedValue(new AuthError('Admin access required', 403));
      const { PUT } = await import('../route');

      const res = await PUT(put(payload));

      expect(res.status).toBe(403);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('passes the 409 body through (currentRevision)', async () => {
      const body = { error: 'Conflict', message: 'stale', currentRevision: 'r9' };
      mockUpdate.mockRejectedValue(new McctlApiError(409, 'Conflict', 'stale', body));
      const { PUT } = await import('../route');

      const res = await PUT(put(payload));

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual(body);
    });

    it('passes the 400 body through (field errors)', async () => {
      const body = {
        error: 'ValidationError',
        message: 'invalid',
        errors: [{ key: 'RCON_PORT', message: 'Invalid port' }],
      };
      mockUpdate.mockRejectedValue(new McctlApiError(400, 'ValidationError', 'invalid', body));
      const { PUT } = await import('../route');

      const res = await PUT(put(payload));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual(body);
    });

    it('rejects a malformed body with 400', async () => {
      const { PUT } = await import('../route');

      const res = await PUT(put({ revision: 1 }));

      expect(res.status).toBe(400);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('returns 500 for unexpected errors without leaking details', async () => {
      mockUpdate.mockRejectedValue(new Error('secret-detail'));
      const { PUT } = await import('../route');

      const res = await PUT(put(payload));

      expect(res.status).toBe(500);
      expect(JSON.stringify(await res.json())).not.toContain('secret-detail');
    });
  });
});
