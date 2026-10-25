import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IBackupScheduleUseCase, IWorldBackupPort } from '@minecraft-docker/shared';
import { BackupSchedule } from '@minecraft-docker/shared';

// Mock node-cron
const mockCronTask = { stop: vi.fn(), start: vi.fn() };
vi.mock('node-cron', () => ({
  schedule: vi.fn().mockReturnValue(mockCronTask),
  validate: vi.fn().mockReturnValue(true),
}));

import { BackupSchedulerService } from '../src/services/backup-scheduler.js';

const HASH = 'abc1234def5678901234567890abcdef12345678';

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

function createMockUseCase(): IBackupScheduleUseCase {
  return {
    create: vi.fn(),
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    recordRun: vi.fn(),
  };
}

function createPort() {
  return {
    status: vi.fn(),
    history: vi.fn(),
    push: vi.fn().mockResolvedValue({
      ok: true,
      value: { changed: true, commit: HASH, flushed: [], skipped: [], warnings: [] },
    }),
    restore: vi.fn(),
    prune: vi.fn().mockResolvedValue({ ok: true, value: { removed: 0, warnings: [] } }),
    testConnection: vi.fn(),
  } satisfies Record<keyof IWorldBackupPort, unknown>;
}

function createTestSchedule(overrides?: Partial<{
  name: string;
  cron: string;
  enabled: boolean;
  maxCount: number;
  maxAgeDays: number;
}>): BackupSchedule {
  return BackupSchedule.create({
    name: overrides?.name ?? 'Test Backup',
    cronExpression: overrides?.cron ?? '0 3 * * *',
    enabled: overrides?.enabled ?? true,
    retentionPolicy: {
      maxCount: overrides?.maxCount,
      maxAgeDays: overrides?.maxAgeDays,
    },
  });
}

