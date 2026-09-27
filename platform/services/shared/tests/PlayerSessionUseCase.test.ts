import { describe, it, expect, vi } from 'vitest';
import { PlayerSessionUseCase } from '../src/application/use-cases/PlayerSessionUseCase.js';
import { PlayerSession } from '../src/domain/entities/PlayerSession.js';
import type {
  IPlayerSessionRepository,
  PlayerSessionSummary,
} from '../src/application/ports/outbound/IPlayerSessionRepository.js';

function makeRepo(overrides: Partial<IPlayerSessionRepository> = {}): IPlayerSessionRepository {
  return {
    recordJoin: vi.fn().mockResolvedValue(undefined),
    recordLeave: vi.fn().mockResolvedValue(undefined),
    closeOpenSessions: vi.fn().mockResolvedValue(undefined),
    listSessions: vi.fn().mockResolvedValue([]),
    getSummary: vi
      .fn()
      .mockResolvedValue({ visitCount: 0, totalPlaytimeSeconds: 0, lastSeen: null }),
    getCursor: vi.fn().mockResolvedValue(null),
    setCursor: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const JOIN_LINE =
  '2026-09-27T08:00:00.000000000Z [08:00:00] [Server thread/INFO]: Steve joined the game';
const LEAVE_LINE =
  '2026-09-27T08:10:00.000000000Z [08:10:00] [Server thread/INFO]: Steve left the game';

describe('PlayerSessionUseCase', () => {
  describe('ingestLogLines', () => {
    it('applies join/leave events in order and advances the cursor to the latest', async () => {
      const repo = makeRepo();
      const useCase = new PlayerSessionUseCase(repo);

      await useCase.ingestLogLines('myserver', [JOIN_LINE, LEAVE_LINE]);

      expect(repo.recordJoin).toHaveBeenCalledWith(
        'myserver',
        'Steve',
        new Date('2026-09-27T08:00:00.000Z')
      );
      expect(repo.recordLeave).toHaveBeenCalledWith(
        'myserver',
        'Steve',
        new Date('2026-09-27T08:10:00.000Z')
      );
      expect(repo.setCursor).toHaveBeenCalledWith(
        'myserver',
        new Date('2026-09-27T08:10:00.000Z')
      );
    });

    it('ignores non-matching lines', async () => {
      const repo = makeRepo();
      const useCase = new PlayerSessionUseCase(repo);

      await useCase.ingestLogLines('myserver', ['not a log line', JOIN_LINE]);

      expect(repo.recordJoin).toHaveBeenCalledTimes(1);
    });

    it('skips events at or before the persisted cursor (dedupe on re-read)', async () => {
      const repo = makeRepo({
        getCursor: vi.fn().mockResolvedValue(new Date('2026-09-27T08:00:00.000Z')),
      });
      const useCase = new PlayerSessionUseCase(repo);

      await useCase.ingestLogLines('myserver', [JOIN_LINE, LEAVE_LINE]);

      // JOIN_LINE's timestamp equals the cursor exactly -> skipped.
      expect(repo.recordJoin).not.toHaveBeenCalled();
      expect(repo.recordLeave).toHaveBeenCalledTimes(1);
      expect(repo.setCursor).toHaveBeenCalledWith(
        'myserver',
        new Date('2026-09-27T08:10:00.000Z')
      );
    });

    it('does not move the cursor when every line is skipped/unmatched', async () => {
      const repo = makeRepo({
        getCursor: vi.fn().mockResolvedValue(new Date('2026-09-27T09:00:00.000Z')),
      });
      const useCase = new PlayerSessionUseCase(repo);

      await useCase.ingestLogLines('myserver', [JOIN_LINE, LEAVE_LINE, 'garbage']);

      expect(repo.setCursor).not.toHaveBeenCalled();
    });

    it('does nothing on an empty batch', async () => {
      const repo = makeRepo();
      const useCase = new PlayerSessionUseCase(repo);

      await useCase.ingestLogLines('myserver', []);

      expect(repo.recordJoin).not.toHaveBeenCalled();
      expect(repo.setCursor).not.toHaveBeenCalled();
    });

    it('advances the cursor to the latest line timestamp even when no events match (idle server)', async () => {
      const repo = makeRepo();
      const useCase = new PlayerSessionUseCase(repo);
      const idleLine =
        '2026-09-27T08:30:00.000000000Z [08:30:00] [Server thread/INFO]: Done (12.3s)!';

      await useCase.ingestLogLines('myserver', [idleLine]);

      expect(repo.recordJoin).not.toHaveBeenCalled();
      expect(repo.recordLeave).not.toHaveBeenCalled();
      expect(repo.setCursor).toHaveBeenCalledWith(
        'myserver',
        new Date('2026-09-27T08:30:00.000Z')
      );
    });

    it('does not move the cursor backwards when the batch has no timestamped lines past it', async () => {
      const repo = makeRepo({
        getCursor: vi.fn().mockResolvedValue(new Date('2026-09-27T09:00:00.000Z')),
      });
      const useCase = new PlayerSessionUseCase(repo);

      await useCase.ingestLogLines('myserver', ['garbage']);

      expect(repo.setCursor).not.toHaveBeenCalled();
    });
  });

  describe('getCursor', () => {
    it('delegates to the repository', async () => {
      const cursor = new Date('2026-09-27T08:00:00.000Z');
      const repo = makeRepo({ getCursor: vi.fn().mockResolvedValue(cursor) });
      const useCase = new PlayerSessionUseCase(repo);

      await expect(useCase.getCursor('myserver')).resolves.toBe(cursor);
      expect(repo.getCursor).toHaveBeenCalledWith('myserver');
    });
  });

  describe('markServerStopped', () => {
    it('delegates to closeOpenSessions', async () => {
      const repo = makeRepo();
      const useCase = new PlayerSessionUseCase(repo);
      const at = new Date('2026-09-27T09:00:00.000Z');

      await useCase.markServerStopped('myserver', at);

      expect(repo.closeOpenSessions).toHaveBeenCalledWith('myserver', at);
    });
  });

  describe('getSessionHistory', () => {
    it('combines summary + recent sessions', async () => {
      const summary: PlayerSessionSummary = {
        visitCount: 2,
        totalPlaytimeSeconds: 900,
        lastSeen: new Date('2026-09-27T08:10:00.000Z'),
      };
      const recent = [
        PlayerSession.create({
          id: 1,
          serverName: 'myserver',
          playerName: 'Steve',
          joinedAt: new Date('2026-09-27T08:00:00.000Z'),
          leftAt: new Date('2026-09-27T08:10:00.000Z'),
        }),
      ];
      const repo = makeRepo({
        getSummary: vi.fn().mockResolvedValue(summary),
        listSessions: vi.fn().mockResolvedValue(recent),
      });
      const useCase = new PlayerSessionUseCase(repo);
      const now = new Date('2026-09-27T09:00:00.000Z');

      const history = await useCase.getSessionHistory('myserver', 'Steve', now, 20);

      expect(repo.getSummary).toHaveBeenCalledWith('myserver', 'Steve', now);
      expect(repo.listSessions).toHaveBeenCalledWith('myserver', 'Steve', 20);
      expect(history).toEqual({ ...summary, recent });
    });

    it('defaults limit to 20', async () => {
      const repo = makeRepo();
      const useCase = new PlayerSessionUseCase(repo);

      await useCase.getSessionHistory('myserver', 'Steve', new Date());

      expect(repo.listSessions).toHaveBeenCalledWith('myserver', 'Steve', 20);
    });
  });
});
