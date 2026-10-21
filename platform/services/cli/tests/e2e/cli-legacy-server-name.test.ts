import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runCli, isCliBuild } from './helpers.js';

describe('CLI legacy server name warning', () => {
  const root = mkdtempSync(join(tmpdir(), 'mcctl-legacy-'));

  beforeAll(async () => {
    if (!(await isCliBuild())) throw new Error('CLI not built. Run "pnpm build" first.');
  });

  it('warns on stderr for a legacy name and keeps the command outcome', async () => {
    const legacy = await runCli(['start', 'My_Server', '--root', root]);
    const strict = await runCli(['start', 'my-server', '--root', root]);

    expect(legacy.stderr).toContain("Server name 'My_Server' does not follow");
    expect(legacy.stdout).not.toContain('does not follow');
    expect(legacy.exitCode).toBe(strict.exitCode);
  });

  it('does not warn for a name that follows the rules', async () => {
    const result = await runCli(['start', 'my-server', '--root', root]);
    expect(result.stderr).not.toContain('does not follow');
  });
});
