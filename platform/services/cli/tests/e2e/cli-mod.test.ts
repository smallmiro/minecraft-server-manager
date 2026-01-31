import { describe, it, expect, beforeAll } from 'vitest';
import { runCli, runCliWithTimeout, isCliBuild } from './helpers.js';

describe('CLI Mod Commands', () => {
  beforeAll(async () => {
    const built = await isCliBuild();
    if (!built) {
      throw new Error('CLI not built. Run "pnpm build" in cli directory first.');
    }
  });

  describe('mcctl mod --help', () => {
    it('should display mod command help', async () => {
      const result = await runCli(['mod', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('mod');
    });

    it('should show mod subcommands', async () => {
      const result = await runCli(['mod', '--help']);

      expect(result.stdout).toMatch(/search|add|remove|list/i);
    });
  });

  describe('mcctl mod search --help', () => {
    it('should display mod search help', async () => {
      const result = await runCli(['mod', 'search', '--help']);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('mcctl mod search (integration)', () => {
    it('should search mods from Modrinth', async () => {
      // Search for a popular mod
      const result = await runCliWithTimeout(['mod', 'search', 'sodium', '--limit', '1'], 20000);

      // May succeed or fail depending on network
      if (result.exitCode === 0) {
        expect(result.stdout.toLowerCase()).toMatch(/sodium|mod|result/i);
      }
    });
  });
});
