import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { usePlayerDetail, playerDetailRefetchInterval } from '../useMcctl';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('usePlayerDetail (#528 Phase 2)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('fetches the player detail with stats, nbt and sessions included', async () => {
    const mockData = {
      uuid: 'abc',
      name: 'Steve',
      online: false,
      lastSeen: '2024-01-01T00:00:00Z',
      isOp: false,
      isBanned: false,
      isWhitelisted: true,
      stats: {
        playTimeSeconds: 7200,
        deaths: 3,
        mobKills: 40,
        playerKills: 1,
        distanceMeters: 12000,
        blocksMined: 500,
        itemsCrafted: 20,
        advancementsCompleted: 15,
      },
      data: null,
    };

    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });

    const { result } = renderHook(() => usePlayerDetail('survival', 'abc'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/servers/survival/players/abc?include=stats,nbt,sessions',
      expect.any(Object)
    );
  });

  describe('playerDetailRefetchInterval (#528 Phase 3)', () => {
    it('polls every 5s while the player is online', () => {
      expect(playerDetailRefetchInterval({ online: true } as never)).toBe(5000);
    });

    it('does not poll when the player is offline', () => {
      expect(playerDetailRefetchInterval({ online: false } as never)).toBe(false);
    });

    it('does not poll when there is no data yet', () => {
      expect(playerDetailRefetchInterval(undefined)).toBe(false);
    });
  });

  it('does not fetch when uuid is empty', () => {
    const { result } = renderHook(() => usePlayerDetail('survival', ''), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not fetch when enabled is false', () => {
    const { result } = renderHook(() => usePlayerDetail('survival', 'abc', { enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
