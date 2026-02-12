import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { initCommand } from '../../../src/commands/init.js';
import * as promptsModule from '@clack/prompts';
import { Paths } from '@minecraft-docker/shared';
import { execSync } from 'node:child_process';

vi.mock('@clack/prompts');

vi.mock('../../../src/lib/prompts/ip-select.js', () => ({
  selectHostIPs: vi.fn(),
  getNetworkInterfaces: vi.fn(() => []),
}));

vi.mock('@minecraft-docker/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@minecraft-docker/shared')>();
  return {
    ...actual,
    checkPlatformPrerequisites: vi.fn(() => ({
      hasErrors: false,
      results: [],
    })),
  };
});

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
}));

describe('init command - playit.gg setup', () => {
  const testRoot = join(process.cwd(), 'tests', '.tmp-playit-test');

  beforeEach(() => {
    vi.clearAllMocks();

    // Clean up and create fresh test directory
    if (existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true });
    }
    mkdirSync(testRoot, { recursive: true });

    // Mock isCancel to return false by default
    vi.mocked(promptsModule.isCancel).mockReturnValue(false);

    // Mock execSync for Docker commands
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));
  });

  afterEach(() => {
    // Cleanup test directory
    if (existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true });
    }
  });

  describe('interactive mode - playit enabled', () => {
    it('should prompt for playit.gg setup after HOST_IP selection', async () => {
      // Mock IP selection (selectHostIPs returns string or null)
      const { selectHostIPs } = await import('../../../src/lib/prompts/ip-select.js');
      vi.mocked(selectHostIPs).mockResolvedValueOnce('192.168.1.100');

      // Mock playit.gg confirmation
      vi.mocked(promptsModule.confirm).mockResolvedValueOnce(true); // Enable playit

      // Mock SECRET_KEY input
      vi.mocked(promptsModule.password).mockResolvedValueOnce('test-secret-key-12345');

      const exitCode = await initCommand({
        root: testRoot,
        skipValidation: true,
        skipDocker: true,
      });

      expect(exitCode).toBe(0);

      // Verify playit prompt was called
      expect(promptsModule.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('playit.gg'),
        })
      );

      // Verify password prompt for SECRET_KEY
      expect(promptsModule.password).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('SECRET_KEY'),
        })
      );
    });

    it('should save PLAYIT_SECRET_KEY to .env when enabled', async () => {
      const { selectHostIPs } = await import('../../../src/lib/prompts/ip-select.js');
      vi.mocked(selectHostIPs).mockResolvedValueOnce('192.168.1.100');
      vi.mocked(promptsModule.confirm).mockResolvedValueOnce(true);
      vi.mocked(promptsModule.password).mockResolvedValueOnce('my-secret-key');

      await initCommand({
        root: testRoot,
        skipValidation: true,
        skipDocker: true,
      });

      const paths = new Paths(testRoot);
      const envPath = join(paths.root, '.env');

      expect(existsSync(envPath)).toBe(true);

      const envContent = readFileSync(envPath, 'utf-8');
      expect(envContent).toContain('PLAYIT_SECRET_KEY=my-secret-key');
    });

    it('should save playitEnabled flag to .mcctl.json when enabled', async () => {
      const { selectHostIPs } = await import('../../../src/lib/prompts/ip-select.js');
      vi.mocked(selectHostIPs).mockResolvedValueOnce('192.168.1.100');
      vi.mocked(promptsModule.confirm).mockResolvedValueOnce(true);
      vi.mocked(promptsModule.password).mockResolvedValueOnce('my-secret-key');

      await initCommand({
        root: testRoot,
        skipValidation: true,
        skipDocker: true,
      });

      const paths = new Paths(testRoot);
      const configPath = join(paths.root, '.mcctl.json');

      expect(existsSync(configPath)).toBe(true);

      const configContent = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.playitEnabled).toBe(true);
    });
  });

  describe('interactive mode - playit disabled', () => {
    it('should skip playit setup when user declines', async () => {
      const { selectHostIPs } = await import('../../../src/lib/prompts/ip-select.js');
      vi.mocked(selectHostIPs).mockResolvedValueOnce('192.168.1.100');
      vi.mocked(promptsModule.confirm).mockResolvedValueOnce(false); // Decline playit

      const exitCode = await initCommand({
        root: testRoot,
        skipValidation: true,
        skipDocker: true,
      });

      expect(exitCode).toBe(0);

      // Verify password prompt was NOT called
      expect(promptsModule.password).not.toHaveBeenCalled();
    });

    it('should not save PLAYIT_SECRET_KEY to .env when disabled', async () => {
      const { selectHostIPs } = await import('../../../src/lib/prompts/ip-select.js');
      vi.mocked(selectHostIPs).mockResolvedValueOnce('192.168.1.100');
      vi.mocked(promptsModule.confirm).mockResolvedValueOnce(false);

      await initCommand({
        root: testRoot,
        skipValidation: true,
        skipDocker: true,
      });

      const paths = new Paths(testRoot);
      const envPath = join(paths.root, '.env');

      const envContent = readFileSync(envPath, 'utf-8');
      // Should not have uncommented PLAYIT_SECRET_KEY line
      expect(envContent).not.toMatch(/^PLAYIT_SECRET_KEY=/m);
    });

    it('should save playitEnabled:false to .mcctl.json when disabled', async () => {
      const { selectHostIPs } = await import('../../../src/lib/prompts/ip-select.js');
      vi.mocked(selectHostIPs).mockResolvedValueOnce('192.168.1.100');
      vi.mocked(promptsModule.confirm).mockResolvedValueOnce(false);

      await initCommand({
        root: testRoot,
        skipValidation: true,
        skipDocker: true,
      });

      const paths = new Paths(testRoot);
      const configPath = join(paths.root, '.mcctl.json');

      const configContent = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.playitEnabled).toBe(false);
    });
  });

  describe('non-interactive mode with --playit-key flag', () => {
    it('should enable playit with provided key', async () => {
      const { selectHostIPs } = await import('../../../src/lib/prompts/ip-select.js');
      // In non-interactive mode, IP selection may return null (uses auto-detection)
      vi.mocked(selectHostIPs).mockResolvedValueOnce(null);

      const exitCode = await initCommand({
        root: testRoot,
        skipValidation: true,
        skipDocker: true,
        playitKey: 'cli-provided-key',
      });

      expect(exitCode).toBe(0);

      // Should not prompt for playit
      expect(promptsModule.confirm).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('playit.gg'),
        })
      );

      const paths = new Paths(testRoot);
      const envPath = join(paths.root, '.env');
      const envContent = readFileSync(envPath, 'utf-8');

      expect(envContent).toContain('PLAYIT_SECRET_KEY=cli-provided-key');

      const configPath = join(paths.root, '.mcctl.json');
      const configContent = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.playitEnabled).toBe(true);
    });
  });

  describe('non-interactive mode with --no-playit flag', () => {
    it('should explicitly disable playit', async () => {
      const { selectHostIPs } = await import('../../../src/lib/prompts/ip-select.js');
      // In non-interactive mode, IP selection may return null (uses auto-detection)
      vi.mocked(selectHostIPs).mockResolvedValueOnce(null);

      const exitCode = await initCommand({
        root: testRoot,
        skipValidation: true,
        skipDocker: true,
        noPlayit: true,
      });

      expect(exitCode).toBe(0);

      // Should not prompt for playit
      expect(promptsModule.confirm).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('playit.gg'),
        })
      );

      const paths = new Paths(testRoot);
      const configPath = join(paths.root, '.mcctl.json');
      const configContent = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.playitEnabled).toBe(false);
    });
  });

  describe('reconfigure with missing .mcctl.json', () => {
    it('should create default config from .env when .mcctl.json is missing', async () => {
      const paths = new Paths(testRoot);

      // Simulate initialized platform (docker-compose.yml exists) but NO .mcctl.json
      mkdirSync(paths.root, { recursive: true });
      const { writeFileSync } = await import('node:fs');
      writeFileSync(join(paths.root, 'docker-compose.yml'), 'services: {}');
      writeFileSync(join(paths.root, '.env'), [
        'HOST_IP=192.168.1.100',
        'DEFAULT_MEMORY=4G',
        'TZ=Asia/Seoul',
        'RCON_PASSWORD=changeme',
        'DEFAULT_VERSION=1.20.4',
      ].join('\n'));

      // Mock multiselect to select nothing (just verify reconfigure loads)
      vi.mocked(promptsModule.multiselect).mockResolvedValueOnce([]);
      vi.mocked(promptsModule.isCancel).mockReturnValue(false);

      const exitCode = await initCommand({
        root: testRoot,
        reconfigure: true,
        skipValidation: true,
        skipDocker: true,
      });

      expect(exitCode).toBe(0);

      // Verify .mcctl.json was created with defaults
      const configPath = join(paths.root, '.mcctl.json');
      expect(existsSync(configPath)).toBe(true);

      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.defaultType).toBe('PAPER');
      expect(config.autoStart).toBe(true);
    });
  });

  describe('validation', () => {
    it('should validate SECRET_KEY is not empty', async () => {
      vi.mocked(promptsModule.multiselect).mockResolvedValueOnce(['192.168.1.100']);
      vi.mocked(promptsModule.confirm).mockResolvedValueOnce(true);

      // Mock password prompt with validation error then success
      const passwordMock = vi.mocked(promptsModule.password);
      passwordMock.mockImplementationOnce(async (options: any) => {
        const result = options.validate('');
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        return 'valid-key-after-retry';
      });

      await initCommand({
        root: testRoot,
        skipDocker: true,
      });
    });
  });
});
