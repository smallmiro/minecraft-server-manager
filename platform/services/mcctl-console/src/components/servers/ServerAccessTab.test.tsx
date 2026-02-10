import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { ServerAccessTab } from './ServerAccessTab';

// Mock hooks
const mockMutate = vi.fn();
const mockRevokeMutate = vi.fn();

vi.mock('@/hooks/useUserServers', () => ({
  useServerUsers: vi.fn(),
  useUpdatePermission: vi.fn(() => ({
    mutate: mockMutate,
    isPending: false,
  })),
  useRevokeAccess: vi.fn(() => ({
    mutate: mockRevokeMutate,
    isPending: false,
  })),
  useSearchUsers: vi.fn(() => ({
    data: undefined,
    isLoading: false,
  })),
  useGrantAccess: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

import { useServerUsers } from '@/hooks/useUserServers';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

const mockUsers = {
  users: [
    {
      id: 'us-1',
      userId: 'user-1',
      serverId: 'test-server',
      permission: 'admin' as const,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      user: {
        id: 'user-1',
        name: 'Admin User',
        email: 'admin@example.com',
        image: null,
      },
    },
    {
      id: 'us-2',
      userId: 'user-2',
      serverId: 'test-server',
      permission: 'view' as const,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      user: {
        id: 'user-2',
        name: 'Viewer User',
        email: 'viewer@example.com',
        image: null,
      },
    },
  ],
  total: 2,
};

describe('ServerAccessTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show skeleton loading state', () => {
    vi.mocked(useServerUsers).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    renderWithTheme(<ServerAccessTab serverId="test-server" />);

    // Skeleton should be rendered (no "Server Access" heading yet)
    expect(screen.queryByText('Server Access')).not.toBeInTheDocument();
  });

  it('should show error state', () => {
    vi.mocked(useServerUsers).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    } as any);

    renderWithTheme(<ServerAccessTab serverId="test-server" />);

    expect(screen.getByText(/Failed to load access list/)).toBeInTheDocument();
  });

  it('should render user list with permissions', () => {
    vi.mocked(useServerUsers).mockReturnValue({
      data: mockUsers,
      isLoading: false,
      error: null,
    } as any);

    renderWithTheme(<ServerAccessTab serverId="test-server" />);

    expect(screen.getByText('Server Access')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('Viewer User')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });

  it('should show empty state when no users', () => {
    vi.mocked(useServerUsers).mockReturnValue({
      data: { users: [], total: 0 },
      isLoading: false,
      error: null,
    } as any);

    renderWithTheme(<ServerAccessTab serverId="test-server" />);

    expect(screen.getByText(/No users have been granted access/)).toBeInTheDocument();
  });

  it('should show Add User button', () => {
    vi.mocked(useServerUsers).mockReturnValue({
      data: mockUsers,
      isLoading: false,
      error: null,
    } as any);

    renderWithTheme(<ServerAccessTab serverId="test-server" />);

    expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument();
  });

  it('should show info message about permissions', () => {
    vi.mocked(useServerUsers).mockReturnValue({
      data: mockUsers,
      isLoading: false,
      error: null,
    } as any);

    renderWithTheme(<ServerAccessTab serverId="test-server" />);

    expect(screen.getByText(/Only platform admins and server owners/)).toBeInTheDocument();
  });

  it('should open context menu on three-dot click', () => {
    vi.mocked(useServerUsers).mockReturnValue({
      data: mockUsers,
      isLoading: false,
      error: null,
    } as any);

    renderWithTheme(<ServerAccessTab serverId="test-server" />);

    const menuButtons = screen.getAllByTestId('MoreVertIcon');
    fireEvent.click(menuButtons[0].closest('button')!);

    expect(screen.getByText('Change to Owner')).toBeInTheDocument();
    expect(screen.getByText('Change to Operator')).toBeInTheDocument();
    expect(screen.getByText('Change to Viewer')).toBeInTheDocument();
    expect(screen.getByText('Remove Access')).toBeInTheDocument();
  });
});
