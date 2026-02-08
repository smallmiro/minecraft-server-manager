import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { UserList } from './UserList';
import type { User } from '@/hooks/use-admin-users';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('UserList', () => {
  it('should render empty state when no users', () => {
    renderWithTheme(<UserList users={[]} onUserClick={vi.fn()} />);

    expect(screen.getByText(/no users found/i)).toBeInTheDocument();
  });

  it('should render user list with correct data', () => {
    const mockUsers: User[] = [
      {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        banned: false,
        createdAt: new Date('2024-01-01'),
      },
      {
        id: '2',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'user',
        banned: false,
        createdAt: new Date('2024-01-02'),
      },
    ];

    renderWithTheme(<UserList users={mockUsers} onUserClick={vi.fn()} />);

    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('Regular User')).toBeInTheDocument();
  });

  it('should display admin badge for admin users', () => {
    const mockUsers: User[] = [
      {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        banned: false,
        createdAt: new Date('2024-01-01'),
      },
    ];

    renderWithTheme(<UserList users={mockUsers} onUserClick={vi.fn()} />);

    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('should display banned badge for banned users', () => {
    const mockUsers: User[] = [
      {
        id: '1',
        email: 'banned@example.com',
        name: 'Banned User',
        role: 'user',
        banned: true,
        createdAt: new Date('2024-01-01'),
      },
    ];

    renderWithTheme(<UserList users={mockUsers} onUserClick={vi.fn()} />);

    expect(screen.getByText('Banned')).toBeInTheDocument();
  });

  it('should call onUserClick when row is clicked', () => {
    const mockUsers: User[] = [
      {
        id: '1',
        email: 'user@example.com',
        name: 'Test User',
        role: 'user',
        banned: false,
        createdAt: new Date('2024-01-01'),
      },
    ];

    const onUserClick = vi.fn();
    renderWithTheme(<UserList users={mockUsers} onUserClick={onUserClick} />);

    const row = screen.getByRole('row', { name: /user@example.com/i });
    row.click();

    expect(onUserClick).toHaveBeenCalledWith(mockUsers[0]);
  });

  it('should display N/A when user has no name', () => {
    const mockUsers: User[] = [
      {
        id: '1',
        email: 'noname@example.com',
        name: null,
        role: 'user',
        banned: false,
        createdAt: new Date('2024-01-01'),
      },
    ];

    renderWithTheme(<UserList users={mockUsers} onUserClick={vi.fn()} />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});
