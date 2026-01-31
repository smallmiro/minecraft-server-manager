import { describe, it, expect, beforeAll } from 'vitest';
import { runCli, isCliBuild } from './helpers.js';

describe('CLI Basic Commands', () => {
  beforeAll(async () => {
    const built = await isCliBuild();
    if (!built) {
      throw new Error('CLI not built. Run "pnpm build" in cli directory first.');
    }
  });

  describe('mcctl --version', () => {
    it('should display version number', async () => {
      const result = await runCli(['--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should display version with -v flag', async () => {
      const result = await runCli(['-v']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('mcctl --help', () => {
    it('should display help text', async () => {
      const result = await runCli(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('mcctl');
      expect(result.stdout).toContain('Usage');
    });

    it('should display help with -h flag', async () => {
      const result = await runCli(['-h']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('mcctl');
    });

    it('should list available commands', async () => {
      const result = await runCli(['--help']);

      // Check for main commands
      expect(result.stdout).toContain('init');
      expect(result.stdout).toContain('status');
      expect(result.stdout).toContain('create');
    });
  });

  describe('mcctl (no args)', () => {
    it('should display help when no command provided', async () => {
      const result = await runCli([]);

      // Should either show help or error about missing command
      expect(result.stdout + result.stderr).toMatch(/mcctl|Usage|command/i);
    });
  });

  describe('mcctl unknown-command', () => {
    it('should show error for unknown command', async () => {
      const result = await runCli(['unknown-command-xyz']);

      // Should return non-zero exit code or show error
      expect(result.exitCode !== 0 || result.stderr.length > 0 || result.stdout.includes('error')).toBe(true);
    });
  });
});
