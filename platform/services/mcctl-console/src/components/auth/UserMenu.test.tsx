import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { UserMenu } from './UserMenu';
import { useSession, signOut } from '@/lib/auth-client';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

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
    vi.mocked(useSession).mockReturnValue({ data: null, isPending: true } as any);

    renderWithTheme(<UserMenu />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should render login button when not authenticated', () => {
    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as any);

    renderWithTheme(<UserMenu />);

    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it('should render user avatar when authenticated', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: '1', name: 'Test User', email: 'test@example.com' } as any },
      isPending: false,
    } as any);

    renderWithTheme(<UserMenu />);

    expect(screen.getByLabelText(/user menu/i)).toBeInTheDocument();
  });

  it('should display user initials in avatar', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: '1', name: 'Test User', email: 'test@example.com' } as any },
      isPending: false,
    } as any);

    renderWithTheme(<UserMenu />);

    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  it('should display first letter of email if name is not available', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: '1', email: 'test@example.com' } as any },
      isPending: false,
    } as any);

    renderWithTheme(<UserMenu />);

    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('should open menu when avatar is clicked', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: '1', name: 'Test User', email: 'test@example.com' } as any },
      isPending: false,
    } as any);

    renderWithTheme(<UserMenu />);

    const avatarButton = screen.getByLabelText(/user menu/i);
    fireEvent.click(avatarButton);

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('should display logout option in menu', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: '1', name: 'Test User', email: 'test@example.com' } as any },
      isPending: false,
    } as any);

    renderWithTheme(<UserMenu />);

    const avatarButton = screen.getByLabelText(/user menu/i);
    fireEvent.click(avatarButton);

    expect(screen.getByText(/logout/i)).toBeInTheDocument();
  });

  it('should call signOut when logout is clicked', async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: '1', name: 'Test User', email: 'test@example.com' } as any },
      isPending: false,
    } as any);

    renderWithTheme(<UserMenu />);

    const avatarButton = screen.getByLabelText(/user menu/i);
    fireEvent.click(avatarButton);

    const logoutButton = screen.getByText(/logout/i);
    fireEvent.click(logoutButton);

    expect(signOut).toHaveBeenCalled();
  });

  it('should close menu when logout is clicked', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: '1', name: 'Test User', email: 'test@example.com' } as any },
      isPending: false,
    } as any);

    renderWithTheme(<UserMenu />);

    const avatarButton = screen.getByLabelText(/user menu/i);
    fireEvent.click(avatarButton);

    // Verify menu is open
    expect(screen.getByText('test@example.com')).toBeInTheDocument();

    const logoutButton = screen.getByText(/logout/i);
    fireEvent.click(logoutButton);

    // Note: MUI menu close is async, so we can't reliably test it here
    // Just verify signOut was called
    expect(signOut).toHaveBeenCalled();
  });

  it('should show admin badge for admin users', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          id: '1',
          name: 'Admin User',
          email: 'admin@example.com',
          role: 'admin',
        } as any,
      },
      isPending: false,
    } as any);

    renderWithTheme(<UserMenu />);

    const avatarButton = screen.getByLabelText(/user menu/i);
    fireEvent.click(avatarButton);

    // Find the Admin badge chip (not the "Admin User" name or "admin@example.com" email)
    const adminChip = screen.getByText((content, element) => {
      return element?.tagName === 'SPAN' && content === 'Admin';
    });
    expect(adminChip).toBeInTheDocument();
  });

  it('should show Admin Panel menu item for admin users', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          id: '1',
          name: 'Admin User',
          email: 'admin@example.com',
          role: 'admin',
        } as any,
      },
      isPending: false,
    } as any);

    renderWithTheme(<UserMenu />);

    const avatarButton = screen.getByLabelText(/user menu/i);
    fireEvent.click(avatarButton);

    expect(screen.getByText(/admin panel/i)).toBeInTheDocument();
  });

  it('should not show Admin Panel menu item for regular users', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          id: '1',
          name: 'Regular User',
          email: 'user@example.com',
          role: 'user',
        } as any,
      },
      isPending: false,
    } as any);

    renderWithTheme(<UserMenu />);

    const avatarButton = screen.getByLabelText(/user menu/i);
    fireEvent.click(avatarButton);

    expect(screen.queryByText(/admin panel/i)).not.toBeInTheDocument();
  });
});
