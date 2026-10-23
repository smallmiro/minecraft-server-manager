/**
 * GitWorldBackupAdapter behaviour (#732, ADR-0001 "Backup Port").
 * Real git against a local bare remote (file://) and a temporary platform root.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, chmod, readdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { GitWorldBackupAdapter } from '../src/infrastructure/adapters/GitWorldBackupAdapter.js';
import { BackupRetentionPolicy } from '../src/domain/index.js';
import { fsOps } from '../src/infrastructure/backup/restore-slots.js';
import { vi } from 'vitest';
import type { IContainerRuntimePort } from '../src/application/ports/outbound/IContainerRuntimePort.js';
import type { IRuntimeEnvironmentPort } from '../src/application/ports/outbound/IRuntimeEnvironmentPort.js';
import type {
  IServerConsolePort,
  ConsoleCommandResult,
} from '../src/application/ports/outbound/IServerConsolePort.js';

const TOKEN = 'ghp_testtoken_0123456789';
const REPO = 'owner/worlds';
const isRoot = process.getuid?.() === 0;

function git(cwd: string, args: string[], env: Record<string, string> = {}): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_AUTHOR_NAME: 'Tester',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 'Tester',
      GIT_COMMITTER_EMAIL: 't@example.com',
      ...env,
    },
  }).trim();
}

class FakeRuntime {
  running: string[] = [];
  /** Optional sequence of answers for list({ running: true }); an Error is a failed query. */
  answers: Array<string[] | Error> = [];
  /** `docker ps` fails: [] without strict (the D1 contract), a throw with strict. */
  failList = false;
  list(options?: { running?: boolean; strict?: boolean }): string[] {
    const answer = options?.running && this.answers.length > 0 ? this.answers.shift()! : undefined;
    const failed = answer instanceof Error || this.failList;
    if (failed) {
      if (options?.strict) throw answer instanceof Error ? answer : new Error('docker ps failed');
      return [];
    }
    return answer ? [...(answer as string[])] : [...this.running];
  }
}

class FakeEnvironment {
  available = true;
  isAvailable(): boolean {
    return this.available;
  }
  getEngineVersion() {
    return { installed: true };
  }
  getComposeVersion() {
    return { installed: true };
  }
}

type Handler = (name: string, args: string[], signal?: AbortSignal) => Promise<ConsoleCommandResult> | ConsoleCommandResult;

class FakeConsole {
  calls: string[] = [];
  handler: Handler = () => ({ exitCode: 0, stdout: '', stderr: '' });
  async command(name: string, args: string[], options?: { signal?: AbortSignal }) {
    this.calls.push(`${name} ${args.join(' ')}`);
    return this.handler(name, args, options?.signal);
  }
  async listPlayers() {
    return null;
  }
  async getEndpoint() {
    return null;
  }
}

interface Ctx {
  base: string;
  root: string;
  bare: string;
  cache: string;
  runtime: FakeRuntime;
  environment: FakeEnvironment;
  console: FakeConsole;
  adapter: GitWorldBackupAdapter;
}

async function setup(): Promise<Ctx> {
  const base = await mkdtemp(join(tmpdir(), 'wb-'));
  const root = join(base, 'root');
  const remotes = join(base, 'remotes');
  await mkdir(join(root, 'worlds', '.locks'), { recursive: true });
  await writeFile(join(root, 'worlds', '.locks', 'a.lock'), 'srv:1:2');
  await mkdir(join(remotes, 'owner'), { recursive: true });
  const bare = join(remotes, 'owner', 'worlds.git');
  git(base, ['init', '--bare', '-q', '-b', 'main', bare]);
  await writeFile(join(root, '.env'), `BACKUP_GITHUB_TOKEN=${TOKEN}\nBACKUP_GITHUB_REPO=${REPO}\n`);
  const runtime = new FakeRuntime();
  const environment = new FakeEnvironment();
  const console = new FakeConsole();
  const adapter = makeAdapter({ root, remotes, runtime, environment, console });
  return { base, root, bare, cache: join(root, 'backups', 'worlds'), runtime, environment, console, adapter };
}

function makeAdapter(c: { root: string; remotes: string; runtime: FakeRuntime; environment: FakeEnvironment; console: FakeConsole }) {
  return new GitWorldBackupAdapter({
    root: c.root,
    runtime: c.runtime as unknown as IContainerRuntimePort,
    environment: c.environment as unknown as IRuntimeEnvironmentPort,
    console: c.console as unknown as IServerConsolePort,
    remoteBase: `file://${c.remotes}/`,
    flushTimeoutMs: 300,
  });
}

async function writeWorld(dir: string, content: string, extra: Record<string, string> = {}) {
  await mkdir(join(dir, 'region'), { recursive: true });
  await writeFile(join(dir, 'level.dat'), content);
  await writeFile(join(dir, 'region', 'r.0.0.mca'), `${content}-region`);
  for (const [name, value] of Object.entries(extra)) await writeFile(join(dir, name), value);
}

async function internalServer(root: string, name: string, level: string, opts: { satellites?: boolean } = {}) {
  const sdir = join(root, 'servers', name);
  await mkdir(join(sdir, 'data'), { recursive: true });
  await writeFile(join(sdir, 'config.env'), `TYPE=PAPER\nLEVEL=${level}\n`);
  await writeWorld(join(sdir, 'data', level), `${name}-${level}`);
  if (opts.satellites) await writeWorld(join(sdir, 'data', `${level}_nether`), `${name}-nether`);
}

/** Files on the remote main branch; [] while nothing was ever published. */
const remoteFiles = (bare: string) => {
  try {
    return git(bare, ['ls-tree', '-r', '--name-only', 'main']).split('\n').filter(Boolean);
  } catch {
    return [];
  }
};
const remoteFile = (bare: string, path: string) => git(bare, ['show', `main:${path}`]);
const remoteCount = (bare: string) => Number(git(bare, ['rev-list', '--count', 'main']));
const remoteTip = (bare: string) => git(bare, ['rev-parse', 'main']);

