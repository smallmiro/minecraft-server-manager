/**
 * SSE Client Port Interface
 * Defines the contract for SSE client adapters (Hexagonal Architecture)
 */

import type { SSEEvent, SSEConnectionState, SSEError } from '@/types/events';

/**
 * SSE connection options
 */
export interface SSEConnectionOptions {
  /**
   * The SSE endpoint URL
   */
  url: string;

  /**
   * Callback when a message is received
   */
  onMessage?: (event: SSEEvent) => void;

  /**
   * Callback when connection state changes
   */
  onStateChange?: (state: SSEConnectionState) => void;

  /**
   * Callback when an error occurs
   */
  onError?: (error: SSEError) => void;

  /**
   * Automatic reconnection interval in milliseconds
   * @default 3000
   */
  reconnectInterval?: number;

  /**
   * Maximum number of reconnection attempts
   * @default Infinity
   */
  maxReconnectAttempts?: number;

  /**
   * Additional headers to send with the request
   */
  headers?: Record<string, string>;

  /**
   * Whether to include credentials (cookies) in the request
   * @default false
   */
  withCredentials?: boolean;
}

/**
 * SSE Client Interface
 * Port for SSE connection management
 */
export interface ISSEClient {
  /**
   * Establish SSE connection
   */
  connect(options: SSEConnectionOptions): void;

  /**
   * Close SSE connection
   */
  disconnect(): void;

  /**
   * Get current connection state
   */
  getState(): SSEConnectionState;

  /**
   * Check if currently connected
   */
  isConnected(): boolean;

  /**
   * Get the last error if any
   */
  getLastError(): SSEError | null;

  /**
   * Get current retry count
   */
  getRetryCount(): number;

  /**
   * Force reconnection
   */
  reconnect(): void;
}
