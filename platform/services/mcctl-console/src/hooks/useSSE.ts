/**
 * Generic SSE Hook
 * Provides a reusable React hook for SSE connections
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SSEAdapter } from '@/adapters/SSEAdapter';
import type { SSEEvent, SSEConnectionState, SSEError } from '@/types/events';

/**
 * Options for useSSE hook
 */
export interface UseSSEOptions {
  /**
   * The SSE endpoint URL
   */
  url: string;

  /**
   * Callback when a message is received
   */
  onMessage?: (event: SSEEvent) => void;

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
   * Whether to enable the connection
   * @default true
   */
  enabled?: boolean;

  /**
   * Whether to include credentials (cookies) in the request
   * @default false
   */
  withCredentials?: boolean;
}

/**
 * Return type for useSSE hook
 */
export interface UseSSEReturn<T = SSEEvent> {
  /**
   * Latest received data
   */
  data: T | null;

  /**
   * Whether the connection is established
   */
  isConnected: boolean;

  /**
   * Current connection state
   */
  state: SSEConnectionState;

  /**
   * Last error if any
   */
  error: SSEError | null;

  /**
   * Current retry count
   */
  retryCount: number;

  /**
   * Manually trigger reconnection
   */
  reconnect: () => void;

  /**
   * Manually disconnect
   */
  disconnect: () => void;
}

/**
 * Generic SSE hook with automatic reconnection
 *
 * @example
 * ```tsx
 * const { data, isConnected } = useSSE({
 *   url: '/api/sse/logs',
 *   onMessage: (event) => console.log(event),
 * });
 * ```
 */
export function useSSE<T extends SSEEvent = SSEEvent>(
  options: UseSSEOptions
): UseSSEReturn<T> {
  const {
    url,
    onMessage,
    onError,
    reconnectInterval = 3000,
    maxReconnectAttempts = Infinity,
    enabled = true,
    withCredentials = false,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<SSEConnectionState>('disconnected');
  const [error, setError] = useState<SSEError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Use ref to store adapter to avoid recreating on every render
  const adapterRef = useRef<SSEAdapter | null>(null);

  // Callbacks wrapped in useCallback to avoid recreating on every render
  const handleMessage = useCallback(
    (event: SSEEvent) => {
      setData(event as T);
      onMessage?.(event);
    },
    [onMessage]
  );

  const handleStateChange = useCallback((newState: SSEConnectionState) => {
    setState(newState);
    if (newState === 'connected') {
      setRetryCount(0);
    }
  }, []);

  const handleError = useCallback(
    (err: SSEError) => {
      setError(err);
      onError?.(err);
    },
    [onError]
  );

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (adapterRef.current) {
      adapterRef.current.reconnect();
      setRetryCount(adapterRef.current.getRetryCount());
    }
  }, []);

  // Manual disconnect
  const disconnect = useCallback(() => {
    if (adapterRef.current) {
      adapterRef.current.disconnect();
    }
  }, []);

  // Effect to manage SSE connection
  useEffect(() => {
    if (!enabled) {
      // Disconnect if disabled
      if (adapterRef.current) {
        adapterRef.current.disconnect();
        adapterRef.current = null;
      }
      return;
    }

    // Create adapter if not exists
    if (!adapterRef.current) {
      adapterRef.current = new SSEAdapter();
    }

    // Connect
    adapterRef.current.connect({
      url,
      onMessage: handleMessage,
      onStateChange: handleStateChange,
      onError: handleError,
      reconnectInterval,
      maxReconnectAttempts,
      withCredentials,
    });

    // Update retry count from adapter
    const updateRetryCount = () => {
      if (adapterRef.current) {
        setRetryCount(adapterRef.current.getRetryCount());
      }
    };

    // Update retry count periodically
    const retryCountInterval = setInterval(updateRetryCount, 500);

    // Cleanup on unmount or dependency change
    return () => {
      clearInterval(retryCountInterval);
      if (adapterRef.current) {
        adapterRef.current.disconnect();
        adapterRef.current = null;
      }
    };
  }, [
    url,
    enabled,
    reconnectInterval,
    maxReconnectAttempts,
    withCredentials,
    handleMessage,
    handleStateChange,
    handleError,
  ]);

  return {
    data,
    isConnected: state === 'connected',
    state,
    error,
    retryCount,
    reconnect,
    disconnect,
  };
}