function ok<T>(r: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}: ${r.error.message}`);
  return r.value;
}

function errCode(r: { ok: boolean; error?: { code: string } }): string | undefined {
  return r.ok ? undefined : r.error?.code;
}

/** Make the remote reject pushes while the flag file exists. */
async function rejectPushes(bare: string, flag: string) {
  const hook = join(bare, 'hooks', 'pre-receive');
  await writeFile(hook, `#!/bin/sh\nif [ -f "${flag}" ]; then echo rejected-by-test >&2; exit 1; fi\nexit 0\n`);
  await chmod(hook, 0o755);
}

let ctx: Ctx;
beforeEach(async () => {
  ctx = await setup();
});
afterEach(async () => {
  await rm(ctx.base, { recursive: true, force: true });
});

describe('push', () => {
  it('creates the repository with README and worlds, without .locks and without scripts/ (#7)', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    const out = ok(await ctx.adapter.push({ message: 'first' }));
    expect(out.changed).toBe(true);
    expect(out.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(remoteFiles(ctx.bare).sort()).toEqual(
      ['README.md', 'worlds/alpha/level.dat', 'worlds/alpha/region/r.0.0.mca'].sort()
    );
    expect(remoteFile(ctx.bare, 'worlds/alpha/level.dat')).toBe('A1');
    expect(git(ctx.bare, ['log', '-1', '--format=%an <%ae>|%s', 'main'])).toBe(
      'Minecraft Backup <minecraft-backup@localhost>|first'
    );
  });

  it('uses the default timestamp message', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    ok(await ctx.adapter.push());
    expect(git(ctx.bare, ['log', '-1', '--format=%s', 'main'])).toMatch(/^Backup: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('reports "no changes" as success (#8)', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    ok(await ctx.adapter.push({ message: 'one' }));
    const again = ok(await ctx.adapter.push({ message: 'two' }));
    expect(again.changed).toBe(false);
    expect(remoteCount(ctx.bare)).toBe(2); // README + one
  });

  it('flushes running servers: save-off, save-all flush, copy, then save-on (#1)', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    ctx.runtime.running = ['mc-a', 'mc-b'];
    const copied = () => existsSync(join(ctx.cache, 'worlds', 'alpha', 'level.dat'));
    const seen: string[] = [];
    ctx.console.handler = (name, args) => {
      seen.push(`${name} ${args.join(' ')} copied=${copied()}`);
      return { exitCode: 0, stdout: '', stderr: '' };
    };
    const out = ok(await ctx.adapter.push({ message: 'm' }));
    expect(seen).toEqual([
      'mc-a save-off copied=false',
      'mc-b save-off copied=false',
      'mc-a save-all flush copied=false',
      'mc-b save-all flush copied=false',
      'mc-a save-on copied=true',
      'mc-b save-on copied=true',
    ]);
    expect(out.flushed).toEqual(['a', 'b']);
  });

  it('still sends save-on when a flush fails, and commits nothing', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    ctx.runtime.running = ['mc-a', 'mc-b'];
    ctx.console.handler = (name, args) =>
      name === 'mc-b' && args[0] === 'save-all' ? { exitCode: 1, stdout: '', stderr: 'boom' } : { exitCode: 0, stdout: '', stderr: '' };
    const r = await ctx.adapter.push();
    expect(errCode(r)).toBe('flush_failed');
    expect(ctx.console.calls.filter((c) => c.endsWith('save-on'))).toEqual(['mc-a save-on', 'mc-b save-on']);
    expect(existsSync(join(ctx.cache, 'worlds', 'alpha'))).toBe(false);
    expect(remoteFiles(ctx.bare)).toEqual([]); // nothing published
  });

  it('aborts a flush that exceeds the timeout through the signal', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    ctx.runtime.running = ['mc-a'];
    let aborted = false;
    ctx.console.handler = (_n, args, signal) => {
      if (args[0] !== 'save-all') return { exitCode: 0, stdout: '', stderr: '' };
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => {
          aborted = true;
          resolve({ exitCode: 1, stdout: '', stderr: 'aborted' });
        });
      });
    };
    expect(errCode(await ctx.adapter.push())).toBe('flush_failed');
    expect(aborted).toBe(true);
    expect(ctx.console.calls).toContain('mc-a save-on');
  });

  it('reports a save-on failure as a warning and keeps the backup', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    ctx.runtime.running = ['mc-a'];
    ctx.console.handler = (_n, args) =>
      args[0] === 'save-on' ? { exitCode: 1, stdout: '', stderr: 'nope' } : { exitCode: 0, stdout: '', stderr: '' };
    const out = ok(await ctx.adapter.push());
    expect(out.changed).toBe(true);
    expect(out.warnings.join('\n')).toContain('save-on failed for a');
  });

  it('refuses when the runtime cannot be queried (K3)', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    ctx.environment.available = false;
    expect(errCode(await ctx.adapter.push())).toBe('runtime_unavailable');
    expect(ctx.console.calls).toEqual([]);
  });

  it('refuses when listing running servers fails although Docker answers info (P1)', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    ctx.runtime.failList = true;
    expect(errCode(await ctx.adapter.push())).toBe('runtime_unavailable');
    expect(ctx.console.calls).toEqual([]);
    expect(remoteFiles(ctx.bare)).toEqual([]);
  });

  it('refuses a symlinked worlds/ root (P1)', async () => {
    await writeWorld(join(ctx.base, 'elsewhere', 'alpha'), 'A1');
    await rm(join(ctx.root, 'worlds'), { recursive: true });
    await symlink(join(ctx.base, 'elsewhere'), join(ctx.root, 'worlds'));
    expect(errCode(await ctx.adapter.push())).toBe('unsupported_layout');
  });

  it('reports a symlinked servers/<n>/ as skipped instead of ignoring it', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    await internalServer(ctx.base, 'real', 'w');
    await mkdir(join(ctx.root, 'servers'), { recursive: true });
    await symlink(join(ctx.base, 'servers', 'real'), join(ctx.root, 'servers', 'linked'));
    const out = ok(await ctx.adapter.push());
    expect(out.skipped.join('\n')).toContain('linked');
  });

  it('keeps save-on failures in the error when the git push fails after a good copy', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    ok(await ctx.adapter.push({ message: 'base' }));
    const flag = join(ctx.base, 'reject');
    await rejectPushes(ctx.bare, flag);
    await writeFile(flag, '');
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A2');
    ctx.runtime.running = ['mc-a'];
    ctx.console.handler = (_n, args) =>
      args[0] === 'save-on' ? { exitCode: 1, stdout: '', stderr: 'rcon down' } : { exitCode: 0, stdout: '', stderr: '' };
    const r = await ctx.adapter.push();
    expect(errCode(r)).toBe('git_failed');
    if (!r.ok) {
      expect(r.error.message).toContain('save-on failed for a: rcon down');
      expect(r.error.servers).toEqual(['a']);
    }
  });

  it('keeps save-on failures in the error when the flush also failed (P2)', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    ctx.runtime.running = ['mc-a', 'mc-b'];
    ctx.console.handler = (name, args) => {
      if (name === 'mc-b' && args[0] === 'save-all') return { exitCode: 1, stdout: '', stderr: 'flush boom' };
      if (name === 'mc-a' && args[0] === 'save-on') return { exitCode: 1, stdout: '', stderr: 'rcon down' };
      return { exitCode: 0, stdout: '', stderr: '' };
    };
    const r = await ctx.adapter.push();
    expect(errCode(r)).toBe('flush_failed');
    if (!r.ok) {
      expect(r.error.message).toContain('save-on failed for a: rcon down');
      expect(r.error.servers).toEqual(expect.arrayContaining(['a', 'b']));
    }
    expect(ctx.console.calls).toContain('mc-b save-on');
  });

  it('refuses a symlink inside worlds/ before flushing', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    await symlink('/etc/hostname', join(ctx.root, 'worlds', 'alpha', 'link'));
    ctx.runtime.running = ['mc-a'];
    expect(errCode(await ctx.adapter.push())).toBe('unsupported_layout');
    expect(ctx.console.calls).toEqual([]);
    expect(remoteFiles(ctx.bare)).toEqual([]); // nothing published
  });

  it('still sends save-on when the copy fails (symlink inside an internal world)', async () => {
    await internalServer(ctx.root, 'surv', 'w');
    await symlink('/etc/hostname', join(ctx.root, 'servers', 'surv', 'data', 'w', 'link'));
    ctx.runtime.running = ['mc-a'];
    expect(errCode(await ctx.adapter.push())).toBe('unsupported_layout');
    expect(ctx.console.calls).toContain('mc-a save-on');
    expect(remoteFiles(ctx.bare)).toEqual([]); // nothing published
  });

  it('backs up server-internal worlds with satellites (#6)', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    await internalServer(ctx.root, 'surv', 'w', { satellites: true });
    await mkdir(join(ctx.root, 'servers', '_template'), { recursive: true });
    ok(await ctx.adapter.push());
    const files = remoteFiles(ctx.bare);
    expect(files).toContain('servers/surv/w/level.dat');
    expect(files).toContain('servers/surv/w_nether/level.dat');
    expect(files.some((f) => f.startsWith('servers/_template'))).toBe(false);
  });

  it('reports a server with a symlinked data dir as skipped', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    await mkdir(join(ctx.root, 'servers', 'linked'), { recursive: true });
    await writeFile(join(ctx.root, 'servers', 'linked', 'config.env'), 'LEVEL=w\n');
    await mkdir(join(ctx.base, 'elsewhere', 'w'), { recursive: true });
    await writeFile(join(ctx.base, 'elsewhere', 'w', 'level.dat'), 'x');
    await symlink(join(ctx.base, 'elsewhere'), join(ctx.root, 'servers', 'linked', 'data'));
    const out = ok(await ctx.adapter.push());
    expect(out.skipped.join('\n')).toContain('linked');
    expect(remoteFiles(ctx.bare).some((f) => f.startsWith('servers/'))).toBe(false);
  });

  it('blocks when a backed-up world is missing, unless allowMissing (R7)', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    await writeWorld(join(ctx.root, 'worlds', 'beta'), 'B1');
    ok(await ctx.adapter.push());
    await rm(join(ctx.root, 'worlds', 'beta'), { recursive: true });
    const tip = remoteTip(ctx.bare);
    const r = await ctx.adapter.push();
    expect(errCode(r)).toBe('missing_worlds');
    if (!r.ok) expect(r.error.paths).toEqual(['worlds/beta']);
    expect(remoteTip(ctx.bare)).toBe(tip);

    ok(await ctx.adapter.push({ allowMissing: true }));
    expect(remoteFiles(ctx.bare).some((f) => f.startsWith('worlds/beta'))).toBe(false);
  });

  it('treats a deleted servers/<n>/ as intentional, but a missing internal world as missing (S5)', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    await internalServer(ctx.root, 'gone', 'w');
    await internalServer(ctx.root, 'kept', 'k');
    ok(await ctx.adapter.push());
    await rm(join(ctx.root, 'servers', 'gone'), { recursive: true });
    ok(await ctx.adapter.push());
    expect(remoteFiles(ctx.bare).some((f) => f.startsWith('servers/gone'))).toBe(false);

    await rm(join(ctx.root, 'servers', 'kept', 'data', 'k', 'level.dat'));
    const r = await ctx.adapter.push();
    expect(errCode(r)).toBe('missing_worlds');
    if (!r.ok) expect(r.error.paths).toEqual(['servers/kept/k']);
  });

  it('refuses an empty source', async () => {
    expect(errCode(await ctx.adapter.push())).toBe('empty_source');
  });

  it('fails with not_configured without token or repository', async () => {
    await writeFile(join(ctx.root, '.env'), 'BACKUP_GITHUB_REPO=owner/worlds\n');
    const saved = process.env.BACKUP_GITHUB_TOKEN;
    delete process.env.BACKUP_GITHUB_TOKEN;
    try {
      expect(errCode(await ctx.adapter.push())).toBe('not_configured');
    } finally {
      if (saved !== undefined) process.env.BACKUP_GITHUB_TOKEN = saved;
    }
  });

  it('keeps a commit whose push failed and sends it with the next push (R11)', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    ok(await ctx.adapter.push({ message: 'base' }));
    const flag = join(ctx.base, 'reject');
    await rejectPushes(ctx.bare, flag);
    await writeFile(flag, '');
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A2');
    expect(errCode(await ctx.adapter.push({ message: 'lost?' }))).toBe('git_failed');
    await rm(flag);

    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A3');
    ok(await ctx.adapter.push({ message: 'next' }));
    expect(git(ctx.bare, ['log', '--format=%s', 'main']).split('\n')).toEqual([
      'next',
      'lost?',
      'base',
      'Initial backup repository setup',
    ]);
    expect(git(ctx.bare, ['show', 'main~1:worlds/alpha/level.dat'])).toBe('A2');
  });

  it('scrubs a legacy token URL and pushurl from the cache config (#11)', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    ok(await ctx.adapter.push());
    git(ctx.cache, ['remote', 'set-url', 'origin', `https://${TOKEN}@github.com/${REPO}.git`]);
    git(ctx.cache, ['config', 'remote.origin.pushurl', `https://${TOKEN}@github.com/${REPO}.git`]);
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A2');
    ok(await ctx.adapter.push());
    expect(await readFile(join(ctx.cache, '.git', 'config'), 'utf8')).not.toContain(TOKEN);
    expect(remoteFile(ctx.bare, 'worlds/alpha/level.dat')).toBe('A2');
  });

  it('blocks while a restore slot is INCOMPLETE', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    await mkdir(join(ctx.root, 'backups', 'restore-previous', 'x'), { recursive: true });
    await writeFile(join(ctx.root, 'backups', 'restore-previous', 'x', 'INCOMPLETE'), '{}');
    expect(errCode(await ctx.adapter.push())).toBe('recovery_required');
  });

  it('fails fast when another operation holds the lock', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    const { acquireBackupLock } = await import('../src/infrastructure/backup/lock.js');
    const lock = await acquireBackupLock(ctx.root, 'restore');
    try {
      const r = await ctx.adapter.push();
      expect(errCode(r)).toBe('locked');
      if (!r.ok) expect(r.error.holder?.op).toBe('restore');
    } finally {
      if (lock.ok) await lock.release();
    }
  });
});

