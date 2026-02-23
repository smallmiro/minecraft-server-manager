import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
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
    info: mock.fn(),
    warn: mock.fn(),
    error: mock.fn(),
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
    create: mock.fn(async () => createTestSnapshot()),
    list: mock.fn(async () => []),
    findById: mock.fn(async () => null),
    diff: mock.fn(),
    restore: mock.fn(),
    count: mock.fn(async () => 0),
    delete: mock.fn(),
  } as any;
}

// Helper: create mock schedule use case
function createMockScheduleUseCase(): IConfigSnapshotScheduleUseCase {
  return {
    create: mock.fn(),
    update: mock.fn(),
    enable: mock.fn(),
    disable: mock.fn(),
    delete: mock.fn(),
    findAll: mock.fn(async () => []),
    findByServer: mock.fn(async () => []),
    recordRun: mock.fn(),
  } as any;
}

// Helper: create mock snapshot repository
function createMockSnapshotRepository(): IConfigSnapshotRepository {
  return {
    save: mock.fn(),
    findById: mock.fn(),
    findAll: mock.fn(async () => []),
    findByServer: mock.fn(async () => []),
    countByServer: mock.fn(async () => 0),
    delete: mock.fn(),
    deleteByServer: mock.fn(),
    findByScheduleId: mock.fn(async () => []),
    countByScheduleId: mock.fn(async () => 0),
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
      assert.strictEqual(service.activeTaskCount, 0);
    });
  });

  describe('addSchedule', () => {
    test('should not register task for disabled schedule', async () => {
      const schedule = createTestSchedule({ enabled: false });
      await service.initialize();

      service.addSchedule(schedule);

      assert.strictEqual(service.activeTaskCount, 0);
    });
  });

  describe('removeSchedule', () => {
    test('should handle removing non-existent schedule', async () => {
      await service.initialize();
      // Should not throw
      service.removeSchedule('non-existent-id');
      assert.strictEqual(service.activeTaskCount, 0);
    });
  });

  describe('getRunningJobs', () => {
    test('should return empty map initially', () => {
      const jobs = service.getRunningJobs();
      assert.strictEqual(jobs.size, 0);
    });
  });

  describe('shutdown', () => {
    test('should clear all tasks and log shutdown', () => {
      service.shutdown();

      assert.strictEqual(service.activeTaskCount, 0);
      assert.strictEqual(mockLogger.info.mock.callCount(), 1);
      assert.ok(
        (mockLogger.info.mock.calls[0]?.arguments[0] as string).includes(
          'Config snapshot scheduler stopped'
        )
      );
    });
  });

  describe('domain entity integration', () => {
    test('should support ConfigSnapshotSchedule.recordRun', () => {
      const schedule = createTestSchedule();
      const recorded = schedule.recordRun('success');
      assert.strictEqual(recorded.lastRunStatus, 'success');
      assert.ok(recorded.lastRunAt instanceof Date);
    });

    test('should support ConfigSnapshot with scheduleId', () => {
      const snapshot = createTestSnapshot('test-server', 'schedule-123');
      assert.strictEqual(snapshot.scheduleId, 'schedule-123');
    });
  });
});
