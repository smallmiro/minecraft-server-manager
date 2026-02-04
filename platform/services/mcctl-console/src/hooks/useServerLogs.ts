/**
 * Server Logs Hook
 * Real-time log streaming using SSE
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSSE } from './useSSE';
import type { SSEEvent, ServerLogEvent } from '@/types/events';

/**
 * Options for useServerLogs hook
 */
export interface UseServerLogsOptions {
  /**
   * Server name to stream logs from
   */
  serverName: string;

  /**
   * Maximum number of log lines to keep in buffer
   * @default 500
   */
  maxLines?: number;

  /**
   * Whether to enable log streaming
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
 * Return type for useServerLogs hook
 */
export interface UseServerLogsReturn {
  /**
   * Array of log lines
   */
  logs: string[];

  /**
   * Whether the connection is established
   */
  isConnected: boolean;

  /**
   * Clear all logs
   */
  clearLogs: () => void;

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
 * Hook for streaming server logs in real-time
 *
 * @example
 * ```tsx
 * const { logs, isConnected, clearLogs } = useServerLogs({
 *   serverName: 'myserver',
 * });
 *
 * return (
 *   <div>
 *     <button onClick={clearLogs}>Clear</button>
 *     {logs.map((log, i) => <div key={i}>{log}</div>)}
 *   </div>
 * );
 * ```
 */
export function useServerLogs(
  options: UseServerLogsOptions
): UseServerLogsReturn {
  const {
    serverName,
    maxLines = 500,
    enabled = true,
    reconnectInterval = 3000,
  } = options;

  const [logs, setLogs] = useState<string[]>([]);

  // Clear logs when server name changes
  useEffect(() => {
    setLogs([]);
  }, [serverName]);

  // Handle incoming log messages
  const handleMessage = useCallback(
    (event: SSEEvent) => {
      let logLine: string | undefined;

      // Handle both formats:
      // 1. New format: { type: 'server-log', data: { log: '...' } }
      // 2. Legacy format: { log: '...' }
      if (event.type === 'server-log') {
        const logEvent = event as ServerLogEvent;
        logLine = logEvent.data.log;
      } else if ('log' in event && typeof (event as { log?: string }).log === 'string') {
        // Legacy format without type field
        logLine = (event as { log: string }).log;
      }

      if (logLine) {
        setLogs((prevLogs) => {
          const newLogs = [...prevLogs, logLine!];

          // Trim to maxLines
          if (newLogs.length > maxLines) {
            return newLogs.slice(newLogs.length - maxLines);
          }

          return newLogs;
        });
      }
    },
    [maxLines]
  );

  // SSE connection
  const { isConnected, reconnect, retryCount } = useSSE({
    url: `/api/sse/servers/${encodeURIComponent(serverName)}/logs`,
    onMessage: handleMessage,
    enabled,
    reconnectInterval,
  });

  // Clear logs callback
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    logs,
    isConnected,
    clearLogs,
    reconnect,
    retryCount,
  };
}
