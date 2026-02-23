import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  configSnapshotScheduleListCommand,
  configSnapshotScheduleAddCommand,
  configSnapshotScheduleRemoveCommand,
  configSnapshotScheduleToggleCommand,
  type ConfigSnapshotScheduleListOptions,
  type ConfigSnapshotScheduleAddOptions,
  type ConfigSnapshotScheduleRemoveOptions,
  type ConfigSnapshotScheduleToggleOptions,
} from '../../src/commands/config-snapshot/index.js';
import { getContainer } from '../../src/infrastructure/di/container.js';

vi.mock('../../src/infrastructure/di/container.js');
vi.mock('@clack/prompts', () => ({
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
  text: vi.fn().mockResolvedValue('Daily Snapshot'),
  select: vi.fn().mockResolvedValue('myserver'),
  intro: vi.fn(),
  outro: vi.fn(),
}));
vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual('@minecraft-docker/shared');
  return {
    ...actual,
    Paths: vi.fn().mockImplementation(() => ({
      isInitialized: vi.fn().mockReturnValue(true),
      root: '/tmp/test',
      servers: '/tmp/test/servers',
    })),
  };
});

/**
 * Build a mock schedule object
 */
function buildMockSchedule(overrides = {}) {
  return {
    id: 'sched-id-001',
    serverName: { value: 'myserver' },
    name: 'Daily Snapshot',
    cronExpression: {
      expression: '0 3 * * *',
      toHumanReadable: () => 'At 03:00 AM every day',
    },
    enabled: true,
    retentionCount: 10,
    lastRunAt: null,
    lastRunStatus: null,
    createdAt: new Date('2026-02-22T09:00:00Z'),
    updatedAt: new Date('2026-02-22T09:00:00Z'),
    toJSON: () => ({
      id: 'sched-id-001',
      serverName: 'myserver',
      name: 'Daily Snapshot',
      cronExpression: '0 3 * * *',
      cronHumanReadable: 'At 03:00 AM every day',
      enabled: true,
      retentionCount: 10,
      lastRunAt: null,
      lastRunStatus: null,
      createdAt: '2026-02-22T09:00:00.000Z',
      updatedAt: '2026-02-22T09:00:00.000Z',
    }),
    ...overrides,
  };
}

