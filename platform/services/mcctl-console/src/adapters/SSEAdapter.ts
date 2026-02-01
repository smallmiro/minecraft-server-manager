/**
 * SSE Adapter Implementation
 * Implements ISSEClient using native EventSource API
 */

import type { ISSEClient, SSEConnectionOptions } from '@/ports/out/ISSEClient';
import type { SSEEvent, SSEConnectionState, SSEError } from '@/types/events';

/**
 * SSEAdapter - EventSource-based implementation of ISSEClient
 */
export class SSEAdapter implements ISSEClient {
  private eventSource: EventSource | null = null;
  private state: SSEConnectionState = 'disconnected';
  private retryCount = 0;
  private lastError: SSEError | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private options: SSEConnectionOptions | null = null;
  private shouldReconnect = true;

  /**
   * Establish SSE connection
   */
  connect(options: SSEConnectionOptions): void {
    this.options = options;
    this.shouldReconnect = true;
    this.establishConnection();
  }

  /**
   * Internal method to establish the connection
   */
  private establishConnection(): void {
    if (!this.options) {
      return;
    }

    // Update state
    this.updateState('connecting');

    // Clear any existing connection
    if (this.eventSource) {
      this.eventSource.close();
    }

    // Create EventSource
    // Note: EventSource API doesn't support custom headers in browser
    // For authenticated SSE, use cookies or URL parameters
    this.eventSource = new EventSource(this.options.url, {
      withCredentials: this.options.withCredentials || false,
    });

    // Connection opened
    this.eventSource.onopen = () => {
      this.updateState('connected');
      this.retryCount = 0; // Reset retry count on successful connection
      this.lastError = null;
    };

    // Message received
    this.eventSource.onmessage = (event: MessageEvent) => {
      // Skip heartbeat messages (SSE comments starting with :)
      if (event.data.startsWith(':')) {
        return;
      }

      try {
        const parsedEvent = JSON.parse(event.data) as SSEEvent;
        this.options?.onMessage?.(parsedEvent);
      } catch (error) {
        // Ignore malformed messages
        console.warn('Failed to parse SSE message:', error);
      }
    };

    // Error occurred
    this.eventSource.onerror = () => {
      const error: SSEError = {
        message: 'SSE connection error',
        code: 'CONNECTION_ERROR',
        retryCount: this.retryCount,
        timestamp: new Date(),
      };

      this.lastError = error;
      this.updateState('error');
      this.options?.onError?.(error);

      // Attempt reconnection if enabled
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * Schedule automatic reconnection
   */
  private scheduleReconnect(): void {
    if (!this.options) {
      return;
    }

    const maxAttempts = this.options.maxReconnectAttempts ?? Infinity;

    if (this.retryCount >= maxAttempts) {
      // Max attempts reached, don't reconnect
      return;
    }

    // Clear any existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const interval = this.options.reconnectInterval ?? 3000;

    this.reconnectTimer = setTimeout(() => {
      this.retryCount++;
      this.establishConnection();
    }, interval);
  }

  /**
   * Close SSE connection
   */
  disconnect(): void {
    this.shouldReconnect = false;

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close connection
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.updateState('disconnected');
  }

  /**
   * Get current connection state
   */
  getState(): SSEConnectionState {
    return this.state;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Get the last error if any
   */
  getLastError(): SSEError | null {
    return this.lastError;
  }

  /**
   * Get current retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Force reconnection
   */
  reconnect(): void {
    this.retryCount++;
    this.shouldReconnect = true;

    // Close current connection
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // Clear any pending reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Reconnect immediately
    this.establishConnection();
  }

  /**
   * Update state and notify listeners
   */
  private updateState(newState: SSEConnectionState): void {
    this.state = newState;
    this.options?.onStateChange?.(newState);
  }
}
