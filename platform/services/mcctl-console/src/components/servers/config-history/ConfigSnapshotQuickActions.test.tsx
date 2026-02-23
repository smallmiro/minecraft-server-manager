import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { ConfigSnapshotQuickActions } from './ConfigSnapshotQuickActions';
import type { ConfigSnapshotItem } from '@/ports/api/IMcctlApiClient';

const renderWithTheme = (component: React.ReactNode) =>
  render(<ThemeProvider>{component}</ThemeProvider>);

const snapshot: ConfigSnapshotItem = {
  id: 'snap-1',
  serverName: 'test-server',
  createdAt: '2026-02-22T14:30:00.000Z',
  description: 'Test snapshot',
  files: [{ path: 'server.properties', hash: 'abc', size: 100 }],
};

describe('ConfigSnapshotQuickActions', () => {
  const onViewDiff = vi.fn();
  const onRestore = vi.fn();
  const onDelete = vi.fn();
  const onToggleCompareSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normal mode', () => {
    it('shows View Diff button when has predecessor', () => {
      renderWithTheme(
        <ConfigSnapshotQuickActions
          snapshot={snapshot}
          compareMode={false}
          isSelectedForCompare={false}
          hasPredecessor={true}
          onViewDiff={onViewDiff}
          onRestore={onRestore}
          onDelete={onDelete}
          onToggleCompareSelect={onToggleCompareSelect}
        />
      );

      expect(screen.getByRole('button', { name: /view diff/i })).toBeInTheDocument();
    });

    it('does not show View Diff button when no predecessor', () => {
      renderWithTheme(
        <ConfigSnapshotQuickActions
          snapshot={snapshot}
          compareMode={false}
          isSelectedForCompare={false}
          hasPredecessor={false}
          onViewDiff={onViewDiff}
          onRestore={onRestore}
          onDelete={onDelete}
          onToggleCompareSelect={onToggleCompareSelect}
        />
      );

      expect(screen.queryByRole('button', { name: /view diff/i })).not.toBeInTheDocument();
    });

    it('calls onViewDiff when View Diff clicked', () => {
      renderWithTheme(
        <ConfigSnapshotQuickActions
          snapshot={snapshot}
          compareMode={false}
          isSelectedForCompare={false}
          hasPredecessor={true}
          onViewDiff={onViewDiff}
          onRestore={onRestore}
          onDelete={onDelete}
          onToggleCompareSelect={onToggleCompareSelect}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /view diff/i }));
      expect(onViewDiff).toHaveBeenCalledWith(snapshot);
    });

    it('calls onRestore when Restore clicked', () => {
      renderWithTheme(
        <ConfigSnapshotQuickActions
          snapshot={snapshot}
          compareMode={false}
          isSelectedForCompare={false}
          hasPredecessor={false}
          onViewDiff={onViewDiff}
          onRestore={onRestore}
          onDelete={onDelete}
          onToggleCompareSelect={onToggleCompareSelect}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /restore snapshot/i }));
      expect(onRestore).toHaveBeenCalledWith(snapshot);
    });

    it('requires double click to delete (confirm pattern)', () => {
      renderWithTheme(
        <ConfigSnapshotQuickActions
          snapshot={snapshot}
          compareMode={false}
          isSelectedForCompare={false}
          hasPredecessor={false}
          onViewDiff={onViewDiff}
          onRestore={onRestore}
          onDelete={onDelete}
          onToggleCompareSelect={onToggleCompareSelect}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete snapshot/i });
      // First click — should show confirm
      fireEvent.click(deleteButton);
      expect(onDelete).not.toHaveBeenCalled();

      // Confirm button should now appear
      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      fireEvent.click(confirmButton);
      expect(onDelete).toHaveBeenCalledWith(snapshot);
    });
  });

  describe('compare mode', () => {
    it('shows checkbox icon in compare mode', () => {
      renderWithTheme(
        <ConfigSnapshotQuickActions
          snapshot={snapshot}
          compareMode={true}
          isSelectedForCompare={false}
          hasPredecessor={true}
          onViewDiff={onViewDiff}
          onRestore={onRestore}
          onDelete={onDelete}
          onToggleCompareSelect={onToggleCompareSelect}
        />
      );

      expect(
        screen.getByRole('button', { name: /select for comparison/i })
      ).toBeInTheDocument();
    });

    it('shows checked icon when selected for compare', () => {
      renderWithTheme(
        <ConfigSnapshotQuickActions
          snapshot={snapshot}
          compareMode={true}
          isSelectedForCompare={true}
          hasPredecessor={true}
          onViewDiff={onViewDiff}
          onRestore={onRestore}
          onDelete={onDelete}
          onToggleCompareSelect={onToggleCompareSelect}
        />
      );

      expect(
        screen.getByRole('button', { name: /remove from comparison/i })
      ).toBeInTheDocument();
    });

    it('calls onToggleCompareSelect in compare mode', () => {
      renderWithTheme(
        <ConfigSnapshotQuickActions
          snapshot={snapshot}
          compareMode={true}
          isSelectedForCompare={false}
          hasPredecessor={true}
          onViewDiff={onViewDiff}
          onRestore={onRestore}
          onDelete={onDelete}
          onToggleCompareSelect={onToggleCompareSelect}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /select for comparison/i }));
      expect(onToggleCompareSelect).toHaveBeenCalledWith(snapshot);
    });
  });
});
