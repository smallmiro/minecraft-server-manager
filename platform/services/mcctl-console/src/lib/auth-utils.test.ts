import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth with complete session type
const mockSession = {
  user: {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    emailVerified: true,
    image: null,
    banned: false,
    banReason: null,
    banExpires: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  session: {
    id: 'session-1',
    expiresAt: new Date(Date.now() + 3600000),
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: 'user-1',
    token: 'test-token',
    ipAddress: null,
    userAgent: null,
  },
};

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
  getServerSession: vi.fn(),
}));

vi.mock('./db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
}));

describe('auth-utils', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('requireAuth', () => {
    it('should return session when authenticated', async () => {
      const authModule = await import('./auth');
      vi.mocked(authModule.getServerSession).mockResolvedValue(mockSession);

      const { requireAuth } = await import('./auth-utils');
      const mockHeaders = new Headers();

      const result = await requireAuth(mockHeaders);
      expect(result).toEqual(mockSession);
    });

    it('should throw error when not authenticated', async () => {
      const authModule = await import('./auth');
      vi.mocked(authModule.getServerSession).mockResolvedValue(null);

      const { requireAuth } = await import('./auth-utils');
      const mockHeaders = new Headers();

      await expect(requireAuth(mockHeaders)).rejects.toThrow('Unauthorized');
    });
  });

  describe('requireAdmin', () => {
    it('should return session when user is admin', async () => {
      const adminSession = {
        ...mockSession,
        user: { ...mockSession.user, role: 'admin' },
      };
      const authModule = await import('./auth');
      vi.mocked(authModule.getServerSession).mockResolvedValue(adminSession);

      const { requireAdmin } = await import('./auth-utils');
      const mockHeaders = new Headers();

      const result = await requireAdmin(mockHeaders);
      expect(result).toEqual(adminSession);
    });

    it('should throw error when user is not admin', async () => {
      const authModule = await import('./auth');
      vi.mocked(authModule.getServerSession).mockResolvedValue(mockSession);

      const { requireAdmin } = await import('./auth-utils');
      const mockHeaders = new Headers();

      await expect(requireAdmin(mockHeaders)).rejects.toThrow('Forbidden');
    });
  });

  describe('requireServerPermission', () => {
    it('should return session when user has server permission', async () => {
      const dbModule = await import('./db');
      vi.mocked(dbModule.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ permission: 'manage' }]),
          }),
        }),
      } as unknown as ReturnType<typeof dbModule.db.select>);

      const authModule = await import('./auth');
      vi.mocked(authModule.getServerSession).mockResolvedValue(mockSession);

      const { requireServerPermission } = await import('./auth-utils');
      const mockHeaders = new Headers();

      const result = await requireServerPermission(mockHeaders, 'server-1');
      expect(result).toEqual(mockSession);
    });

    it('should allow admin without explicit permission', async () => {
      const adminSession = {
        ...mockSession,
        user: { ...mockSession.user, role: 'admin' },
      };
      const authModule = await import('./auth');
      vi.mocked(authModule.getServerSession).mockResolvedValue(adminSession);

      const { requireServerPermission } = await import('./auth-utils');
      const mockHeaders = new Headers();

      const result = await requireServerPermission(mockHeaders, 'server-1');
      expect(result).toEqual(adminSession);
    });
  });
});
