import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import UsersPage from './page';

// Mock useAdminUsers hook
vi.mock('@/hooks/use-admin-users', () => ({
  useAdminUsers: vi.fn(),
}));

import { useAdminUsers } from '@/hooks/use-admin-users';

const mockUseAdminUsers = useAdminUsers as ReturnType<typeof vi.fn>;

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('Admin Users Page', () => {
  it('should show loading state while fetching users', () => {
    mockUseAdminUsers.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderWithTheme(<UsersPage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should show error state when fetch fails', () => {
    mockUseAdminUsers.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch users'),
    });

    renderWithTheme(<UsersPage />);

    expect(screen.getByText(/failed to load users/i)).toBeInTheDocument();
  });

  it('should render user list when data is loaded', async () => {
    const mockUsers = [
      {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        banned: false,
        createdAt: new Date('2024-01-01'),
      },
    ];

    mockUseAdminUsers.mockReturnValue({
      data: mockUsers,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithTheme(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    });
  });

  it('should render page title', () => {
    mockUseAdminUsers.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithTheme(<UsersPage />);

    expect(screen.getByText('User Management')).toBeInTheDocument();
  });
});
