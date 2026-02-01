import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SSEAdapter } from '../SSEAdapter';
import type { SSEConnectionState, SSEError, ServerLogEvent } from '@/types/events';

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

  // Helper for testing
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

describe('SSEAdapter', () => {
  let adapter: SSEAdapter;
  let mockEventSource: MockEventSource;

  beforeEach(() => {
    adapter = new SSEAdapter();

    // Mock global EventSource
    vi.stubGlobal('EventSource', vi.fn((url: string) => {
      mockEventSource = new MockEventSource(url);
      return mockEventSource;
    }));
  });

  afterEach(() => {
    adapter.disconnect();
    vi.unstubAllGlobals();
    vi.clearAllTimers();
  });

  describe('Initial State', () => {
    it('should start in disconnected state', () => {
      expect(adapter.getState()).toBe('disconnected');
      expect(adapter.isConnected()).toBe(false);
    });

    it('should have no errors initially', () => {
      expect(adapter.getLastError()).toBeNull();
    });

    it('should have zero retry count', () => {
      expect(adapter.getRetryCount()).toBe(0);
    });
  });

  describe('Connection', () => {
    it('should transition to connecting state on connect', () => {
      adapter.connect({ url: 'http://localhost/test' });
      expect(adapter.getState()).toBe('connecting');
    });

    it('should transition to connected state when connection opens', () => {
      const onStateChange = vi.fn();
      adapter.connect({
        url: 'http://localhost/test',
        onStateChange,
      });

      mockEventSource.simulateOpen();

      expect(adapter.getState()).toBe('connected');
      expect(adapter.isConnected()).toBe(true);
      expect(onStateChange).toHaveBeenCalledWith('connecting');
      expect(onStateChange).toHaveBeenCalledWith('connected');
    });

    it('should call onMessage callback when receiving messages', () => {
      const onMessage = vi.fn();
      adapter.connect({
        url: 'http://localhost/test',
        onMessage,
      });

      mockEventSource.simulateOpen();

      const testEvent: ServerLogEvent = {
        type: 'server-log',
        data: { log: 'Test log message' },
      };

      mockEventSource.simulateMessage(JSON.stringify(testEvent));

      expect(onMessage).toHaveBeenCalledWith(testEvent);
    });

    it('should handle heartbeat messages without calling onMessage', () => {
      const onMessage = vi.fn();
      adapter.connect({
        url: 'http://localhost/test',
        onMessage,
      });

      mockEventSource.simulateOpen();

      // Simulate heartbeat (comment line starting with :)
      const messageEvent = new MessageEvent('message', { data: ': heartbeat' });
      mockEventSource.onmessage?.(messageEvent);

      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  describe('Disconnection', () => {
    it('should close connection and update state', () => {
      adapter.connect({ url: 'http://localhost/test' });
      mockEventSource.simulateOpen();

      expect(adapter.isConnected()).toBe(true);

      adapter.disconnect();

      expect(adapter.getState()).toBe('disconnected');
      expect(adapter.isConnected()).toBe(false);
    });

    it('should not reconnect after manual disconnect', () => {
      vi.useFakeTimers();

      adapter.connect({
        url: 'http://localhost/test',
        reconnectInterval: 1000,
      });

      mockEventSource.simulateOpen();
      adapter.disconnect();

      // Fast-forward time
      vi.advanceTimersByTime(2000);

      // Should still be disconnected
      expect(adapter.getState()).toBe('disconnected');

      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should transition to error state on connection error', () => {
      const onError = vi.fn();
      const onStateChange = vi.fn();

      adapter.connect({
        url: 'http://localhost/test',
        onError,
        onStateChange,
      });

      mockEventSource.simulateError();

      expect(adapter.getState()).toBe('error');
      expect(onError).toHaveBeenCalled();
      expect(onStateChange).toHaveBeenCalledWith('error');
    });

    it('should store last error', () => {
      adapter.connect({ url: 'http://localhost/test' });
      mockEventSource.simulateError();

      const lastError = adapter.getLastError();
      expect(lastError).not.toBeNull();
      expect(lastError?.message).toContain('SSE connection error');
    });

    it('should handle malformed JSON messages gracefully', () => {
      const onMessage = vi.fn();
      const onError = vi.fn();

      adapter.connect({
        url: 'http://localhost/test',
        onMessage,
        onError,
      });

      mockEventSource.simulateOpen();
      mockEventSource.simulateMessage('invalid json');

      // Should not crash, but should handle error
      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  describe('Reconnection', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should attempt reconnection after error', () => {
      const onStateChange = vi.fn();

      adapter.connect({
        url: 'http://localhost/test',
        reconnectInterval: 1000,
        onStateChange,
      });

      // Simulate error
      mockEventSource.simulateError();

      expect(adapter.getState()).toBe('error');
      expect(adapter.getRetryCount()).toBe(0);

      // Fast-forward past reconnect interval
      vi.advanceTimersByTime(1100);

      // Should attempt reconnection
      expect(adapter.getRetryCount()).toBe(1);
      expect(adapter.getState()).toBe('connecting');
    });

    it('should respect max reconnect attempts', () => {
      adapter.connect({
        url: 'http://localhost/test',
        reconnectInterval: 1000,
        maxReconnectAttempts: 3,
      });

      // Simulate 3 errors
      for (let i = 0; i < 3; i++) {
        mockEventSource.simulateError();
        vi.advanceTimersByTime(1100);
      }

      expect(adapter.getRetryCount()).toBe(3);

      // Fourth error should not trigger reconnection
      mockEventSource.simulateError();
      vi.advanceTimersByTime(1100);

      expect(adapter.getRetryCount()).toBe(3);
      expect(adapter.getState()).toBe('error');
    });

    it('should reset retry count on successful connection', () => {
      adapter.connect({
        url: 'http://localhost/test',
        reconnectInterval: 1000,
      });

      // Simulate error and reconnection
      mockEventSource.simulateError();
      vi.advanceTimersByTime(1100);

      expect(adapter.getRetryCount()).toBeGreaterThan(0);

      // Successful connection
      mockEventSource.simulateOpen();

      expect(adapter.getRetryCount()).toBe(0);
    });

    it('should support manual reconnection', () => {
      adapter.connect({ url: 'http://localhost/test' });
      mockEventSource.simulateOpen();

      expect(adapter.getRetryCount()).toBe(0);

      adapter.reconnect();

      expect(adapter.getRetryCount()).toBe(1);
      expect(adapter.getState()).toBe('connecting');
    });
  });

  describe('Custom Headers', () => {
    it('should support custom headers (via EventSource limitations)', () => {
      // Note: EventSource doesn't support custom headers in browser
      // This test verifies the option is accepted
      adapter.connect({
        url: 'http://localhost/test',
        headers: {
          'Authorization': 'Bearer token',
        },
      });

      // Should not throw error
      expect(adapter.getState()).toBe('connecting');
    });
  });

  describe('Credentials', () => {
    it('should support withCredentials option', () => {
      // Note: EventSource supports withCredentials as constructor option
      adapter.connect({
        url: 'http://localhost/test',
        withCredentials: true,
      });

      expect(adapter.getState()).toBe('connecting');
    });
  });
});
