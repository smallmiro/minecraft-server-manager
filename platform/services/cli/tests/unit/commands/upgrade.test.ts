import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockCopyFileSync = vi.fn();
const mockMkdirSync = vi.fn();
vi.mock('node:fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
  writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
  copyFileSync: (...args: any[]) => mockCopyFileSync(...args),
  mkdirSync: (...args: any[]) => mockMkdirSync(...args),
}));

// Mock child_process (docker compose up -d router)
const mockExecSync = vi.fn();
vi.mock('node:child_process', () => ({
  execSync: (...args: any[]) => mockExecSync(...args),
}));

// Mock @clack/prompts
const mockSpinnerStart = vi.fn();
const mockSpinnerStop = vi.fn();
const mockConfirm = vi.fn().mockResolvedValue(true);
const mockText = vi.fn();
vi.mock('@clack/prompts', () => ({
  spinner: () => ({
    start: mockSpinnerStart,
    stop: mockSpinnerStop,
  }),
  confirm: (...args: any[]) => mockConfirm(...args),
  text: (...args: any[]) => mockText(...args),
  note: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  intro: vi.fn(),
  outro: vi.fn(),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
    message: vi.fn(),
  },
}));

// Mock @minecraft-docker/shared
let mockIsInitialized = true;
const mockConfigLoad = vi.fn();
const mockConfigSave = vi.fn();
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
    root: '/mock/root',
    templates: '/mock/templates',
    envFile: '/mock/root/.env',
    composeFile: '/mock/root/docker-compose.yml',
    configFile: '/mock/root/.mcctl.json',
    servers: '/mock/root/servers',
    serverTemplate: '/mock/root/servers/_template',
    isInitialized: () => mockIsInitialized,
  })),
  Config: vi.fn().mockImplementation(() => ({
    load: () => mockConfigLoad(),
    save: (...args: any[]) => mockConfigSave(...args),
  })),
}));

import { upgradeCommand } from '../../../src/commands/upgrade.js';

// Helper to set up filesystem mocks
function setupBaseMocks(overrides: {
  initialized?: boolean;
  config?: Record<string, any> | null;
  templateEnv?: string;
  userEnv?: string;
} = {}) {
  const {
    initialized = true,
    config = {
      version: '2.3.0',
      initialized: '2024-01-01',
      dataDir: '/mock/root',
      defaultType: 'PAPER',
      defaultVersion: '1.21.1',
      autoStart: true,
      avahiEnabled: true,
      templateVersion: '2.3.0',
    },
    templateEnv = `HOST_IP=192.168.1.100\nDEFAULT_MEMORY=4G`,
    userEnv = `HOST_IP=10.0.0.1\nDEFAULT_MEMORY=8G`,
  } = overrides;

  mockIsInitialized = initialized;
  mockConfigLoad.mockReturnValue(config);

  mockExistsSync.mockImplementation((path: string) => {
    const p = String(path);
    if (p.includes('.env.example')) return true;
    if (p.endsWith('.env')) return true;
    if (p.includes('_template')) return true;
    return false;
  });

  mockReadFileSync.mockImplementation((path: string) => {
    const p = String(path);
    if (p.includes('.env.example')) return templateEnv;
    if (p.endsWith('.env')) return userEnv;
    return '';
  });
}

