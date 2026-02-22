import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IBackupScheduleUseCase, BackupSchedule } from '@minecraft-docker/shared';

// Mock IBackupScheduleUseCase
const mockCreate = vi.fn();
const mockFindAll = vi.fn().mockResolvedValue([]);
const mockFindById = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn().mockResolvedValue(undefined);
const mockEnable = vi.fn();
const mockDisable = vi.fn();
const mockRecordRun = vi.fn();

const mockBackupScheduleUseCase: IBackupScheduleUseCase = {
  create: mockCreate,
  findAll: mockFindAll,
  findById: mockFindById,
  update: mockUpdate,
  remove: mockRemove,
  enable: mockEnable,
  disable: mockDisable,
  recordRun: mockRecordRun,
};

// Mock Paths
const mockIsInitialized = vi.fn().mockReturnValue(true);
vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual('@minecraft-docker/shared');
  return {
    ...actual,
    Paths: vi.fn().mockImplementation(() => ({
      isInitialized: mockIsInitialized,
      root: '/tmp/test-root',
      platform: '/tmp/test-platform',
    })),
    log: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
    colors: {
      bold: (s: string) => s,
      cyan: (s: string) => s,
      yellow: (s: string) => s,
      green: (s: string) => s,
      dim: (s: string) => s,
      red: (s: string) => s,
    },
  };
});

// Mock getContainer
const mockGetContainer = vi.fn().mockReturnValue({
  backupScheduleUseCase: mockBackupScheduleUseCase,
});
vi.mock('../../../src/infrastructure/di/container.js', () => ({
  getContainer: (...args: any[]) => mockGetContainer(...args),
}));

import { backupScheduleCommand } from '../../../src/commands/backup-schedule.js';
import { BackupSchedule as BSEntity, CronExpression, BackupRetentionPolicy } from '@minecraft-docker/shared';

// Helper to create a mock BackupSchedule entity
function createMockSchedule(overrides?: Partial<{
  id: string;
  name: string;
  cron: string;
  enabled: boolean;
  maxCount: number;
  maxAgeDays: number;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  lastRunMessage: string | null;
}>): BackupSchedule {
  return BSEntity.create({
    id: overrides?.id ?? 'test-id-1',
    name: overrides?.name ?? 'Test Backup',
    cronExpression: overrides?.cron ?? '0 3 * * *',
    enabled: overrides?.enabled ?? true,
    retentionPolicy: {
      maxCount: overrides?.maxCount,
      maxAgeDays: overrides?.maxAgeDays,
    },
  });
}

