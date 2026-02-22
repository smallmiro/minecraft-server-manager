import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useConfigSnapshotDiff } from '../useConfigSnapshotDiff';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useConfigSnapshotDiff', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should fetch diff between two snapshots', async () => {
    const mockDiff = {
      baseSnapshotId: 'snap-1',
      compareSnapshotId: 'snap-2',
      changes: [
        {
          path: 'server.properties',
          status: 'modified',
          oldContent: 'max-players=20',
          newContent: 'max-players=50',
        },
      ],
      summary: { added: 0, modified: 1, deleted: 0 },
      hasChanges: true,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDiff),
    });

    const { result } = renderHook(
      () => useConfigSnapshotDiff('snap-1', 'snap-2'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockDiff);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/config-snapshots/snap-1/diff/snap-2'),
      expect.any(Object)
    );
  });

  it('should not fetch when snapshotId1 is empty', async () => {
    const { result } = renderHook(
      () => useConfigSnapshotDiff('', 'snap-2'),
      { wrapper: createWrapper() }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should not fetch when snapshotId2 is empty', async () => {
    const { result } = renderHook(
      () => useConfigSnapshotDiff('snap-1', ''),
      { wrapper: createWrapper() }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle error state', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'NotFound', message: 'Snapshot not found' }),
    });

    const { result } = renderHook(
      () => useConfigSnapshotDiff('snap-1', 'snap-2'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
