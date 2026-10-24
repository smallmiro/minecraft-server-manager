import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSelect = vi.hoisted(() => vi.fn().mockResolvedValue('all'));
const mockLogError = vi.hoisted(() => vi.fn());

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
      error: mockLogError,
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
  select: (...args: unknown[]) => mockSelect(...args),
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

const NO_TERMINAL_MESSAGE =
  'No terminal to ask which services to ACTION. Pass --console (API + Console) or --api.';

function setTty(value: boolean | undefined) {
  Object.defineProperty(process.stdin, 'isTTY', { value, configurable: true });
}

describe('consoleServiceCommand without a terminal', () => {
  const originalTty = process.stdin.isTTY;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsInitialized.mockReturnValue(true);
  });

  afterEach(() => setTty(originalTty));

  describe('stdin is not a TTY and no --api/--console', () => {
    beforeEach(() => setTty(undefined));

    it.each(['start', 'restart', 'stop', 'logs'] as const)(
      '%s exits 1 with a hint instead of prompting',
      async (subCommand) => {
        const exitCode = await consoleServiceCommand({ subCommand });

        expect(exitCode).toBe(1);
        expect(mockSelect).not.toHaveBeenCalled();
        expect(mockLogError).toHaveBeenCalledWith(NO_TERMINAL_MESSAGE.replace('ACTION', subCommand));
        expect(mockStart).not.toHaveBeenCalled();
        expect(mockStop).not.toHaveBeenCalled();
        expect(mockRestart).not.toHaveBeenCalled();
      }
    );

    it('--console still works', async () => {
      const exitCode = await consoleServiceCommand({ subCommand: 'stop', consoleOnly: true });

      expect(exitCode).toBe(0);
      expect(mockSelect).not.toHaveBeenCalled();
      expect(mockStop).toHaveBeenCalledWith('mcctl-console');
    });

    it('--api still works', async () => {
      const exitCode = await consoleServiceCommand({ subCommand: 'start', apiOnly: true });

      expect(exitCode).toBe(0);
      expect(mockSelect).not.toHaveBeenCalled();
      expect(mockStart).toHaveBeenCalledWith('mcctl-api', expect.anything());
    });
  });

  it('prompts when stdin is a TTY', async () => {
    setTty(true);

    const exitCode = await consoleServiceCommand({ subCommand: 'stop' });

    expect(exitCode).toBe(0);
    expect(mockSelect).toHaveBeenCalledOnce();
  });
});
