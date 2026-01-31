import { describe, it, expect, beforeAll } from 'vitest';
import { runCli, isCliBuild } from './helpers.js';

describe('CLI Config Commands', () => {
  beforeAll(async () => {
    const built = await isCliBuild();
    if (!built) {
      throw new Error('CLI not built. Run "pnpm build" in cli directory first.');
    }
  });

  describe('mcctl config --help', () => {
    it('should display config command help', async () => {
      const result = await runCli(['config', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('config');
    });
  });

  describe('mcctl update --help', () => {
    it('should display update command help', async () => {
      const result = await runCli(['update', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('update');
    });
  });

  describe('mcctl migrate --help', () => {
    it('should display migrate command help', async () => {
      const result = await runCli(['migrate', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('migrate');
    });
  });
});
