import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redirect } from 'next/navigation';
import AdminLayout from './layout';
import { getServerSession } from '@/lib/auth';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock headers
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow access for admin users', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'admin-123',
        email: 'admin@test.com',
        name: 'Admin User',
        role: 'admin',
      },
      session: {},
    } as any;

    vi.mocked(getServerSession).mockResolvedValue(mockSession);

    // Act
    const result = await AdminLayout({ children: <div>Admin Content</div> });

    // Assert
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });

  it('should redirect non-admin users to dashboard', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user-123',
        email: 'user@test.com',
        name: 'Regular User',
        role: 'user',
      },
      session: {},
    } as any;

    vi.mocked(getServerSession).mockResolvedValue(mockSession);

    // Act
    await AdminLayout({ children: <div>Admin Content</div> });

    // Assert
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('should redirect unauthenticated users to dashboard', async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(null);

    // Act
    await AdminLayout({ children: <div>Admin Content</div> });

    // Assert
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });
});
