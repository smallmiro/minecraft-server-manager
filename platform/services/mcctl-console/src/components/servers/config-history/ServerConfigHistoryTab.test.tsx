import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { ThemeProvider } from '@/theme';
import { ServerConfigHistoryTab } from './ServerConfigHistoryTab';
import type { ConfigSnapshotItem } from '@/ports/api/IMcctlApiClient';

// Mock hooks
vi.mock('@/hooks/useServerConfigSnapshots', () => ({
  useServerConfigSnapshots: vi.fn(),
}));

vi.mock('@/hooks/useDeleteConfigSnapshot', () => ({
  useDeleteConfigSnapshot: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

// Mock dialog components to simplify testing
vi.mock('@/components/backups/CreateSnapshotDialog', () => ({
  CreateSnapshotDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? createElement('div', { 'data-testid': 'create-snapshot-dialog' }, createElement('button', { onClick: onClose }, 'Close')) : null,
}));

vi.mock('@/components/backups/diff', () => ({
  ConfigDiffDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? createElement('div', { 'data-testid': 'diff-dialog' }, createElement('button', { onClick: onClose }, 'Close')) : null,
}));

vi.mock('@/components/backups/restore', () => ({
  ConfigRestoreDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? createElement('div', { 'data-testid': 'restore-dialog' }, createElement('button', { onClick: onClose }, 'Close')) : null,
}));

import { useServerConfigSnapshots } from '@/hooks/useServerConfigSnapshots';
const mockUseServerConfigSnapshots = vi.mocked(useServerConfigSnapshots);

const snapshots: ConfigSnapshotItem[] = [
  {
    id: 'snap-1',
    serverName: 'test-server',
    createdAt: '2026-02-22T14:30:00.000Z',
    description: 'Before mod update',
    files: [{ path: 'server.properties', hash: 'abc', size: 100 }],
  },
  {
    id: 'snap-2',
    serverName: 'test-server',
    createdAt: '2026-02-21T03:00:00.000Z',
    description: 'Scheduled: Daily backup',
    files: [{ path: 'server.properties', hash: 'abc', size: 100 }],
    scheduleId: 'sched-1',
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ThemeProvider, null, children)
    );
  }
  return Wrapper;
}

const renderComponent = (props = {}) =>
  render(
    <ServerConfigHistoryTab serverName="test-server" {...props} />,
    { wrapper: createWrapper() }
  );

describe('ServerConfigHistoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    mockUseServerConfigSnapshots.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      isSuccess: false,
    } as never);

    renderComponent();

    expect(screen.getByText('Loading config history...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseServerConfigSnapshots.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network failure'),
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      isSuccess: false,
    } as never);

    renderComponent();

    expect(screen.getByText(/Failed to load config history/i)).toBeInTheDocument();
    expect(screen.getByText(/Network failure/i)).toBeInTheDocument();
  });

  it('shows empty state when no snapshots', () => {
    mockUseServerConfigSnapshots.mockReturnValue({
      data: { pages: [{ snapshots: [], total: 0 }], pageParams: [0] },
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      isSuccess: true,
    } as never);

    renderComponent();

    expect(screen.getByText('No config snapshots yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create first snapshot/i })).toBeInTheDocument();
  });

  it('shows Config History heading and Create Snapshot button', () => {
    mockUseServerConfigSnapshots.mockReturnValue({
      data: { pages: [{ snapshots, total: 2 }], pageParams: [0] },
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      isSuccess: true,
    } as never);

    renderComponent();

    expect(screen.getByText('Config History')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create snapshot/i })).toBeInTheDocument();
  });

  it('shows snapshot descriptions in timeline', () => {
    mockUseServerConfigSnapshots.mockReturnValue({
      data: { pages: [{ snapshots, total: 2 }], pageParams: [0] },
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      isSuccess: true,
    } as never);

    renderComponent();

    expect(screen.getByText('Before mod update')).toBeInTheDocument();
    expect(screen.getByText('Scheduled: Daily backup')).toBeInTheDocument();
  });

  it('opens Create Snapshot dialog when button clicked', async () => {
    mockUseServerConfigSnapshots.mockReturnValue({
      data: { pages: [{ snapshots, total: 2 }], pageParams: [0] },
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      isSuccess: true,
    } as never);

    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /create snapshot/i }));

    await waitFor(() => {
      expect(screen.getByTestId('create-snapshot-dialog')).toBeInTheDocument();
    });
  });

  it('shows Compare button when at least 2 snapshots exist', () => {
    mockUseServerConfigSnapshots.mockReturnValue({
      data: { pages: [{ snapshots, total: 2 }], pageParams: [0] },
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      isSuccess: true,
    } as never);

    renderComponent();

    expect(screen.getByRole('button', { name: /compare/i })).toBeInTheDocument();
  });

  it('hides Compare button when only 1 snapshot exists', () => {
    mockUseServerConfigSnapshots.mockReturnValue({
      data: { pages: [{ snapshots: [snapshots[0]], total: 1 }], pageParams: [0] },
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      isSuccess: true,
    } as never);

    renderComponent();

    expect(screen.queryByRole('button', { name: /^compare$/i })).not.toBeInTheDocument();
  });

  it('enters compare mode when Compare button clicked', async () => {
    mockUseServerConfigSnapshots.mockReturnValue({
      data: { pages: [{ snapshots, total: 2 }], pageParams: [0] },
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      isSuccess: true,
    } as never);

    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /compare/i }));

    await waitFor(() => {
      expect(screen.getByText('Compare mode')).toBeInTheDocument();
    });
  });

  it('exits compare mode when Cancel clicked', async () => {
    mockUseServerConfigSnapshots.mockReturnValue({
      data: { pages: [{ snapshots, total: 2 }], pageParams: [0] },
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      isSuccess: true,
    } as never);

    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /compare/i }));
    await waitFor(() => expect(screen.getByText('Compare mode')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText('Compare mode')).not.toBeInTheDocument();
    });
  });

  it('renders without crash when page.snapshots is undefined', () => {
    mockUseServerConfigSnapshots.mockReturnValue({
      data: {
        pages: [{ total: 0 } as never],
        pageParams: [0],
      },
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      isSuccess: true,
    } as never);

    // Should not throw TypeError
    renderComponent();

    expect(screen.getByText('No config snapshots yet')).toBeInTheDocument();
  });

  it('renders empty state when pages contain mixed undefined snapshots', () => {
    mockUseServerConfigSnapshots.mockReturnValue({
      data: {
        pages: [
          { snapshots: undefined, total: 0 } as never,
          { total: 0 } as never,
        ],
        pageParams: [0, 10],
      },
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      isSuccess: true,
    } as never);

    // Should not throw TypeError from flatMap
    renderComponent();

    expect(screen.getByText('No config snapshots yet')).toBeInTheDocument();
  });
});
