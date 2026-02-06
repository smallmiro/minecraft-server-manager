import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { WorldList } from './WorldList';
import type { World } from '@/ports/api/IMcctlApiClient';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

const mockWorlds: World[] = [
  {
    name: 'survival-world',
    path: '/worlds/survival-world',
    isLocked: false,
    size: '256 MB',
    lastModified: '2025-01-15T10:30:00Z',
  },
  {
    name: 'creative-world',
    path: '/worlds/creative-world',
    isLocked: true,
    lockedBy: 'paper-server',
    size: '512 MB',
    lastModified: '2025-01-20T14:00:00Z',
  },
  {
    name: 'adventure-world',
    path: '/worlds/adventure-world',
    isLocked: false,
    size: '128 MB',
    lastModified: '2025-01-10T08:00:00Z',
  },
];

describe('WorldList', () => {
  it('should render all worlds in grid layout', () => {
    renderWithTheme(<WorldList worlds={mockWorlds} />);

    expect(screen.getByText('survival-world')).toBeInTheDocument();
    expect(screen.getByText('creative-world')).toBeInTheDocument();
    expect(screen.getByText('adventure-world')).toBeInTheDocument();
  });

  it('should render empty state when no worlds', () => {
    renderWithTheme(<WorldList worlds={[]} />);

    expect(screen.getByText(/no worlds found/i)).toBeInTheDocument();
  });

  it('should show create button in empty state', () => {
    const onCreate = vi.fn();
    renderWithTheme(<WorldList worlds={[]} onCreate={onCreate} />);

    const createButton = screen.getByRole('button', { name: /create world/i });
    expect(createButton).toBeInTheDocument();

    fireEvent.click(createButton);
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('should filter worlds by available status', () => {
    renderWithTheme(<WorldList worlds={mockWorlds} />);

    const availableFilter = screen.getByRole('button', { name: /available/i });
    fireEvent.click(availableFilter);

    expect(screen.getByText('survival-world')).toBeInTheDocument();
    expect(screen.getByText('adventure-world')).toBeInTheDocument();
    expect(screen.queryByText('creative-world')).not.toBeInTheDocument();
  });

  it('should filter worlds by locked status', () => {
    renderWithTheme(<WorldList worlds={mockWorlds} />);

    const lockedFilter = screen.getByRole('button', { name: /locked/i });
    fireEvent.click(lockedFilter);

    expect(screen.getByText('creative-world')).toBeInTheDocument();
    expect(screen.queryByText('survival-world')).not.toBeInTheDocument();
    expect(screen.queryByText('adventure-world')).not.toBeInTheDocument();
  });

  it('should search worlds by name', () => {
    renderWithTheme(<WorldList worlds={mockWorlds} />);

    const searchInput = screen.getByPlaceholderText(/search worlds/i);
    fireEvent.change(searchInput, { target: { value: 'survival' } });

    expect(screen.getByText('survival-world')).toBeInTheDocument();
    expect(screen.queryByText('creative-world')).not.toBeInTheDocument();
    expect(screen.queryByText('adventure-world')).not.toBeInTheDocument();
  });

  it('should search worlds case-insensitively', () => {
    renderWithTheme(<WorldList worlds={mockWorlds} />);

    const searchInput = screen.getByPlaceholderText(/search worlds/i);
    fireEvent.change(searchInput, { target: { value: 'CREATIVE' } });

    expect(screen.getByText('creative-world')).toBeInTheDocument();
    expect(screen.queryByText('survival-world')).not.toBeInTheDocument();
  });

  it('should show empty state when search has no results', () => {
    renderWithTheme(<WorldList worlds={mockWorlds} />);

    const searchInput = screen.getByPlaceholderText(/search worlds/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText(/no worlds found/i)).toBeInTheDocument();
  });

  it('should combine search and filter', () => {
    renderWithTheme(<WorldList worlds={mockWorlds} />);

    // Filter by available
    const availableFilter = screen.getByRole('button', { name: /available/i });
    fireEvent.click(availableFilter);

    // Then search for "adventure"
    const searchInput = screen.getByPlaceholderText(/search worlds/i);
    fireEvent.change(searchInput, { target: { value: 'adventure' } });

    expect(screen.getByText('adventure-world')).toBeInTheDocument();
    expect(screen.queryByText('survival-world')).not.toBeInTheDocument();
    expect(screen.queryByText('creative-world')).not.toBeInTheDocument();
  });

  it('should display world count', () => {
    renderWithTheme(<WorldList worlds={mockWorlds} />);

    expect(screen.getByText(/3 worlds/i)).toBeInTheDocument();
  });

  it('should update count when filtering', () => {
    renderWithTheme(<WorldList worlds={mockWorlds} />);

    const availableFilter = screen.getByRole('button', { name: /available/i });
    fireEvent.click(availableFilter);

    expect(screen.getByText(/2 worlds/i)).toBeInTheDocument();
  });

  it('should use singular "world" for count of 1', () => {
    renderWithTheme(<WorldList worlds={mockWorlds} />);

    const lockedFilter = screen.getByRole('button', { name: /locked/i });
    fireEvent.click(lockedFilter);

    expect(screen.getByText(/1 world$/i)).toBeInTheDocument();
  });
});
