import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useServerStatus } from '../useServerStatus';
import type { ServerStatusEvent } from '@/types/events';

/**
 * Mock EventSource for testing
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

  constructor(url: string) {
    this.url = url;
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

  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

describe('useServerStatus Hook', () => {
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

  describe('Initial State', () => {
    it('should start with null status', () => {
      const { result } = renderHook(() =>
        useServerStatus({ serverName: 'test-server' })
      );

      expect(result.current.status).toBeNull();
      expect(result.current.health).toBeNull();
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('Connection', () => {
    it('should connect to correct endpoint', () => {
      renderHook(() =>
        useServerStatus({ serverName: 'test-server' })
      );

      expect(EventSource).toHaveBeenCalledWith(
        '/api/sse/servers/test-server/status',
        expect.any(Object)
      );
    });

    it('should receive and parse status updates', async () => {
      const { result } = renderHook(() =>
        useServerStatus({ serverName: 'test-server' })
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      const statusEvent: ServerStatusEvent = {
        type: 'server-status',
        data: {
          serverName: 'test-server',
          status: 'running',
          health: 'healthy',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      act(() => {
        mockEventSource.simulateMessage(JSON.stringify(statusEvent));
      });

      await waitFor(() => {
        expect(result.current.status).toBe('running');
        expect(result.current.health).toBe('healthy');
      });
    });

    it('should call onStatusChange callback', async () => {
      const onStatusChange = vi.fn();

      const { result } = renderHook(() =>
        useServerStatus({
          serverName: 'test-server',
          onStatusChange,
        })
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      const statusEvent: ServerStatusEvent = {
        type: 'server-status',
        data: {
          serverName: 'test-server',
          status: 'running',
          health: 'healthy',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      act(() => {
        mockEventSource.simulateMessage(JSON.stringify(statusEvent));
      });

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith('running', 'healthy');
      });
    });

    it('should update status on multiple events', async () => {
      const { result } = renderHook(() =>
        useServerStatus({ serverName: 'test-server' })
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      // Initial status
      act(() => {
        const event: ServerStatusEvent = {
          type: 'server-status',
          data: {
            serverName: 'test-server',
            status: 'running',
            health: 'healthy',
            timestamp: '2024-01-01T00:00:00Z',
          },
        };
        mockEventSource.simulateMessage(JSON.stringify(event));
      });

      await waitFor(() => {
        expect(result.current.status).toBe('running');
      });

      // Updated status
      act(() => {
        const event: ServerStatusEvent = {
          type: 'server-status',
          data: {
            serverName: 'test-server',
            status: 'stopped',
            health: 'none',
            timestamp: '2024-01-01T00:01:00Z',
          },
        };
        mockEventSource.simulateMessage(JSON.stringify(event));
      });

      await waitFor(() => {
        expect(result.current.status).toBe('stopped');
        expect(result.current.health).toBe('none');
      });
    });
  });

  describe('Enabled Option', () => {
    it('should not connect when enabled is false', () => {
      renderHook(() =>
        useServerStatus({
          serverName: 'test-server',
          enabled: false,
        })
      );

      expect(EventSource).not.toHaveBeenCalled();
    });

    it('should connect when enabled changes to true', () => {
      const { rerender } = renderHook(
        ({ enabled }) =>
          useServerStatus({
            serverName: 'test-server',
            enabled,
          }),
        { initialProps: { enabled: false } }
      );

      expect(EventSource).not.toHaveBeenCalled();

      rerender({ enabled: true });

      expect(EventSource).toHaveBeenCalledTimes(1);
    });
  });

  describe('Server Name Changes', () => {
    it('should reconnect when server name changes', async () => {
      const { rerender } = renderHook(
        ({ serverName }) => useServerStatus({ serverName }),
        { initialProps: { serverName: 'server1' } }
      );

      expect(EventSource).toHaveBeenCalledWith(
        '/api/sse/servers/server1/status',
        expect.any(Object)
      );

      rerender({ serverName: 'server2' });

      await waitFor(() => {
        expect(EventSource).toHaveBeenCalledWith(
          '/api/sse/servers/server2/status',
          expect.any(Object)
        );
      });

      expect(EventSource).toHaveBeenCalledTimes(2);
    });

    it('should reset status when server name changes', async () => {
      const { result, rerender } = renderHook(
        ({ serverName }) => useServerStatus({ serverName }),
        { initialProps: { serverName: 'server1' } }
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      act(() => {
        const event: ServerStatusEvent = {
          type: 'server-status',
          data: {
            serverName: 'server1',
            status: 'running',
            health: 'healthy',
            timestamp: '2024-01-01T00:00:00Z',
          },
        };
        mockEventSource.simulateMessage(JSON.stringify(event));
      });

      await waitFor(() => {
        expect(result.current.status).toBe('running');
      });

      rerender({ serverName: 'server2' });

      await waitFor(() => {
        expect(result.current.status).toBeNull();
        expect(result.current.health).toBeNull();
      });
    });
  });

  describe('Cleanup', () => {
    it('should disconnect on unmount', () => {
      const { unmount } = renderHook(() =>
        useServerStatus({ serverName: 'test-server' })
      );

      expect(mockEventSource).toBeDefined();

      unmount();

      expect(mockEventSource.readyState).toBe(MockEventSource.CLOSED);
    });
  });
});