describe('upgradeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBaseMocks();
  });

  it('should fail if platform is not initialized', async () => {
    setupBaseMocks({ initialized: false, config: null });

    const result = await upgradeCommand({ root: '/mock/root' });
    expect(result).toBe(1);
  });

  it('should succeed when no new variables are found', async () => {
    setupBaseMocks({
      templateEnv: 'HOST_IP=192.168.1.100\nDEFAULT_MEMORY=4G',
      userEnv: 'HOST_IP=10.0.0.1\nDEFAULT_MEMORY=8G',
    });

    const result = await upgradeCommand({ root: '/mock/root' });
    expect(result).toBe(0);
  });

  it('should detect new variables in template', async () => {
    setupBaseMocks({
      templateEnv: 'HOST_IP=192.168.1.100\nDEFAULT_MEMORY=4G\nNEW_VAR=default',
      userEnv: 'HOST_IP=10.0.0.1\nDEFAULT_MEMORY=8G',
    });

    // In non-interactive mode, should add without prompting
    const result = await upgradeCommand({ root: '/mock/root', nonInteractive: true });
    expect(result).toBe(0);
    // Should have written updated .env
    const envWrites = mockWriteFileSync.mock.calls.filter(
      (call: any[]) => typeof call[0] === 'string' && (call[0] as string).endsWith('.env')
    );
    expect(envWrites.length).toBeGreaterThanOrEqual(1);
  });

  it('should dry-run without writing any files', async () => {
    setupBaseMocks({
      templateEnv: 'HOST_IP=192.168.1.100\nNEW_VAR=default',
      userEnv: 'HOST_IP=10.0.0.1',
    });

    const result = await upgradeCommand({ root: '/mock/root', dryRun: true });
    expect(result).toBe(0);
    // Should NOT write to .env file
    const envWrites = mockWriteFileSync.mock.calls.filter(
      (call: any[]) => typeof call[0] === 'string' && (call[0] as string).endsWith('.env')
    );
    expect(envWrites).toHaveLength(0);
    // Should NOT copy template files
    expect(mockCopyFileSync).not.toHaveBeenCalled();
  });

  it('should update templateVersion in config after upgrade', async () => {
    setupBaseMocks({
      config: {
        version: '2.3.0',
        initialized: '2024-01-01',
        dataDir: '/mock/root',
        defaultType: 'PAPER',
        defaultVersion: '1.21.1',
        autoStart: true,
        avahiEnabled: true,
        templateVersion: '2.3.0',
      },
      templateEnv: 'HOST_IP=192.168.1.100',
      userEnv: 'HOST_IP=10.0.0.1',
    });

    const result = await upgradeCommand({ root: '/mock/root' });
    expect(result).toBe(0);
    expect(mockConfigSave).toHaveBeenCalledWith(
      expect.objectContaining({
        templateVersion: expect.any(String),
      })
    );
    // templateVersion should be set (not 'unknown')
    const savedConfig = mockConfigSave.mock.calls[0]![0];
    expect(savedConfig.templateVersion).toBeDefined();
    expect(savedConfig.templateVersion).not.toBe('unknown');
  });

  it('should handle missing config gracefully (pre-upgrade platforms)', async () => {
    setupBaseMocks({ config: null });

    const result = await upgradeCommand({ root: '/mock/root' });
    expect(result).toBe(0);
    // Should still save a new config
    expect(mockConfigSave).toHaveBeenCalled();
  });

  it('should copy template files to servers/_template', async () => {
    setupBaseMocks();

    await upgradeCommand({ root: '/mock/root' });
    // Should attempt to copy _template files
    expect(mockCopyFileSync).toHaveBeenCalled();
  });

  it('should prompt for values in interactive mode', async () => {
    setupBaseMocks({
      templateEnv: 'HOST_IP=192.168.1.100\nNEW_REQUIRED=default-value',
      userEnv: 'HOST_IP=10.0.0.1',
    });

    mockText.mockResolvedValue('user-provided-value');
    mockConfirm.mockResolvedValue(true);

    const result = await upgradeCommand({ root: '/mock/root' });
    expect(result).toBe(0);
    // text prompt should have been called for the new variable
    expect(mockText).toHaveBeenCalled();
  });

  it('should not prompt in non-interactive mode', async () => {
    setupBaseMocks({
      templateEnv: 'HOST_IP=192.168.1.100\nNEW_VAR=default',
      userEnv: 'HOST_IP=10.0.0.1',
    });

    const result = await upgradeCommand({ root: '/mock/root', nonInteractive: true });
    expect(result).toBe(0);
    // text prompt should NOT have been called
    expect(mockText).not.toHaveBeenCalled();
  });
});

