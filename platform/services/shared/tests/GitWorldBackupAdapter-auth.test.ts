/**
 * Token handling and git environment of GitWorldBackupAdapter (#732 B3, #10, #11).
 * A fake `git` on PATH logs argv and env, then runs the real git (or answers itself).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { GitWorldBackupAdapter } from '../src/infrastructure/adapters/GitWorldBackupAdapter.js';
import type { IContainerRuntimePort } from '../src/application/ports/outbound/IContainerRuntimePort.js';
import type { IRuntimeEnvironmentPort } from '../src/application/ports/outbound/IRuntimeEnvironmentPort.js';
import type { IServerConsolePort } from '../src/application/ports/outbound/IServerConsolePort.js';

const TOKEN = 'ghp_secret_token_abcdef0123';
const B64 = Buffer.from(`x-access-token:${TOKEN}`).toString('base64');
const REAL_GIT = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();

const FAKE = `#!/bin/sh
{ printf 'ARGV'; for a in "$@"; do printf '\\t%s' "$a"; done; printf '\\n'; } >> "$FAKE_GIT_LOG"
env | grep -E '^(GIT_|HTTPS_PROXY=)' | sed 's/^/ENV\\t/' >> "$FAKE_GIT_LOG"
if [ "$1" = "--version" ] && [ -n "$FAKE_GIT_VERSION" ]; then echo "git version $FAKE_GIT_VERSION"; exit 0; fi
if [ "$1" = "ls-remote" ] && [ -n "$FAKE_GIT_LS_REMOTE_STDERR" ]; then echo "$FAKE_GIT_LS_REMOTE_STDERR" >&2; exit 128; fi
if [ "$1" = "ls-remote" ] && [ -n "$FAKE_GIT_LS_REMOTE_OK" ]; then exit 0; fi
exec "${REAL_GIT}" "$@"
`;

const fakes = {
  runtime: { list: () => [] } as unknown as IContainerRuntimePort,
  environment: { isAvailable: () => true } as unknown as IRuntimeEnvironmentPort,
  console: { command: async () => ({ exitCode: 0, stdout: '', stderr: '' }) } as unknown as IServerConsolePort,
};

let base: string;
let log: string;
const savedEnv = { ...process.env };

beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), 'wb-auth-'));
  await mkdir(join(base, 'bin'));
  await writeFile(join(base, 'bin', 'git'), FAKE);
  await chmod(join(base, 'bin', 'git'), 0o755);
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

beforeEach(async () => {
  log = join(base, `log-${Date.now()}-${Math.random()}`);
  await writeFile(log, '');
  process.env.PATH = `${join(base, 'bin')}:${savedEnv.PATH}`;
  process.env.FAKE_GIT_LOG = log;
  process.env.GIT_DIR = '/should/not/leak';
  process.env.GIT_CONFIG_COUNT = '1';
  process.env.GIT_CONFIG_KEY_0 = 'core.bogus';
  process.env.GIT_CONFIG_VALUE_0 = 'x';
  process.env.HTTPS_PROXY = 'http://proxy.example:3128';
});

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
});

async function readLog() {
  const lines = (await readFile(log, 'utf8')).split('\n').filter(Boolean);
  const calls: { argv: string[]; env: Record<string, string> }[] = [];
  for (const line of lines) {
    const [kind, ...rest] = line.split('\t');
    if (kind === 'ARGV') calls.push({ argv: rest, env: {} });
    else if (kind === 'ENV' && calls.length > 0) {
      const kv = rest.join('\t');
      const i = kv.indexOf('=');
      calls[calls.length - 1]!.env[kv.slice(0, i)] = kv.slice(i + 1);
    }
  }
  return calls;
}

function adapter(root: string, remoteBase = 'https://github.com/') {
  return new GitWorldBackupAdapter({ root, ...fakes, remoteBase });
}

describe('testConnection (#10)', () => {
  it('runs the real git ls-remote with the token only in the environment', async () => {
    process.env.FAKE_GIT_LS_REMOTE_OK = '1';
    const r = await adapter(base).testConnection({ token: TOKEN, repository: 'owner/repo' });
    expect(r).toEqual({ ok: true, value: undefined });

    const calls = await readLog();
    const ls = calls.find((c) => c.argv[0] === 'ls-remote')!;
    expect(ls.argv).toEqual(['ls-remote', '--heads', 'https://github.com/owner/repo.git']);
    expect(ls.env.GIT_TERMINAL_PROMPT).toBe('0');
    expect(Object.values(ls.env)).toContain(`Authorization: Basic ${B64}`);
    expect(ls.env.GIT_CONFIG_KEY_0).toBe('commit.gpgSign');
    expect(Object.values(ls.env)).not.toContain('core.bogus');
    expect(ls.env.GIT_DIR).toBeUndefined();
    expect(ls.env.HTTPS_PROXY).toBe('http://proxy.example:3128');
    for (const c of calls) expect(c.argv.join(' ')).not.toMatch(new RegExp(`${TOKEN}|${B64}`));
  });

  it('maps "Repository not found" and authentication failures', async () => {
    process.env.FAKE_GIT_LS_REMOTE_STDERR = 'remote: Repository not found.';
    const notFound = await adapter(base).testConnection({ token: TOKEN, repository: 'owner/repo' });
    expect(notFound.ok ? undefined : notFound.error.code).toBe('repo_not_found');

    process.env.FAKE_GIT_LS_REMOTE_STDERR = "fatal: Authentication failed for 'https://github.com/owner/repo.git/'";
    const denied = await adapter(base).testConnection({ token: TOKEN, repository: 'owner/repo' });
    expect(denied.ok ? undefined : denied.error.code).toBe('auth_failed');
    if (!denied.ok) expect(denied.error.message).not.toContain(TOKEN);
  });

  it('rejects git older than 2.31', async () => {
    process.env.FAKE_GIT_VERSION = '2.30.2';
    const r = await adapter(base).testConnection({ token: TOKEN, repository: 'owner/repo' });
    expect(r.ok ? undefined : r.error.code).toBe('git_too_old');
  });

  it('rejects an invalid repository name before running git', async () => {
    const r = await adapter(base).testConnection({ token: TOKEN, repository: 'owner/repo --upload-pack=x' });
    expect(r.ok ? undefined : r.error.code).toBe('repo_not_found');
    expect((await readLog()).find((c) => c.argv[0] === 'ls-remote')).toBeUndefined();
  });
});

describe('push and restore keep the token out of argv (#11)', () => {
  it('no git argv ever contains the token', async () => {
    const root = join(base, `root-${Date.now()}`);
    const remotes = join(base, `remotes-${Date.now()}`);
    await mkdir(join(root, 'worlds', 'alpha'), { recursive: true });
    await writeFile(join(root, 'worlds', 'alpha', 'level.dat'), 'A1');
    await writeFile(join(root, '.env'), `BACKUP_GITHUB_TOKEN=${TOKEN}\nBACKUP_GITHUB_REPO=owner/worlds\n`);
    await mkdir(join(remotes, 'owner'), { recursive: true });
    execFileSync(REAL_GIT, ['init', '--bare', '-q', '-b', 'main', join(remotes, 'owner', 'worlds.git')], { env: savedEnv });

    const a = adapter(root, `file://${remotes}/`);
    const first = await a.push({ message: 'one' });
    expect(first.ok).toBe(true);
    await writeFile(join(root, 'worlds', 'alpha', 'level.dat'), 'A2');
    expect((await a.push({ message: 'two' })).ok).toBe(true);
    if (first.ok) expect((await a.restore(first.value.commit!)).ok).toBe(true);

    const calls = await readLog();
    expect(calls.some((c) => c.argv[0] === 'clone' || c.argv[0] === 'ls-remote')).toBe(true);
    expect(calls.some((c) => c.argv[0] === 'push')).toBe(true);
    for (const c of calls) expect(c.argv.join(' ')).not.toMatch(new RegExp(`${TOKEN}|${B64}`));
    const network = calls.filter((c) => ['ls-remote', 'clone', 'fetch', 'push'].includes(c.argv[0]!));
    for (const c of network) expect(Object.values(c.env)).toContain(`Authorization: Basic ${B64}`);
    const local = calls.filter((c) => ['add', 'commit', 'log'].includes(c.argv[0]!));
    for (const c of local) expect(JSON.stringify(c.env)).not.toContain(B64);
  });
});
