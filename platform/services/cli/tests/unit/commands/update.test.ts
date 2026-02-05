import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process
const mockSpawnSync = vi.fn<any>().mockReturnValue({
  status: 0,
  stdout: '',
  stderr: '',
  pid: 0,
  output: [],
  signal: null,
});
vi.mock('child_process', () => ({
  spawnSync: (...args: any[]) => mockSpawnSync(...args),
}));

// Mock @clack/prompts
const mockSpinnerStart = vi.fn();
const mockSpinnerStop = vi.fn();
vi.mock('@clack/prompts', () => ({
  spinner: () => ({
    start: mockSpinnerStart,
    stop: mockSpinnerStop,
  }),
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
}));

// Mock update-checker
const mockGetInstalledVersion = vi.fn().mockReturnValue('1.8.0');
const mockFetchLatestVersionForced = vi.fn().mockResolvedValue('1.8.0');
const mockGetCachedVersion = vi.fn().mockReturnValue('1.8.0');
const mockClearCache = vi.fn();
const mockIsUpdateAvailable = vi.fn().mockReturnValue(false);
vi.mock('../../../src/lib/update-checker.js', () => ({
  getInstalledVersion: () => mockGetInstalledVersion(),
  fetchLatestVersionForced: () => mockFetchLatestVersionForced(),
  getCachedVersion: () => mockGetCachedVersion(),
  clearCache: () => mockClearCache(),
  isUpdateAvailable: (...args: any[]) => mockIsUpdateAvailable(...args),
}));

// Mock pm2-utils
const mockCheckServiceAvailability = vi.fn().mockReturnValue({
  api: { available: false },
  console: { available: false },
});
vi.mock('../../../src/lib/pm2-utils.js', () => ({
  checkServiceAvailability: (...args: any[]) => mockCheckServiceAvailability(...args),
  PM2_SERVICE_NAMES: {
    API: 'mcctl-api',
    CONSOLE: 'mcctl-console',
  },
}));

// Mock Pm2ServiceManagerAdapter
const mockRestart = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn();
vi.mock('../../../src/infrastructure/adapters/Pm2ServiceManagerAdapter.js', () => ({
  Pm2ServiceManagerAdapter: vi.fn().mockImplementation(() => ({
    restart: mockRestart,
    disconnect: mockDisconnect,
  })),
}));

// Mock @minecraft-docker/shared
vi.mock('@minecraft-docker/shared', () => ({
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
  Paths: vi.fn().mockImplementation(() => ({
    platform: '/tmp/test-platform',
    root: '/tmp/test-root',
  })),
}));

// Mock node:fs
const mockExistsSync = vi.fn().mockReturnValue(false);
const mockReadFileSync = vi.fn().mockReturnValue('{}');
vi.mock('node:fs', () => ({
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
  existsSync: (...args: any[]) => mockExistsSync(...args),
}));

import { updateCommand, updateServices, fetchLatestServiceVersion, getInstalledServiceVersion } from '../../../src/commands/update.js';

