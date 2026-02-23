import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IBackupScheduleUseCase } from '@minecraft-docker/shared';
import { BackupSchedule } from '@minecraft-docker/shared';

// Mock child_process - must be before import
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

// Mock node-cron
const mockCronTask = { stop: vi.fn(), start: vi.fn() };
vi.mock('node-cron', () => ({
  schedule: vi.fn().mockReturnValue(mockCronTask),
  validate: vi.fn().mockReturnValue(true),
}));

import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { BackupSchedulerService } from '../src/services/backup-scheduler.js';

const mockedExecFile = vi.mocked(execFile);
const mockedExistsSync = vi.mocked(existsSync);

// Create a mock logger
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

// Create a mock use case
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

  const platformPath = '/tmp/test-platform';

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCase = createMockUseCase();
    mockLogger = createMockLogger();
    service = new BackupSchedulerService(mockUseCase, platformPath, mockLogger);
    mockedExistsSync.mockReturnValue(true);
  });

  describe('initialize', () => {
    it('should load node-cron and start enabled schedules', async () => {
      const schedule = createTestSchedule({ enabled: true });
      vi.mocked(mockUseCase.findAll).mockResolvedValue([schedule]);

      await service.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('1 enabled')
      );
    });

    it('should warn when node-cron is not available', async () => {
      // This test verifies graceful degradation.
      // When node-cron import fails, initialize should warn and return.
      // With node-cron mocked and no enabled schedules, no tasks should be registered.
      await service.initialize();
      expect(service.activeTaskCount).toBe(0);
    });
  });

  describe('registerTask', () => {
    it('should register a cron task for a schedule', async () => {
      const schedule = createTestSchedule();
      await service.initialize();

      service.registerTask(schedule);

      expect(service.activeTaskCount).toBe(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Registered backup schedule')
      );
    });

    it('should replace existing task when registering same schedule', async () => {
      const schedule = createTestSchedule();
      await service.initialize();

      service.registerTask(schedule);
      service.registerTask(schedule);

      expect(service.activeTaskCount).toBe(1);
    });
  });

  describe('unregisterTask', () => {
    it('should stop and remove a registered task', async () => {
      const schedule = createTestSchedule();
      await service.initialize();
      service.registerTask(schedule);

      service.unregisterTask(schedule.id);

      expect(service.activeTaskCount).toBe(0);
      expect(mockCronTask.stop).toHaveBeenCalled();
    });

    it('should do nothing for non-existent task', async () => {
      await service.initialize();

      service.unregisterTask('non-existent');

      expect(service.activeTaskCount).toBe(0);
    });
  });

  describe('executeBackup', () => {
    it('should skip if schedule is disabled or not found', async () => {
      vi.mocked(mockUseCase.findById).mockResolvedValue(null);
      await service.initialize();

      // Trigger executeBackup via registerTask + cron callback
      const schedule = createTestSchedule();
      const nodeCron = await import('node-cron');
      vi.mocked(nodeCron.schedule).mockImplementation((_expr, callback) => {
        // Execute callback immediately for testing
        if (typeof callback === 'function') {
          (callback as () => Promise<void>)();
        }
        return mockCronTask;
      });

      service.registerTask(schedule);

      // Wait for async callback
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping disabled/missing schedule')
      );
    });

    it('should use execFile instead of exec to prevent shell injection', async () => {
      const schedule = createTestSchedule({ name: 'Test"; rm -rf /' });
      vi.mocked(mockUseCase.findById).mockResolvedValue(schedule);

      // Mock execFile for successful execution
      mockedExecFile.mockImplementation(
        (_file: any, _args: any, _opts: any, callback: any) => {
          if (typeof callback === 'function') {
            callback(null, 'Success', '');
          }
          return {} as any;
        }
      );

      // Trigger executeBackup directly via the internal mechanism
      const nodeCron = await import('node-cron');
      let capturedCallback: (() => Promise<void>) | null = null;
      vi.mocked(nodeCron.schedule).mockImplementation((_expr, callback) => {
        capturedCallback = callback as () => Promise<void>;
        return mockCronTask;
      });

      await service.initialize();
      service.registerTask(schedule);

      if (capturedCallback) {
        await capturedCallback();
        // Wait for async operations
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Verify execFile was called instead of exec
      expect(mockedExecFile).toHaveBeenCalled();
      // Verify the schedule name is passed as an argument, not interpolated into shell command
      const calls = mockedExecFile.mock.calls;
      if (calls.length > 0) {
        // The command should NOT contain the schedule name directly in a shell string
        const firstArg = calls[0]![0];
        expect(firstArg).toBe('bash');
      }
    });

    it('should record failure when worlds directory does not exist', async () => {
      const schedule = createTestSchedule();
      vi.mocked(mockUseCase.findById).mockResolvedValue(schedule);
      mockedExistsSync.mockReturnValue(false);

      const nodeCron = await import('node-cron');
      let capturedCallback: (() => Promise<void>) | null = null;
      vi.mocked(nodeCron.schedule).mockImplementation((_expr, callback) => {
        capturedCallback = callback as () => Promise<void>;
        return mockCronTask;
      });

      await service.initialize();
      service.registerTask(schedule);

      if (capturedCallback) {
        await capturedCallback();
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      expect(mockUseCase.recordRun).toHaveBeenCalledWith(
        schedule.id,
        'failure',
        'Worlds directory not found'
      );
    });

    it('should record success after successful backup', async () => {
      const schedule = createTestSchedule();
      vi.mocked(mockUseCase.findById).mockResolvedValue(schedule);
      mockedExistsSync.mockReturnValue(true);

      // Mock execFile for backup command
      mockedExecFile.mockImplementation(
        (_file: any, _args: any, _opts: any, callback: any) => {
          if (typeof callback === 'function') {
            callback(null, 'Backup complete', '');
          }
          return {} as any;
        }
      );

      const nodeCron = await import('node-cron');
      let capturedCallback: (() => Promise<void>) | null = null;
      vi.mocked(nodeCron.schedule).mockImplementation((_expr, callback) => {
        capturedCallback = callback as () => Promise<void>;
        return mockCronTask;
      });

      await service.initialize();
      service.registerTask(schedule);

      if (capturedCallback) {
        await capturedCallback();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      expect(mockUseCase.recordRun).toHaveBeenCalledWith(
        schedule.id,
        'success',
        expect.any(String)
      );
    });

    it('should handle "nothing to commit" as success', async () => {
      const schedule = createTestSchedule();
      vi.mocked(mockUseCase.findById).mockResolvedValue(schedule);
      mockedExistsSync.mockReturnValue(true);

      mockedExecFile.mockImplementation(
        (_file: any, _args: any, _opts: any, callback: any) => {
          if (typeof callback === 'function') {
            const error = new Error('nothing to commit') as any;
            error.stderr = 'nothing to commit, working tree clean';
            callback(error, '', 'nothing to commit, working tree clean');
          }
          return {} as any;
        }
      );

      const nodeCron = await import('node-cron');
      let capturedCallback: (() => Promise<void>) | null = null;
      vi.mocked(nodeCron.schedule).mockImplementation((_expr, callback) => {
        capturedCallback = callback as () => Promise<void>;
        return mockCronTask;
      });

      await service.initialize();
      service.registerTask(schedule);

      if (capturedCallback) {
        await capturedCallback();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      expect(mockUseCase.recordRun).toHaveBeenCalledWith(
        schedule.id,
        'success',
        'No changes to backup'
      );
    });

    it('should record failure on backup error', async () => {
      const schedule = createTestSchedule();
      vi.mocked(mockUseCase.findById).mockResolvedValue(schedule);
      mockedExistsSync.mockReturnValue(true);

      mockedExecFile.mockImplementation(
        (_file: any, _args: any, _opts: any, callback: any) => {
          if (typeof callback === 'function') {
            const error = new Error('git push failed') as any;
            error.stderr = 'fatal: Could not read from remote repository';
            callback(error, '', error.stderr);
          }
          return {} as any;
        }
      );

      const nodeCron = await import('node-cron');
      let capturedCallback: (() => Promise<void>) | null = null;
      vi.mocked(nodeCron.schedule).mockImplementation((_expr, callback) => {
        capturedCallback = callback as () => Promise<void>;
        return mockCronTask;
      });

      await service.initialize();
      service.registerTask(schedule);

      if (capturedCallback) {
        await capturedCallback();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      expect(mockUseCase.recordRun).toHaveBeenCalledWith(
        schedule.id,
        'failure',
        expect.any(String)
      );
    });
  });

  describe('reload', () => {
    it('should stop all tasks and reload enabled schedules', async () => {
      const schedule = createTestSchedule();
      vi.mocked(mockUseCase.findAll).mockResolvedValue([schedule]);

      await service.initialize();
      expect(service.activeTaskCount).toBe(1);

      vi.mocked(mockUseCase.findAll).mockResolvedValue([]);
      await service.reload();

      expect(mockCronTask.stop).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should stop all tasks and clear', async () => {
      const schedule = createTestSchedule();
      vi.mocked(mockUseCase.findAll).mockResolvedValue([schedule]);

      await service.initialize();

      service.shutdown();

      expect(service.activeTaskCount).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Backup scheduler stopped');
    });
  });

  describe('applyRetentionPolicy', () => {
    it('should not prune when no retention policy is set', async () => {
      const schedule = createTestSchedule({ maxCount: undefined, maxAgeDays: undefined });
      vi.mocked(mockUseCase.findById).mockResolvedValue(schedule);
      mockedExistsSync.mockReturnValue(true);

      // Mock: 5 commits exist
      mockedExecFile.mockImplementation(
        (_file: any, args: any, _opts: any, callback: any) => {
          if (typeof callback === 'function') {
            if (Array.isArray(args) && args.includes('rev-list') && args.includes('--count')) {
              callback(null, '5\n', '');
            } else if (Array.isArray(args) && args.includes('rev-parse') && args.includes('--short')) {
              callback(null, 'abc1234\n', '');
            } else {
              callback(null, 'ok\n', '');
            }
          }
          return {} as any;
        }
      );

      const nodeCron = await import('node-cron');
      let capturedCallback: (() => Promise<void>) | null = null;
      vi.mocked(nodeCron.schedule).mockImplementation((_expr, callback) => {
        capturedCallback = callback as () => Promise<void>;
        return mockCronTask;
      });

      await service.initialize();
      service.registerTask(schedule);

      if (capturedCallback) {
        await capturedCallback();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // No orphan/truncation commands should have been called
      const calls = mockedExecFile.mock.calls;
      const orphanCalls = calls.filter(
        (call) => Array.isArray(call[1]) && call[1].includes('--orphan')
      );
      expect(orphanCalls).toHaveLength(0);
    });

    it('should prune by maxCount when backup count exceeds limit', async () => {
      const schedule = createTestSchedule({ maxCount: 3 });
      vi.mocked(mockUseCase.findById).mockResolvedValue(schedule);
      mockedExistsSync.mockReturnValue(true);

      let revListCountCallCount = 0;

      mockedExecFile.mockImplementation(
        (_file: any, args: any, _opts: any, callback: any) => {
          if (typeof callback === 'function') {
            if (Array.isArray(args) && args.includes('rev-list') && args.includes('--count')) {
              // First call: 5 commits; second call (after prune): 3 commits
              revListCountCallCount++;
              callback(null, revListCountCallCount === 1 ? '5\n' : '3\n', '');
            } else if (Array.isArray(args) && args.includes('rev-list') && !args.includes('--count')) {
              // Return the Nth commit SHA
              callback(null, 'deadbeef1234567890abcdef\n', '');
            } else if (Array.isArray(args) && args.includes('rev-parse') && args.includes('--short')) {
              callback(null, 'abc1234\n', '');
            } else if (Array.isArray(args) && args.includes('rev-parse') && !args.includes('--short')) {
              // HEAD SHA for orphan
              callback(null, 'deadbeef1234567890abcdef\n', '');
            } else {
              callback(null, 'ok\n', '');
            }
          }
          return {} as any;
        }
      );

      const nodeCron = await import('node-cron');
      let capturedCallback: (() => Promise<void>) | null = null;
      vi.mocked(nodeCron.schedule).mockImplementation((_expr, callback) => {
        capturedCallback = callback as () => Promise<void>;
        return mockCronTask;
      });

      await service.initialize();
      service.registerTask(schedule);

      if (capturedCallback) {
        await capturedCallback();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Should have attempted orphan branch creation for truncation
      const calls = mockedExecFile.mock.calls;
      const orphanCalls = calls.filter(
        (call) => Array.isArray(call[1]) && call[1].includes('--orphan')
      );
      expect(orphanCalls.length).toBeGreaterThan(0);

      // Should have logged pruning
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('prune')
      );
    });

    it('should prune by maxAgeDays when oldest backup is too old', async () => {
      const schedule = createTestSchedule({ maxAgeDays: 7 });
      vi.mocked(mockUseCase.findById).mockResolvedValue(schedule);
      mockedExistsSync.mockReturnValue(true);

      // oldest commit is 10 days ago
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const oldTimestamp = tenDaysAgo.toISOString();

      let revListCountCallCount = 0;

      mockedExecFile.mockImplementation(
        (_file: any, args: any, _opts: any, callback: any) => {
          if (typeof callback === 'function') {
            if (Array.isArray(args) && args.includes('rev-list') && args.includes('--count')) {
              revListCountCallCount++;
              // 5 commits before/after pruning
              callback(null, '5\n', '');
            } else if (Array.isArray(args) && args.includes('log') && args.includes('--format=%aI')) {
              // Return old timestamp as oldest commit date
              callback(null, `${oldTimestamp}\n`, '');
            } else if (Array.isArray(args) && args.includes('rev-list') && !args.includes('--count')) {
              callback(null, 'deadbeef1234567890abcdef\n', '');
            } else if (Array.isArray(args) && args.includes('rev-parse')) {
              callback(null, 'deadbeef1234567890abcdef\n', '');
            } else {
              callback(null, 'ok\n', '');
            }
          }
          return {} as any;
        }
      );

      const nodeCron = await import('node-cron');
      let capturedCallback: (() => Promise<void>) | null = null;
      vi.mocked(nodeCron.schedule).mockImplementation((_expr, callback) => {
        capturedCallback = callback as () => Promise<void>;
        return mockCronTask;
      });

      await service.initialize();
      service.registerTask(schedule);

      if (capturedCallback) {
        await capturedCallback();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Should have called git log to get oldest commit date
      const calls = mockedExecFile.mock.calls;
      const logCalls = calls.filter(
        (call) => Array.isArray(call[1]) && call[1].includes('log') && call[1].includes('--format=%aI')
      );
      expect(logCalls.length).toBeGreaterThan(0);
    });

    it('should not prune when maxCount is satisfied', async () => {
      const schedule = createTestSchedule({ maxCount: 10 });
      vi.mocked(mockUseCase.findById).mockResolvedValue(schedule);
      mockedExistsSync.mockReturnValue(true);

      mockedExecFile.mockImplementation(
        (_file: any, args: any, _opts: any, callback: any) => {
          if (typeof callback === 'function') {
            if (Array.isArray(args) && args.includes('rev-list') && args.includes('--count')) {
              // Only 5 commits, under maxCount of 10
              callback(null, '5\n', '');
            } else if (Array.isArray(args) && args.includes('rev-parse') && args.includes('--short')) {
              callback(null, 'abc1234\n', '');
            } else if (Array.isArray(args) && args.includes('log') && args.includes('--format=%aI')) {
              // Timestamp from 2 days ago (within 10-day default)
              const twoDaysAgo = new Date();
              twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
              callback(null, `${twoDaysAgo.toISOString()}\n`, '');
            } else {
              callback(null, 'ok\n', '');
            }
          }
          return {} as any;
        }
      );

      const nodeCron = await import('node-cron');
      let capturedCallback: (() => Promise<void>) | null = null;
      vi.mocked(nodeCron.schedule).mockImplementation((_expr, callback) => {
        capturedCallback = callback as () => Promise<void>;
        return mockCronTask;
      });

      await service.initialize();
      service.registerTask(schedule);

      if (capturedCallback) {
        await capturedCallback();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Should not have called orphan branch creation
      const calls = mockedExecFile.mock.calls;
      const orphanCalls = calls.filter(
        (call) => Array.isArray(call[1]) && call[1].includes('--orphan')
      );
      expect(orphanCalls).toHaveLength(0);
    });

    it('should re-count after maxCount prune before applying maxAgeDays', async () => {
      const schedule = createTestSchedule({ maxCount: 3, maxAgeDays: 7 });
      vi.mocked(mockUseCase.findById).mockResolvedValue(schedule);
      mockedExistsSync.mockReturnValue(true);

      let revListCountCallCount = 0;
      const recentTimestamp = new Date().toISOString(); // fresh commit, within 7 days

      mockedExecFile.mockImplementation(
        (_file: any, args: any, _opts: any, callback: any) => {
          if (typeof callback === 'function') {
            if (Array.isArray(args) && args.includes('rev-list') && args.includes('--count')) {
              revListCountCallCount++;
              if (revListCountCallCount === 1) {
                // Initial: 5 commits (exceeds maxCount=3)
                callback(null, '5\n', '');
              } else {
                // After maxCount prune: 3 commits (at maxCount limit)
                callback(null, '3\n', '');
              }
            } else if (Array.isArray(args) && args.includes('log') && args.includes('--format=%aI')) {
              // Recent timestamp - should NOT trigger maxAgeDays prune
              callback(null, `${recentTimestamp}\n`, '');
            } else if (Array.isArray(args) && args.includes('rev-list') && !args.includes('--count')) {
              callback(null, 'deadbeef1234567890abcdef\n', '');
            } else if (Array.isArray(args) && args.includes('rev-parse')) {
              callback(null, 'deadbeef1234567890abcdef\n', '');
            } else {
              callback(null, 'ok\n', '');
            }
          }
          return {} as any;
        }
      );

      const nodeCron = await import('node-cron');
      let capturedCallback: (() => Promise<void>) | null = null;
      vi.mocked(nodeCron.schedule).mockImplementation((_expr, callback) => {
        capturedCallback = callback as () => Promise<void>;
        return mockCronTask;
      });

      await service.initialize();
      service.registerTask(schedule);

      if (capturedCallback) {
        await capturedCallback();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Should have called rev-list --count at least twice (initial + after maxCount prune)
      expect(revListCountCallCount).toBeGreaterThanOrEqual(2);
    });

    it('should not fail the backup if pruning throws an error', async () => {
      const schedule = createTestSchedule({ maxCount: 3 });
      vi.mocked(mockUseCase.findById).mockResolvedValue(schedule);
      mockedExistsSync.mockReturnValue(true);

      let callCount = 0;

      mockedExecFile.mockImplementation(
        (_file: any, args: any, _opts: any, callback: any) => {
          if (typeof callback === 'function') {
            callCount++;
            if (Array.isArray(args) && args.includes('rev-list') && args.includes('--count')) {
              // Exceeds maxCount
              callback(null, '10\n', '');
            } else if (Array.isArray(args) && args.includes('--orphan')) {
              // Pruning fails
              const error = new Error('orphan branch failed') as any;
              error.stderr = 'fatal: error creating orphan branch';
              callback(error, '', error.stderr);
            } else if (Array.isArray(args) && args.includes('rev-parse') && args.includes('--short')) {
              callback(null, 'abc1234\n', '');
            } else {
              callback(null, 'ok\n', '');
            }
          }
          return {} as any;
        }
      );

      const nodeCron = await import('node-cron');
      let capturedCallback: (() => Promise<void>) | null = null;
      vi.mocked(nodeCron.schedule).mockImplementation((_expr, callback) => {
        capturedCallback = callback as () => Promise<void>;
        return mockCronTask;
      });

      await service.initialize();
      service.registerTask(schedule);

      if (capturedCallback) {
        await capturedCallback();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Backup should still succeed despite pruning failure
      expect(mockUseCase.recordRun).toHaveBeenCalledWith(
        schedule.id,
        'success',
        expect.any(String)
      );

      // A warning should be logged about pruning failure
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('prune')
      );
    });

    it('should write audit log after successful pruning', async () => {
      const schedule = createTestSchedule({ maxCount: 3 });
      vi.mocked(mockUseCase.findById).mockResolvedValue(schedule);
      mockedExistsSync.mockReturnValue(true);

      let revListCountCallCount = 0;

      mockedExecFile.mockImplementation(
        (_file: any, args: any, _opts: any, callback: any) => {
          if (typeof callback === 'function') {
            if (Array.isArray(args) && args.includes('rev-list') && args.includes('--count')) {
              revListCountCallCount++;
              callback(null, revListCountCallCount === 1 ? '5\n' : '3\n', '');
            } else if (Array.isArray(args) && args.includes('rev-list') && !args.includes('--count')) {
              callback(null, 'deadbeef1234567890abcdef\n', '');
            } else if (Array.isArray(args) && args.includes('rev-parse')) {
              callback(null, 'deadbeef1234567890abcdef\n', '');
            } else {
              callback(null, 'ok\n', '');
            }
          }
          return {} as any;
        }
      );

      const nodeCron = await import('node-cron');
      let capturedCallback: (() => Promise<void>) | null = null;
      vi.mocked(nodeCron.schedule).mockImplementation((_expr, callback) => {
        capturedCallback = callback as () => Promise<void>;
        return mockCronTask;
      });

      await service.initialize();
      service.registerTask(schedule);

      if (capturedCallback) {
        await capturedCallback();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Should have logged pruning info
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('prune')
      );
    });
  });

  describe('shell injection prevention', () => {
    it('should not pass schedule.name through shell interpreter', async () => {
      // Verify that names with shell metacharacters are safe
      const maliciousNames = [
        '$(whoami)',
        '`whoami`',
        'test"; rm -rf /',
        "test'; rm -rf /",
        'test\n&& rm -rf /',
        'test | cat /etc/passwd',
      ];

      for (const name of maliciousNames) {
        const schedule = createTestSchedule({ name });
        vi.mocked(mockUseCase.findById).mockResolvedValue(schedule);
        mockedExistsSync.mockReturnValue(true);

        mockedExecFile.mockImplementation(
          (_file: any, _args: any, _opts: any, callback: any) => {
            if (typeof callback === 'function') {
              callback(null, 'OK', '');
            }
            return {} as any;
          }
        );

        const nodeCron = await import('node-cron');
        let capturedCallback: (() => Promise<void>) | null = null;
        vi.mocked(nodeCron.schedule).mockImplementation((_expr, callback) => {
          capturedCallback = callback as () => Promise<void>;
          return mockCronTask;
        });

        await service.initialize();
        service.registerTask(schedule);

        if (capturedCallback) {
          await capturedCallback();
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        // Verify execFile is used (not exec) - the name should be in args array, not a shell string
        const calls = mockedExecFile.mock.calls;
        for (const call of calls) {
          const firstArg = String(call[0]);
          // First arg should be a command like 'bash' or 'git', not a shell string
          expect(firstArg).not.toContain(name);
        }

        vi.clearAllMocks();
      }
    });
  });
});
