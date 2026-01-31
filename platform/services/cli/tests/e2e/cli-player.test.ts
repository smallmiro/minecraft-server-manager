import { describe, it, expect, beforeAll } from 'vitest';
import { runCli, isCliBuild } from './helpers.js';

describe('CLI Player Commands', () => {
  beforeAll(async () => {
    const built = await isCliBuild();
    if (!built) {
      throw new Error('CLI not built. Run "pnpm build" in cli directory first.');
    }
  });

  describe('mcctl player --help', () => {
    it('should display player command help', async () => {
      const result = await runCli(['player', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('player');
    });
  });

  describe('mcctl whitelist --help', () => {
    it('should display whitelist command help', async () => {
      const result = await runCli(['whitelist', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('whitelist');
    });

    it('should show add/remove/list subcommands', async () => {
      const result = await runCli(['whitelist', '--help']);

      expect(result.stdout).toMatch(/add|remove|list/i);
    });
  });

  describe('mcctl ban --help', () => {
    it('should display ban command help', async () => {
      const result = await runCli(['ban', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ban');
    });
  });

  describe('mcctl op --help', () => {
    it('should display op command help', async () => {
      const result = await runCli(['op', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('op');
    });
  });

  describe('mcctl kick --help', () => {
    it('should display kick command help', async () => {
      const result = await runCli(['kick', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('kick');
    });
  });

  describe('mcctl msg --help', () => {
    it('should display msg command help', async () => {
      const result = await runCli(['msg', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('msg');
    });
  });
});
