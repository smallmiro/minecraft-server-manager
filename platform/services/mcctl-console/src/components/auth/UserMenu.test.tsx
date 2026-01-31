import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { UserMenu } from './UserMenu';

// Mock auth client
vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state when session is loading', () => {
    const { useSession } = require('@/lib/auth-client');
    useSession.mockReturnValue({ data: null, isPending: true });

    renderWithTheme(<UserMenu />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should render login button when not authenticated', () => {
    const { useSession } = require('@/lib/auth-client');
    useSession.mockReturnValue({ data: null, isPending: false });

    renderWithTheme(<UserMenu />);

    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it('should render user avatar when authenticated', () => {
    const { useSession } = require('@/lib/auth-client');
    useSession.mockReturnValue({
      data: { user: { id: '1', name: 'Test User', email: 'test@example.com' } },
      isPending: false,
    });

    renderWithTheme(<UserMenu />);

    expect(screen.getByLabelText(/user menu/i)).toBeInTheDocument();
  });

  it('should display user initials in avatar', () => {
    const { useSession } = require('@/lib/auth-client');
    useSession.mockReturnValue({
      data: { user: { id: '1', name: 'Test User', email: 'test@example.com' } },
      isPending: false,
    });

    renderWithTheme(<UserMenu />);

    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  it('should display first letter of email if name is not available', () => {
    const { useSession } = require('@/lib/auth-client');
    useSession.mockReturnValue({
      data: { user: { id: '1', email: 'test@example.com' } },
      isPending: false,
    });

    renderWithTheme(<UserMenu />);

    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('should open menu when avatar is clicked', () => {
    const { useSession } = require('@/lib/auth-client');
    useSession.mockReturnValue({
      data: { user: { id: '1', name: 'Test User', email: 'test@example.com' } },
      isPending: false,
    });

    renderWithTheme(<UserMenu />);

    const avatarButton = screen.getByLabelText(/user menu/i);
    fireEvent.click(avatarButton);

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('should display logout option in menu', () => {
    const { useSession } = require('@/lib/auth-client');
    useSession.mockReturnValue({
      data: { user: { id: '1', name: 'Test User', email: 'test@example.com' } },
      isPending: false,
    });

    renderWithTheme(<UserMenu />);

    const avatarButton = screen.getByLabelText(/user menu/i);
    fireEvent.click(avatarButton);

    expect(screen.getByText(/logout/i)).toBeInTheDocument();
  });

  it('should call signOut when logout is clicked', async () => {
    const { useSession, signOut } = require('@/lib/auth-client');
    useSession.mockReturnValue({
      data: { user: { id: '1', name: 'Test User', email: 'test@example.com' } },
      isPending: false,
    });

    renderWithTheme(<UserMenu />);

    const avatarButton = screen.getByLabelText(/user menu/i);
    fireEvent.click(avatarButton);

    const logoutButton = screen.getByText(/logout/i);
    fireEvent.click(logoutButton);

    expect(signOut).toHaveBeenCalled();
  });

  it('should close menu when logout is clicked', () => {
    const { useSession, signOut } = require('@/lib/auth-client');
    useSession.mockReturnValue({
      data: { user: { id: '1', name: 'Test User', email: 'test@example.com' } },
      isPending: false,
    });

    renderWithTheme(<UserMenu />);

    const avatarButton = screen.getByLabelText(/user menu/i);
    fireEvent.click(avatarButton);

    const logoutButton = screen.getByText(/logout/i);
    fireEvent.click(logoutButton);

    // Menu should be closed, so user email shouldn't be visible
    expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
  });

  it('should show admin badge for admin users', () => {
    const { useSession } = require('@/lib/auth-client');
    useSession.mockReturnValue({
      data: {
        user: {
          id: '1',
          name: 'Admin User',
          email: 'admin@example.com',
          role: 'admin',
        },
      },
      isPending: false,
    });

    renderWithTheme(<UserMenu />);

    const avatarButton = screen.getByLabelText(/user menu/i);
    fireEvent.click(avatarButton);

    expect(screen.getByText(/admin/i)).toBeInTheDocument();
  });
});
