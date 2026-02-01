import { describe, it, expect } from 'vitest';
import type { ISSEClient, SSEConnectionOptions } from './ISSEClient';
import type { SSEConnectionState, SSEError } from '@/types/events';

/**
 * Mock implementation for testing interface compliance
 */
class MockSSEClient implements ISSEClient {
  private state: SSEConnectionState = 'disconnected';
  private retryCount = 0;
  private lastError: SSEError | null = null;

  connect(_options: SSEConnectionOptions): void {
    this.state = 'connected';
  }

  disconnect(): void {
    this.state = 'disconnected';
  }

  getState(): SSEConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  getLastError(): SSEError | null {
    return this.lastError;
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  reconnect(): void {
    this.retryCount++;
    this.state = 'connecting';
  }
}

describe('ISSEClient Interface', () => {
  describe('SSEConnectionOptions', () => {
    it('should define required options', () => {
      const options: SSEConnectionOptions = {
        url: 'http://localhost:5000/api/sse/test',
      };

      expect(options.url).toBeDefined();
    });

    it('should allow optional callbacks', () => {
      const options: SSEConnectionOptions = {
        url: 'http://localhost:5000/api/sse/test',
        onMessage: (event) => {
          console.log('Message:', event);
        },
        onStateChange: (state) => {
          console.log('State:', state);
        },
        onError: (error) => {
          console.error('Error:', error);
        },
      };

      expect(options.onMessage).toBeDefined();
      expect(options.onStateChange).toBeDefined();
      expect(options.onError).toBeDefined();
    });

    it('should allow optional configuration', () => {
      const options: SSEConnectionOptions = {
        url: 'http://localhost:5000/api/sse/test',
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
        headers: {
          'Authorization': 'Bearer token',
        },
        withCredentials: true,
      };

      expect(options.reconnectInterval).toBe(5000);
      expect(options.maxReconnectAttempts).toBe(10);
      expect(options.headers).toBeDefined();
      expect(options.withCredentials).toBe(true);
    });
  });

  describe('ISSEClient Implementation', () => {
    it('should implement all required methods', () => {
      const client: ISSEClient = new MockSSEClient();

      expect(client.connect).toBeDefined();
      expect(client.disconnect).toBeDefined();
      expect(client.getState).toBeDefined();
      expect(client.isConnected).toBeDefined();
      expect(client.getLastError).toBeDefined();
      expect(client.getRetryCount).toBeDefined();
      expect(client.reconnect).toBeDefined();
    });

    it('should track connection state', () => {
      const client = new MockSSEClient();

      expect(client.getState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);

      client.connect({ url: 'http://localhost/test' });

      expect(client.getState()).toBe('connected');
      expect(client.isConnected()).toBe(true);

      client.disconnect();

      expect(client.getState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });

    it('should track retry count', () => {
      const client = new MockSSEClient();

      expect(client.getRetryCount()).toBe(0);

      client.reconnect();
      expect(client.getRetryCount()).toBe(1);

      client.reconnect();
      expect(client.getRetryCount()).toBe(2);
    });

    it('should provide error information', () => {
      const client = new MockSSEClient();

      expect(client.getLastError()).toBeNull();
    });
  });
});
