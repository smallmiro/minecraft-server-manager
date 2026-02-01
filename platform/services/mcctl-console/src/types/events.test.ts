import { describe, it, expect } from 'vitest';
import type {
  ServerStatusEvent,
  ServerLogEvent,
  PlayerEvent,
  HeartbeatEvent,
  ErrorEvent,
  SSEEvent,
  SSEConnectionState,
  SSEError,
} from './events';

describe('SSE Event Types', () => {
  describe('ServerStatusEvent', () => {
    it('should have correct structure', () => {
      const event: ServerStatusEvent = {
        type: 'server-status',
        data: {
          serverName: 'test-server',
          status: 'running',
          health: 'healthy',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      expect(event.type).toBe('server-status');
      expect(event.data.serverName).toBe('test-server');
      expect(event.data.status).toBe('running');
      expect(event.data.health).toBe('healthy');
    });
  });

  describe('ServerLogEvent', () => {
    it('should have correct structure', () => {
      const event: ServerLogEvent = {
        type: 'server-log',
        data: {
          log: '[INFO] Server started',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      expect(event.type).toBe('server-log');
      expect(event.data.log).toContain('Server started');
    });

    it('should allow optional timestamp', () => {
      const event: ServerLogEvent = {
        type: 'server-log',
        data: {
          log: '[INFO] Test log',
        },
      };

      expect(event.data.timestamp).toBeUndefined();
    });
  });

  describe('PlayerEvent', () => {
    it('should have correct structure for join', () => {
      const event: PlayerEvent = {
        type: 'player-event',
        data: {
          serverName: 'test-server',
          playerName: 'Steve',
          action: 'join',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      expect(event.type).toBe('player-event');
      expect(event.data.action).toBe('join');
    });

    it('should have correct structure for leave', () => {
      const event: PlayerEvent = {
        type: 'player-event',
        data: {
          serverName: 'test-server',
          playerName: 'Steve',
          action: 'leave',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      expect(event.data.action).toBe('leave');
    });
  });

  describe('HeartbeatEvent', () => {
    it('should have correct structure', () => {
      const event: HeartbeatEvent = {
        type: 'heartbeat',
        data: {
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      expect(event.type).toBe('heartbeat');
      expect(event.data.timestamp).toBeDefined();
    });
  });

  describe('ErrorEvent', () => {
    it('should have correct structure', () => {
      const event: ErrorEvent = {
        type: 'error',
        data: {
          message: 'Connection failed',
          code: 'ECONNREFUSED',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      expect(event.type).toBe('error');
      expect(event.data.message).toBe('Connection failed');
    });

    it('should allow optional code', () => {
      const event: ErrorEvent = {
        type: 'error',
        data: {
          message: 'Unknown error',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      expect(event.data.code).toBeUndefined();
    });
  });

  describe('SSEEvent Union Type', () => {
    it('should accept all event types', () => {
      const events: SSEEvent[] = [
        {
          type: 'server-status',
          data: {
            serverName: 'test',
            status: 'running',
            health: 'healthy',
            timestamp: '2024-01-01T00:00:00Z',
          },
        },
        {
          type: 'server-log',
          data: { log: 'test log' },
        },
        {
          type: 'player-event',
          data: {
            serverName: 'test',
            playerName: 'Steve',
            action: 'join',
            timestamp: '2024-01-01T00:00:00Z',
          },
        },
        {
          type: 'heartbeat',
          data: { timestamp: '2024-01-01T00:00:00Z' },
        },
        {
          type: 'error',
          data: {
            message: 'test error',
            timestamp: '2024-01-01T00:00:00Z',
          },
        },
      ];

      expect(events).toHaveLength(5);
    });
  });

  describe('SSEConnectionState', () => {
    it('should accept valid states', () => {
      const states: SSEConnectionState[] = [
        'connecting',
        'connected',
        'disconnected',
        'error',
      ];

      expect(states).toHaveLength(4);
    });
  });

  describe('SSEError', () => {
    it('should have correct structure', () => {
      const error: SSEError = {
        message: 'Connection failed',
        code: 'ECONNREFUSED',
        retryCount: 3,
        timestamp: new Date(),
      };

      expect(error.message).toBe('Connection failed');
      expect(error.retryCount).toBe(3);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should allow optional fields', () => {
      const error: SSEError = {
        message: 'Error',
        timestamp: new Date(),
      };

      expect(error.code).toBeUndefined();
      expect(error.retryCount).toBeUndefined();
    });
  });
});
