import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useDeleteConfigSnapshot } from './useDeleteConfigSnapshot';

// Mock apiFetch
vi.mock('./useApi', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from './useApi';
const mockApiFetch = vi.mocked(apiFetch);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
}

describe('useDeleteConfigSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends DELETE request with correct URL', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteConfigSnapshot(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        serverName: 'test-server',
        snapshotId: 'snap-123',
      });
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/servers/test-server/config-snapshots/snap-123',
      { method: 'DELETE' }
    );
  });

  it('encodes serverName and snapshotId in URL', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteConfigSnapshot(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        serverName: 'my server',
        snapshotId: 'snap/with/slashes',
      });
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/servers/my%20server/config-snapshots/snap%2Fwith%2Fslashes',
      { method: 'DELETE' }
    );
  });

  it('is in pending state during mutation', async () => {
    let resolve: () => void;
    mockApiFetch.mockReturnValue(new Promise<void>((r) => (resolve = r)));

    const { result } = renderHook(() => useDeleteConfigSnapshot(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ serverName: 'test-server', snapshotId: 'snap-1' });
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    act(() => resolve!());

    await waitFor(() => expect(result.current.isPending).toBe(false));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('reports error on API failure', async () => {
    mockApiFetch.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useDeleteConfigSnapshot(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          serverName: 'test-server',
          snapshotId: 'snap-999',
        });
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Not found');
  });
});