describe('backup schedule command', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockIsInitialized.mockReturnValue(true);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('unknown subcommand', () => {
    it('should return error for unknown subcommand', async () => {
      const exitCode = await backupScheduleCommand({ subCommand: 'unknown' });
      expect(exitCode).toBe(1);
    });
  });

  describe('list subcommand', () => {
    it('should default to list subcommand', async () => {
      mockFindAll.mockResolvedValue([]);
      const exitCode = await backupScheduleCommand({});
      expect(exitCode).toBe(0);
      expect(mockFindAll).toHaveBeenCalled();
    });

    it('should show empty message when no schedules exist', async () => {
      mockFindAll.mockResolvedValue([]);
      const exitCode = await backupScheduleCommand({ subCommand: 'list' });
      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No backup schedules configured')
      );
    });

    it('should display schedules', async () => {
      const schedule = createMockSchedule({
        name: 'Daily Backup',
        cron: '0 3 * * *',
        enabled: true,
      });
      mockFindAll.mockResolvedValue([schedule]);

      const exitCode = await backupScheduleCommand({ subCommand: 'list' });

      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Daily Backup')
      );
    });

    it('should display retention policy info when set', async () => {
      const schedule = createMockSchedule({
        name: 'With Retention',
        maxCount: 5,
        maxAgeDays: 14,
      });
      mockFindAll.mockResolvedValue([schedule]);

      const exitCode = await backupScheduleCommand({ subCommand: 'list' });

      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('max 5 backups')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('max 14 days')
      );
    });

    it('should output JSON when --json flag is set', async () => {
      const schedule = createMockSchedule({ name: 'JSON Test' });
      mockFindAll.mockResolvedValue([schedule]);

      const exitCode = await backupScheduleCommand({
        subCommand: 'list',
        json: true,
      });

      expect(exitCode).toBe(0);
      // Should have logged JSON output
      expect(consoleLogSpy).toHaveBeenCalled();
      const jsonCall = consoleLogSpy.mock.calls.find((call) => {
        try {
          JSON.parse(call[0] as string);
          return true;
        } catch {
          return false;
        }
      });
      expect(jsonCall).toBeDefined();
    });

    it('should return error on exception', async () => {
      mockFindAll.mockRejectedValue(new Error('Database error'));
      const exitCode = await backupScheduleCommand({ subCommand: 'list' });
      expect(exitCode).toBe(1);
    });
  });

  describe('add subcommand', () => {
    it('should return error when --cron is missing', async () => {
      const exitCode = await backupScheduleCommand({ subCommand: 'add' });
      expect(exitCode).toBe(1);
    });

    it('should create a schedule with cron expression', async () => {
      const schedule = createMockSchedule({ name: 'New Schedule', cron: '0 3 * * *' });
      mockCreate.mockResolvedValue(schedule);

      const exitCode = await backupScheduleCommand({
        subCommand: 'add',
        cron: '0 3 * * *',
        name: 'New Schedule',
      });

      expect(exitCode).toBe(0);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Schedule',
          cron: '0 3 * * *',
        })
      );
    });

    it('should create a schedule with cron preset', async () => {
      const schedule = createMockSchedule({ name: 'Preset Schedule', cron: '0 3 * * *' });
      mockCreate.mockResolvedValue(schedule);

      const exitCode = await backupScheduleCommand({
        subCommand: 'add',
        cron: 'daily',
        name: 'Preset Schedule',
      });

      expect(exitCode).toBe(0);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          cron: '0 3 * * *', // daily preset resolves to this
        })
      );
    });

    it('should create with retention options', async () => {
      const schedule = createMockSchedule({
        name: 'Retention',
        maxCount: 10,
        maxAgeDays: 30,
      });
      mockCreate.mockResolvedValue(schedule);

      const exitCode = await backupScheduleCommand({
        subCommand: 'add',
        cron: '0 0 * * *',
        name: 'Retention',
        maxCount: 10,
        maxAgeDays: 30,
      });

      expect(exitCode).toBe(0);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          maxCount: 10,
          maxAgeDays: 30,
        })
      );
    });

    it('should use default name when not provided', async () => {
      const schedule = createMockSchedule({ name: 'Backup Schedule' });
      mockCreate.mockResolvedValue(schedule);

      const exitCode = await backupScheduleCommand({
        subCommand: 'add',
        cron: '0 0 * * *',
      });

      expect(exitCode).toBe(0);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Backup Schedule',
        })
      );
    });

    it('should output JSON when --json flag is set', async () => {
      const schedule = createMockSchedule({ name: 'JSON Add' });
      mockCreate.mockResolvedValue(schedule);

      const exitCode = await backupScheduleCommand({
        subCommand: 'add',
        cron: '0 0 * * *',
        json: true,
      });

      expect(exitCode).toBe(0);
      const jsonCall = consoleLogSpy.mock.calls.find((call) => {
        try {
          JSON.parse(call[0] as string);
          return true;
        } catch {
          return false;
        }
      });
      expect(jsonCall).toBeDefined();
    });

    it('should return error on creation failure', async () => {
      mockCreate.mockRejectedValue(new Error('Invalid cron'));
      const exitCode = await backupScheduleCommand({
        subCommand: 'add',
        cron: 'invalid',
      });
      expect(exitCode).toBe(1);
    });
  });

  describe('remove subcommand', () => {
    it('should return error when schedule ID is missing', async () => {
      const exitCode = await backupScheduleCommand({ subCommand: 'remove' });
      expect(exitCode).toBe(1);
    });

    it('should return error when schedule not found', async () => {
      mockFindById.mockResolvedValue(null);
      const exitCode = await backupScheduleCommand({
        subCommand: 'remove',
        scheduleId: 'nonexistent',
      });
      expect(exitCode).toBe(1);
    });

    it('should remove an existing schedule', async () => {
      const schedule = createMockSchedule({ id: 'to-remove', name: 'Remove Me' });
      mockFindById.mockResolvedValue(schedule);
      mockRemove.mockResolvedValue(undefined);

      const exitCode = await backupScheduleCommand({
        subCommand: 'remove',
        scheduleId: 'to-remove',
      });

      expect(exitCode).toBe(0);
      expect(mockRemove).toHaveBeenCalledWith('to-remove');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Removed schedule')
      );
    });

    it('should return error on removal failure', async () => {
      mockFindById.mockResolvedValue(createMockSchedule());
      mockRemove.mockRejectedValue(new Error('DB error'));

      const exitCode = await backupScheduleCommand({
        subCommand: 'remove',
        scheduleId: 'test-id',
      });
      expect(exitCode).toBe(1);
    });
  });

  describe('enable subcommand', () => {
    it('should return error when schedule ID is missing', async () => {
      const exitCode = await backupScheduleCommand({ subCommand: 'enable' });
      expect(exitCode).toBe(1);
    });

    it('should enable a schedule', async () => {
      const schedule = createMockSchedule({ enabled: true, name: 'Enabled Schedule' });
      mockEnable.mockResolvedValue(schedule);

      const exitCode = await backupScheduleCommand({
        subCommand: 'enable',
        scheduleId: 'test-id',
      });

      expect(exitCode).toBe(0);
      expect(mockEnable).toHaveBeenCalledWith('test-id');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Enabled schedule')
      );
    });

    it('should return error on enable failure', async () => {
      mockEnable.mockRejectedValue(new Error('Schedule not found'));
      const exitCode = await backupScheduleCommand({
        subCommand: 'enable',
        scheduleId: 'nonexistent',
      });
      expect(exitCode).toBe(1);
    });
  });

  describe('disable subcommand', () => {
    it('should return error when schedule ID is missing', async () => {
      const exitCode = await backupScheduleCommand({ subCommand: 'disable' });
      expect(exitCode).toBe(1);
    });

    it('should disable a schedule', async () => {
      const schedule = createMockSchedule({ enabled: false, name: 'Disabled Schedule' });
      mockDisable.mockResolvedValue(schedule);

      const exitCode = await backupScheduleCommand({
        subCommand: 'disable',
        scheduleId: 'test-id',
      });

      expect(exitCode).toBe(0);
      expect(mockDisable).toHaveBeenCalledWith('test-id');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Disabled schedule')
      );
    });

    it('should return error on disable failure', async () => {
      mockDisable.mockRejectedValue(new Error('Schedule not found'));
      const exitCode = await backupScheduleCommand({
        subCommand: 'disable',
        scheduleId: 'nonexistent',
      });
      expect(exitCode).toBe(1);
    });
  });
});
