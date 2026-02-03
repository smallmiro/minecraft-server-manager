/**
 * SSE Event Type Definitions
 * Type-safe event structures for Server-Sent Events
 */

/**
 * Server status update event
 */
export interface ServerStatusEvent {
  type: 'server-status';
  data: {
    serverName: string;
    status: 'running' | 'stopped' | 'created' | 'exited' | 'unknown';
    health: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown';
    timestamp: string;
  };
}

/**
 * Server log line event
 */
export interface ServerLogEvent {
  type: 'server-log';
  data: {
    log: string;
    timestamp?: string;
  };
}

/**
 * Player event (join/leave)
 */
export interface PlayerEvent {
  type: 'player-event';
  data: {
    serverName: string;
    playerName: string;
    action: 'join' | 'leave';
    timestamp: string;
  };
}

/**
 * Heartbeat event to keep connection alive
 */
export interface HeartbeatEvent {
  type: 'heartbeat';
  data: {
    timestamp: string;
  };
}

/**
 * Generic SSE error event
 */
export interface ErrorEvent {
  type: 'error';
  data: {
    message: string;
    code?: string;
    timestamp: string;
  };
}

/**
 * Connection closed event (sent when SSE stream ends)
 */
export interface ConnectionClosedEvent {
  type: 'connection-closed';
  data: {
    timestamp: string;
  };
}

/**
 * Union type of all possible SSE events
 */
export type SSEEvent =
  | ServerStatusEvent
  | ServerLogEvent
  | PlayerEvent
  | HeartbeatEvent
  | ErrorEvent
  | ConnectionClosedEvent;

/**
 * SSE connection state
 */
export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * SSE connection error
 */
export interface SSEError {
  message: string;
  code?: string;
  retryCount?: number;
  timestamp: Date;
}
