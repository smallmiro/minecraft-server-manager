import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useServerLogs } from '../useServerLogs';
import type { ServerLogEvent } from '@/types/events';

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

describe('useServerLogs Hook', () => {
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
    it('should start with empty logs', () => {
      const { result } = renderHook(() =>
        useServerLogs({ serverName: 'test-server' })
      );

      expect(result.current.logs).toEqual([]);
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('Connection', () => {
    it('should connect to correct endpoint', () => {
      renderHook(() =>
        useServerLogs({ serverName: 'test-server' })
      );

      expect(EventSource).toHaveBeenCalledWith(
        '/api/sse/servers/test-server/logs',
        expect.any(Object)
      );
    });

    it('should append initial logs on connection', async () => {
      const { result } = renderHook(() =>
        useServerLogs({ serverName: 'test-server' })
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      const logEvents: ServerLogEvent[] = [
        { type: 'server-log', data: { log: 'Server starting...' } },
        { type: 'server-log', data: { log: 'World loaded' } },
        { type: 'server-log', data: { log: 'Server started' } },
      ];

      act(() => {
        logEvents.forEach((event) => {
          mockEventSource.simulateMessage(JSON.stringify(event));
        });
      });

      await waitFor(() => {
        expect(result.current.logs).toHaveLength(3);
      });

      expect(result.current.logs[0]).toBe('Server starting...');
      expect(result.current.logs[1]).toBe('World loaded');
      expect(result.current.logs[2]).toBe('Server started');
    });
  });

  describe('Buffer Management', () => {
    it('should limit buffer size to maxLines', async () => {
      const { result } = renderHook(() =>
        useServerLogs({
          serverName: 'test-server',
          maxLines: 5,
        })
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      // Simulate 10 log messages
      act(() => {
        for (let i = 0; i < 10; i++) {
          const event: ServerLogEvent = {
            type: 'server-log',
            data: { log: `Log ${i}` },
          };
          mockEventSource.simulateMessage(JSON.stringify(event));
        }
      });

      await waitFor(() => {
        expect(result.current.logs).toHaveLength(5);
      });

      // Should keep the latest 5 logs
      expect(result.current.logs[0]).toBe('Log 5');
      expect(result.current.logs[4]).toBe('Log 9');
    });

    it('should use default maxLines of 500', async () => {
      const { result } = renderHook(() =>
        useServerLogs({ serverName: 'test-server' })
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      // Simulate 600 log messages
      act(() => {
        for (let i = 0; i < 600; i++) {
          const event: ServerLogEvent = {
            type: 'server-log',
            data: { log: `Log ${i}` },
          };
          mockEventSource.simulateMessage(JSON.stringify(event));
        }
      });

      await waitFor(() => {
        expect(result.current.logs).toHaveLength(500);
      });

      // Should keep the latest 500 logs
      expect(result.current.logs[0]).toBe('Log 100');
      expect(result.current.logs[499]).toBe('Log 599');
    });
  });

  describe('Clear Logs', () => {
    it('should clear all logs', async () => {
      const { result } = renderHook(() =>
        useServerLogs({ serverName: 'test-server' })
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      act(() => {
        for (let i = 0; i < 5; i++) {
          const event: ServerLogEvent = {
            type: 'server-log',
            data: { log: `Log ${i}` },
          };
          mockEventSource.simulateMessage(JSON.stringify(event));
        }
      });

      await waitFor(() => {
        expect(result.current.logs).toHaveLength(5);
      });

      act(() => {
        result.current.clearLogs();
      });

      expect(result.current.logs).toEqual([]);
    });
  });

  describe('Enabled Option', () => {
    it('should not connect when enabled is false', () => {
      renderHook(() =>
        useServerLogs({
          serverName: 'test-server',
          enabled: false,
        })
      );

      expect(EventSource).not.toHaveBeenCalled();
    });

    it('should connect when enabled changes to true', () => {
      const { rerender } = renderHook(
        ({ enabled }) =>
          useServerLogs({
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
        ({ serverName }) => useServerLogs({ serverName }),
        { initialProps: { serverName: 'server1' } }
      );

      expect(EventSource).toHaveBeenCalledWith(
        '/api/sse/servers/server1/logs',
        expect.any(Object)
      );

      rerender({ serverName: 'server2' });

      await waitFor(() => {
        expect(EventSource).toHaveBeenCalledWith(
          '/api/sse/servers/server2/logs',
          expect.any(Object)
        );
      });

      expect(EventSource).toHaveBeenCalledTimes(2);
    });

    it('should clear logs when server name changes', async () => {
      const { result, rerender } = renderHook(
        ({ serverName }) => useServerLogs({ serverName }),
        { initialProps: { serverName: 'server1' } }
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      act(() => {
        const event: ServerLogEvent = {
          type: 'server-log',
          data: { log: 'Log from server1' },
        };
        mockEventSource.simulateMessage(JSON.stringify(event));
      });

      await waitFor(() => {
        expect(result.current.logs).toHaveLength(1);
      });

      rerender({ serverName: 'server2' });

      await waitFor(() => {
        expect(result.current.logs).toEqual([]);
      });
    });
  });

  describe('Cleanup', () => {
    it('should disconnect on unmount', () => {
      const { unmount } = renderHook(() =>
        useServerLogs({ serverName: 'test-server' })
      );

      expect(mockEventSource).toBeDefined();

      unmount();

      expect(mockEventSource.readyState).toBe(MockEventSource.CLOSED);
    });
  });
});
