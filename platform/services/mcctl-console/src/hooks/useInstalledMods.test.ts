import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useInstalledMods, useToggleModExclude } from './useMods';
import type { InstalledModsResponse, ToggleModExcludeResponse } from '@/ports/api/IMcctlApiClient';

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

const mockInstalledMods: InstalledModsResponse = {
  mods: [
    { filename: 'sodium-1.0.jar', excluded: false },
    { filename: 'lithium-0.5.jar', excluded: false },
    { filename: 'status-effect-bars-client.jar', excluded: true },
  ],
};

describe('useInstalledMods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches installed mod jars for a server', async () => {
    mockApiFetch.mockResolvedValue(mockInstalledMods);

    const { result } = renderHook(() => useInstalledMods('myserver'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.mods).toHaveLength(3);
    expect(result.current.data?.mods[0].filename).toBe('sodium-1.0.jar');
    expect(result.current.data?.mods[0].excluded).toBe(false);
    expect(result.current.data?.mods[2].excluded).toBe(true);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/servers/myserver/mods/installed');
  });

  it('encodes server name in URL', async () => {
    mockApiFetch.mockResolvedValue({ mods: [] });

    renderHook(() => useInstalledMods('my server/test'), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/servers/my%20server%2Ftest/mods/installed'
      )
    );
  });

  it('does not fetch when serverName is empty', () => {
    mockApiFetch.mockResolvedValue({ mods: [] });

    const { result } = renderHook(() => useInstalledMods(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('does not fetch when disabled via options', () => {
    mockApiFetch.mockResolvedValue({ mods: [] });

    const { result } = renderHook(
      () => useInstalledMods('myserver', { enabled: false }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(false);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('handles API error gracefully', async () => {
    mockApiFetch.mockRejectedValue(new Error('Server unreachable'));

    const { result } = renderHook(() => useInstalledMods('myserver'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Server unreachable');
  });
});

describe('useToggleModExclude', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends PATCH request with excluded=true', async () => {
    const mockResponse: ToggleModExcludeResponse = {
      success: true,
      filename: 'status-effect-bars-client.jar',
      excluded: true,
      excludeList: ['status-effect-bars-client.jar'],
      restartRequired: true,
    };
    mockApiFetch.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useToggleModExclude(), {
      wrapper: createWrapper(),
    });

    let mutationResult: ToggleModExcludeResponse | undefined;
    await act(async () => {
      mutationResult = await result.current.mutateAsync({
        serverName: 'myserver',
        filename: 'status-effect-bars-client.jar',
        excluded: true,
      });
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/servers/myserver/mods/installed/status-effect-bars-client.jar/exclude',
      {
        method: 'PATCH',
        body: JSON.stringify({ excluded: true }),
      }
    );
    expect(mutationResult?.excluded).toBe(true);
    expect(mutationResult?.restartRequired).toBe(true);
  });

  it('sends PATCH request with excluded=false to un-exclude', async () => {
    const mockResponse: ToggleModExcludeResponse = {
      success: true,
      filename: 'sodium-1.0.jar',
      excluded: false,
      excludeList: [],
      restartRequired: true,
    };
    mockApiFetch.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useToggleModExclude(), {
      wrapper: createWrapper(),
    });

    let mutationResult: ToggleModExcludeResponse | undefined;
    await act(async () => {
      mutationResult = await result.current.mutateAsync({
        serverName: 'myserver',
        filename: 'sodium-1.0.jar',
        excluded: false,
      });
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/servers/myserver/mods/installed/sodium-1.0.jar/exclude',
      {
        method: 'PATCH',
        body: JSON.stringify({ excluded: false }),
      }
    );
    expect(mutationResult?.excludeList).toHaveLength(0);
  });

  it('encodes filename with special characters in URL', async () => {
    mockApiFetch.mockResolvedValue({
      success: true,
      filename: 'mod with spaces.jar',
      excluded: true,
      excludeList: ['mod with spaces.jar'],
      restartRequired: true,
    });

    const { result } = renderHook(() => useToggleModExclude(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        serverName: 'myserver',
        filename: 'mod with spaces.jar',
        excluded: true,
      });
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/servers/myserver/mods/installed/mod%20with%20spaces.jar/exclude',
      expect.any(Object)
    );
  });
});
