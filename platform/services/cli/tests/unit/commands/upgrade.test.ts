import { describe, it, expect, vi, beforeEach } from 'vitest';

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
