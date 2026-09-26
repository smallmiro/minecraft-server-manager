/**
 * Server Players Hook (#528)
 * Real-time player roster (online + offline) updates using SSE.
 * Mirrors useServerStatus, but the SSE payload is the raw PlayersResponse
 * (no `type` discriminator), matching the mcctl-api contract for this route.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSSE } from './useSSE';
import type { SSEEvent } from '@/types/events';
import type { PlayerSummary, PlayersResponse } from '@/ports/api/IMcctlApiClient';

export interface UseServerPlayersOptions {
  /**
   * Server name to monitor
   */
  serverName: string;

  /**
   * Whether to enable the connection
   * @default true
   */
  enabled?: boolean;

  /**
   * Reconnection interval in milliseconds
   * @default 3000
   */
  reconnectInterval?: number;
}

export interface UseServerPlayersReturn {
  roster: PlayerSummary[];
  online: number;
  max: number;
  running: boolean;
  isConnected: boolean;
  reconnect: () => void;
  retryCount: number;
}

function isPlayersResponse(data: unknown): data is PlayersResponse {
  return !!data && typeof data === 'object' && Array.isArray((data as PlayersResponse).roster);
}

/**
 * Hook for monitoring a server's player roster in real-time.
 *
 * @example
 * ```tsx
 * const { roster, online, max, running, isConnected } = useServerPlayers({
 *   serverName: 'myserver',
 * });
 * ```
 */
export function useServerPlayers(options: UseServerPlayersOptions): UseServerPlayersReturn {
  const { serverName, enabled = true, reconnectInterval = 3000 } = options;

  const [data, setData] = useState<PlayersResponse | null>(null);

  // Reset roster when server name changes
  useEffect(() => {
    setData(null);
  }, [serverName]);

  const handleMessage = useCallback((event: SSEEvent) => {
    // The players endpoint sends the full PlayersResponse as the payload,
    // with no `type` wrapper — cast the underlying JSON directly.
    if (isPlayersResponse(event)) {
      setData(event);
    }
  }, []);

  const { isConnected, reconnect, retryCount } = useSSE({
    url: `/api/servers/${encodeURIComponent(serverName)}/players?follow=true`,
    onMessage: handleMessage,
    enabled,
    reconnectInterval,
  });

  return {
    roster: data?.roster ?? [],
    online: data?.online ?? 0,
    max: data?.max ?? 0,
    running: data?.running ?? false,
    isConnected,
    reconnect,
    retryCount,
  };
}