describe('config-snapshot schedule commands', () => {
  let mockScheduleUseCase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockScheduleUseCase = {
      create: vi.fn().mockResolvedValue(buildMockSchedule()),
      findAll: vi.fn().mockResolvedValue([buildMockSchedule()]),
      findByServer: vi.fn().mockResolvedValue([buildMockSchedule()]),
      enable: vi.fn().mockResolvedValue(undefined),
      disable: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(buildMockSchedule()),
    };

    vi.mocked(getContainer).mockReturnValue({
      configSnapshotScheduleUseCase: mockScheduleUseCase,
    } as any);
  });

  // ─────────────────────────────────────────────────────────────
  // schedule list
  // ─────────────────────────────────────────────────────────────
  describe('configSnapshotScheduleListCommand', () => {
    it('should list all schedules', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleListOptions = {
        root: '/tmp/test',
      };

      const exitCode = await configSnapshotScheduleListCommand(options);

      expect(exitCode).toBe(0);
      expect(mockScheduleUseCase.findAll).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should filter by server when --server option is given', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleListOptions = {
        root: '/tmp/test',
        serverName: 'myserver',
      };

      const exitCode = await configSnapshotScheduleListCommand(options);

      expect(exitCode).toBe(0);
      expect(mockScheduleUseCase.findByServer).toHaveBeenCalledWith('myserver');
      consoleSpy.mockRestore();
    });

    it('should output JSON when --json flag is set', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleListOptions = {
        root: '/tmp/test',
        json: true,
      };

      const exitCode = await configSnapshotScheduleListCommand(options);

      expect(exitCode).toBe(0);
      const jsonOutput = consoleSpy.mock.calls.find((call) => {
        try {
          JSON.parse(call[0]);
          return true;
        } catch {
          return false;
        }
      });
      expect(jsonOutput).toBeDefined();
      consoleSpy.mockRestore();
    });

    it('should show empty message when no schedules found', async () => {
      mockScheduleUseCase.findAll.mockResolvedValue([]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleListOptions = {
        root: '/tmp/test',
      };

      const exitCode = await configSnapshotScheduleListCommand(options);

      expect(exitCode).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No schedules')
      );
      consoleSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // schedule add
  // ─────────────────────────────────────────────────────────────
  describe('configSnapshotScheduleAddCommand', () => {
    it('should add a schedule with required args', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleAddOptions = {
        root: '/tmp/test',
        serverName: 'myserver',
        cron: '0 3 * * *',
        name: 'Daily Snapshot',
        retention: 10,
      };

      const exitCode = await configSnapshotScheduleAddCommand(options);

      expect(exitCode).toBe(0);
      expect(mockScheduleUseCase.create).toHaveBeenCalledWith(
        'myserver',
        'Daily Snapshot',
        '0 3 * * *',
        10
      );
      consoleSpy.mockRestore();
    });

    it('should use default retention when not specified', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleAddOptions = {
        root: '/tmp/test',
        serverName: 'myserver',
        cron: '0 3 * * *',
        name: 'Daily Snapshot',
      };

      const exitCode = await configSnapshotScheduleAddCommand(options);

      expect(exitCode).toBe(0);
      expect(mockScheduleUseCase.create).toHaveBeenCalledWith(
        'myserver',
        'Daily Snapshot',
        '0 3 * * *',
        10
      );
      consoleSpy.mockRestore();
    });

    it('should return 1 when server name is missing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleAddOptions = {
        root: '/tmp/test',
        cron: '0 3 * * *',
        name: 'Daily Snapshot',
      };

      const exitCode = await configSnapshotScheduleAddCommand(options);

      expect(exitCode).toBe(1);
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should return 1 when cron expression is missing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleAddOptions = {
        root: '/tmp/test',
        serverName: 'myserver',
        name: 'Daily Snapshot',
      };

      const exitCode = await configSnapshotScheduleAddCommand(options);

      expect(exitCode).toBe(1);
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should return 1 when name is missing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleAddOptions = {
        root: '/tmp/test',
        serverName: 'myserver',
        cron: '0 3 * * *',
      };

      const exitCode = await configSnapshotScheduleAddCommand(options);

      expect(exitCode).toBe(1);
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should output JSON when --json flag is set', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleAddOptions = {
        root: '/tmp/test',
        serverName: 'myserver',
        cron: '0 3 * * *',
        name: 'Daily Snapshot',
        json: true,
      };

      const exitCode = await configSnapshotScheduleAddCommand(options);

      expect(exitCode).toBe(0);
      const jsonOutput = consoleSpy.mock.calls.find((call) => {
        try {
          JSON.parse(call[0]);
          return true;
        } catch {
          return false;
        }
      });
      expect(jsonOutput).toBeDefined();
      consoleSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // schedule remove
  // ─────────────────────────────────────────────────────────────
  describe('configSnapshotScheduleRemoveCommand', () => {
    it('should remove schedule with confirmation', async () => {
      const { confirm } = await import('@clack/prompts');
      vi.mocked(confirm).mockResolvedValue(true);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleRemoveOptions = {
        root: '/tmp/test',
        id: 'sched-id-001',
      };

      const exitCode = await configSnapshotScheduleRemoveCommand(options);

      expect(exitCode).toBe(0);
      expect(mockScheduleUseCase.delete).toHaveBeenCalledWith('sched-id-001');
      consoleSpy.mockRestore();
    });

    it('should skip confirmation with --force flag', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleRemoveOptions = {
        root: '/tmp/test',
        id: 'sched-id-001',
        force: true,
      };

      const exitCode = await configSnapshotScheduleRemoveCommand(options);

      expect(exitCode).toBe(0);
      expect(mockScheduleUseCase.delete).toHaveBeenCalledWith('sched-id-001');
      consoleSpy.mockRestore();
    });

    it('should cancel when user declines', async () => {
      const { confirm, isCancel } = await import('@clack/prompts');
      vi.mocked(confirm).mockResolvedValue(false);
      vi.mocked(isCancel).mockReturnValue(false);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleRemoveOptions = {
        root: '/tmp/test',
        id: 'sched-id-001',
      };

      const exitCode = await configSnapshotScheduleRemoveCommand(options);

      expect(exitCode).toBe(0);
      expect(mockScheduleUseCase.delete).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should return 1 when schedule ID is missing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleRemoveOptions = {
        root: '/tmp/test',
        id: '',
      };

      const exitCode = await configSnapshotScheduleRemoveCommand(options);

      expect(exitCode).toBe(1);
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // schedule enable / disable
  // ─────────────────────────────────────────────────────────────
  describe('configSnapshotScheduleToggleCommand', () => {
    it('should enable a schedule', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleToggleOptions = {
        root: '/tmp/test',
        id: 'sched-id-001',
        action: 'enable',
      };

      const exitCode = await configSnapshotScheduleToggleCommand(options);

      expect(exitCode).toBe(0);
      expect(mockScheduleUseCase.enable).toHaveBeenCalledWith('sched-id-001');
      consoleSpy.mockRestore();
    });

    it('should disable a schedule', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleToggleOptions = {
        root: '/tmp/test',
        id: 'sched-id-001',
        action: 'disable',
      };

      const exitCode = await configSnapshotScheduleToggleCommand(options);

      expect(exitCode).toBe(0);
      expect(mockScheduleUseCase.disable).toHaveBeenCalledWith('sched-id-001');
      consoleSpy.mockRestore();
    });

    it('should return 1 when schedule ID is missing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleToggleOptions = {
        root: '/tmp/test',
        id: '',
        action: 'enable',
      };

      const exitCode = await configSnapshotScheduleToggleCommand(options);

      expect(exitCode).toBe(1);
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should return 1 on error', async () => {
      mockScheduleUseCase.enable.mockRejectedValue(new Error('Schedule not found'));
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const options: ConfigSnapshotScheduleToggleOptions = {
        root: '/tmp/test',
        id: 'nonexistent',
        action: 'enable',
      };

      const exitCode = await configSnapshotScheduleToggleCommand(options);

      expect(exitCode).toBe(1);
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
