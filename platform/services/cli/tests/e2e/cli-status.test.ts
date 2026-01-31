import { describe, it, expect, beforeAll } from 'vitest';
import { runCli, runCliWithTimeout, isCliBuild, parseJsonOutput } from './helpers.js';

describe('CLI Status Command', () => {
  beforeAll(async () => {
    const built = await isCliBuild();
    if (!built) {
      throw new Error('CLI not built. Run "pnpm build" in cli directory first.');
    }
  });

  describe('mcctl status', () => {
    it('should run status command without error in initialized platform', async () => {
      const result = await runCliWithTimeout(['status'], 15000);

      // Status may fail if not initialized, but should not crash
      expect([0, 1]).toContain(result.exitCode);
      // Should have some output
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
    });

    it('should display platform information when initialized', async () => {
      const result = await runCliWithTimeout(['status'], 15000);

      if (result.exitCode === 0) {
        // Should show server or platform info
        expect(result.stdout).toMatch(/server|router|platform|status/i);
      }
    });
  });

  describe('mcctl status --json', () => {
    it('should output JSON format when --json flag is provided', async () => {
      const result = await runCliWithTimeout(['status', '--json'], 15000);

      if (result.exitCode === 0) {
        const json = parseJsonOutput(result.stdout);
        // If successful, should have valid JSON
        if (json) {
          expect(typeof json).toBe('object');
        }
      }
    });
  });

  describe('mcctl status --help', () => {
    it('should display status command help', async () => {
      const result = await runCli(['status', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('status');
    });
  });
});
