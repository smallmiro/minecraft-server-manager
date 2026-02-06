import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to avoid hoisting issues with vi.mock factory
const { mockConnect, mockDisconnect, mockKillDaemon, mockList } = vi.hoisted(() => ({
  mockConnect: vi.fn((_noDaemon: boolean, cb: (err?: Error) => void) => cb()),
  mockDisconnect: vi.fn(),
  mockKillDaemon: vi.fn((cb: (err?: Error, proc?: any) => void) => cb()),
  mockList: vi.fn((cb: (err?: Error, list?: any[]) => void) => cb(undefined, [])),
}));

vi.mock('pm2', () => ({
  default: {
    connect: mockConnect,
    disconnect: mockDisconnect,
    killDaemon: mockKillDaemon,
    list: mockList,
  },
}));

// Mock pm2-utils
vi.mock('../../../../src/lib/pm2-utils.js', () => ({
  getEcosystemConfigPath: vi.fn().mockReturnValue('/tmp/ecosystem.config.cjs'),
  getPm2LogPaths: vi.fn().mockReturnValue({ output: '/tmp/out.log', error: '/tmp/err.log' }),
  readLogFile: vi.fn().mockReturnValue(''),
  normalizePm2Status: vi.fn().mockReturnValue('online'),
  formatPm2Error: vi.fn((err: any) => (err instanceof Error ? err.message : String(err))),
  PM2_SERVICE_NAMES: { API: 'mcctl-api', CONSOLE: 'mcctl-console' },
}));

// Mock @minecraft-docker/shared
vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual('@minecraft-docker/shared');
  return {
    ...actual,
    Paths: vi.fn().mockImplementation(() => ({
      root: '/tmp/test-root',
      platform: '/tmp/test-platform',
    })),
  };
});

import { Pm2ServiceManagerAdapter } from '../../../../src/infrastructure/adapters/Pm2ServiceManagerAdapter.js';
import { Paths } from '@minecraft-docker/shared';

describe('Pm2ServiceManagerAdapter', () => {
  let adapter: Pm2ServiceManagerAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockImplementation((_noDaemon: boolean, cb: (err?: Error) => void) => cb());
    mockKillDaemon.mockImplementation((cb: (err?: Error, proc?: any) => void) => cb());
    adapter = new Pm2ServiceManagerAdapter(new Paths('/tmp/test-root'));
  });

  describe('killDaemon', () => {
    it('should call pm2.killDaemon and mark as disconnected', async () => {
      await adapter.killDaemon();

      // Should have connected first
      expect(mockConnect).toHaveBeenCalledOnce();
      // Should have called killDaemon
      expect(mockKillDaemon).toHaveBeenCalledOnce();
      // After killDaemon, disconnect should be no-op (connected = false)
      adapter.disconnect();
      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it('should throw formatted error on pm2 failure', async () => {
      mockKillDaemon.mockImplementationOnce((cb: (err?: Error) => void) => {
        cb(new Error('Permission denied'));
      });

      await expect(adapter.killDaemon()).rejects.toThrow('Failed to kill PM2 daemon: Permission denied');
    });

    it('should set connected to false even on error', async () => {
      mockKillDaemon.mockImplementationOnce((cb: (err?: Error) => void) => {
        cb(new Error('Some error'));
      });

      try {
        await adapter.killDaemon();
      } catch {
        // Expected
      }

      // Should be disconnected - calling disconnect should be no-op
      adapter.disconnect();
      expect(mockDisconnect).not.toHaveBeenCalled();
    });
  });
});
