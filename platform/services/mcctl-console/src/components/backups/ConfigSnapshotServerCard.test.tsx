import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { ConfigSnapshotServerCard } from './ConfigSnapshotServerCard';
import type { ConfigSnapshotItem } from '@/ports/api/IMcctlApiClient';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

const createMockSnapshot = (id: string, createdAt: string): ConfigSnapshotItem => ({
  id,
  serverName: 'test-server',
  createdAt,
  trigger: 'manual' as const,
  files: [
    { path: 'server.properties', contentHash: 'abc123' },
  ],
});

describe('ConfigSnapshotServerCard', () => {
  const defaultProps = {
    serverName: 'test-server',
    snapshots: [] as ConfigSnapshotItem[],
    totalCount: 0,
    onViewHistory: vi.fn(),
    onCreateSnapshot: vi.fn(),
    onViewDiff: vi.fn(),
  };

  it('should render server name', () => {
    renderWithTheme(<ConfigSnapshotServerCard {...defaultProps} />);
    expect(screen.getByText('test-server')).toBeInTheDocument();
  });

  it('should render "No snapshots yet" when no snapshots exist', () => {
    renderWithTheme(<ConfigSnapshotServerCard {...defaultProps} />);
    expect(screen.getByText('No snapshots yet')).toBeInTheDocument();
  });

  it('should render total count chip', () => {
    renderWithTheme(<ConfigSnapshotServerCard {...defaultProps} totalCount={3} />);
    expect(screen.getByText('3 snapshots total')).toBeInTheDocument();
  });

  describe('View History button - disabled conditions (#432)', () => {
    it('should disable View History button when totalCount is 0', () => {
      renderWithTheme(
        <ConfigSnapshotServerCard {...defaultProps} totalCount={0} />
      );
      const button = screen.getByRole('button', { name: /View History/i });
      expect(button).toBeDisabled();
    });

    it('should disable View History button when totalCount is 1 (less than 2)', () => {
      const oneSnapshot = [createMockSnapshot('snap-1', new Date().toISOString())];
      renderWithTheme(
        <ConfigSnapshotServerCard
          {...defaultProps}
          snapshots={oneSnapshot}
          totalCount={1}
        />
      );
      const button = screen.getByRole('button', { name: /View History/i });
      expect(button).toBeDisabled();
    });

    it('should enable View History button when totalCount is 2 or more', () => {
      const twoSnapshots = [
        createMockSnapshot('snap-2', new Date().toISOString()),
        createMockSnapshot('snap-1', new Date(Date.now() - 3600000).toISOString()),
      ];
      renderWithTheme(
        <ConfigSnapshotServerCard
          {...defaultProps}
          snapshots={twoSnapshots}
          totalCount={2}
        />
      );
      const button = screen.getByRole('button', { name: /View History/i });
      expect(button).not.toBeDisabled();
    });

    it('should show tooltip on disabled View History button explaining minimum requirement', async () => {
      const oneSnapshot = [createMockSnapshot('snap-1', new Date().toISOString())];
      renderWithTheme(
        <ConfigSnapshotServerCard
          {...defaultProps}
          snapshots={oneSnapshot}
          totalCount={1}
        />
      );
      // Hover over the disabled button's wrapper span to trigger MUI Tooltip
      const button = screen.getByRole('button', { name: /View History/i });
      fireEvent.mouseOver(button.parentElement!);
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent(/at least 2 snapshots/i);
      });
    });

    it('should call onViewHistory when View History button is clicked with sufficient snapshots', () => {
      const twoSnapshots = [
        createMockSnapshot('snap-2', new Date().toISOString()),
        createMockSnapshot('snap-1', new Date(Date.now() - 3600000).toISOString()),
      ];
      const onViewHistory = vi.fn();
      renderWithTheme(
        <ConfigSnapshotServerCard
          {...defaultProps}
          snapshots={twoSnapshots}
          totalCount={2}
          onViewHistory={onViewHistory}
        />
      );
      const button = screen.getByRole('button', { name: /View History/i });
      fireEvent.click(button);
      expect(onViewHistory).toHaveBeenCalledWith('test-server');
    });
  });

  it('should render Create Snapshot button always enabled', () => {
    renderWithTheme(<ConfigSnapshotServerCard {...defaultProps} />);
    const button = screen.getByRole('button', { name: /Create Snapshot/i });
    expect(button).not.toBeDisabled();
  });

  it('should show View Diff button only when 2+ snapshots available', () => {
    const twoSnapshots = [
      createMockSnapshot('snap-2', new Date().toISOString()),
      createMockSnapshot('snap-1', new Date(Date.now() - 3600000).toISOString()),
    ];
    renderWithTheme(
      <ConfigSnapshotServerCard
        {...defaultProps}
        snapshots={twoSnapshots}
        totalCount={2}
      />
    );
    expect(screen.getByRole('button', { name: /View Diff/i })).toBeInTheDocument();
  });

  it('should not show View Diff button when less than 2 snapshots', () => {
    renderWithTheme(<ConfigSnapshotServerCard {...defaultProps} totalCount={1} />);
    expect(screen.queryByRole('button', { name: /View Diff/i })).not.toBeInTheDocument();
  });
});
