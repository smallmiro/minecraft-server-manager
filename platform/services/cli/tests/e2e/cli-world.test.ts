import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

describe('CLI world delete confirmation (#823)', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcctl-wdel-'));
    writeFileSync(join(root, 'docker-compose.yml'), '');
    mkdirSync(join(root, 'worlds', 'doomed'), { recursive: true });
    writeFileSync(join(root, 'worlds', 'doomed', 'level.dat'), 'x');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('refuses without a terminal and --force, leaving the world', async () => {
    const result = await runCli(['world', 'delete', 'doomed', '--root', root]);

    expect(result.exitCode).toBe(1);
    expect(existsSync(join(root, 'worlds', 'doomed'))).toBe(true);
  });

  it('deletes with --force', async () => {
    const result = await runCli(['world', 'delete', 'doomed', '--force', '--root', root]);

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(root, 'worlds', 'doomed'))).toBe(false);
  });
});
