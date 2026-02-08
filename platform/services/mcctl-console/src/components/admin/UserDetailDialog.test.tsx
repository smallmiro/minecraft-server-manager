import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { UserDetailDialog } from './UserDetailDialog';
import type { User } from '@/hooks/use-admin-users';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('UserDetailDialog', () => {
  const mockUser: User = {
    id: '1',
    email: 'user@example.com',
    name: 'Test User',
    role: 'user',
    banned: false,
    createdAt: new Date('2024-01-01'),
  };

  it('should not render when open is false', () => {
    renderWithTheme(
      <UserDetailDialog user={mockUser} open={false} onClose={vi.fn()} />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render when open is true', () => {
    renderWithTheme(
      <UserDetailDialog user={mockUser} open={true} onClose={vi.fn()} />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should display user information', () => {
    renderWithTheme(
      <UserDetailDialog user={mockUser} open={true} onClose={vi.fn()} />
    );

    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    renderWithTheme(
      <UserDetailDialog user={mockUser} open={true} onClose={onClose} />
    );

    const closeButton = screen.getByLabelText('close');
    closeButton.click();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