describe('status and history', () => {
  it('status is not configured without keys (#13)', async () => {
    await writeFile(join(ctx.root, '.env'), 'OTHER=1\n');
    const saved = { t: process.env.BACKUP_GITHUB_TOKEN, r: process.env.BACKUP_GITHUB_REPO };
    delete process.env.BACKUP_GITHUB_TOKEN;
    delete process.env.BACKUP_GITHUB_REPO;
    try {
      expect(ok(await ctx.adapter.status())).toEqual({ configured: false, branch: 'main', autoOnStop: false });
    } finally {
      if (saved.t !== undefined) process.env.BACKUP_GITHUB_TOKEN = saved.t;
      if (saved.r !== undefined) process.env.BACKUP_GITHUB_REPO = saved.r;
    }
  });

  it('status reports configuration and the last backup (#13)', async () => {
    await writeFile(
      join(ctx.root, '.env'),
      `BACKUP_GITHUB_TOKEN=${TOKEN}\nBACKUP_GITHUB_REPO=${REPO}\nBACKUP_AUTO_ON_STOP=true\n`
    );
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    const pushed = ok(await ctx.adapter.push());
    const status = ok(await ctx.adapter.status());
    expect(status).toMatchObject({ configured: true, repository: REPO, branch: 'main', autoOnStop: true });
    expect(status.lastBackup?.commit).toBe(pushed.commit);
    expect(status.lastBackup?.date).toBeInstanceOf(Date);
  });

  it('status fails on an unreadable .env instead of claiming "not configured" (S5)', async () => {
    if (isRoot) return;
    await chmod(join(ctx.root, '.env'), 0o000);
    expect(errCode(await ctx.adapter.status())).toBe('io_failed');
  });

  it('history returns commits newest first with exact messages (#12)', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    ok(await ctx.adapter.push({ message: 'a | b "quoted"' }));
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A2');
    ok(await ctx.adapter.push({ message: 'second' }));
    const history = ok(await ctx.adapter.history());
    expect(history.map((h) => h.message)).toEqual(['second', 'a | b "quoted"', 'Initial backup repository setup']);
    expect(history[0]!.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(history[0]!.author).toBe('Minecraft Backup');
    expect(history[0]!.date).toBeInstanceOf(Date);
    expect(ok(await ctx.adapter.history(1))).toHaveLength(1);
  });

  it('history is empty without a cache', async () => {
    expect(ok(await ctx.adapter.history())).toEqual([]);
  });
});

