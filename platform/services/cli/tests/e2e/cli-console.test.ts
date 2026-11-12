import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { homedir, tmpdir, userInfo } from 'os';
import { dirname, join } from 'path';
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
    expect(parseJsonOutput(result.stdout)).toEqual({ success: true, email: 'a@example.com' });
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

// #650: enable registers `pm2 startup` (through sudo) and saves the process list.
// A fake sudo and pm2 on PATH log their calls: no init system is touched.
describe('mcctl console service enable', () => {
  let root: string;
  let log: string;
  let env: Record<string, string>;
  const calls = () => (existsSync(log) ? readFileSync(log, 'utf-8').trim().split('\n') : []);
  const run = (extra: Record<string, string> = {}) =>
    runCliWithTimeout(['console', 'service', 'enable'], 10000, { env: { ...env, ...extra } });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcctl-enable-'));
    log = join(root, 'calls.log');
    const bin = join(root, 'bin');
    mkdirSync(bin);
    writeFileSync(
      join(bin, 'sudo'),
      `#!/bin/sh\necho "sudo $*" >> "${log}"\n[ -n "$SUDO_FAIL" ] && exit 1\n[ "$1" = -n ] && shift\nexec "$@"\n`,
      { mode: 0o755 }
    );
    writeFileSync(
      join(bin, 'pm2'),
      `#!/bin/sh\n[ "$1" = --version ] && { echo 6.0.14; exit 0; }\necho "pm2 $*" >> "${log}"\n`,
      { mode: 0o755 }
    );
    writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
    env = { MCCTL_ROOT: root, PATH: `${bin}:${process.env.PATH}`, PM2_HOME: '' };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('runs pm2 startup through sudo -n with this Node first on PATH, then pm2 save', async () => {
    const result = await run();

    expect(result.exitCode).toBe(0);
    const [sudo, startup, save] = calls();
    expect(sudo!.startsWith(`sudo -n env PATH=${dirname(process.execPath)}:`)).toBe(true);
    expect(startup).toBe(`pm2 startup -u ${userInfo().username} --hp ${homedir()}`);
    expect(save).toBe('pm2 save');
  });

  it('points the startup unit at a custom PM2_HOME', async () => {
    expect((await run({ PM2_HOME: '/srv/mcctl/.pm2' })).exitCode).toBe(0);
    expect(calls()).toContain(`pm2 startup -u ${userInfo().username} --hp /srv/mcctl`);
  });

  it('shows the command to run when sudo fails, and does not save', async () => {
    const result = await run({ SUDO_FAIL: '1' });

    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/sudo env 'PATH=.*' \S*pm2 startup -u .* && \S*pm2 save/);
    expect(calls().filter((c) => c.startsWith('pm2'))).toEqual([]);
  });
});
