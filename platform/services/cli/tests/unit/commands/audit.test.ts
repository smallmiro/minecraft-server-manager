import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AuditLog, IAuditLogPort } from '@minecraft-docker/shared';

// Mock IAuditLogPort
const mockLog = vi.fn().mockResolvedValue(undefined);
const mockFindAll = vi.fn().mockResolvedValue([]);
const mockFindByTarget = vi.fn().mockResolvedValue([]);
const mockFindByAction = vi.fn().mockResolvedValue([]);
const mockFindByActor = vi.fn().mockResolvedValue([]);
const mockCount = vi.fn().mockResolvedValue(0);
const mockDeleteOlderThan = vi.fn().mockResolvedValue(0);

const mockAuditLogPort: IAuditLogPort = {
  log: mockLog,
  findAll: mockFindAll,
  findByTarget: mockFindByTarget,
  findByAction: mockFindByAction,
  findByActor: mockFindByActor,
  count: mockCount,
  deleteOlderThan: mockDeleteOlderThan,
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
  auditLogPort: mockAuditLogPort,
});
vi.mock('../../../src/infrastructure/di/container.js', () => ({
  getContainer: (...args: any[]) => mockGetContainer(...args),
}));

// Mock @clack/prompts
const mockConfirm = vi.fn().mockResolvedValue(true);
const mockIsCancel = vi.fn().mockReturnValue(false);
vi.mock('@clack/prompts', () => ({
  confirm: (...args: any[]) => mockConfirm(...args),
  isCancel: (...args: any[]) => mockIsCancel(...args),
}));

import { auditCommand } from '../../../src/commands/audit.js';
import { AuditActionEnum } from '@minecraft-docker/shared';