describe('restore', () => {
  async function twoCommits() {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    const a = ok(await ctx.adapter.push({ message: 'A' })).commit!;
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A2');
    await writeWorld(join(ctx.root, 'worlds', 'beta'), 'B2');
    const b = ok(await ctx.adapter.push({ message: 'B' })).commit!;
    return { a, b };
  }

  it('restores the exact tree of the commit and keeps .locks (#3, #2)', async () => {
    const { a } = await twoCommits();
    const out = ok(await ctx.adapter.restore(a.slice(0, 7)));
    expect(out.commit).toBe(a);
    expect(await readFile(join(ctx.root, 'worlds', 'alpha', 'level.dat'), 'utf8')).toBe('A1');
    expect(existsSync(join(ctx.root, 'worlds', 'beta'))).toBe(false);
    expect(await readFile(join(ctx.root, 'worlds', '.locks', 'a.lock'), 'utf8')).toBe('srv:1:2');
    expect(await readFile(join(out.previousDir, 'worlds', 'beta', 'level.dat'), 'utf8')).toBe('B2');
    expect(existsSync(join(out.previousDir, 'INCOMPLETE'))).toBe(false);
    expect((await readdir(join(ctx.root, 'backups'))).some((f) => f.startsWith('.restore-'))).toBe(false);
  });

  it('refuses while any server is running (#2)', async () => {
    const { a } = await twoCommits();
    ctx.runtime.running = ['mc-x'];
    const r = await ctx.adapter.restore(a);
    expect(errCode(r)).toBe('servers_running');
    if (!r.ok) expect(r.error.servers).toEqual(['x']);
    expect(await readFile(join(ctx.root, 'worlds', 'alpha', 'level.dat'), 'utf8')).toBe('A2');
  });

  it('re-checks right before the swap (K3, R1)', async () => {
    const { a } = await twoCommits();
    ctx.runtime.answers = [[], ['mc-late']];
    expect(errCode(await ctx.adapter.restore(a))).toBe('servers_running');
    expect(existsSync(join(ctx.root, 'worlds', 'beta'))).toBe(true);
  });

  it('refuses when listing running servers fails, at the first check or the re-check (P1)', async () => {
    const { a } = await twoCommits();
    ctx.runtime.answers = [new Error('docker ps failed')];
    expect(errCode(await ctx.adapter.restore(a))).toBe('runtime_unavailable');
    ctx.runtime.answers = [[], new Error('docker ps failed')];
    expect(errCode(await ctx.adapter.restore(a))).toBe('runtime_unavailable');
    expect(existsSync(join(ctx.root, 'worlds', 'beta'))).toBe(true);
    expect(await readFile(join(ctx.root, 'worlds', 'alpha', 'level.dat'), 'utf8')).toBe('A2');
  });

  it('refuses a symlinked worlds/ root and leaves the link target alone (P1)', async () => {
    const { a } = await twoCommits();
    await rename(join(ctx.root, 'worlds'), join(ctx.base, 'real-worlds'));
    await symlink(join(ctx.base, 'real-worlds'), join(ctx.root, 'worlds'));
    expect(errCode(await ctx.adapter.restore(a))).toBe('unsupported_layout');
    expect(existsSync(join(ctx.base, 'real-worlds', 'beta', 'level.dat'))).toBe(true);
  });

  it('refuses a symlinked live world target (P1)', async () => {
    await internalServer(ctx.root, 'surv', 'w');
    const c = ok(await ctx.adapter.push()).commit!;
    await rename(join(ctx.root, 'servers', 'surv', 'data', 'w'), join(ctx.base, 'w-real'));
    await symlink(join(ctx.base, 'w-real'), join(ctx.root, 'servers', 'surv', 'data', 'w'));
    expect(errCode(await ctx.adapter.restore(c))).toBe('unsupported_layout');
    expect(existsSync(join(ctx.base, 'w-real', 'level.dat'))).toBe(true);
  });

  it('refuses a symlinked servers/ root (P1)', async () => {
    await internalServer(ctx.root, 'surv', 'w');
    const c = ok(await ctx.adapter.push()).commit!;
    await rename(join(ctx.root, 'servers'), join(ctx.base, 'real-servers'));
    await symlink(join(ctx.base, 'real-servers'), join(ctx.root, 'servers'));
    expect(errCode(await ctx.adapter.restore(c))).toBe('unsupported_layout');
  });

  it('refuses when the runtime cannot be queried (K3)', async () => {
    const { a } = await twoCommits();
    ctx.environment.available = false;
    expect(errCode(await ctx.adapter.restore(a))).toBe('runtime_unavailable');
  });

  it('rejects unknown or malformed commits', async () => {
    await twoCommits();
    expect(errCode(await ctx.adapter.restore('deadbeef'))).toBe('commit_not_found');
    expect(errCode(await ctx.adapter.restore('--orphan'))).toBe('commit_not_found');
  });

  it('restores internal worlds by the commit dir names; worlds-only commits leave them alone (#6, R8)', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    const worldsOnly = ok(await ctx.adapter.push()).commit!;
    await internalServer(ctx.root, 'surv', 'w', { satellites: true });
    const withInternal = ok(await ctx.adapter.push()).commit!;
    await writeWorld(join(ctx.root, 'servers', 'surv', 'data', 'w'), 'changed');
    await rm(join(ctx.root, 'servers', 'surv', 'data', 'w_nether'), { recursive: true });

    ok(await ctx.adapter.restore(withInternal));
    expect(await readFile(join(ctx.root, 'servers', 'surv', 'data', 'w', 'level.dat'), 'utf8')).toBe('surv-w');
    expect(existsSync(join(ctx.root, 'servers', 'surv', 'data', 'w_nether', 'level.dat'))).toBe(true);

    await writeWorld(join(ctx.root, 'servers', 'surv', 'data', 'w'), 'changed-again');
    ok(await ctx.adapter.restore(worldsOnly));
    expect(await readFile(join(ctx.root, 'servers', 'surv', 'data', 'w', 'level.dat'), 'utf8')).toBe('changed-again');
  });

  it('restores an internal-only commit without touching worlds/ (R8)', async () => {
    await internalServer(ctx.root, 'surv', 'w');
    const c = ok(await ctx.adapter.push()).commit!;
    await writeWorld(join(ctx.root, 'worlds', 'later'), 'L');
    await writeWorld(join(ctx.root, 'servers', 'surv', 'data', 'w'), 'changed');
    ok(await ctx.adapter.restore(c));
    expect(await readFile(join(ctx.root, 'servers', 'surv', 'data', 'w', 'level.dat'), 'utf8')).toBe('surv-w');
    expect(existsSync(join(ctx.root, 'worlds', 'later', 'level.dat'))).toBe(true);
  });

  it('refuses when the commit world does not match the current LEVEL (R8)', async () => {
    await internalServer(ctx.root, 'surv', 'old');
    const c = ok(await ctx.adapter.push()).commit!;
    await writeFile(join(ctx.root, 'servers', 'surv', 'config.env'), 'LEVEL=new\n');
    expect(errCode(await ctx.adapter.restore(c))).toBe('restore_conflict');
    expect(existsSync(join(ctx.root, 'servers', 'surv', 'data', 'old', 'level.dat'))).toBe(true);
  });

  it('reports a server whose directory is gone as skipped', async () => {
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    await internalServer(ctx.root, 'gone', 'w');
    const c = ok(await ctx.adapter.push()).commit!;
    await rm(join(ctx.root, 'servers', 'gone'), { recursive: true });
    const out = ok(await ctx.adapter.restore(c));
    expect(out.skipped.join('\n')).toContain('gone');
  });

  it('rolls back every move when a later move fails (K2, R4)', async () => {
    if (isRoot) return;
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    await internalServer(ctx.root, 'surv', 'w');
    const c = ok(await ctx.adapter.push()).commit!;
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A2');
    await writeWorld(join(ctx.root, 'worlds', 'beta'), 'B2');
    await writeWorld(join(ctx.root, 'servers', 'surv', 'data', 'w'), 'W2');
    ok(await ctx.adapter.push({ allowMissing: false }));
    const dataDir = join(ctx.root, 'servers', 'surv', 'data');
    await chmod(dataDir, 0o555); // moving data/w aside fails after worlds/ was swapped
    try {
      const r = await ctx.adapter.restore(c);
      expect(errCode(r)).toBe('io_failed');
    } finally {
      await chmod(dataDir, 0o755);
    }
    expect(await readFile(join(ctx.root, 'worlds', 'alpha', 'level.dat'), 'utf8')).toBe('A2');
    expect(await readFile(join(ctx.root, 'worlds', 'beta', 'level.dat'), 'utf8')).toBe('B2');
    expect(await readFile(join(dataDir, 'w', 'level.dat'), 'utf8')).toBe('W2');
    const slots = await readdir(join(ctx.root, 'backups', 'restore-previous'));
    for (const s of slots) {
      expect(existsSync(join(ctx.root, 'backups', 'restore-previous', s, 'INCOMPLETE'))).toBe(false);
    }
    expect(ok(await ctx.adapter.push()).changed).toBe(false); // nothing blocks afterwards
  });

  it('a failed rollback leaves INCOMPLETE, which blocks the next push and restore (P2)', async () => {
    const { a } = await twoCommits();
    const real = fsOps.rename;
    let calls = 0;
    const spy = vi.spyOn(fsOps, 'rename').mockImplementation(async (from, to) => {
      calls += 1;
      if (calls === 3 || calls === 4) throw new Error(`injected rename failure ${calls}`); // swap, then rollback
      return real(from, to);
    });
    try {
      const r = await ctx.adapter.restore(a);
      expect(errCode(r)).toBe('io_failed');
      if (!r.ok) expect(r.error.paths?.[0]).toContain('restore-previous');
    } finally {
      spy.mockRestore();
    }
    expect(errCode(await ctx.adapter.push())).toBe('recovery_required');
    expect(errCode(await ctx.adapter.restore(a))).toBe('recovery_required');
  });

  it('rolled-back slots do not push successful slots out of the rotation (P2)', async () => {
    if (isRoot) return;
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'A1');
    await internalServer(ctx.root, 'surv', 'w');
    const c = ok(await ctx.adapter.push()).commit!;
    for (let i = 0; i < 3; i++) ok(await ctx.adapter.restore(c));
    const slotsDir = join(ctx.root, 'backups', 'restore-previous');
    const before = (await readdir(slotsDir)).sort();
    const dataDir = join(ctx.root, 'servers', 'surv', 'data');
    await chmod(dataDir, 0o555);
    try {
      for (let i = 0; i < 2; i++) expect(errCode(await ctx.adapter.restore(c))).toBe('io_failed');
    } finally {
      await chmod(dataDir, 0o755);
    }
    expect((await readdir(slotsDir)).sort()).toEqual(before); // rolled-back slots are removed
    ok(await ctx.adapter.restore(c));
    const after = (await readdir(slotsDir)).sort();
    expect(after).toHaveLength(3);
    expect(after).toEqual(expect.arrayContaining([before[1], before[2]]));
    expect(await readFile(join(slotsDir, before[1]!, 'worlds', 'alpha', 'level.dat'), 'utf8')).toBe('A1');
  });

  it('blocks while a slot is INCOMPLETE', async () => {
    const { a } = await twoCommits();
    await mkdir(join(ctx.root, 'backups', 'restore-previous', 'x'), { recursive: true });
    await writeFile(join(ctx.root, 'backups', 'restore-previous', 'x', 'INCOMPLETE'), '{}');
    expect(errCode(await ctx.adapter.restore(a))).toBe('recovery_required');
  });

  it('keeps the three newest complete slots (K2)', async () => {
    const { a, b } = await twoCommits();
    for (const c of [a, b, a, b]) ok(await ctx.adapter.restore(c));
    expect(await readdir(join(ctx.root, 'backups', 'restore-previous'))).toHaveLength(3);
  });

  it('cleans a leftover staging dir from a crashed restore', async () => {
    const { a } = await twoCommits();
    await mkdir(join(ctx.root, 'backups', '.restore-crashed', 'worlds'), { recursive: true });
    ok(await ctx.adapter.restore(a));
    expect(existsSync(join(ctx.root, 'backups', '.restore-crashed'))).toBe(false);
  });

  it('scrubs a legacy token URL before fetching (#11)', async () => {
    const { a } = await twoCommits();
    git(ctx.cache, ['remote', 'set-url', 'origin', `https://${TOKEN}@github.com/${REPO}.git`]);
    ok(await ctx.adapter.restore(a));
    expect(await readFile(join(ctx.cache, '.git', 'config'), 'utf8')).not.toContain(TOKEN);
  });

  it('prepares the cache when it does not exist yet', async () => {
    const { a } = await twoCommits();
    await rm(ctx.cache, { recursive: true, force: true });
    ok(await ctx.adapter.restore(a));
    expect(existsSync(join(ctx.root, 'worlds', 'beta'))).toBe(false);
  });
});

