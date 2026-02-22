import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  configSnapshotListCommand,
  configSnapshotCreateCommand,
  configSnapshotShowCommand,
  configSnapshotDeleteCommand,
  configSnapshotDiffCommand,
  configSnapshotRestoreCommand,
  type ConfigSnapshotListOptions,
  type ConfigSnapshotCreateOptions,
  type ConfigSnapshotShowOptions,
  type ConfigSnapshotDeleteOptions,
  type ConfigSnapshotDiffOptions,
  type ConfigSnapshotRestoreOptions,
} from '../../src/commands/config-snapshot/index.js';
import { getContainer } from '../../src/infrastructure/di/container.js';

vi.mock('../../src/infrastructure/di/container.js');
vi.mock('@clack/prompts', () => ({
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
  text: vi.fn().mockResolvedValue('test description'),
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
 * Build mock snapshot object
 */
function buildMockSnapshot(overrides = {}) {
  return {
    id: 'snap-id-001',
    serverName: { value: 'myserver' },
    createdAt: new Date('2026-02-22T10:00:00Z'),
    description: 'Test snapshot',
    files: [
      { path: 'server.properties', hash: 'abc123', size: 1024 },
      { path: 'ops.json', hash: 'def456', size: 512 },
    ],
    scheduleId: undefined,
    toJSON: () => ({
      id: 'snap-id-001',
      serverName: 'myserver',
      createdAt: '2026-02-22T10:00:00.000Z',
      description: 'Test snapshot',
      files: [
        { path: 'server.properties', hash: 'abc123', size: 1024 },
        { path: 'ops.json', hash: 'def456', size: 512 },
      ],
    }),
    ...overrides,
  };
}

/**
 * Build mock schedule object
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

/**
 * Build mock SnapshotDiff object
 */
function buildMockDiff() {
  return {
    baseSnapshotId: 'snap-id-001',
    compareSnapshotId: 'snap-id-002',
    changes: [
      {
        path: 'server.properties',
        status: 'modified',
        oldContent: 'old content',
        newContent: 'new content',
        oldHash: 'abc',
        newHash: 'xyz',
        toJSON: () => ({
          path: 'server.properties',
          status: 'modified',
          oldContent: 'old content',
          newContent: 'new content',
          oldHash: 'abc',
          newHash: 'xyz',
        }),
      },
      {
        path: 'whitelist.json',
        status: 'added',
        newContent: '[]',
        newHash: 'new-hash',
        toJSON: () => ({
          path: 'whitelist.json',
          status: 'added',
          newContent: '[]',
          newHash: 'new-hash',
        }),
      },
    ],
    summary: { added: 1, modified: 1, deleted: 0 },
    hasChanges: true,
    toJSON: () => ({
      baseSnapshotId: 'snap-id-001',
      compareSnapshotId: 'snap-id-002',
      changes: [],
      summary: { added: 1, modified: 1, deleted: 0 },
      hasChanges: true,
    }),
  };
}

describe('config-snapshot commands', () => {
  let mockUseCase: any;
  let mockScheduleUseCase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseCase = {
      create: vi.fn().mockResolvedValue(buildMockSnapshot()),
      list: vi.fn().mockResolvedValue([buildMockSnapshot()]),
      findById: vi.fn().mockResolvedValue(buildMockSnapshot()),
      diff: vi.fn().mockResolvedValue(buildMockDiff()),
      restore: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(1),
    };

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
      configSnapshotUseCase: mockUseCase,
      configSnapshotScheduleUseCase: mockScheduleUseCase,
    } as any);
  });

  // ─────────────────────────────────────────────────────────────
  // config-snapshot list
  // ─────────────────────────────────────────────────────────────
  describe('configSnapshotListCommand', () => {
    it('should list all snapshots (no server filter)', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotListOptions = {
        root: '/tmp/test',
        limit: 20,
      };

      const exitCode = await configSnapshotListCommand(options);

      expect(exitCode).toBe(0);
      expect(mockUseCase.list).toHaveBeenCalledWith(undefined, 20, undefined);
      consoleSpy.mockRestore();
    });

    it('should list snapshots filtered by server', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotListOptions = {
        root: '/tmp/test',
        serverName: 'myserver',
        limit: 10,
      };

      const exitCode = await configSnapshotListCommand(options);

      expect(exitCode).toBe(0);
      expect(mockUseCase.list).toHaveBeenCalledWith('myserver', 10, undefined);
      consoleSpy.mockRestore();
    });

    it('should output JSON when --json flag is set', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotListOptions = {
        root: '/tmp/test',
        json: true,
      };

      const exitCode = await configSnapshotListCommand(options);

      expect(exitCode).toBe(0);
      // Verify JSON was output
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

    it('should show empty message when no snapshots found', async () => {
      mockUseCase.list.mockResolvedValue([]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotListOptions = {
        root: '/tmp/test',
      };

      const exitCode = await configSnapshotListCommand(options);

      expect(exitCode).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No snapshots'));
      consoleSpy.mockRestore();
    });

    it('should return 1 on error', async () => {
      mockUseCase.list.mockRejectedValue(new Error('DB error'));
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const options: ConfigSnapshotListOptions = {
        root: '/tmp/test',
      };

      const exitCode = await configSnapshotListCommand(options);

      expect(exitCode).toBe(1);
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // config-snapshot create
  // ─────────────────────────────────────────────────────────────
  describe('configSnapshotCreateCommand', () => {
    it('should create a snapshot with server name and description', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotCreateOptions = {
        root: '/tmp/test',
        serverName: 'myserver',
        description: 'My snapshot',
      };

      const exitCode = await configSnapshotCreateCommand(options);

      expect(exitCode).toBe(0);
      expect(mockUseCase.create).toHaveBeenCalledWith('myserver', 'My snapshot');
      consoleSpy.mockRestore();
    });

    it('should create a snapshot without description', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotCreateOptions = {
        root: '/tmp/test',
        serverName: 'myserver',
      };

      const exitCode = await configSnapshotCreateCommand(options);

      expect(exitCode).toBe(0);
      expect(mockUseCase.create).toHaveBeenCalledWith('myserver', undefined);
      consoleSpy.mockRestore();
    });

    it('should output JSON when --json flag is set', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotCreateOptions = {
        root: '/tmp/test',
        serverName: 'myserver',
        json: true,
      };

      const exitCode = await configSnapshotCreateCommand(options);

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

    it('should return 1 on error', async () => {
      mockUseCase.create.mockRejectedValue(new Error('Server not found'));
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const options: ConfigSnapshotCreateOptions = {
        root: '/tmp/test',
        serverName: 'nonexistent',
      };

      const exitCode = await configSnapshotCreateCommand(options);

      expect(exitCode).toBe(1);
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // config-snapshot show
  // ─────────────────────────────────────────────────────────────
  describe('configSnapshotShowCommand', () => {
    it('should show snapshot details', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotShowOptions = {
        root: '/tmp/test',
        id: 'snap-id-001',
      };

      const exitCode = await configSnapshotShowCommand(options);

      expect(exitCode).toBe(0);
      expect(mockUseCase.findById).toHaveBeenCalledWith('snap-id-001');
      consoleSpy.mockRestore();
    });

    it('should include file list when --files flag is set', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotShowOptions = {
        root: '/tmp/test',
        id: 'snap-id-001',
        files: true,
      };

      const exitCode = await configSnapshotShowCommand(options);

      expect(exitCode).toBe(0);
      // File paths should appear in output
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('server.properties')
      );
      consoleSpy.mockRestore();
    });

    it('should output JSON when --json flag is set', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotShowOptions = {
        root: '/tmp/test',
        id: 'snap-id-001',
        json: true,
      };

      const exitCode = await configSnapshotShowCommand(options);

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

    it('should return 1 when snapshot not found', async () => {
      mockUseCase.findById.mockResolvedValue(null);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const options: ConfigSnapshotShowOptions = {
        root: '/tmp/test',
        id: 'nonexistent-id',
      };

      const exitCode = await configSnapshotShowCommand(options);

      expect(exitCode).toBe(1);
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should require snapshot ID', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const options: ConfigSnapshotShowOptions = {
        root: '/tmp/test',
        id: '',
      };

      const exitCode = await configSnapshotShowCommand(options);

      expect(exitCode).toBe(1);
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // config-snapshot delete
  // ─────────────────────────────────────────────────────────────
  describe('configSnapshotDeleteCommand', () => {
    it('should delete snapshot with confirmation', async () => {
      const { confirm } = await import('@clack/prompts');
      vi.mocked(confirm).mockResolvedValue(true);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotDeleteOptions = {
        root: '/tmp/test',
        id: 'snap-id-001',
      };

      const exitCode = await configSnapshotDeleteCommand(options);

      expect(exitCode).toBe(0);
      expect(mockUseCase.findById).toHaveBeenCalledWith('snap-id-001');
      expect(mockUseCase.delete).toHaveBeenCalledWith('snap-id-001');
      consoleSpy.mockRestore();
    });

    it('should skip confirmation with --force flag', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotDeleteOptions = {
        root: '/tmp/test',
        id: 'snap-id-001',
        force: true,
      };

      const exitCode = await configSnapshotDeleteCommand(options);

      expect(exitCode).toBe(0);
      expect(mockUseCase.delete).toHaveBeenCalledWith('snap-id-001');
      consoleSpy.mockRestore();
    });

    it('should cancel when user declines confirmation', async () => {
      const { confirm, isCancel } = await import('@clack/prompts');
      vi.mocked(confirm).mockResolvedValue(false);
      vi.mocked(isCancel).mockReturnValue(false);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotDeleteOptions = {
        root: '/tmp/test',
        id: 'snap-id-001',
      };

      const exitCode = await configSnapshotDeleteCommand(options);

      expect(exitCode).toBe(0);
      expect(mockUseCase.delete).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should return 1 when snapshot not found', async () => {
      mockUseCase.findById.mockResolvedValue(null);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const options: ConfigSnapshotDeleteOptions = {
        root: '/tmp/test',
        id: 'nonexistent',
        force: true,
      };

      const exitCode = await configSnapshotDeleteCommand(options);

      expect(exitCode).toBe(1);
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // config-snapshot diff
  // ─────────────────────────────────────────────────────────────
  describe('configSnapshotDiffCommand', () => {
    it('should diff two snapshots', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotDiffOptions = {
        root: '/tmp/test',
        id1: 'snap-id-001',
        id2: 'snap-id-002',
      };

      const exitCode = await configSnapshotDiffCommand(options);

      expect(exitCode).toBe(0);
      expect(mockUseCase.diff).toHaveBeenCalledWith('snap-id-001', 'snap-id-002');
      consoleSpy.mockRestore();
    });

    it('should show files-only when --files-only flag is set', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotDiffOptions = {
        root: '/tmp/test',
        id1: 'snap-id-001',
        id2: 'snap-id-002',
        filesOnly: true,
      };

      const exitCode = await configSnapshotDiffCommand(options);

      expect(exitCode).toBe(0);
      // Should output file names only
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('server.properties')
      );
      consoleSpy.mockRestore();
    });

    it('should output JSON when --json flag is set', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotDiffOptions = {
        root: '/tmp/test',
        id1: 'snap-id-001',
        id2: 'snap-id-002',
        json: true,
      };

      const exitCode = await configSnapshotDiffCommand(options);

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

    it('should require both snapshot IDs', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const options: ConfigSnapshotDiffOptions = {
        root: '/tmp/test',
        id1: 'snap-id-001',
        id2: '',
      };

      const exitCode = await configSnapshotDiffCommand(options);

      expect(exitCode).toBe(1);
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // config-snapshot restore
  // ─────────────────────────────────────────────────────────────
  describe('configSnapshotRestoreCommand', () => {
    it('should restore snapshot with confirmation', async () => {
      const { confirm } = await import('@clack/prompts');
      vi.mocked(confirm).mockResolvedValue(true);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotRestoreOptions = {
        root: '/tmp/test',
        id: 'snap-id-001',
      };

      const exitCode = await configSnapshotRestoreCommand(options);

      expect(exitCode).toBe(0);
      expect(mockUseCase.findById).toHaveBeenCalledWith('snap-id-001');
      expect(mockUseCase.restore).toHaveBeenCalledWith('snap-id-001', false);
      consoleSpy.mockRestore();
    });

    it('should skip confirmation with --force flag', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const options: ConfigSnapshotRestoreOptions = {
        root: '/tmp/test',
        id: 'snap-id-001',
        force: true,
      };

      const exitCode = await configSnapshotRestoreCommand(options);

      expect(exitCode).toBe(0);
      expect(mockUseCase.restore).toHaveBeenCalledWith('snap-id-001', true);
      consoleSpy.mockRestore();
    });

    it('should return 1 when snapshot not found', async () => {
      mockUseCase.findById.mockResolvedValue(null);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const options: ConfigSnapshotRestoreOptions = {
        root: '/tmp/test',
        id: 'nonexistent',
        force: true,
      };

      const exitCode = await configSnapshotRestoreCommand(options);

      expect(exitCode).toBe(1);
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
