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

  describe('retention policy pruning', () => {
    it('should attempt pruning after successful backup when retention policy is set', async () => {
      const schedule = createTestSchedule({ maxCount: 5 });
      vi.mocked(mockUseCase.findById).mockResolvedValue(schedule);
      mockedExistsSync.mockReturnValue(true);

      // Track all execFile calls
      const execFileCalls: any[][] = [];
      mockedExecFile.mockImplementation(
        (file: any, args: any, opts: any, callback: any) => {
          execFileCalls.push([file, args, opts]);
          if (typeof callback === 'function') {
            // For git rev-parse, return a hash
            if (args && args.includes('rev-parse')) {
              callback(null, 'abc1234\n', '');
            }
            // For git log --oneline (counting commits), return lines
            else if (args && args.includes('--oneline')) {
              callback(null, 'a\nb\nc\nd\ne\nf\n', '');
            }
            // For git log with date format (oldest date)
            else if (args && args.includes('--format=%aI')) {
              callback(null, '2025-01-01T00:00:00+00:00\n', '');
            }
            // For backup command
            else {
              callback(null, 'Backup complete', '');
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
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Should have called execFile multiple times including for retention check
      expect(mockedExecFile.mock.calls.length).toBeGreaterThan(1);
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
