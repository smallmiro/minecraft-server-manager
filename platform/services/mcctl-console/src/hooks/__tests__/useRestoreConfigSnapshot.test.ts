import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useRestoreConfigSnapshot } from '../useRestoreConfigSnapshot';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useRestoreConfigSnapshot', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should restore a config snapshot successfully', async () => {
    const mockResponse = {
      restored: {
        id: 'snap-1',
        serverName: 'survival',
        createdAt: '2026-02-20T03:00:00Z',
        description: 'Before game update',
        files: [],
      },
      safetySnapshot: {
        id: 'snap-safety',
        serverName: 'survival',
        createdAt: '2026-02-22T14:30:00Z',
        description: 'Safety snapshot before restoring snap-1',
        files: [],
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const { result } = renderHook(
      () => useRestoreConfigSnapshot(),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      result.current.mutate({
        serverName: 'survival',
        snapshotId: 'snap-1',
        options: { createSnapshotBeforeRestore: true },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/servers/survival/config-snapshots/snap-1/restore'),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('should handle restore error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          error: 'Conflict',
          message: 'Server is currently running',
        }),
    });

    const { result } = renderHook(
      () => useRestoreConfigSnapshot(),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      result.current.mutate({
        serverName: 'survival',
        snapshotId: 'snap-1',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('should pass force option when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          restored: {
            id: 'snap-1',
            serverName: 'survival',
            createdAt: '2026-02-20T03:00:00Z',
            description: '',
            files: [],
          },
        }),
    });

    const { result } = renderHook(
      () => useRestoreConfigSnapshot(),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      result.current.mutate({
        serverName: 'survival',
        snapshotId: 'snap-1',
        options: { force: true, createSnapshotBeforeRestore: false },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.force).toBe(true);
    expect(callBody.createSnapshotBeforeRestore).toBe(false);
  });
});
