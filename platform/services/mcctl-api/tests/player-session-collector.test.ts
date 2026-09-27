import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IPlayerSessionUseCase } from '@minecraft-docker/shared';
import { PlayerSessionCollectorService } from '../src/services/player-session-collector.js';

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: 'info',
    silent: vi.fn(),
  } as any;
}

function createMockSessions(): IPlayerSessionUseCase {
  return {
    ingestLogLines: vi.fn().mockResolvedValue(undefined),
    markServerStopped: vi.fn().mockResolvedValue(undefined),
    getSessionHistory: vi.fn(),
  };
}

describe('PlayerSessionCollectorService', () => {
  let sessions: IPlayerSessionUseCase;
  let logger: ReturnType<typeof createMockLogger>;
  let listServers: ReturnType<typeof vi.fn>;
  let getStatus: ReturnType<typeof vi.fn>;
  let getCursor: ReturnType<typeof vi.fn>;
  let fetchLogs: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessions = createMockSessions();
    logger = createMockLogger();
    listServers = vi.fn().mockReturnValue(['alpha']);
    getStatus = vi.fn().mockReturnValue('running');
    getCursor = vi.fn().mockResolvedValue(null);
    fetchLogs = vi.fn().mockResolvedValue(['2026-01-01T00:00:00.000000000Z [00:00:00] [Server thread/INFO]: Notch joined the game']);
  });

  function createService() {
    return new PlayerSessionCollectorService(
      sessions,
      listServers,
      getStatus,
      getCursor,
      fetchLogs,
      logger
    );
  }

  it('fetches logs since "24h" on first run (no cursor) and ingests them', async () => {
    const service = createService();
    await service.tick();

    expect(fetchLogs).toHaveBeenCalledWith('mc-alpha', '24h');
    expect(sessions.ingestLogLines).toHaveBeenCalledWith('alpha', [
      '2026-01-01T00:00:00.000000000Z [00:00:00] [Server thread/INFO]: Notch joined the game',
    ]);
  });

  it('fetches logs since the stored cursor ISO string when one exists', async () => {
    const cursor = new Date('2026-01-01T00:00:00.000Z');
    getCursor.mockResolvedValue(cursor);
    const service = createService();

    await service.tick();

    expect(fetchLogs).toHaveBeenCalledWith('mc-alpha', cursor.toISOString());
  });

  it('marks the server stopped and skips log fetching when not running', async () => {
    getStatus.mockReturnValue('exited');
    const service = createService();

    await service.tick();

    expect(fetchLogs).not.toHaveBeenCalled();
    expect(sessions.markServerStopped).toHaveBeenCalledWith('alpha', expect.any(Date));
    expect(sessions.ingestLogLines).not.toHaveBeenCalled();
  });

  it('continues collecting other servers when one server errors', async () => {
    listServers.mockReturnValue(['alpha', 'beta']);
    getStatus.mockImplementation((container: string) =>
      container === 'mc-alpha' ? 'running' : 'running'
    );
    fetchLogs.mockImplementation(async (container: string) => {
      if (container === 'mc-alpha') throw new Error('docker logs failed');
      return [];
    });
    const service = createService();

    await service.tick();

    expect(logger.warn).toHaveBeenCalled();
    expect(sessions.ingestLogLines).toHaveBeenCalledWith('beta', []);
  });

  it('start() schedules tick() on an interval and stop() clears it', () => {
    vi.useFakeTimers();
    try {
      const service = createService();
      service.start();
      expect(fetchLogs).not.toHaveBeenCalled();

      vi.advanceTimersByTime(30_000);
      // tick() is async; flushing microtasks isn't needed to assert it was invoked.
      expect(getStatus).toHaveBeenCalled();

      service.stop();
      getStatus.mockClear();
      vi.advanceTimersByTime(60_000);
      expect(getStatus).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
