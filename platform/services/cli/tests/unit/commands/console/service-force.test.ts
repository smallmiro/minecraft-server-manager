import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock PM2 adapter methods
const mockStart = vi.fn().mockResolvedValue(undefined);
const mockStop = vi.fn().mockResolvedValue(undefined);
const mockRestart = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockKillDaemon = vi.fn().mockResolvedValue(undefined);
const mockStatus = vi.fn().mockResolvedValue([]);
const mockSave = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn();

vi.mock('../../../../src/infrastructure/adapters/Pm2ServiceManagerAdapter.js', () => ({
  Pm2ServiceManagerAdapter: vi.fn().mockImplementation(() => ({
    start: mockStart,
    stop: mockStop,
    restart: mockRestart,
    delete: mockDelete,
    killDaemon: mockKillDaemon,
    status: mockStatus,
    save: mockSave,
    disconnect: mockDisconnect,
  })),
}));

// Mock @minecraft-docker/shared
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

// Mock @clack/prompts (prevent interactive prompts from blocking tests)
vi.mock('@clack/prompts', () => ({
  select: vi.fn().mockResolvedValue('all'),
  isCancel: vi.fn().mockReturnValue(false),
}));

// Mock pm2-utils
vi.mock('../../../../src/lib/pm2-utils.js', () => ({
  checkPm2Installation: vi.fn().mockReturnValue({ installed: true, version: '5.0.0' }),
  getEcosystemConfigPath: vi.fn().mockReturnValue('/tmp/test-root/ecosystem.config.cjs'),
  ecosystemConfigExists: vi.fn().mockReturnValue(true),
  PM2_SERVICE_NAMES: { API: 'mcctl-api', CONSOLE: 'mcctl-console' },
  getAvailableServices: vi.fn().mockReturnValue(['mcctl-api', 'mcctl-console']),
  checkServiceAvailability: vi.fn().mockReturnValue({
    api: { available: true },
    console: { available: true },
  }),
}));

import { consoleServiceCommand } from '../../../../src/commands/console/service.js';

describe('consoleServiceCommand --force', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsInitialized.mockReturnValue(true);
  });

  describe('stop --force', () => {
    it('should delete all services and kill PM2 daemon', async () => {
      const exitCode = await consoleServiceCommand({
        subCommand: 'stop',
        force: true,
      });

      expect(exitCode).toBe(0);
      // Should delete each service (not stop)
      expect(mockDelete).toHaveBeenCalledWith('mcctl-api');
      expect(mockDelete).toHaveBeenCalledWith('mcctl-console');
      // Should NOT call stop
      expect(mockStop).not.toHaveBeenCalled();
      // Should kill PM2 daemon
      expect(mockKillDaemon).toHaveBeenCalledOnce();
    });

    it('should not kill PM2 daemon without --force', async () => {
      const exitCode = await consoleServiceCommand({
        subCommand: 'stop',
      });

      expect(exitCode).toBe(0);
      // Should call stop (not delete)
      expect(mockStop).toHaveBeenCalledWith('mcctl-api');
      expect(mockStop).toHaveBeenCalledWith('mcctl-console');
      // Should NOT delete or kill daemon
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockKillDaemon).not.toHaveBeenCalled();
    });

    it('should ignore delete errors when force stopping', async () => {
      mockDelete.mockRejectedValueOnce(new Error('Process not found'));

      const exitCode = await consoleServiceCommand({
        subCommand: 'stop',
        force: true,
      });

      expect(exitCode).toBe(0);
      expect(mockKillDaemon).toHaveBeenCalledOnce();
    });
  });

  describe('restart --force', () => {
    it('should delete all services, kill daemon, and start fresh', async () => {
      const exitCode = await consoleServiceCommand({
        subCommand: 'restart',
        force: true,
      });

      expect(exitCode).toBe(0);
      // Should delete each service
      expect(mockDelete).toHaveBeenCalledWith('mcctl-api');
      expect(mockDelete).toHaveBeenCalledWith('mcctl-console');
      // Should kill PM2 daemon
      expect(mockKillDaemon).toHaveBeenCalledOnce();
      // Should start services fresh
      expect(mockStart).toHaveBeenCalledWith('mcctl-api', { wait: true, waitTimeout: 30000 });
      expect(mockStart).toHaveBeenCalledWith('mcctl-console', { wait: true, waitTimeout: 30000 });
      // Should NOT call restart
      expect(mockRestart).not.toHaveBeenCalled();
      // Should save process list
      expect(mockSave).toHaveBeenCalledOnce();
    });

    it('should not kill PM2 daemon without --force', async () => {
      const exitCode = await consoleServiceCommand({
        subCommand: 'restart',
        force: true,
      });

      // Reset for normal restart test
      vi.clearAllMocks();

      const exitCode2 = await consoleServiceCommand({
        subCommand: 'restart',
      });

      expect(exitCode2).toBe(0);
      // Should call restart (not delete + start)
      expect(mockRestart).toHaveBeenCalledWith('mcctl-api', { wait: true, waitTimeout: 30000 });
      expect(mockRestart).toHaveBeenCalledWith('mcctl-console', { wait: true, waitTimeout: 30000 });
      // Should NOT delete or kill daemon
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockKillDaemon).not.toHaveBeenCalled();
    });

    it('should ignore delete errors when force restarting', async () => {
      mockDelete.mockRejectedValueOnce(new Error('Process not found'));

      const exitCode = await consoleServiceCommand({
        subCommand: 'restart',
        force: true,
      });

      expect(exitCode).toBe(0);
      expect(mockKillDaemon).toHaveBeenCalledOnce();
      expect(mockStart).toHaveBeenCalled();
    });
  });
});
