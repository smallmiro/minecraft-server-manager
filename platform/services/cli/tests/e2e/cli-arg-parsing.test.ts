import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli, isCliBuild } from './helpers.js';

// Arguments that used to be mis-parsed (#824)
describe('CLI argument parsing', () => {
  let root: string;

  beforeAll(async () => {
    if (!(await isCliBuild())) throw new Error('CLI not built. Run "pnpm build" in cli directory first.');
  });
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcctl-args-'));
    writeFileSync(join(root, 'docker-compose.yml'), '');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('mcctl audit list runs the subcommand instead of printing usage', async () => {
    const result = await runCli(['audit', 'stats', '--root', root]);

    expect(result.stdout + result.stderr).not.toContain('Usage: mcctl audit');
  });

  it.each(['--curseforge', '--spiget', '--modrinth', '--url'])(
    'mod add %s keeps the names that follow as mods, not as the flag value',
    async (flag) => {
      const result = await runCli(['mod', 'add', 'nosuch', flag, 'a', 'b', '--root', root]);

      expect(result.stdout + result.stderr).not.toContain('At least one mod name required');
    }
  );

  it('mcctl --version still prints the mcctl version', async () => {
    const result = await runCli(['--version']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('mcctl version');
  });
});
