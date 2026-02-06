/**
 * Server Status Hook
 * Real-time server status updates using SSE
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSSE } from './useSSE';
import type { SSEEvent, ServerStatusEvent } from '@/types/events';

/**
 * Options for useServerStatus hook
 */
export interface UseServerStatusOptions {
  /**
   * Server name to monitor
   */
  serverName: string;

  /**
   * Callback when status changes
   */
  onStatusChange?: (
    status: 'running' | 'stopped' | 'created' | 'exited' | 'not_created' | 'unknown',
    health: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown'
  ) => void;

  /**
   * Whether to enable status monitoring
   * @default true
   */
  enabled?: boolean;

  /**
   * Reconnection interval in milliseconds
   * @default 3000
   */
  reconnectInterval?: number;
}

/**
 * Return type for useServerStatus hook
 */
export interface UseServerStatusReturn {
  /**
   * Current server status
   */
  status: 'running' | 'stopped' | 'created' | 'exited' | 'not_created' | 'unknown' | null;

  /**
   * Current server health
   */
  health: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown' | null;

  /**
   * Whether the connection is established
   */
  isConnected: boolean;

  /**
   * Manually reconnect
   */
  reconnect: () => void;

  /**
   * Current retry count
   */
  retryCount: number;
}

/**
 * Hook for monitoring server status in real-time
 *
 * @example
 * ```tsx
 * const { status, health, isConnected } = useServerStatus({
 *   serverName: 'myserver',
 *   onStatusChange: (status, health) => {
 *     console.log('Status changed:', status, health);
 *   },
 * });
 *
 * return (
 *   <div>
 *     Status: {status}
 *     Health: {health}
 *   </div>
 * );
 * ```
 */
export function useServerStatus(
  options: UseServerStatusOptions
): UseServerStatusReturn {
  const {
    serverName,
    onStatusChange,
    enabled = true,
    reconnectInterval = 3000,
  } = options;

  const [status, setStatus] = useState<
    'running' | 'stopped' | 'created' | 'exited' | 'not_created' | 'unknown' | null
  >(null);

  const [health, setHealth] = useState<
    'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown' | null
  >(null);

  // Reset status when server name changes
  useEffect(() => {
    setStatus(null);
    setHealth(null);
  }, [serverName]);

  // Handle incoming status messages
  const handleMessage = useCallback(
    (event: SSEEvent) => {
      if (event.type === 'server-status') {
        const statusEvent = event as ServerStatusEvent;
        const newStatus = statusEvent.data.status;
        const newHealth = statusEvent.data.health;

        setStatus(newStatus);
        setHealth(newHealth);

        onStatusChange?.(newStatus, newHealth);
      }
    },
    [onStatusChange]
  );

  // SSE connection
  const { isConnected, reconnect, retryCount } = useSSE({
    url: `/api/sse/servers/${encodeURIComponent(serverName)}/status`,
    onMessage: handleMessage,
    enabled,
    reconnectInterval,
  });

  return {
    status,
    health,
    isConnected,
    reconnect,
    retryCount,
  };
}