describe('upgradeCommand - docker-compose.yml router patch', () => {
  const TEMPLATE = 'services:\n  router:\n    image: itzg/mc-router:1.47.1\n    group_add:\n      - "${DOCKER_GID:-999}"\n    networks:\n      - n\n';
  const OLD = 'services:\n  router:\n    image: itzg/mc-router:1.43.1\n    networks:\n      - n\n';

  function setupCompose(user: string | null) {
    setupBaseMocks();
    const baseExists = mockExistsSync.getMockImplementation()!;
    const baseRead = mockReadFileSync.getMockImplementation()!;
    mockExistsSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('templates/docker-compose.yml')) return true;
      if (s.endsWith('root/docker-compose.yml')) return user !== null;
      return baseExists(p);
    });
    mockReadFileSync.mockImplementation((p: string, ...rest: any[]) => {
      const s = String(p);
      if (s.endsWith('templates/docker-compose.yml')) return TEMPLATE;
      if (s.endsWith('root/docker-compose.yml')) return user;
      return baseRead(p, ...rest);
    });
  }
  const composeWrites = () =>
    mockWriteFileSync.mock.calls.filter((c: any[]) => String(c[0]).endsWith('root/docker-compose.yml'));

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockResolvedValue(true);
  });

  afterEach(() => {
    mockWriteFileSync.mockReset();
    mockExecSync.mockReset();
  });

  it('dry-run shows the change but writes, backs up and recreates nothing', async () => {
    setupCompose(OLD);
    expect(await upgradeCommand({ root: '/mock/root', dryRun: true })).toBe(0);
    expect(composeWrites()).toHaveLength(0);
    expect(mockCopyFileSync).not.toHaveBeenCalled();
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('non-interactive: backs up, patches and recreates router without prompting', async () => {
    setupCompose(OLD);
    expect(await upgradeCommand({ root: '/mock/root', nonInteractive: true })).toBe(0);
    expect(mockConfirm).not.toHaveBeenCalled();
    const bak = mockCopyFileSync.mock.calls.find((c: any[]) => /docker-compose\.yml\.bak-\d{14}$/.test(String(c[1])));
    expect(bak).toBeDefined();
    const [w] = composeWrites();
    expect(w![1]).toContain('mc-router:1.47.1');
    expect(w![1]).toContain('group_add:');
    expect(mockExecSync).toHaveBeenCalledWith('docker compose up -d router', expect.objectContaining({ cwd: '/mock/root', stdio: 'inherit', timeout: expect.any(Number) }));
  });

  it('interactive: declining the patch leaves the file untouched', async () => {
    setupCompose(OLD);
    mockConfirm.mockResolvedValue(false);
    expect(await upgradeCommand({ root: '/mock/root' })).toBe(0);
    expect(composeWrites()).toHaveLength(0);
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('does nothing when compose is already up to date', async () => {
    setupCompose(TEMPLATE);
    expect(await upgradeCommand({ root: '/mock/root', nonInteractive: true })).toBe(0);
    expect(composeWrites()).toHaveLength(0);
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('restores from the backup and returns 1 when the write fails', async () => {
    setupCompose(OLD);
    mockWriteFileSync.mockImplementation((p: string) => {
      if (String(p).endsWith('root/docker-compose.yml')) throw new Error('EACCES');
    });
    expect(await upgradeCommand({ root: '/mock/root', nonInteractive: true })).toBe(1);
    const restore = mockCopyFileSync.mock.calls.find((c: any[]) => String(c[1]).endsWith('root/docker-compose.yml'));
    expect(restore).toBeDefined();
    // compose failure must not leave the upgrade half-done: remaining steps still run
    expect(mockConfigSave).toHaveBeenCalled();
  });

  it('a failing router recreate only warns', async () => {
    setupCompose(OLD);
    mockExecSync.mockImplementation(() => { throw new Error('docker not running'); });
    expect(await upgradeCommand({ root: '/mock/root', nonInteractive: true })).toBe(0);
  });
});
