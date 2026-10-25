import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigSnapshotSchedulerService } from '../src/infrastructure/adapters/ConfigSnapshotSchedulerService.js';
import { ConfigSnapshotSchedule } from '../src/domain/entities/ConfigSnapshotSchedule.js';
import { ConfigSnapshot } from '../src/domain/entities/ConfigSnapshot.js';
import { ServerName } from '../src/domain/value-objects/ServerName.js';
import { ConfigSnapshotFile } from '../src/domain/value-objects/ConfigSnapshotFile.js';
import type { IConfigSnapshotUseCase } from '../src/application/ports/inbound/IConfigSnapshotUseCase.js';
import type { IConfigSnapshotScheduleUseCase } from '../src/application/ports/inbound/IConfigSnapshotScheduleUseCase.js';
import type { IConfigSnapshotRepository } from '../src/application/ports/outbound/IConfigSnapshotRepository.js';

// Helper: create mock logger
function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as any;
}

// Helper: create a test schedule
function createTestSchedule(overrides?: Partial<{
  id: string;
  serverName: string;
  name: string;
  cron: string;
  enabled: boolean;
  retentionCount: number;
}>): ConfigSnapshotSchedule {
  return ConfigSnapshotSchedule.create({
    id: overrides?.id,
    serverName: ServerName.create(overrides?.serverName ?? 'test-server'),
    name: overrides?.name ?? 'Daily Config Snapshot',
    cronExpression: overrides?.cron ?? '0 3 * * *',
    enabled: overrides?.enabled ?? true,
    retentionCount: overrides?.retentionCount ?? 5,
  });
}

// Helper: create a test snapshot
function createTestSnapshot(serverName = 'test-server', scheduleId?: string): ConfigSnapshot {
  const file = ConfigSnapshotFile.create({
    path: 'server.properties',
    hash: 'abc123',
    size: 100,
  });
  return ConfigSnapshot.create(
    ServerName.create(serverName),
    [file],
    'Test snapshot',
    scheduleId
  );
}

// Helper: create mock snapshot use case
function createMockSnapshotUseCase(): IConfigSnapshotUseCase {
  return {
    create: vi.fn(async () => createTestSnapshot()),
    list: vi.fn(async () => []),
    findById: vi.fn(async () => null),
    diff: vi.fn(),
    restore: vi.fn(),
    count: vi.fn(async () => 0),
    delete: vi.fn(),
  } as any;
}

// Helper: create mock schedule use case
function createMockScheduleUseCase(): IConfigSnapshotScheduleUseCase {
  return {
    create: vi.fn(),
    update: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(async () => []),
    findByServer: vi.fn(async () => []),
    recordRun: vi.fn(),
  } as any;
}

// Helper: create mock snapshot repository
function createMockSnapshotRepository(): IConfigSnapshotRepository {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(async () => []),
    findByServer: vi.fn(async () => []),
    countByServer: vi.fn(async () => 0),
    delete: vi.fn(),
    deleteByServer: vi.fn(),
    findByScheduleId: vi.fn(async () => []),
    countByScheduleId: vi.fn(async () => 0),
  } as any;
}

describe('ConfigSnapshotSchedulerService', () => {
  let service: ConfigSnapshotSchedulerService;
  let mockSnapshotUseCase: IConfigSnapshotUseCase;
  let mockScheduleUseCase: IConfigSnapshotScheduleUseCase;
  let mockSnapshotRepository: IConfigSnapshotRepository;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockSnapshotUseCase = createMockSnapshotUseCase();
    mockScheduleUseCase = createMockScheduleUseCase();
    mockSnapshotRepository = createMockSnapshotRepository();
    mockLogger = createMockLogger();
    service = new ConfigSnapshotSchedulerService(
      mockSnapshotUseCase,
      mockScheduleUseCase,
      mockSnapshotRepository,
      mockLogger
    );
  });

  afterEach(() => {
    service.shutdown();
  });

  describe('constructor', () => {
    test('should create service with zero active tasks', () => {
      expect(service.activeTaskCount).toBe(0);
    });
  });

  describe('addSchedule', () => {
    test('should not register task for disabled schedule', async () => {
      const schedule = createTestSchedule({ enabled: false });
      await service.initialize();

      service.addSchedule(schedule);

      expect(service.activeTaskCount).toBe(0);
    });
  });

  describe('removeSchedule', () => {
    test('should handle removing non-existent schedule', async () => {
      await service.initialize();
      // Should not throw
      service.removeSchedule('non-existent-id');
      expect(service.activeTaskCount).toBe(0);
    });
  });

  describe('getRunningJobs', () => {
    test('should return empty map initially', () => {
      const jobs = service.getRunningJobs();
      expect(jobs.size).toBe(0);
    });
  });

  describe('shutdown', () => {
    test('should clear all tasks and log shutdown', () => {
      service.shutdown();

      expect(service.activeTaskCount).toBe(0);
      expect(mockLogger.info.mock.calls.length).toBe(1);
      expect((mockLogger.info.mock.calls[0]?.[0] as string).includes(
          'Config snapshot scheduler stopped'
        )).toBeTruthy();
    });
  });

  // mcctl config-snapshot schedule writes the same DB; the API picks it up (#826)
  describe('sync with schedules changed outside the API', () => {
    // node-cron is mcctl-api's dependency, not this package's: stand in for it
    const task = { stop: vi.fn(), start: vi.fn() };
    const cron = vi.fn(() => task);
    beforeEach(() => {
      task.stop.mockClear();
      cron.mockClear();
      (service as unknown as { cronSchedule: unknown }).cronSchedule = cron;
    });

    test('registers a new schedule, re-registers a changed one and drops a removed or disabled one', async () => {
      const kept = createTestSchedule({ id: 'kept', cron: '0 3 * * *' });
      const changed = createTestSchedule({ id: 'changed', cron: '0 4 * * *' });
      const removed = createTestSchedule({ id: 'removed', cron: '0 5 * * *' });
      const disabled = createTestSchedule({ id: 'disabled', cron: '0 6 * * *' });
      for (const s of [kept, changed, removed, disabled]) service.addSchedule(s);
      cron.mockClear();

      vi.mocked(mockScheduleUseCase.findAll).mockResolvedValue([
        kept,
        createTestSchedule({ id: 'changed', cron: '30 4 * * *' }),
        createTestSchedule({ id: 'disabled', cron: '0 6 * * *', enabled: false }),
        createTestSchedule({ id: 'added', cron: '0 7 * * *' }),
      ]);
      await service.sync();

      expect(cron.mock.calls.map((c) => (c as unknown[])[0]).sort()).toEqual(['0 7 * * *', '30 4 * * *']);
      expect(task.stop).toHaveBeenCalledTimes(3);
      expect([...service.getRunningJobs().keys()].sort()).toEqual(['added', 'changed', 'kept']);
    });
  });

  describe('domain entity integration', () => {
    test('should support ConfigSnapshotSchedule.recordRun', () => {
      const schedule = createTestSchedule();
      const recorded = schedule.recordRun('success');
      expect(recorded.lastRunStatus).toBe('success');
      expect(recorded.lastRunAt instanceof Date).toBeTruthy();
    });

    test('should support ConfigSnapshot with scheduleId', () => {
      const snapshot = createTestSnapshot('test-server', 'schedule-123');
      expect(snapshot.scheduleId).toBe('schedule-123');
    });
  });
});
