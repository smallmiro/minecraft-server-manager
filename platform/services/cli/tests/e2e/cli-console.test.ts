import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runCliWithTimeout, isCliBuild, parseJsonOutput } from './helpers.js';

// #628: options after `mcctl console user|api` must reach the Commander subcommands
describe('mcctl console user/api options', () => {
  let root: string;
  // A timeout means the command fell back to an interactive prompt
  const run = (args: string[]) => runCliWithTimeout(['console', ...args], 10000, { env: { MCCTL_ROOT: root } });

  beforeAll(async () => {
    if (!(await isCliBuild())) {
      throw new Error('CLI not built. Run "pnpm build" in cli directory first.');
    }
  });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcctl-console-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('user add --role --password runs without prompts', async () => {
    const result = await run(['user', 'add', 'a@example.com', '--role', 'user', '--password', '-secret123']);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toEqual({ success: true, email: 'a@example.com' });
  });

  it('user list --json prints JSON', async () => {
    await run(['user', 'add', 'a@example.com', '--role', 'user', '--password', 'secret123']);

    const result = await run(['user', 'list', '--json']);

    expect(result.exitCode).toBe(0);
    const users = parseJsonOutput<Array<{ email: string; role: string }>>(result.stdout);
    expect(users).toEqual([expect.objectContaining({ email: 'a@example.com', role: 'user' })]);
  });

  it('user update --role, reset-password --password and remove --force run without prompts', async () => {
    await run(['user', 'add', 'a@example.com', '--role', 'user', '--password', 'secret123']);

    expect((await run(['user', 'update', 'a@example.com', '--role', 'admin'])).exitCode).toBe(0);
    expect((await run(['user', 'reset-password', 'a@example.com', '--password', 'newsecret123'])).exitCode).toBe(0);
    expect(parseJsonOutput((await run(['user', 'list', '--json'])).stdout)).toEqual([
      expect.objectContaining({ email: 'a@example.com', role: 'admin' }),
    ]);

    // a@ is now the last admin and cannot be removed, so remove a second user
    await run(['user', 'add', 'b@example.com', '--role', 'user', '--password', 'secret123']);
    expect((await run(['user', 'remove', 'b@example.com', '--force'])).exitCode).toBe(0);
    expect(parseJsonOutput((await run(['user', 'list', '--json'])).stdout)).toEqual([
      expect.objectContaining({ email: 'a@example.com' }),
    ]);
  });

  it('api mode --force, key regenerate --force and status --json run without prompts', async () => {
    const mode = await run(['api', 'mode', 'open', '--force']);
    expect(mode.exitCode).toBe(0);
    expect(mode.stdout).toContain('Access mode changed to: open');

    const key = await run(['api', 'key', 'regenerate', '--force']);
    expect(key.exitCode).toBe(0);
    expect(key.stdout).toContain('API key regenerated successfully.');

    const status = await run(['api', 'status', '--json']);
    expect(status.exitCode).toBe(0);
    expect(parseJsonOutput(status.stdout)).toEqual(expect.objectContaining({ accessMode: 'open' }));
  });
});
