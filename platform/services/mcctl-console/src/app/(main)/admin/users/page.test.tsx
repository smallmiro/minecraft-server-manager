import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  it('shows loading state with page context', () => {
    mockUseAdminUsers.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderWithTheme(<UsersPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'User Management' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'User directory' })).toBeInTheDocument();
  });

  it('shows error state with page context', () => {
    mockUseAdminUsers.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch users'),
    });

    renderWithTheme(<UsersPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'User Management' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch users');
    expect(screen.getAllByText('Unavailable')).toHaveLength(3);
    expect(screen.queryByText('No users found')).not.toBeInTheDocument();
  });

  it('renders a compact hero, metrics, and full-width user list from existing data', async () => {
    const mockUsers = [
      {
        id: '1',
        email: 'admin-with-a-very-long-address-for-containment@example.minecraft.internal',
        name: 'Admin User',
        role: 'admin',
        banned: false,
        createdAt: new Date('2024-01-01'),
      },
      {
        id: '2',
        email: 'banned@example.com',
        name: 'Banned User',
        role: 'user',
        banned: true,
        createdAt: new Date('2024-02-01'),
      },
      {
        id: '3',
        email: 'player@example.com',
        name: 'Player',
        role: 'user',
        banned: false,
        createdAt: new Date('2024-03-01'),
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
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });
    expect(screen.getByTestId('page-hero')).toHaveAttribute('data-compact', 'true');
    expect(within(screen.getByRole('article', { name: 'Total users' })).getByText('3')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Administrators' })).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Banned users' })).getByText('1')).toBeInTheDocument();

    const directory = screen.getByRole('region', { name: 'User directory' });
    expect(directory).toContainElement(
      screen.getByText('admin-with-a-very-long-address-for-containment@example.minecraft.internal')
    );
  });

  it('shows the empty state with page context', () => {
    mockUseAdminUsers.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithTheme(<UsersPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'User Management' })).toBeInTheDocument();
    expect(screen.getByText('No users found')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Total users' })).toHaveTextContent('0');
  });

  it('opens the unchanged detail dialog when a user row is selected', () => {
    mockUseAdminUsers.mockReturnValue({
      data: [
        {
          id: '1',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin',
          banned: false,
          createdAt: new Date('2024-01-01'),
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithTheme(<UsersPage />);

    fireEvent.click(screen.getByRole('row', { name: /admin@example\.com/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('User Details')).toBeInTheDocument();
  });
});
