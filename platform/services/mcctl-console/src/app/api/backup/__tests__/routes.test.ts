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

const mockGetBackupStatus = vi.fn();
const mockPushBackup = vi.fn();
const mockGetBackupHistory = vi.fn();
const mockRestoreBackup = vi.fn();

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
      getBackupStatus: mockGetBackupStatus,
      pushBackup: mockPushBackup,
      getBackupHistory: mockGetBackupHistory,
      restoreBackup: mockRestoreBackup,
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

// --- Tests ---

describe('Backup BFF Routes - Permission Wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockSession as never);
    mockRequireAdmin.mockResolvedValue(mockAdminSession as never);
    mockGetBackupStatus.mockResolvedValue({ configured: true, lastBackup: null });
    mockPushBackup.mockResolvedValue({ success: true });
    mockGetBackupHistory.mockResolvedValue({ commits: [] });
    mockRestoreBackup.mockResolvedValue({ success: true });
  });

  // ===== /api/backup (GET) =====
  describe('GET /api/backup', () => {
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

    it('should return backup status on success', async () => {
      const { GET } = await import('../route');

      const res = await GET();

      expect(res.status).toBe(200);
      expect(mockGetBackupStatus).toHaveBeenCalled();
    });
  });

  // ===== /api/backup (POST) =====
  describe('POST /api/backup', () => {
    it('should call requireAdmin', async () => {
      const { POST } = await import('../route');
      const req = makePostRequest('http://localhost:5000/api/backup', {
        message: 'test backup',
      });

      await POST(req);

      expect(mockRequireAdmin).toHaveBeenCalledWith(mockHeaders);
    });

    it('should return 403 when not admin', async () => {
      mockRequireAdmin.mockRejectedValue(
        new AuthError('Forbidden: Admin access required', 403)
      );
      const { POST } = await import('../route');
      const req = makePostRequest('http://localhost:5000/api/backup', {});

      const res = await POST(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('Forbidden');
    });

    it('should push backup on success', async () => {
      const { POST } = await import('../route');
      const req = makePostRequest('http://localhost:5000/api/backup', {
        message: 'manual backup',
      });

      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockPushBackup).toHaveBeenCalledWith('manual backup');
    });
  });

  // ===== /api/backup/history (GET) =====
  describe('GET /api/backup/history', () => {
    it('should call requireAuth', async () => {
      const { GET } = await import('../history/route');
      const req = makeGetRequest('http://localhost:5000/api/backup/history');

      await GET(req);

      expect(mockRequireAuth).toHaveBeenCalledWith(mockHeaders);
    });

    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockRejectedValue(new AuthError('Unauthorized', 401));
      const { GET } = await import('../history/route');
      const req = makeGetRequest('http://localhost:5000/api/backup/history');

      const res = await GET(req);

      expect(res.status).toBe(401);
    });

    it('should return history with default limit on success', async () => {
      const { GET } = await import('../history/route');
      const req = makeGetRequest('http://localhost:5000/api/backup/history');

      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(mockGetBackupHistory).toHaveBeenCalledWith(20);
    });

    it('should pass custom limit parameter', async () => {
      const { GET } = await import('../history/route');
      const req = makeGetRequest('http://localhost:5000/api/backup/history?limit=5');

      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(mockGetBackupHistory).toHaveBeenCalledWith(5);
    });
  });

  // ===== /api/backup/restore (POST) =====
  describe('POST /api/backup/restore', () => {
    it('should call requireAdmin', async () => {
      const { POST } = await import('../restore/route');
      const req = makePostRequest('http://localhost:5000/api/backup/restore', {
        commitHash: 'abc123',
      });

      await POST(req);

      expect(mockRequireAdmin).toHaveBeenCalledWith(mockHeaders);
    });

    it('should return 403 when not admin', async () => {
      mockRequireAdmin.mockRejectedValue(
        new AuthError('Forbidden: Admin access required', 403)
      );
      const { POST } = await import('../restore/route');
      const req = makePostRequest('http://localhost:5000/api/backup/restore', {
        commitHash: 'abc123',
      });

      const res = await POST(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('Forbidden');
    });

    it('should return 400 when commitHash missing', async () => {
      const { POST } = await import('../restore/route');
      const req = makePostRequest('http://localhost:5000/api/backup/restore', {});

      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('ValidationError');
    });

    it('should restore backup on success', async () => {
      const { POST } = await import('../restore/route');
      const req = makePostRequest('http://localhost:5000/api/backup/restore', {
        commitHash: 'abc123',
      });

      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockRestoreBackup).toHaveBeenCalledWith('abc123');
    });
  });
});
