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

  /**
   * Current server status. When it becomes 'running' after the log stream
   * ended, the stream is reconnected.
   */
  serverStatus?: string;
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
    serverStatus,
  } = options;

  const [logs, setLogs] = useState<string[]>([]);
  // Set when the API ends the stream (container not running): stop reconnecting
  const [streamEnded, setStreamEnded] = useState(false);

  // Clear logs when server name changes
  useEffect(() => {
    setLogs([]);
    setStreamEnded(false);
  }, [serverName]);

  // Resume streaming when the server (re)starts
  useEffect(() => {
    if (serverStatus === 'running') setStreamEnded(false);
  }, [serverStatus]);

  // Handle incoming log messages
  const handleMessage = useCallback(
    (event: SSEEvent) => {
      if (event.type === 'connection-closed') {
        setStreamEnded(true);
        return;
      }

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
  const { isConnected, reconnect: sseReconnect, retryCount } = useSSE({
    url: `/api/sse/servers/${encodeURIComponent(serverName)}/logs`,
    onMessage: handleMessage,
    enabled: enabled && !streamEnded,
    reconnectInterval,
  });

  // The API replays the log tail on every connect: drop what we have
  useEffect(() => {
    if (isConnected) setLogs([]);
  }, [isConnected]);

  const reconnect = useCallback(() => {
    setStreamEnded(false);
    sseReconnect();
  }, [sseReconnect]);

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
