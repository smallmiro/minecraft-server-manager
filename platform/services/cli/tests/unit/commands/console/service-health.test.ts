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
const mockLogs = vi.fn().mockResolvedValue('');

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
    logs: mockLogs,
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
import { ProcessInfo, ServiceStatusEnum } from '@minecraft-docker/shared';

const procs = () => [
  ProcessInfo.create({ pmId: 0, name: 'mcctl-api', status: ServiceStatusEnum.ONLINE }),
  ProcessInfo.create({ pmId: 1, name: 'mcctl-console', status: ServiceStatusEnum.ONLINE }),
];

describe('consoleServiceCommand health probe', () => {
  const mockFetch = vi.fn();
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsInitialized.mockReturnValue(true);
    mockStatus.mockResolvedValue(procs());
    mockLogs.mockResolvedValue('');
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', mockFetch);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('status: healthy when PM2 online and HTTP ok', async () => {
    expect(await consoleServiceCommand({ subCommand: 'status' })).toBe(0);
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:5001/health', expect.anything());
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:5000/api/auth/get-session', expect.anything());
  });

  it('status: API 500 on /health is unhealthy, reason in --json', async () => {
    mockFetch.mockImplementation(async (url: string) =>
      url.endsWith('/health') ? { ok: false, status: 500 } : { ok: true, status: 200 }
    );
    expect(await consoleServiceCommand({ subCommand: 'status', json: true })).toBe(1);
    const out = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(out.api.health).toBe('HTTP 500');
    expect(out.healthy).toBe(false);
  });

  it('status: console connection error is unhealthy; 401 is fine', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('get-session')) throw new Error('ECONNREFUSED');
      return { ok: true, status: 200 };
    });
    expect(await consoleServiceCommand({ subCommand: 'status', json: true })).toBe(1);
    expect(JSON.parse(logSpy.mock.calls[0][0] as string).console.health).toBe('unreachable');

    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    // api /health 401 is non-2xx -> only console is tolerant
    logSpy.mockClear();
    await consoleServiceCommand({ subCommand: 'status', json: true });
    expect(JSON.parse(logSpy.mock.calls[0][0] as string).console.health).toBeUndefined();
  });

  it('status: prints native module hint when error log has NODE_MODULE_VERSION', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    mockLogs.mockResolvedValue('Error: NODE_MODULE_VERSION 127 ... ERR_DLOPEN_FAILED');
    const { log } = await import('@minecraft-docker/shared');
    expect(await consoleServiceCommand({ subCommand: 'status' })).toBe(1);
    expect(mockLogs).toHaveBeenCalledWith('mcctl-api', { err: true, lines: 50 });
    expect(vi.mocked(log.info).mock.calls.flat().join('\n')).toContain('pm2 kill');
  });

  it('start: returns 1 when services stay unhealthy after retries', async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const p = consoleServiceCommand({ subCommand: 'start' });
    await vi.advanceTimersByTimeAsync(20000);
    expect(await p).toBe(1);
    vi.useRealTimers();
  });

  it('restart: retries until healthy and returns 0', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue({ ok: true, status: 200 });
    const p = consoleServiceCommand({ subCommand: 'restart' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toBe(0);
    vi.useRealTimers();
  });
});