describe('prune (#9)', () => {
  async function pushN(n: number) {
    for (let i = 1; i <= n; i++) {
      await writeWorld(join(ctx.root, 'worlds', 'alpha'), `v${i}`);
      ok(await ctx.adapter.push({ message: `v${i}` }));
    }
  }

  it('keeps the newest maxCount snapshots and the tip tree', async () => {
    await pushN(4);
    const tipTree = git(ctx.bare, ['rev-parse', 'main^{tree}']);
    const out = ok(await ctx.adapter.prune(BackupRetentionPolicy.create({ maxCount: 2 })));
    expect(out.removed).toBe(3);
    expect(git(ctx.bare, ['log', '--format=%s', 'main']).split('\n')).toEqual(['v4', 'v3']);
    expect(git(ctx.bare, ['rev-parse', 'main^{tree}'])).toBe(tipTree);
    expect(git(ctx.cache, ['rev-parse', 'main'])).toBe(remoteTip(ctx.bare));
    expect(git(ctx.cache, ['status', '--porcelain'])).toBe('');
  });

  it('removes nothing when the policy is already met', async () => {
    await pushN(2);
    const tip = remoteTip(ctx.bare);
    expect(ok(await ctx.adapter.prune(BackupRetentionPolicy.create({ maxCount: 5 }))).removed).toBe(0);
    expect(remoteTip(ctx.bare)).toBe(tip);
  });

  /** Builds history directly in the remote with chosen author dates. */
  function seedRemote(dates: string[]) {
    const work = join(ctx.base, 'seed');
    git(ctx.base, ['clone', '-q', ctx.bare, work]);
    dates.forEach((date, i) => {
      execFileSync('sh', ['-c', `mkdir -p worlds/alpha && printf %s v${i} > worlds/alpha/level.dat`], { cwd: work });
      git(work, ['add', '-A']);
      git(work, ['commit', '-q', '-m', `c${i}`], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
    });
    git(work, ['push', '-q', 'origin', 'HEAD:main']);
  }

  it('applies maxAgeDays by author date and always keeps the tip (R6)', async () => {
    const day = 86_400_000;
    const iso = (ago: number) => new Date(Date.now() - ago * day).toISOString();
    seedRemote([iso(40), iso(35), iso(5), iso(2), iso(50)]); // the tip has an old author date
    const tipTree = git(ctx.bare, ['rev-parse', 'main^{tree}']);
    const c3Dates = git(ctx.bare, ['log', '-1', '--format=%aI %cI', 'main~1']);
    const out = ok(await ctx.adapter.prune(BackupRetentionPolicy.create({ maxAgeDays: 30 })));
    expect(git(ctx.bare, ['log', '--format=%s', 'main']).split('\n')).toEqual(['c4', 'c3', 'c2']);
    expect(out.removed).toBe(2);
    expect(git(ctx.bare, ['rev-parse', 'main^{tree}'])).toBe(tipTree);
    expect(git(ctx.bare, ['log', '-1', '--format=%aI %cI', 'main~1'])).toBe(c3Dates);
  });

  it('unshallows a --depth 50 cache before deciding (R5, S2)', async () => {
    const day = 86_400_000;
    seedRemote(Array.from({ length: 60 }, (_, i) => new Date(Date.now() - (60 - i) * day).toISOString()));
    await mkdir(join(ctx.root, 'worlds', 'alpha'), { recursive: true });
    await writeFile(join(ctx.root, 'worlds', 'alpha', 'level.dat'), 'new');
    ok(await ctx.adapter.push({ message: 'now' }));
    expect(git(ctx.cache, ['rev-parse', '--is-shallow-repository'])).toBe('true');
    ok(await ctx.adapter.prune(BackupRetentionPolicy.create({ maxAgeDays: 55 })));
    // seeded c0..c59 at 60..1 days ago: newer than 55 days are c6..c59 (54), plus 'now'
    expect(remoteCount(ctx.bare)).toBe(55);
  });

  it('leaves remote and local untouched when the push is rejected', async () => {
    await pushN(3);
    const flag = join(ctx.base, 'reject');
    await rejectPushes(ctx.bare, flag);
    await writeFile(flag, '');
    const tip = remoteTip(ctx.bare);
    const r = await ctx.adapter.prune(BackupRetentionPolicy.create({ maxCount: 1 }));
    expect(r.ok).toBe(false);
    expect(remoteTip(ctx.bare)).toBe(tip);
    expect(git(ctx.cache, ['rev-parse', 'main'])).toBe(tip);
  });

  it('skips with a warning when local differs from origin', async () => {
    await pushN(2);
    git(ctx.cache, ['commit', '-q', '--allow-empty', '-m', 'local only'], {
      GIT_AUTHOR_NAME: 'x', GIT_AUTHOR_EMAIL: 'x@x', GIT_COMMITTER_NAME: 'x', GIT_COMMITTER_EMAIL: 'x@x',
    });
    const out = ok(await ctx.adapter.prune(BackupRetentionPolicy.create({ maxCount: 1 })));
    expect(out.removed).toBe(0);
    expect(out.warnings.length).toBe(1);
  });

  it('skips without touching history when local has an unpushed commit and the remote moved (P1)', async () => {
    await pushN(2);
    git(ctx.cache, ['commit', '-q', '--allow-empty', '-m', 'local A'], {
      GIT_AUTHOR_NAME: 'x', GIT_AUTHOR_EMAIL: 'x@x', GIT_COMMITTER_NAME: 'x', GIT_COMMITTER_EMAIL: 'x@x',
    });
    const localA = git(ctx.cache, ['rev-parse', 'main']);
    const work = join(ctx.base, 'other-writer');
    git(ctx.base, ['clone', '-q', ctx.bare, work]);
    git(work, ['commit', '-q', '--allow-empty', '-m', 'remote B']);
    git(work, ['push', '-q', 'origin', 'HEAD:main']);
    const remoteB = remoteTip(ctx.bare);

    const out = ok(await ctx.adapter.prune(BackupRetentionPolicy.create({ maxCount: 1 })));
    expect(out.removed).toBe(0);
    expect(out.warnings).toHaveLength(1);
    expect(git(ctx.cache, ['rev-parse', 'main'])).toBe(localA);
    expect(remoteTip(ctx.bare)).toBe(remoteB);
  });

  it('a crash between push and update-ref is reconciled silently by the next push', async () => {
    await pushN(3);
    const before = git(ctx.cache, ['rev-parse', 'main']);
    ok(await ctx.adapter.prune(BackupRetentionPolicy.create({ maxCount: 1 })));
    git(ctx.cache, ['update-ref', 'refs/heads/main', before]); // simulate the crash
    await writeWorld(join(ctx.root, 'worlds', 'alpha'), 'v4');
    const out = ok(await ctx.adapter.push({ message: 'v4' }));
    expect(out.warnings).toEqual([]);
    expect(git(ctx.bare, ['log', '--format=%s', 'main']).split('\n')).toEqual(['v4', 'v3']);
  });
});

describe('prune against a remote that changes under it (#9, R12)', () => {
  const REAL_GIT = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
  const savedPath = process.env.PATH;
  const WRAPPER = `#!/bin/sh
case " $* " in
  *" --force-with-lease="*)
    if [ "$FAKE_PRUNE_MODE" = lease ]; then "${REAL_GIT}" -C "$EXTERNAL_CLONE" push -q origin HEAD:main > /dev/null 2>&1; fi
    if [ "$FAKE_PRUNE_MODE" = ack-fail ]; then "${REAL_GIT}" "$@"; echo "fatal: the remote end hung up unexpectedly" >&2; exit 1; fi
    ;;
esac
exec "${REAL_GIT}" "$@"
`;

  beforeEach(async () => {
    await mkdir(join(ctx.base, 'bin'), { recursive: true });
    await writeFile(join(ctx.base, 'bin', 'git'), WRAPPER);
    await chmod(join(ctx.base, 'bin', 'git'), 0o755);
    process.env.PATH = `${join(ctx.base, 'bin')}:${savedPath}`;
  });

  afterEach(() => {
    process.env.PATH = savedPath;
    delete process.env.FAKE_PRUNE_MODE;
    delete process.env.EXTERNAL_CLONE;
  });

  async function pushN(n: number) {
    for (let i = 1; i <= n; i++) {
      await writeWorld(join(ctx.root, 'worlds', 'alpha'), `v${i}`);
      ok(await ctx.adapter.push({ message: `v${i}` }));
    }
  }

  it('an external writer that moves the remote mid-prune is a lease conflict; nothing is rewritten', async () => {
    await pushN(3);
    const external = join(ctx.base, 'external');
    git(ctx.base, ['clone', '-q', ctx.bare, external]);
    git(external, ['commit', '-q', '--allow-empty', '-m', 'external']);
    const externalTip = git(external, ['rev-parse', 'HEAD']);
    const localTip = git(ctx.cache, ['rev-parse', 'main']);
    process.env.FAKE_PRUNE_MODE = 'lease';
    process.env.EXTERNAL_CLONE = external;

    const r = await ctx.adapter.prune(BackupRetentionPolicy.create({ maxCount: 1 }));
    expect(errCode(r)).toBe('lease_conflict');
    expect(remoteTip(ctx.bare)).toBe(externalTip);
    expect(git(ctx.cache, ['rev-parse', 'main'])).toBe(localTip);
  });

  it('a push that reached the remote but reported failure converges to the new history', async () => {
    await pushN(3);
    process.env.FAKE_PRUNE_MODE = 'ack-fail';
    const out = ok(await ctx.adapter.prune(BackupRetentionPolicy.create({ maxCount: 1 })));
    expect(out.removed).toBeGreaterThan(0);
    expect(remoteCount(ctx.bare)).toBe(1);
    expect(git(ctx.cache, ['rev-parse', 'main'])).toBe(remoteTip(ctx.bare));
  });
});