describe('update command', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output during tests
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Default: no CLI update, cached version available
    mockGetCachedVersion.mockReturnValue('1.8.0');
    mockIsUpdateAvailable.mockReturnValue(false);
    mockCheckServiceAvailability.mockReturnValue({
      api: { available: false },
      console: { available: false },
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('without --all flag', () => {
    it('should not call checkServiceAvailability', async () => {
      await updateCommand({ check: false, force: false, yes: false });

      expect(mockCheckServiceAvailability).not.toHaveBeenCalled();
    });
  });

  describe('with --all flag', () => {
    it('should call checkServiceAvailability when --all is set', async () => {
      await updateCommand({ all: true, yes: true });

      expect(mockCheckServiceAvailability).toHaveBeenCalled();
    });

    it('should skip services that are not installed', async () => {
      mockCheckServiceAvailability.mockReturnValue({
        api: { available: false },
        console: { available: false },
      });

      const exitCode = await updateCommand({ all: true, yes: true });

      expect(exitCode).toBe(0);
      expect(mockCheckServiceAvailability).toHaveBeenCalled();
      // npm install should NOT be called for services
      const serviceInstallCalls = mockSpawnSync.mock.calls.filter(
        (call: any[]) => call[0] === 'npm' && call[1]?.[0] === 'install' && call[1]?.[1]?.includes('mcctl-api')
      );
      expect(serviceInstallCalls.length).toBe(0);
    });

    it('should show service versions with --check --all without installing', async () => {
      mockCheckServiceAvailability.mockReturnValue({
        api: { available: true, path: '/tmp/node_modules/@minecraft-docker/mcctl-api/dist/index.js' },
        console: { available: false },
      });

      // Mock fetchLatestServiceVersion via global fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: '1.9.0' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      // isUpdateAvailable returns true for service comparison
      mockIsUpdateAvailable.mockImplementation((current: string, latest: string) => {
        if (current === '1.8.0' && latest === '1.9.0') return true;
        return false;
      });

      await updateCommand({ check: true, all: true, yes: false });

      expect(mockCheckServiceAvailability).toHaveBeenCalled();
      // npm install should NOT be called (check-only mode)
      const installCalls = mockSpawnSync.mock.calls.filter(
        (call: any[]) => call[0] === 'npm' && call[1]?.[0] === 'install'
      );
      expect(installCalls.length).toBe(0);
    });
  });

  describe('updateServices', () => {
    it('should return 0 when no services are installed', async () => {
      mockCheckServiceAvailability.mockReturnValue({
        api: { available: false },
        console: { available: false },
      });

      const exitCode = await updateServices('/tmp/test-root', { yes: true });

      expect(exitCode).toBe(0);
    });

    it('should update installed services and restart PM2', async () => {
      mockCheckServiceAvailability.mockReturnValue({
        api: { available: true, path: '/tmp/node_modules/@minecraft-docker/mcctl-api/dist/index.js' },
        console: { available: false },
      });

      // Mock fetch for npm registry
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: '1.9.0' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      // isUpdateAvailable returns true
      mockIsUpdateAvailable.mockReturnValue(true);

      // Mock spawnSync for npm install
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: '',
        stderr: '',
        pid: 0,
        output: [],
        signal: null,
      });

      const exitCode = await updateServices('/tmp/test-root', { yes: true });

      expect(exitCode).toBe(0);
      // Should have called npm install for mcctl-api
      const installCalls = mockSpawnSync.mock.calls.filter(
        (call: any[]) => call[0] === 'npm' && call[1]?.[0] === 'install'
      );
      expect(installCalls.length).toBe(1);
      expect(installCalls[0][1][1]).toBe('@minecraft-docker/mcctl-api@latest');
      // Should have called PM2 restart
      expect(mockRestart).toHaveBeenCalledWith('mcctl-api');
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should not install in check-only mode', async () => {
      mockCheckServiceAvailability.mockReturnValue({
        api: { available: true, path: '/tmp/node_modules/@minecraft-docker/mcctl-api/dist/index.js' },
        console: { available: false },
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: '1.9.0' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      mockIsUpdateAvailable.mockReturnValue(true);

      const exitCode = await updateServices('/tmp/test-root', { check: true });

      expect(exitCode).toBe(0);
      // npm install should NOT be called
      const installCalls = mockSpawnSync.mock.calls.filter(
        (call: any[]) => call[0] === 'npm' && call[1]?.[0] === 'install'
      );
      expect(installCalls.length).toBe(0);
      // PM2 should NOT be restarted
      expect(mockRestart).not.toHaveBeenCalled();
    });
  });

  describe('fetchLatestServiceVersion', () => {
    it('should fetch version from npm registry', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: '1.9.0' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const version = await fetchLatestServiceVersion('@minecraft-docker/mcctl-api');

      expect(version).toBe('1.9.0');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/@minecraft-docker/mcctl-api/latest',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should return null on fetch failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
      });
      vi.stubGlobal('fetch', mockFetch);

      const version = await fetchLatestServiceVersion('@minecraft-docker/mcctl-api');

      expect(version).toBeNull();
    });
  });

  describe('getInstalledServiceVersion', () => {
    it('should return null when package is not installed', () => {
      mockExistsSync.mockReturnValue(false);

      const version = getInstalledServiceVersion('/tmp/root', '@minecraft-docker/mcctl-api');

      expect(version).toBeNull();
    });

    it('should return version from package.json', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.7.11' }));

      const version = getInstalledServiceVersion('/tmp/root', '@minecraft-docker/mcctl-api');

      expect(version).toBe('1.7.11');
    });
  });
});