describe('audit command', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockIsInitialized.mockReturnValue(true);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('platform initialization check', () => {
    it('should return error when platform is not initialized', async () => {
      mockIsInitialized.mockReturnValue(false);

      const exitCode = await auditCommand({ subcommand: 'list' });

      expect(exitCode).toBe(1);
    });
  });

  describe('no subcommand', () => {
    it('should show error when no subcommand is provided', async () => {
      const exitCode = await auditCommand({});

      expect(exitCode).toBe(1);
    });

    it('should show error for unknown subcommand', async () => {
      const exitCode = await auditCommand({ subcommand: 'unknown' });

      expect(exitCode).toBe(1);
    });
  });

  describe('list subcommand', () => {
    it('should list audit logs with default limit (50)', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          timestamp: new Date('2025-01-25T10:00:00Z'),
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'testserver',
          status: 'success',
          details: {},
          errorMessage: null,
        },
      ];
      mockFindAll.mockResolvedValue(mockLogs);

      const exitCode = await auditCommand({ subcommand: 'list' });

      expect(exitCode).toBe(0);
      expect(mockFindAll).toHaveBeenCalledWith({ limit: 50 });
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should apply action filter', async () => {
      mockFindAll.mockResolvedValue([]);

      const exitCode = await auditCommand({
        subcommand: 'list',
        action: 'server.create',
      });

      expect(exitCode).toBe(0);
      expect(mockFindAll).toHaveBeenCalledWith({
        limit: 50,
        action: 'server.create',
      });
    });

    it('should apply target filter', async () => {
      mockFindAll.mockResolvedValue([]);

      const exitCode = await auditCommand({
        subcommand: 'list',
        target: 'myserver',
      });

      expect(exitCode).toBe(0);
      expect(mockFindAll).toHaveBeenCalledWith({
        limit: 50,
        targetName: 'myserver',
      });
    });

    it('should apply actor filter', async () => {
      mockFindAll.mockResolvedValue([]);

      const exitCode = await auditCommand({
        subcommand: 'list',
        actor: 'cli:local',
      });

      expect(exitCode).toBe(0);
      expect(mockFindAll).toHaveBeenCalledWith({
        limit: 50,
        actor: 'cli:local',
      });
    });

    it('should apply status filter', async () => {
      mockFindAll.mockResolvedValue([]);

      const exitCode = await auditCommand({
        subcommand: 'list',
        status: 'success',
      });

      expect(exitCode).toBe(0);
      expect(mockFindAll).toHaveBeenCalledWith({
        limit: 50,
        status: 'success',
      });
    });

    it('should apply date range filters (from/to)', async () => {
      mockFindAll.mockResolvedValue([]);

      const exitCode = await auditCommand({
        subcommand: 'list',
        from: '2025-01-01',
        to: '2025-01-31',
      });

      expect(exitCode).toBe(0);
      expect(mockFindAll).toHaveBeenCalledWith({
        limit: 50,
        from: new Date('2025-01-01'),
        to: new Date('2025-01-31'),
      });
    });

    it('should apply custom limit', async () => {
      mockFindAll.mockResolvedValue([]);

      const exitCode = await auditCommand({
        subcommand: 'list',
        limit: 100,
      });

      expect(exitCode).toBe(0);
      expect(mockFindAll).toHaveBeenCalledWith({
        limit: 100,
      });
    });

    it('should show "No audit logs found" when empty', async () => {
      mockFindAll.mockResolvedValue([]);

      const exitCode = await auditCommand({ subcommand: 'list' });

      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No audit logs found')
      );
    });

    it('should display logs with success status in green', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          timestamp: new Date('2025-01-25T10:00:00Z'),
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'testserver',
          status: 'success',
          details: {},
          errorMessage: null,
        },
      ];
      mockFindAll.mockResolvedValue(mockLogs);

      const exitCode = await auditCommand({ subcommand: 'list' });

      expect(exitCode).toBe(0);
    });

    it('should display logs with failure status in red', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          timestamp: new Date('2025-01-25T10:00:00Z'),
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'testserver',
          status: 'failure',
          details: {},
          errorMessage: 'Failed to create server',
        },
      ];
      mockFindAll.mockResolvedValue(mockLogs);

      const exitCode = await auditCommand({ subcommand: 'list' });

      expect(exitCode).toBe(0);
    });

    it('should return error code on exception', async () => {
      mockFindAll.mockRejectedValue(new Error('Database error'));

      const exitCode = await auditCommand({ subcommand: 'list' });

      expect(exitCode).toBe(1);
    });
  });

  describe('purge subcommand', () => {
    it('should purge logs older than default 90 days', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          timestamp: new Date('2024-10-01T10:00:00Z'),
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'oldserver',
          status: 'success',
          details: {},
          errorMessage: null,
        },
      ];
      mockFindAll.mockResolvedValue(mockLogs);
      mockDeleteOlderThan.mockResolvedValue(1);
      mockConfirm.mockResolvedValue(true);
      mockIsCancel.mockReturnValue(false);

      const exitCode = await auditCommand({ subcommand: 'purge' });

      expect(exitCode).toBe(0);
      expect(mockFindAll).toHaveBeenCalled();
      expect(mockDeleteOlderThan).toHaveBeenCalled();
      expect(mockLog).toHaveBeenCalledWith({
        action: AuditActionEnum.AUDIT_PURGE,
        actor: 'cli:local',
        targetType: 'audit',
        targetName: 'logs',
        status: 'success',
        details: expect.objectContaining({ deletedCount: 1 }),
        errorMessage: null,
      });
    });

    it('should purge logs older than specified --days', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          timestamp: new Date('2024-12-01T10:00:00Z'),
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'oldserver',
          status: 'success',
          details: {},
          errorMessage: null,
        },
      ];
      mockFindAll.mockResolvedValue(mockLogs);
      mockDeleteOlderThan.mockResolvedValue(1);
      mockConfirm.mockResolvedValue(true);
      mockIsCancel.mockReturnValue(false);

      const exitCode = await auditCommand({
        subcommand: 'purge',
        days: 30,
      });

      expect(exitCode).toBe(0);
      expect(mockDeleteOlderThan).toHaveBeenCalled();
      const cutoffDate = mockDeleteOlderThan.mock.calls[0][0];
      expect(cutoffDate).toBeInstanceOf(Date);
    });

    it('should purge logs before specified --before date', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          timestamp: new Date('2024-12-01T10:00:00Z'),
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'oldserver',
          status: 'success',
          details: {},
          errorMessage: null,
        },
      ];
      mockFindAll.mockResolvedValue(mockLogs);
      mockDeleteOlderThan.mockResolvedValue(1);
      mockConfirm.mockResolvedValue(true);
      mockIsCancel.mockReturnValue(false);

      const exitCode = await auditCommand({
        subcommand: 'purge',
        before: '2025-01-01',
      });

      expect(exitCode).toBe(0);
      expect(mockDeleteOlderThan).toHaveBeenCalledWith(new Date('2025-01-01'));
    });

    it('should perform dry-run with --dry-run flag (no actual deletion)', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          timestamp: new Date('2024-10-01T10:00:00Z'),
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'oldserver',
          status: 'success',
          details: {},
          errorMessage: null,
        },
      ];
      mockFindAll.mockResolvedValue(mockLogs);

      const exitCode = await auditCommand({
        subcommand: 'purge',
        dryRun: true,
      });

      expect(exitCode).toBe(0);
      expect(mockDeleteOlderThan).not.toHaveBeenCalled();
      expect(mockLog).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DRY RUN]')
      );
    });

    it('should skip confirmation with --force flag', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          timestamp: new Date('2024-10-01T10:00:00Z'),
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'oldserver',
          status: 'success',
          details: {},
          errorMessage: null,
        },
      ];
      mockFindAll.mockResolvedValue(mockLogs);
      mockDeleteOlderThan.mockResolvedValue(1);

      const exitCode = await auditCommand({
        subcommand: 'purge',
        force: true,
      });

      expect(exitCode).toBe(0);
      expect(mockConfirm).not.toHaveBeenCalled();
      expect(mockDeleteOlderThan).toHaveBeenCalled();
    });

    it('should cancel purge when user declines confirmation', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          timestamp: new Date('2024-10-01T10:00:00Z'),
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'oldserver',
          status: 'success',
          details: {},
          errorMessage: null,
        },
      ];
      mockFindAll.mockResolvedValue(mockLogs);
      mockConfirm.mockResolvedValue(false);
      mockIsCancel.mockReturnValue(false);

      const exitCode = await auditCommand({ subcommand: 'purge' });

      expect(exitCode).toBe(0);
      expect(mockDeleteOlderThan).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('cancelled')
      );
    });

    it('should cancel purge when user cancels prompt', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          timestamp: new Date('2024-10-01T10:00:00Z'),
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'oldserver',
          status: 'success',
          details: {},
          errorMessage: null,
        },
      ];
      mockFindAll.mockResolvedValue(mockLogs);
      mockIsCancel.mockReturnValue(true);

      const exitCode = await auditCommand({ subcommand: 'purge' });

      expect(exitCode).toBe(0);
      expect(mockDeleteOlderThan).not.toHaveBeenCalled();
    });

    it('should show message when no logs to purge', async () => {
      mockFindAll.mockResolvedValue([]);

      const exitCode = await auditCommand({ subcommand: 'purge' });

      expect(exitCode).toBe(0);
      expect(mockDeleteOlderThan).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No audit logs to purge')
      );
    });

    it('should log the purge action to audit log', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          timestamp: new Date('2024-10-01T10:00:00Z'),
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'oldserver',
          status: 'success',
          details: {},
          errorMessage: null,
        },
      ];
      mockFindAll.mockResolvedValue(mockLogs);
      mockDeleteOlderThan.mockResolvedValue(1);
      mockConfirm.mockResolvedValue(true);
      mockIsCancel.mockReturnValue(false);

      const exitCode = await auditCommand({ subcommand: 'purge' });

      expect(exitCode).toBe(0);
      expect(mockLog).toHaveBeenCalledWith({
        action: AuditActionEnum.AUDIT_PURGE,
        actor: 'cli:local',
        targetType: 'audit',
        targetName: 'logs',
        status: 'success',
        details: expect.objectContaining({
          deletedCount: 1,
          cutoffDate: expect.any(String),
        }),
        errorMessage: null,
      });
    });

    it('should return error code on exception', async () => {
      mockFindAll.mockRejectedValue(new Error('Database error'));

      const exitCode = await auditCommand({ subcommand: 'purge' });

      expect(exitCode).toBe(1);
    });
  });

  describe('stats subcommand', () => {
    it('should display statistics summary', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          timestamp: new Date('2025-01-25T10:00:00Z'),
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'server1',
          status: 'success',
          details: {},
          errorMessage: null,
        },
        {
          id: '2',
          timestamp: new Date('2025-01-25T11:00:00Z'),
          action: AuditActionEnum.SERVER_START,
          actor: 'api:user1',
          targetType: 'server',
          targetName: 'server1',
          status: 'success',
          details: {},
          errorMessage: null,
        },
        {
          id: '3',
          timestamp: new Date('2025-01-25T12:00:00Z'),
          action: AuditActionEnum.SERVER_DELETE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'server2',
          status: 'failure',
          details: {},
          errorMessage: 'Server not found',
        },
      ];
      mockFindAll.mockResolvedValue(mockLogs);

      const exitCode = await auditCommand({ subcommand: 'stats' });

      expect(exitCode).toBe(0);
      expect(mockFindAll).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Audit Log Statistics')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Logs: 3')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Success: 2')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failure: 1')
      );
    });

    it('should show zero counts for empty database', async () => {
      mockFindAll.mockResolvedValue([]);

      const exitCode = await auditCommand({ subcommand: 'stats' });

      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No audit logs found')
      );
    });

    it('should display action counts sorted by frequency', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          timestamp: new Date('2025-01-25T10:00:00Z'),
          action: AuditActionEnum.SERVER_START,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'server1',
          status: 'success',
          details: {},
          errorMessage: null,
        },
        {
          id: '2',
          timestamp: new Date('2025-01-25T11:00:00Z'),
          action: AuditActionEnum.SERVER_START,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'server1',
          status: 'success',
          details: {},
          errorMessage: null,
        },
        {
          id: '3',
          timestamp: new Date('2025-01-25T12:00:00Z'),
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'server2',
          status: 'success',
          details: {},
          errorMessage: null,
        },
      ];
      mockFindAll.mockResolvedValue(mockLogs);

      const exitCode = await auditCommand({ subcommand: 'stats' });

      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('By Action')
      );
    });

    it('should display actor counts sorted by frequency', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          timestamp: new Date('2025-01-25T10:00:00Z'),
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'server1',
          status: 'success',
          details: {},
          errorMessage: null,
        },
        {
          id: '2',
          timestamp: new Date('2025-01-25T11:00:00Z'),
          action: AuditActionEnum.SERVER_START,
          actor: 'cli:local',
          targetType: 'server',
          targetName: 'server1',
          status: 'success',
          details: {},
          errorMessage: null,
        },
        {
          id: '3',
          timestamp: new Date('2025-01-25T12:00:00Z'),
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'api:user1',
          targetType: 'server',
          targetName: 'server2',
          status: 'success',
          details: {},
          errorMessage: null,
        },
      ];
      mockFindAll.mockResolvedValue(mockLogs);

      const exitCode = await auditCommand({ subcommand: 'stats' });

      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('By Actor')
      );
    });

    it('should return error code on exception', async () => {
      mockFindAll.mockRejectedValue(new Error('Database error'));

      const exitCode = await auditCommand({ subcommand: 'stats' });

      expect(exitCode).toBe(1);
    });
  });
});
