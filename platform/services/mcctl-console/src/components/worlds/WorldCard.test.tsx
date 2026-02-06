import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { WorldCard } from './WorldCard';
import type { World } from '@/ports/api/IMcctlApiClient';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

const mockAvailableWorld: World = {
  name: 'survival-world',
  path: '/worlds/survival-world',
  isLocked: false,
  size: '256 MB',
  lastModified: '2025-01-15T10:30:00Z',
};

const mockLockedWorld: World = {
  name: 'creative-world',
  path: '/worlds/creative-world',
  isLocked: true,
  lockedBy: 'paper-server',
  size: '512 MB',
  lastModified: '2025-01-20T14:00:00Z',
};

describe('WorldCard', () => {
  it('should render world name', () => {
    renderWithTheme(<WorldCard world={mockAvailableWorld} />);
    expect(screen.getByText('survival-world')).toBeInTheDocument();
  });

  it('should render world size', () => {
    renderWithTheme(<WorldCard world={mockAvailableWorld} />);
    expect(screen.getByText('256 MB')).toBeInTheDocument();
  });

  it('should display Available status for unlocked world', () => {
    renderWithTheme(<WorldCard world={mockAvailableWorld} />);
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('should display Locked status for locked world', () => {
    renderWithTheme(<WorldCard world={mockLockedWorld} />);
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('should display locked by server name', () => {
    renderWithTheme(<WorldCard world={mockLockedWorld} />);
    expect(screen.getByText('paper-server')).toBeInTheDocument();
  });

  it('should show assign button for available world', () => {
    renderWithTheme(<WorldCard world={mockAvailableWorld} onAssign={vi.fn()} />);
    expect(screen.getByLabelText('Assign world')).toBeInTheDocument();
  });

  it('should not show assign button for locked world', () => {
    renderWithTheme(<WorldCard world={mockLockedWorld} onAssign={vi.fn()} />);
    expect(screen.queryByLabelText('Assign world')).not.toBeInTheDocument();
  });

  it('should show release button for locked world', () => {
    renderWithTheme(<WorldCard world={mockLockedWorld} onRelease={vi.fn()} />);
    expect(screen.getByLabelText('Release world')).toBeInTheDocument();
  });

  it('should not show release button for available world', () => {
    renderWithTheme(<WorldCard world={mockAvailableWorld} onRelease={vi.fn()} />);
    expect(screen.queryByLabelText('Release world')).not.toBeInTheDocument();
  });

  it('should show delete button', () => {
    renderWithTheme(<WorldCard world={mockAvailableWorld} onDelete={vi.fn()} />);
    expect(screen.getByLabelText('Delete world')).toBeInTheDocument();
  });

  it('should call onAssign when assign button is clicked', () => {
    const onAssign = vi.fn();
    renderWithTheme(<WorldCard world={mockAvailableWorld} onAssign={onAssign} />);

    const assignButton = screen.getByLabelText('Assign world');
    fireEvent.click(assignButton);

    expect(onAssign).toHaveBeenCalledTimes(1);
    expect(onAssign).toHaveBeenCalledWith('survival-world');
  });

  it('should call onRelease when release button is clicked', () => {
    const onRelease = vi.fn();
    renderWithTheme(<WorldCard world={mockLockedWorld} onRelease={onRelease} />);

    const releaseButton = screen.getByLabelText('Release world');
    fireEvent.click(releaseButton);

    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(onRelease).toHaveBeenCalledWith('creative-world');
  });

  it('should call onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    renderWithTheme(<WorldCard world={mockAvailableWorld} onDelete={onDelete} />);

    const deleteButton = screen.getByLabelText('Delete world');
    fireEvent.click(deleteButton);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('survival-world');
  });

  it('should disable buttons when loading', () => {
    renderWithTheme(
      <WorldCard
        world={mockAvailableWorld}
        onAssign={vi.fn()}
        onDelete={vi.fn()}
        loading={true}
      />
    );

    expect(screen.getByLabelText('Assign world')).toBeDisabled();
    expect(screen.getByLabelText('Delete world')).toBeDisabled();
  });

  it('should show Unknown size when size is not provided', () => {
    const worldNoSize: World = { ...mockAvailableWorld, size: undefined };
    renderWithTheme(<WorldCard world={worldNoSize} />);
    expect(screen.getByText('Unknown size')).toBeInTheDocument();
  });
});
