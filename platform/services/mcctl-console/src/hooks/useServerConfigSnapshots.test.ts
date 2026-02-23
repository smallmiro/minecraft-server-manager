import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useServerConfigSnapshots } from './useServerConfigSnapshots';
import type { ConfigSnapshotListResponse } from '@/ports/api/IMcctlApiClient';

// Mock apiFetch
vi.mock('./useApi', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from './useApi';
const mockApiFetch = vi.mocked(apiFetch);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
}

const mockPage1: ConfigSnapshotListResponse = {
  snapshots: [
    {
      id: 'snap-1',
      serverName: 'test-server',
      createdAt: '2026-02-22T14:30:00.000Z',
      description: 'Before mod update',
      files: [
        { path: 'server.properties', hash: 'abc123', size: 1024 },
        { path: 'config.env', hash: 'def456', size: 512 },
      ],
    },
    {
      id: 'snap-2',
      serverName: 'test-server',
      createdAt: '2026-02-21T03:00:00.000Z',
      description: 'Scheduled: Daily backup',
      files: [{ path: 'server.properties', hash: 'abc123', size: 1024 }],
      scheduleId: 'sched-1',
    },
  ],
  total: 3,
};

describe('useServerConfigSnapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches snapshots for a server', async () => {
    mockApiFetch.mockResolvedValue(mockPage1);

    const { result } = renderHook(() => useServerConfigSnapshots('test-server'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages[0].snapshots).toHaveLength(2);
    expect(result.current.data?.pages[0].total).toBe(3);
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/servers/test-server/config-snapshots?limit=10&offset=0'
    );
  });

  it('encodes server name in URL', async () => {
    mockApiFetch.mockResolvedValue({ snapshots: [], total: 0 });

    renderHook(() => useServerConfigSnapshots('my server/test'), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/servers/my%20server%2Ftest/config-snapshots?limit=10&offset=0'
      )
    );
  });

  it('does not fetch when serverName is empty', () => {
    mockApiFetch.mockResolvedValue({ snapshots: [], total: 0 });

    const { result } = renderHook(() => useServerConfigSnapshots(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('does not fetch when disabled via options', () => {
    mockApiFetch.mockResolvedValue({ snapshots: [], total: 0 });

    const { result } = renderHook(
      () => useServerConfigSnapshots('test-server', { enabled: false }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('hasNextPage is true when there are more snapshots', async () => {
    mockApiFetch.mockResolvedValue(mockPage1); // 2 snapshots, total=3

    const { result } = renderHook(() => useServerConfigSnapshots('test-server'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.hasNextPage).toBe(true);
  });

  it('hasNextPage is false when all snapshots are loaded', async () => {
    const allLoaded: ConfigSnapshotListResponse = {
      snapshots: mockPage1.snapshots,
      total: 2, // total equals fetched count
    };
    mockApiFetch.mockResolvedValue(allLoaded);

    const { result } = renderHook(() => useServerConfigSnapshots('test-server'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.hasNextPage).toBe(false);
  });

  it('handles API errors gracefully', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useServerConfigSnapshots('test-server'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Network error');
  });
});