describe('BackupSchedulerService', () => {
  let service: BackupSchedulerService;
  let mockUseCase: IBackupScheduleUseCase;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let port: ReturnType<typeof createPort>;
  let audit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCase = createMockUseCase();
    mockLogger = createMockLogger();
    port = createPort();
    audit = vi.fn().mockResolvedValue(undefined);
    service = new BackupSchedulerService(mockUseCase, port as unknown as IWorldBackupPort, mockLogger, audit);
  });

  /** Registers the schedule and runs its cron callback once. */
  async function runOnce(schedule: BackupSchedule) {
    vi.mocked(mockUseCase.findById).mockResolvedValue(schedule);
    const nodeCron = await import('node-cron');
    let callback: (() => Promise<void>) | undefined;
    vi.mocked(nodeCron.schedule).mockImplementation((_expr, cb) => {
      callback = cb as () => Promise<void>;
      return mockCronTask;
    });
    await service.initialize();
    service.registerTask(schedule);
    await callback!();
  }

  describe('initialize', () => {
    it('should load node-cron and start enabled schedules', async () => {
      vi.mocked(mockUseCase.findAll).mockResolvedValue([createTestSchedule({ enabled: true })]);
      await service.initialize();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('1 enabled'));
    });

    it('registers nothing without enabled schedules', async () => {
      await service.initialize();
      expect(service.activeTaskCount).toBe(0);
    });
  });

  describe('registerTask / unregisterTask', () => {
    it('registers one task per schedule and replaces it on re-register', async () => {
      const schedule = createTestSchedule();
      await service.initialize();
      service.registerTask(schedule);
      service.registerTask(schedule);
      expect(service.activeTaskCount).toBe(1);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Registered backup schedule'));
    });

    it('stops and removes a task; ignores unknown ids', async () => {
      const schedule = createTestSchedule();
      await service.initialize();
      service.registerTask(schedule);
      service.unregisterTask('unknown');
      service.unregisterTask(schedule.id);
      expect(service.activeTaskCount).toBe(0);
      expect(mockCronTask.stop).toHaveBeenCalled();
    });
  });

  describe('scheduled backup on the world backup port (#732)', () => {
    it('skips a disabled or missing schedule', async () => {
      const schedule = createTestSchedule();
      await runOnce(schedule);
      vi.mocked(mockUseCase.findById).mockResolvedValue(null);
      const nodeCron = await import('node-cron');
      const cb = vi.mocked(nodeCron.schedule).mock.calls.at(-1)![1] as () => Promise<void>;
      port.push.mockClear();
      await cb();
      expect(port.push).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping disabled/missing schedule'));
    });

    it('pushes through the port with the schedule message and waits for the lock (#7)', async () => {
      const schedule = createTestSchedule({ name: 'Nightly"; rm -rf /' });
      await runOnce(schedule);
      expect(port.push).toHaveBeenCalledWith({
        message: expect.stringMatching(/^Scheduled backup: Nightly"; rm -rf \/ \[.+\]$/),
        lockWaitMs: 600_000,
      });
      expect(mockUseCase.recordRun).toHaveBeenCalledWith(schedule.id, 'success', 'Backup complete (abc1234)');
    });

    it('records "no changes" as success (#8)', async () => {
      port.push.mockResolvedValue({
        ok: true,
        value: { changed: false, commit: HASH, flushed: [], skipped: [], warnings: [] },
      });
      const schedule = createTestSchedule();
      await runOnce(schedule);
      expect(mockUseCase.recordRun).toHaveBeenCalledWith(schedule.id, 'success', 'No changes to backup');
    });

    it('records a missing-world failure with the command that fixes it', async () => {
      port.push.mockResolvedValue({
        ok: false,
        error: { code: 'missing_worlds', message: 'Worlds in the last backup are missing: worlds/b', paths: ['worlds/b'] },
      });
      const schedule = createTestSchedule();
      await runOnce(schedule);
      expect(mockUseCase.recordRun).toHaveBeenCalledWith(
        schedule.id,
        'failure',
        expect.stringContaining('mcctl backup push --allow-missing')
      );
      expect(port.prune).not.toHaveBeenCalled();
    });

    it('records other port failures', async () => {
      port.push.mockResolvedValue({ ok: false, error: { code: 'locked', message: 'Another backup operation is running' } });
      const schedule = createTestSchedule();
      await runOnce(schedule);
      expect(mockUseCase.recordRun).toHaveBeenCalledWith(schedule.id, 'failure', 'Another backup operation is running');
    });

    it('prunes through the port with the schedule policy after a backup (#9)', async () => {
      port.prune.mockResolvedValue({ ok: true, value: { removed: 3, warnings: [] } });
      const schedule = createTestSchedule({ maxCount: 5, maxAgeDays: 30 });
      await runOnce(schedule);
      expect(port.prune).toHaveBeenCalledWith(schedule.retentionPolicy, { lockWaitMs: 600_000 });
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          details: expect.objectContaining({ operation: 'retention-prune', removed: 3 }),
        })
      );
    });

    it('prunes after a no-change backup too', async () => {
      port.push.mockResolvedValue({
        ok: true,
        value: { changed: false, commit: HASH, flushed: [], skipped: [], warnings: [] },
      });
      await runOnce(createTestSchedule({ maxCount: 5 }));
      expect(port.prune).toHaveBeenCalled();
    });

    it('a prune failure is audited but the backup still succeeds', async () => {
      port.prune.mockResolvedValue({ ok: false, error: { code: 'lease_conflict', message: 'The remote branch moved' } });
      const schedule = createTestSchedule({ maxCount: 5 });
      await runOnce(schedule);
      expect(mockUseCase.recordRun).toHaveBeenCalledWith(schedule.id, 'success', 'Backup complete (abc1234)');
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failure', errorMessage: 'The remote branch moved' })
      );
    });

    it('logs push and prune warnings', async () => {
      port.push.mockResolvedValue({
        ok: true,
        value: { changed: true, commit: HASH, flushed: [], skipped: ['x: data is a symbolic link'], warnings: ['save-on failed for a'] },
      });
      port.prune.mockResolvedValue({ ok: true, value: { removed: 0, warnings: ['prune skipped'] } });
      await runOnce(createTestSchedule({ maxCount: 5 }));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('save-on failed for a'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('x: data is a symbolic link'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('prune skipped'));
    });
  });

  describe('reload / shutdown', () => {
    it('reload stops all tasks and reloads enabled schedules', async () => {
      vi.mocked(mockUseCase.findAll).mockResolvedValue([createTestSchedule()]);
      await service.initialize();
      expect(service.activeTaskCount).toBe(1);
      vi.mocked(mockUseCase.findAll).mockResolvedValue([]);
      await service.reload();
      expect(mockCronTask.stop).toHaveBeenCalled();
    });

    it('shutdown stops all tasks', async () => {
      vi.mocked(mockUseCase.findAll).mockResolvedValue([createTestSchedule()]);
      await service.initialize();
      service.shutdown();
      expect(service.activeTaskCount).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Backup scheduler stopped');
    });
  });

  // mcctl backup-schedule writes the same DB; the API picks it up (#826)
  describe('sync with schedules changed outside the API', () => {
    const at = (cron: string, enabled = true) =>
      createTestSchedule({ cron, enabled });

    it('registers a new schedule, re-registers a changed one and drops a removed one', async () => {
      const kept = at('0 3 * * *');
      const changed = at('0 4 * * *');
      const removed = at('0 5 * * *');
      vi.mocked(mockUseCase.findAll).mockResolvedValue([kept, changed, removed]);
      await service.initialize();
      const nodeCron = await import('node-cron');
      vi.mocked(nodeCron.schedule).mockClear();
      mockCronTask.stop.mockClear();

      const added = at('0 6 * * *');
      const rescheduled = BackupSchedule.create({ id: changed.id, name: changed.name, cronExpression: '30 4 * * *' });
      vi.mocked(mockUseCase.findAll).mockResolvedValue([kept, rescheduled, added]);
      await service.sync();

      expect(vi.mocked(nodeCron.schedule).mock.calls.map((c) => c[0]).sort()).toEqual(['0 6 * * *', '30 4 * * *']);
      expect(mockCronTask.stop).toHaveBeenCalledTimes(2); // the old task of the changed one, the removed one
      expect(service.activeTaskCount).toBe(3);
    });

    it('drops a schedule disabled outside the API', async () => {
      const schedule = at('0 3 * * *');
      vi.mocked(mockUseCase.findAll).mockResolvedValue([schedule]);
      await service.initialize();
      vi.mocked(mockUseCase.findAll).mockResolvedValue([BackupSchedule.create({ id: schedule.id, name: schedule.name, cronExpression: '0 3 * * *', enabled: false })]);
      await service.sync();
      expect(service.activeTaskCount).toBe(0);
    });

    it('syncs every minute after initialize, until shutdown', async () => {
      vi.useFakeTimers();
      try {
        await service.initialize();
        vi.mocked(mockUseCase.findAll).mockClear();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(mockUseCase.findAll).toHaveBeenCalledTimes(1);
        service.shutdown();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(mockUseCase.findAll).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
