import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useServerPlayers } from '../useServerPlayers';
import type { PlayersResponse } from '@/ports/api/IMcctlApiClient';

/**
 * Mock EventSource for testing (mirrors useServerStatus.test.tsx)
 */
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  public url: string;
  public readyState: number = MockEventSource.CONNECTING;
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  private listeners: Record<string, ((event: MessageEvent) => void)[]> = {};

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    (this.listeners[type] ??= []).push(listener);
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  simulateOpen(): void {
    this.readyState = MockEventSource.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateMessage(data: string): void {
    if (this.onmessage) {
      const event = new MessageEvent('message', { data });
      this.onmessage(event);
    }
  }

  // The players endpoint sends a named `event: players` SSE event, which
  // only reaches listeners registered via addEventListener (see SSEAdapter).
  simulatePlayersEvent(data: string): void {
    const event = new MessageEvent('players', { data });
    for (const listener of this.listeners['players'] ?? []) {
      listener(event);
    }
  }
}

describe('useServerPlayers Hook (#528)', () => {
  let mockEventSource: MockEventSource;

  beforeEach(() => {
    vi.stubGlobal('EventSource', vi.fn((url: string) => {
      mockEventSource = new MockEventSource(url);
      return mockEventSource;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('connects to the players SSE endpoint with follow=true', () => {
    renderHook(() => useServerPlayers({ serverName: 'survival' }));

    expect(EventSource).toHaveBeenCalledWith(
      '/api/servers/survival/players?follow=true',
      expect.any(Object)
    );
  });

  it('starts with an empty roster', () => {
    const { result } = renderHook(() => useServerPlayers({ serverName: 'survival' }));

    expect(result.current.roster).toEqual([]);
    expect(result.current.online).toBe(0);
    expect(result.current.max).toBe(0);
    expect(result.current.running).toBe(false);
    expect(result.current.isConnected).toBe(false);
  });

  it('parses the roster payload from the SSE message (no type wrapper)', async () => {
    const { result } = renderHook(() => useServerPlayers({ serverName: 'survival' }));

    act(() => {
      mockEventSource.simulateOpen();
    });

    const payload: PlayersResponse = {
      serverName: 'survival',
      running: true,
      online: 1,
      max: 20,
      players: ['Steve'],
      roster: [
        { uuid: 'abc', name: 'Steve', online: true, lastSeen: null, isOp: false, isBanned: false, isWhitelisted: true },
      ],
    };

    act(() => {
      mockEventSource.simulatePlayersEvent(JSON.stringify(payload));
    });

    await waitFor(() => {
      expect(result.current.roster).toEqual(payload.roster);
    });
    expect(result.current.online).toBe(1);
    expect(result.current.max).toBe(20);
    expect(result.current.running).toBe(true);
  });

  it('resets the roster when the server name changes', async () => {
    const { result, rerender } = renderHook(
      ({ serverName }) => useServerPlayers({ serverName }),
      { initialProps: { serverName: 'server1' } }
    );

    act(() => {
      mockEventSource.simulateOpen();
    });

    act(() => {
      mockEventSource.simulatePlayersEvent(JSON.stringify({
        serverName: 'server1',
        running: true,
        online: 1,
        max: 20,
        players: ['Steve'],
        roster: [{ uuid: 'abc', name: 'Steve', online: true, lastSeen: null, isOp: false, isBanned: false, isWhitelisted: true }],
      }));
    });

    await waitFor(() => {
      expect(result.current.roster).toHaveLength(1);
    });

    rerender({ serverName: 'server2' });

    await waitFor(() => {
      expect(result.current.roster).toEqual([]);
    });
  });

  it('does not connect when disabled', () => {
    renderHook(() => useServerPlayers({ serverName: 'survival', enabled: false }));

    expect(EventSource).not.toHaveBeenCalled();
  });
});
