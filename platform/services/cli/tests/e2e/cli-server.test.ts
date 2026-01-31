import { describe, it, expect, beforeAll } from 'vitest';
import { runCli, runCliWithTimeout, isCliBuild } from './helpers.js';

describe('CLI Server Commands', () => {
  beforeAll(async () => {
    const built = await isCliBuild();
    if (!built) {
      throw new Error('CLI not built. Run "pnpm build" in cli directory first.');
    }
  });

  describe('mcctl create --help', () => {
    it('should display create command help', async () => {
      const result = await runCli(['create', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('create');
    });

    it('should show server type options', async () => {
      const result = await runCli(['create', '--help']);

      expect(result.stdout).toMatch(/type|TYPE|PAPER|FORGE|FABRIC/i);
    });

    it('should show version option', async () => {
      const result = await runCli(['create', '--help']);

      expect(result.stdout).toMatch(/version|VERSION/i);
    });

    it('should show memory option', async () => {
      const result = await runCli(['create', '--help']);

      expect(result.stdout).toMatch(/memory|MEMORY/i);
    });
  });

  describe('mcctl delete --help', () => {
    it('should display delete command help', async () => {
      const result = await runCli(['delete', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('delete');
    });
  });

  describe('mcctl start/stop/restart --help', () => {
    it('should display start command help', async () => {
      const result = await runCli(['start', '--help']);

      expect(result.exitCode).toBe(0);
    });

    it('should display stop command help', async () => {
      const result = await runCli(['stop', '--help']);

      expect(result.exitCode).toBe(0);
    });

    it('should display restart command help', async () => {
      const result = await runCli(['restart', '--help']);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('mcctl up/down --help', () => {
    it('should display up command help', async () => {
      const result = await runCli(['up', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('up');
    });

    it('should display down command help', async () => {
      const result = await runCli(['down', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('down');
    });
  });

  describe('mcctl logs --help', () => {
    it('should display logs command help', async () => {
      const result = await runCli(['logs', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('logs');
    });

    it('should show follow option', async () => {
      const result = await runCli(['logs', '--help']);

      expect(result.stdout).toMatch(/follow|-f/i);
    });
  });

  describe('mcctl exec --help', () => {
    it('should display exec command help', async () => {
      const result = await runCli(['exec', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('exec');
    });
  });
});
