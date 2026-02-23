import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { ConfigSnapshotCompareBar } from './ConfigSnapshotCompareBar';
import type { ConfigSnapshotItem } from '@/ports/api/IMcctlApiClient';

const renderWithTheme = (component: React.ReactNode) =>
  render(<ThemeProvider>{component}</ThemeProvider>);

const makeSnapshot = (id: string, createdAt: string): ConfigSnapshotItem => ({
  id,
  serverName: 'test-server',
  createdAt,
  description: `Snapshot ${id}`,
  files: [],
});

describe('ConfigSnapshotCompareBar', () => {
  const onCompare = vi.fn();
  const onCancelCompare = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows instructions when no snapshots selected', () => {
    renderWithTheme(
      <ConfigSnapshotCompareBar
        selectedSnapshots={[]}
        onCompare={onCompare}
        onCancelCompare={onCancelCompare}
      />
    );

    expect(screen.getByText('Compare mode')).toBeInTheDocument();
    expect(screen.getByText('Select two snapshots to compare')).toBeInTheDocument();
  });

  it('View Diff button is disabled when fewer than 2 snapshots selected', () => {
    const snap = makeSnapshot('a', '2026-02-22T14:30:00.000Z');

    renderWithTheme(
      <ConfigSnapshotCompareBar
        selectedSnapshots={[snap]}
        onCompare={onCompare}
        onCancelCompare={onCancelCompare}
      />
    );

    const viewDiffButton = screen.getByRole('button', { name: /view diff/i });
    expect(viewDiffButton).toBeDisabled();
  });

  it('View Diff button is enabled when 2 snapshots selected', () => {
    const snapA = makeSnapshot('a', '2026-02-21T03:00:00.000Z');
    const snapB = makeSnapshot('b', '2026-02-22T14:30:00.000Z');

    renderWithTheme(
      <ConfigSnapshotCompareBar
        selectedSnapshots={[snapA, snapB]}
        onCompare={onCompare}
        onCancelCompare={onCancelCompare}
      />
    );

    const viewDiffButton = screen.getByRole('button', { name: /view diff/i });
    expect(viewDiffButton).not.toBeDisabled();
  });

  it('calls onCompare when View Diff clicked with 2 selected', () => {
    const snapA = makeSnapshot('a', '2026-02-21T03:00:00.000Z');
    const snapB = makeSnapshot('b', '2026-02-22T14:30:00.000Z');

    renderWithTheme(
      <ConfigSnapshotCompareBar
        selectedSnapshots={[snapA, snapB]}
        onCompare={onCompare}
        onCancelCompare={onCancelCompare}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /view diff/i }));
    expect(onCompare).toHaveBeenCalledOnce();
  });

  it('calls onCancelCompare when Cancel clicked', () => {
    renderWithTheme(
      <ConfigSnapshotCompareBar
        selectedSnapshots={[]}
        onCompare={onCompare}
        onCancelCompare={onCancelCompare}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancelCompare).toHaveBeenCalledOnce();
  });

  it('shows IDs of both selected snapshots', () => {
    const snapA = makeSnapshot('abcdefgh-1234', '2026-02-21T03:00:00.000Z');
    const snapB = makeSnapshot('xyzwvuts-9876', '2026-02-22T14:30:00.000Z');

    renderWithTheme(
      <ConfigSnapshotCompareBar
        selectedSnapshots={[snapA, snapB]}
        onCompare={onCompare}
        onCancelCompare={onCancelCompare}
      />
    );

    // Short IDs (first 8 chars) should appear
    expect(screen.getByText(/abcdefgh/)).toBeInTheDocument();
    expect(screen.getByText(/xyzwvuts/)).toBeInTheDocument();
  });
});
