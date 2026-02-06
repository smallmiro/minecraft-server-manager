/**
 * Servers SSE Hook
 * Real-time status updates for all servers using SSE
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSSE } from './useSSE';
import type { SSEEvent, ServerStatusEvent } from '@/types/events';

/**
 * Server status map (serverName -> status)
 */
export interface ServerStatusMap {
  [serverName: string]: {
    status: 'running' | 'stopped' | 'created' | 'exited' | 'unknown';
    health: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown';
    timestamp: string;
  };
}

/**
 * Options for useServersSSE hook
 */
export interface UseServersSSEOptions {
  /**
   * Callback when any server status changes
   */
  onStatusChange?: (
    serverName: string,
    status: 'running' | 'stopped' | 'created' | 'exited' | 'unknown',
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
 * Return type for useServersSSE hook
 */
export interface UseServersSSEReturn {
  /**
   * Map of server statuses
   */
  statusMap: ServerStatusMap;

  /**
   * Get status for a specific server
   */
  getServerStatus: (
    serverName: string
  ) => ServerStatusMap[string] | null;

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
 * Hook for monitoring all server statuses in real-time
 *
 * @example
 * ```tsx
 * const { statusMap, isConnected } = useServersSSE({
 *   onStatusChange: (serverName, status, health) => {
 *     console.log(`${serverName}: ${status} (${health})`);
 *   },
 * });
 *
 * return (
 *   <div>
 *     {Object.entries(statusMap).map(([name, info]) => (
 *       <div key={name}>
 *         {name}: {info.status}
 *       </div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useServersSSE(
  options: UseServersSSEOptions = {}
): UseServersSSEReturn {
  const {
    onStatusChange,
    enabled = true,
    reconnectInterval = 3000,
  } = options;

  const [statusMap, setStatusMap] = useState<ServerStatusMap>({});

  // Handle incoming status messages
  const handleMessage = useCallback(
    (event: SSEEvent) => {
      if (event.type === 'server-status') {
        const statusEvent = event as ServerStatusEvent;
        const { serverName, status, health, timestamp } = statusEvent.data;

        // Update status map
        setStatusMap((prev) => ({
          ...prev,
          [serverName]: {
            status,
            health,
            timestamp,
          },
        }));

        // Trigger callback
        onStatusChange?.(serverName, status, health);
      }
    },
    [onStatusChange]
  );

  // SSE connection to servers/status endpoint
  const { isConnected, reconnect, retryCount } = useSSE({
    url: '/api/sse/servers/status',
    onMessage: handleMessage,
    enabled,
    reconnectInterval,
  });

  // Get status for a specific server
  const getServerStatus = useCallback(
    (serverName: string) => {
      return statusMap[serverName] || null;
    },
    [statusMap]
  );

  // Clear status map when disabled
  useEffect(() => {
    if (!enabled) {
      setStatusMap({});
    }
  }, [enabled]);

  return {
    statusMap,
    getServerStatus,
    isConnected,
    reconnect,
    retryCount,
  };
}
