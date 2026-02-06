import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useServersSSE } from '../useServersSSE';
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

describe('useServersSSE Hook', () => {
  let mockEventSource: MockEventSource;

  beforeEach(() => {
    vi.stubGlobal('EventSource', vi.fn((url: string) => {
      mockEventSource = new MockEventSource(url);
      return mockEventSource;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllTimers();
  });

  describe('Initial State', () => {
    it('should start with empty statusMap and disconnected state', () => {
      const { result } = renderHook(() => useServersSSE());

      expect(result.current.statusMap).toEqual({});
      expect(result.current.isConnected).toBe(false);
      expect(result.current.retryCount).toBe(0);
    });

    it('should connect to /api/sse/servers-status endpoint', () => {
      renderHook(() => useServersSSE());

      expect(EventSource).toHaveBeenCalledWith(
        '/api/sse/servers-status',
        expect.any(Object)
      );
    });
  });

  describe('Server Status Updates', () => {
    it('should update statusMap when receiving server-status events', async () => {
      const { result } = renderHook(() => useServersSSE());

      act(() => {
        mockEventSource.simulateOpen();
      });

      const statusEvent: ServerStatusEvent = {
        type: 'server-status',
        data: {
          serverName: 'survival',
          status: 'running',
          health: 'healthy',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      act(() => {
        mockEventSource.simulateMessage(JSON.stringify(statusEvent));
      });

      await waitFor(() => {
        expect(result.current.statusMap).toEqual({
          survival: {
            status: 'running',
            health: 'healthy',
            timestamp: '2024-01-01T00:00:00Z',
          },
        });
      });
    });

    it('should handle multiple server status updates', async () => {
      const { result } = renderHook(() => useServersSSE());

      act(() => {
        mockEventSource.simulateOpen();
      });

      const events: ServerStatusEvent[] = [
        {
          type: 'server-status',
          data: {
            serverName: 'survival',
            status: 'running',
            health: 'healthy',
            timestamp: '2024-01-01T00:00:00Z',
          },
        },
        {
          type: 'server-status',
          data: {
            serverName: 'creative',
            status: 'stopped',
            health: 'none',
            timestamp: '2024-01-01T00:01:00Z',
          },
        },
        {
          type: 'server-status',
          data: {
            serverName: 'survival',
            status: 'stopped',
            health: 'none',
            timestamp: '2024-01-01T00:02:00Z',
          },
        },
      ];

      act(() => {
        events.forEach((event) => {
          mockEventSource.simulateMessage(JSON.stringify(event));
        });
      });

      await waitFor(() => {
        expect(result.current.statusMap).toEqual({
          survival: {
            status: 'stopped',
            health: 'none',
            timestamp: '2024-01-01T00:02:00Z',
          },
          creative: {
            status: 'stopped',
            health: 'none',
            timestamp: '2024-01-01T00:01:00Z',
          },
        });
      });
    });
  });

  describe('Status Change Callback', () => {
    it('should call onStatusChange callback when status changes', async () => {
      const onStatusChange = vi.fn();
      const { result } = renderHook(() =>
        useServersSSE({ onStatusChange })
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      const statusEvent: ServerStatusEvent = {
        type: 'server-status',
        data: {
          serverName: 'survival',
          status: 'running',
          health: 'healthy',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      act(() => {
        mockEventSource.simulateMessage(JSON.stringify(statusEvent));
      });

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith(
          'survival',
          'running',
          'healthy'
        );
      });
    });

    it('should call onStatusChange for each server update', async () => {
      const onStatusChange = vi.fn();
      const { result } = renderHook(() =>
        useServersSSE({ onStatusChange })
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      const events: ServerStatusEvent[] = [
        {
          type: 'server-status',
          data: {
            serverName: 'survival',
            status: 'running',
            health: 'healthy',
            timestamp: '2024-01-01T00:00:00Z',
          },
        },
        {
          type: 'server-status',
          data: {
            serverName: 'creative',
            status: 'stopped',
            health: 'none',
            timestamp: '2024-01-01T00:01:00Z',
          },
        },
      ];

      act(() => {
        events.forEach((event) => {
          mockEventSource.simulateMessage(JSON.stringify(event));
        });
      });

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledTimes(2);
        expect(onStatusChange).toHaveBeenCalledWith('survival', 'running', 'healthy');
        expect(onStatusChange).toHaveBeenCalledWith('creative', 'stopped', 'none');
      });
    });
  });

  describe('getServerStatus Helper', () => {
    it('should return server status via getServerStatus helper', async () => {
      const { result } = renderHook(() => useServersSSE());

      act(() => {
        mockEventSource.simulateOpen();
      });

      const statusEvent: ServerStatusEvent = {
        type: 'server-status',
        data: {
          serverName: 'survival',
          status: 'running',
          health: 'healthy',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      act(() => {
        mockEventSource.simulateMessage(JSON.stringify(statusEvent));
      });

      await waitFor(() => {
        const status = result.current.getServerStatus('survival');
        expect(status).toEqual({
          status: 'running',
          health: 'healthy',
          timestamp: '2024-01-01T00:00:00Z',
        });
      });
    });

    it('should return null for unknown server in getServerStatus', () => {
      const { result } = renderHook(() => useServersSSE());

      const status = result.current.getServerStatus('nonexistent');
      expect(status).toBeNull();
    });
  });

  describe('Enabled Option', () => {
    it('should clear statusMap when disabled', async () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useServersSSE({ enabled }),
        { initialProps: { enabled: true } }
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      const statusEvent: ServerStatusEvent = {
        type: 'server-status',
        data: {
          serverName: 'survival',
          status: 'running',
          health: 'healthy',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      act(() => {
        mockEventSource.simulateMessage(JSON.stringify(statusEvent));
      });

      await waitFor(() => {
        expect(result.current.statusMap).toEqual({
          survival: {
            status: 'running',
            health: 'healthy',
            timestamp: '2024-01-01T00:00:00Z',
          },
        });
      });

      // Disable the hook
      rerender({ enabled: false });

      await waitFor(() => {
        expect(result.current.statusMap).toEqual({});
      });
    });

    it('should not connect when enabled is false', () => {
      renderHook(() =>
        useServersSSE({
          enabled: false,
        })
      );

      expect(EventSource).not.toHaveBeenCalled();
    });
  });

  describe('Reconnection', () => {
    it('should pass reconnectInterval to underlying useSSE', () => {
      renderHook(() =>
        useServersSSE({
          reconnectInterval: 5000,
        })
      );

      // EventSource should be called, indicating useSSE is connected
      expect(EventSource).toHaveBeenCalledTimes(1);
    });

    it('should support manual reconnection', async () => {
      const { result } = renderHook(() => useServersSSE());

      act(() => {
        mockEventSource.simulateOpen();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const initialCallCount = (EventSource as unknown as ReturnType<typeof vi.fn>).mock.calls.length;

      act(() => {
        result.current.reconnect();
      });

      // Should create new EventSource
      await waitFor(() => {
        expect(EventSource).toHaveBeenCalledTimes(initialCallCount + 1);
      });
    });
  });

  describe('Non-Status Events', () => {
    it('should ignore non-server-status events', async () => {
      const onStatusChange = vi.fn();
      const { result } = renderHook(() =>
        useServersSSE({ onStatusChange })
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      // Send a heartbeat event (not server-status)
      const heartbeatEvent = {
        type: 'heartbeat',
        data: { timestamp: '2024-01-01T00:00:00Z' },
      };

      act(() => {
        mockEventSource.simulateMessage(JSON.stringify(heartbeatEvent));
      });

      // Wait a bit to ensure nothing happens
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(result.current.statusMap).toEqual({});
      expect(onStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should disconnect on unmount', () => {
      const { unmount } = renderHook(() => useServersSSE());

      expect(mockEventSource).toBeDefined();

      unmount();

      expect(mockEventSource.readyState).toBe(MockEventSource.CLOSED);
    });
  });
});
