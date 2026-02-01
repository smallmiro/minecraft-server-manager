import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSSE } from '../useSSE';
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

describe('useSSE Hook', () => {
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
    it('should start with null data and disconnected state', () => {
      const { result } = renderHook(() =>
        useSSE({ url: 'http://localhost/test' })
      );

      expect(result.current.data).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Connection', () => {
    it('should establish connection on mount', async () => {
      const { result } = renderHook(() =>
        useSSE({ url: 'http://localhost/test' })
      );

      expect(result.current.isConnected).toBe(false);

      act(() => {
        mockEventSource.simulateOpen();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
    });

    it('should receive and parse messages', async () => {
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useSSE({
          url: 'http://localhost/test',
          onMessage,
        })
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      const testEvent: ServerLogEvent = {
        type: 'server-log',
        data: { log: 'Test log message' },
      };

      act(() => {
        mockEventSource.simulateMessage(JSON.stringify(testEvent));
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(testEvent);
        expect(onMessage).toHaveBeenCalledWith(testEvent);
      });
    });

    it('should handle multiple messages', async () => {
      const messages: ServerLogEvent[] = [];
      const { result } = renderHook(() =>
        useSSE({
          url: 'http://localhost/test',
          onMessage: (msg) => messages.push(msg as ServerLogEvent),
        })
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      const events: ServerLogEvent[] = [
        { type: 'server-log', data: { log: 'Message 1' } },
        { type: 'server-log', data: { log: 'Message 2' } },
        { type: 'server-log', data: { log: 'Message 3' } },
      ];

      act(() => {
        events.forEach((event) => {
          mockEventSource.simulateMessage(JSON.stringify(event));
        });
      });

      await waitFor(() => {
        expect(messages).toHaveLength(3);
        expect(result.current.data).toEqual(events[2]); // Last message
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      const onError = vi.fn();
      const { result } = renderHook(() =>
        useSSE({
          url: 'http://localhost/test',
          onError,
        })
      );

      act(() => {
        mockEventSource.simulateError();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
        expect(result.current.error).not.toBeNull();
        expect(onError).toHaveBeenCalled();
      });
    });

    it('should handle malformed JSON gracefully', async () => {
      const { result } = renderHook(() =>
        useSSE({ url: 'http://localhost/test' })
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      act(() => {
        mockEventSource.simulateMessage('invalid json');
      });

      // Should not crash
      expect(result.current.data).toBeNull();
    });
  });

  describe('Reconnection', () => {
    it('should support manual reconnection', async () => {
      const { result } = renderHook(() =>
        useSSE({ url: 'http://localhost/test' })
      );

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

  describe('Cleanup', () => {
    it('should disconnect on unmount', () => {
      const { unmount } = renderHook(() =>
        useSSE({ url: 'http://localhost/test' })
      );

      expect(mockEventSource).toBeDefined();

      unmount();

      expect(mockEventSource.readyState).toBe(MockEventSource.CLOSED);
    });
  });

  describe('URL Changes', () => {
    it('should reconnect when URL changes', async () => {
      const { result, rerender } = renderHook(
        ({ url }) => useSSE({ url }),
        { initialProps: { url: 'http://localhost/test1' } }
      );

      act(() => {
        mockEventSource.simulateOpen();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(EventSource).toHaveBeenCalledTimes(1);

      // Change URL
      rerender({ url: 'http://localhost/test2' });

      // Should create new EventSource
      expect(EventSource).toHaveBeenCalledTimes(2);
    });
  });

  describe('Enabled Option', () => {
    it('should not connect when enabled is false', () => {
      renderHook(() =>
        useSSE({
          url: 'http://localhost/test',
          enabled: false,
        })
      );

      expect(EventSource).not.toHaveBeenCalled();
    });

    it('should connect when enabled changes to true', () => {
      const { rerender } = renderHook(
        ({ enabled }) =>
          useSSE({
            url: 'http://localhost/test',
            enabled,
          }),
        { initialProps: { enabled: false } }
      );

      expect(EventSource).not.toHaveBeenCalled();

      rerender({ enabled: true });

      expect(EventSource).toHaveBeenCalledTimes(1);
    });

    it('should disconnect when enabled changes to false', () => {
      const { rerender } = renderHook(
        ({ enabled }) =>
          useSSE({
            url: 'http://localhost/test',
            enabled,
          }),
        { initialProps: { enabled: true } }
      );

      expect(EventSource).toHaveBeenCalledTimes(1);

      rerender({ enabled: false });

      expect(mockEventSource.readyState).toBe(MockEventSource.CLOSED);
    });
  });
});
