import { describe, it, expect, beforeAll } from 'vitest';
import { runCli, isCliBuild } from './helpers.js';

describe('CLI World Commands', () => {
  beforeAll(async () => {
    const built = await isCliBuild();
    if (!built) {
      throw new Error('CLI not built. Run "pnpm build" in cli directory first.');
    }
  });

  describe('mcctl world --help', () => {
    it('should display world command help', async () => {
      const result = await runCli(['world', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('world');
    });

    it('should show world subcommands', async () => {
      const result = await runCli(['world', '--help']);

      expect(result.stdout).toMatch(/list|create|delete|assign/i);
    });
  });

  describe('mcctl backup --help', () => {
    it('should display backup command help', async () => {
      const result = await runCli(['backup', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('backup');
    });
  });
});
