/**
 * Git backup of worlds/ and server-internal worlds (ADR-0001 "Backup Port (#732, S3)").
 *
 * Not a runtime port: git plus file copies. The runtime and console ports are used only
 * to refuse restores over running servers and to flush running servers before a copy.
 * Never import the docker facade or an adapter barrel from here (cycle, ADR-0001).
 */
import { cp, lstat, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseEnvDocument } from '../../utils/env-file.js';
import { WorldName, resolveWorldName } from '../../domain/value-objects/WorldName.js';
import type { BackupRetentionPolicy } from '../../domain/value-objects/BackupRetentionPolicy.js';
import type { IContainerRuntimePort } from '../../application/ports/outbound/IContainerRuntimePort.js';
import type { IRuntimeEnvironmentPort } from '../../application/ports/outbound/IRuntimeEnvironmentPort.js';
import type { IServerConsolePort } from '../../application/ports/outbound/IServerConsolePort.js';
import type {
  IWorldBackupPort,
  LockOptions,
  WorldBackupCommit,
  WorldBackupPruneOutcome,
  WorldBackupPushOptions,
  WorldBackupPushOutcome,
  WorldBackupRestoreOutcome,
  WorldBackupResult,
  WorldBackupStatus,
} from '../../application/ports/outbound/IWorldBackupPort.js';
import { acquireBackupLock } from '../backup/lock.js';
import { cleanStaging, incompleteSlots, rotateSlots, swapIntoPlace, type RestoreTarget } from '../backup/restore-slots.js';
import { assertNoSymlinks, entries, fail, Fail, isMissing, listDirs, lstatOrNull } from '../backup/support.js';
import { BACKUP_IDENTITY, GitRunner, networkErrorCode, type GitOptions, type GitResult } from '../backup/git.js';

export interface GitWorldBackupAdapterOptions {
  root: string;
  runtime: IContainerRuntimePort;
  environment: IRuntimeEnvironmentPort;
  console: IServerConsolePort;
  /** Remote prefix; `<remoteBase><owner>/<repo>.git`. Tests pass a file:// directory. */
  remoteBase?: string;
  /** Per RCON command (save-off, save-all flush). Default 60 s. */
  flushTimeoutMs?: number;
}

interface BackupConfig {
  token: string;
  repository: string;
  branch: string;
  autoOnStop: boolean;
}

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const COMMIT_RE = /^[0-9a-f]{4,40}$/i;
const README = '# Minecraft Worlds Backup\n\nThis repository contains automated backups of Minecraft world data.\n\n**Do not edit manually.**\n';

/** D1 ports use container names; results use server names (D4 moves this rule). */
const serverNameOf = (container: string) => container.replace(/^mc-/, '');

/** A server's internal world: servers/<n>/data/<LEVEL>[ _nether | _the_end ]. */
interface InternalWorld {
  server: string;
  level: string;
  dirs: string[];
}

export class GitWorldBackupAdapter implements IWorldBackupPort {
  private readonly git: GitRunner;
  private readonly remoteBase: string;
  private readonly root: string;
  private readonly cache: string;

  constructor(private readonly options: GitWorldBackupAdapterOptions) {
    this.root = options.root;
    this.cache = join(this.root, 'backups', 'worlds');
    this.remoteBase = options.remoteBase ?? 'https://github.com/';
    this.git = new GitRunner(this.remoteBase);
  }

  // ---------------------------------------------------------------- public

  async status(): Promise<WorldBackupResult<WorldBackupStatus>> {
    return this.guard(async () => {
      const cfg = await this.readConfig();
      const status: WorldBackupStatus = {
        configured: Boolean(cfg.token && cfg.repository),
        branch: cfg.branch,
        autoOnStop: cfg.autoOnStop,
      };
      if (cfg.repository) status.repository = cfg.repository;
      if (await this.hasCache()) {
        const r = await this.git.run(['log', '-1', '--format=%H%x00%aI'], { cwd: this.cache });
        const [commit, date] = r.stdout.trim().split('\0');
        if (r.code === 0 && commit && date) status.lastBackup = { commit, date: new Date(date) };
      }
      return status;
    });
  }

  async history(limit = 20): Promise<WorldBackupResult<WorldBackupCommit[]>> {
    return this.guard(async () => {
      if (!(await this.hasCache())) return [];
      const r = await this.git.run(['log', '-n', String(limit), '--format=%H%x00%aI%x00%an%x00%s%x1e'], {
        cwd: this.cache,
      });
      if (r.code !== 0) return []; // no commit yet
      return r.stdout
        .split('\x1e')
        .map((rec) => rec.replace(/^\n/, ''))
        .filter(Boolean)
        .map((rec) => {
          const [hash = '', date = '', author = '', message = ''] = rec.split('\0');
          return { hash, date: new Date(date), author, message };
        });
    });
  }

  async testConnection(credentials: { token: string; repository: string }): Promise<WorldBackupResult<void>> {
    return this.guard(async () => {
      if (!REPO_RE.test(credentials.repository)) {
        fail('repo_not_found', `Invalid repository "${credentials.repository}" (expected owner/repo)`);
      }
      await this.ensureGit();
      const r = await this.git.run(['ls-remote', '--heads', this.url(credentials.repository)], {
        token: credentials.token,
        timeoutMs: 60_000,
      });
      if (r.code !== 0) fail(networkErrorCode(r), r.stderr.trim() || 'git ls-remote failed');
    });
  }

  async push(options: WorldBackupPushOptions = {}): Promise<WorldBackupResult<WorldBackupPushOutcome>> {
    return this.locked('push', options, async (cfg) => {
      const warnings = await this.prepareCache(cfg);
      const internals = await this.scanInternalWorlds();
      const worldNames = await entries(join(this.root, 'worlds'));
      for (const name of worldNames) await assertNoSymlinks(join(this.root, 'worlds', name));

      // Missing-world guard (R7, S5), before the cache is touched
      const source = new Set([
        ...worldNames.map((n) => `worlds/${n}`),
        ...internals.worlds.flatMap((w) => w.dirs.map((d) => `servers/${w.server}/${d}`)),
      ]);
      const serversDirExists = (await lstatOrNull(join(this.root, 'servers'))) !== null;
      const missing: string[] = [];
      for (const path of await this.trackedWorlds()) {
        if (source.has(path)) continue;
        const server = path.startsWith('servers/') ? path.split('/')[1]! : undefined;
        if (server && serversDirExists && !(await lstatOrNull(join(this.root, 'servers', server)))) continue;
        missing.push(path);
      }
      if (missing.length > 0 && !options.allowMissing) {
        fail('missing_worlds', `Worlds in the last backup are missing from the source: ${missing.join(', ')}`, {
          paths: missing,
        });
      }
      if (source.size === 0) fail('empty_source', 'Nothing to back up: no worlds found');

      const flushed = await this.withFlush(warnings, async () => {
        await rm(join(this.cache, 'worlds'), { recursive: true, force: true });
        await rm(join(this.cache, 'servers'), { recursive: true, force: true });
        const worlds = join(this.root, 'worlds');
        for (const name of worldNames) await this.copy(join(worlds, name), join(this.cache, 'worlds', name));
        for (const w of internals.worlds) {
          for (const d of w.dirs) {
            await this.copy(join(this.root, 'servers', w.server, 'data', d), join(this.cache, 'servers', w.server, d));
          }
        }
      });

      await this.mustGit(['add', '-A']);
      const staged = await this.git.run(['diff', '--cached', '--quiet'], { cwd: this.cache });
      const changed = staged.code !== 0;
      if (changed) {
        await this.mustGit(['commit', '-q', '-m', options.message || this.defaultMessage()], {
          env: BACKUP_IDENTITY,
        });
      }
      const ahead = await this.git.run(['rev-list', '--count', `refs/remotes/origin/${cfg.branch}..HEAD`], {
        cwd: this.cache,
      });
      if (changed || ahead.code !== 0 || ahead.stdout.trim() !== '0') {
        const r = await this.git.run(['push', '-q', 'origin', `HEAD:refs/heads/${cfg.branch}`], {
          cwd: this.cache,
          token: cfg.token,
        });
        if (r.code !== 0) fail(networkErrorCode(r), `git push failed: ${r.stderr.trim()}`);
        await this.git.run(['fetch', '-q', 'origin', this.refspec(cfg.branch)], { cwd: this.cache, token: cfg.token });
      }
      const head = await this.mustGit(['rev-parse', 'HEAD']);
      return {
        changed,
        commit: head.stdout.trim(),
        flushed,
        skipped: internals.skipped,
        warnings,
      };
    });
  }

  async restore(commit: string, options: LockOptions = {}): Promise<WorldBackupResult<WorldBackupRestoreOutcome>> {
    if (!COMMIT_RE.test(commit)) {
      return { ok: false, error: { code: 'commit_not_found', message: `Invalid commit "${commit}"` } };
    }
    return this.locked('restore', options, async (cfg) => {
      await cleanStaging(this.root);
      if (await this.hasCache()) {
        await this.git.run(['worktree', 'prune'], { cwd: this.cache });
        await this.normalizeRemote(this.url(cfg.repository));
        await this.git.run(['fetch', '-q', 'origin', this.refspec(cfg.branch)], { cwd: this.cache, token: cfg.token });
      } else {
        await this.prepareCache(cfg);
      }
      const oid = await this.resolveCommit(commit, cfg);

      this.assertNothingRunning();
      const staging = join(this.root, 'backups', `.restore-${this.stamp()}`);
      try {
        await this.mustGit(['worktree', 'add', '-q', '--detach', staging, oid]);
        const { targets, skipped } = await this.planRestore(staging);
        this.assertNothingRunning(); // re-check right before the swap (K3, R1)
        const previousDir = await swapIntoPlace(this.root, oid, targets, this.stamp());
        await rotateSlots(this.root);
        return { commit: oid, previousDir, skipped };
      } finally {
        await this.git.run(['worktree', 'remove', '--force', staging], { cwd: this.cache });
        await rm(staging, { recursive: true, force: true });
      }
    });
  }

  async prune(policy: BackupRetentionPolicy, options: LockOptions = {}): Promise<WorldBackupResult<WorldBackupPruneOutcome>> {
    return this.locked('prune', options, async (cfg) => {
      const warnings = await this.prepareCache(cfg);
      const b = cfg.branch;
      const local = (await this.mustGit(['rev-parse', `refs/heads/${b}`])).stdout.trim();
      const originRef = await this.git.run(['rev-parse', '--verify', '-q', `refs/remotes/origin/${b}`], { cwd: this.cache });
      if (originRef.code !== 0 || originRef.stdout.trim() !== local) {
        return { removed: 0, warnings: [...warnings, 'Local backup differs from the remote; prune skipped until the next push'] };
      }
      const oldTip = local;

      const shallow = await this.mustGit(['rev-parse', '--is-shallow-repository']);
      if (shallow.stdout.trim() === 'true') {
        const r = await this.git.run(['fetch', '-q', '--unshallow', 'origin', this.refspec(b)], {
          cwd: this.cache,
          token: cfg.token,
        });
        if (r.code !== 0) fail(networkErrorCode(r), `Cannot fetch the full history; prune skipped: ${r.stderr.trim()}`);
      }

      const log = await this.mustGit([
        'log', '--first-parent', '--format=%H%x00%aI%x00%cI%x00%an%x00%ae%x00%cn%x00%ce%x00%B%x1e', oldTip,
      ]);
      const commits = log.stdout
        .split('\x1e')
        .map((rec) => rec.replace(/^\n/, ''))
        .filter(Boolean)
        .map((rec) => {
          const [hash, aDate, cDate, an, ae, cn, ce, body] = rec.split('\0') as string[];
          return { hash: hash!, aDate: aDate!, cDate: cDate!, an: an!, ae: ae!, cn: cn!, ce: ce!, body: (body ?? '').trim() };
        });
      const cutoff = policy.maxAgeDays !== undefined ? Date.now() - policy.maxAgeDays * 86_400_000 : undefined;
      const kept = commits.filter(
        (c, i) =>
          i === 0 || // the tip is always kept (R6)
          ((policy.maxCount === undefined || i < policy.maxCount) &&
            (cutoff === undefined || new Date(c.aDate).getTime() >= cutoff))
      );
      const removed = commits.length - kept.length;
      if (removed === 0) return { removed: 0, warnings };

      let parent: string | undefined;
      for (const c of kept.reverse()) {
        const args = ['commit-tree', `${c.hash}^{tree}`, ...(parent ? ['-p', parent] : []), '-m', c.body || '(no message)'];
        const r = await this.mustGit(args, {
          env: {
            GIT_AUTHOR_NAME: c.an, GIT_AUTHOR_EMAIL: c.ae, GIT_AUTHOR_DATE: c.aDate,
            GIT_COMMITTER_NAME: c.cn, GIT_COMMITTER_EMAIL: c.ce, GIT_COMMITTER_DATE: c.cDate,
          },
        });
        parent = r.stdout.trim();
      }
      const newTip = parent!;
      const [newTree, oldTree] = await Promise.all([
        this.mustGit(['rev-parse', `${newTip}^{tree}`]),
        this.mustGit(['rev-parse', `${oldTip}^{tree}`]),
      ]);
      if (newTree.stdout !== oldTree.stdout) fail('io_failed', 'Rebuilt history does not end in the current snapshot');

      const push = await this.git.run(
        ['push', '-q', `--force-with-lease=refs/heads/${b}:${oldTip}`, 'origin', `${newTip}:refs/heads/${b}`],
        { cwd: this.cache, token: cfg.token }
      );
      if (push.code !== 0) {
        // The outcome may be unknown (timeout): ask the remote (R12)
        const remote = await this.git.run(['ls-remote', 'origin', `refs/heads/${b}`], { cwd: this.cache, token: cfg.token });
        const remoteTip = remote.stdout.split(/\s/)[0];
        if (remoteTip !== newTip) {
          if (remote.code === 0 && remoteTip !== oldTip) fail('lease_conflict', 'The remote branch moved during prune');
          fail(networkErrorCode(push), `Prune push failed: ${push.stderr.trim()}`);
        }
      }
      await this.mustGit(['update-ref', `refs/heads/${b}`, newTip, oldTip]);
      await this.mustGit(['update-ref', `refs/remotes/origin/${b}`, newTip]);
      return { removed, warnings };
    });
  }

  // ---------------------------------------------------------------- operation frame

  private async guard<T>(fn: () => Promise<T>): Promise<WorldBackupResult<T>> {
    try {
      return { ok: true, value: await fn() };
    } catch (e) {
      if (e instanceof Fail) return { ok: false, error: e.error };
      return { ok: false, error: { code: 'io_failed', message: (e as Error).message } };
    }
  }

  /** Config check, lock, recovery check and git version for a writing operation. */
  private locked<T>(
    op: 'push' | 'restore' | 'prune',
    options: LockOptions,
    fn: (cfg: BackupConfig) => Promise<T>
  ): Promise<WorldBackupResult<T>> {
    return this.guard(async () => {
      const cfg = await this.readConfig();
      if (!cfg.token || !cfg.repository) {
        fail('not_configured', 'Backup is not configured: set BACKUP_GITHUB_TOKEN and BACKUP_GITHUB_REPO in .env');
      }
      if (!REPO_RE.test(cfg.repository)) fail('repo_not_found', `Invalid BACKUP_GITHUB_REPO "${cfg.repository}"`);
      const lock = await acquireBackupLock(this.root, op, { waitMs: options.lockWaitMs ?? 0 });
      if (!lock.ok) {
        const h = lock.holder;
        fail('locked', h ? `Another backup operation is running (${h.op}, pid ${h.pid} on ${h.hostname}, since ${h.startedAt})` : 'The backup lock file is unreadable; remove backups/.backup.lock if no backup is running', lock.holder ? { holder: lock.holder } : {});
      }
      try {
        const incomplete = await incompleteSlots(this.root);
        if (incomplete.length > 0) {
          fail('recovery_required', `A restore did not finish; recover manually from ${incomplete.join(', ')}`, { paths: incomplete });
        }
        await this.ensureGit();
        const branchOk = await this.git.run(['check-ref-format', '--branch', cfg.branch]);
        if (branchOk.code !== 0) fail('git_failed', `Invalid BACKUP_GITHUB_BRANCH "${cfg.branch}"`);
        return await fn(cfg);
      } finally {
        if (lock.ok) await lock.release();
      }
    });
  }

  private async ensureGit(): Promise<void> {
    if (!(await this.git.ensureVersion())) fail('git_too_old', 'git 2.31 or newer is required for backups');
  }

  private async readConfig(): Promise<BackupConfig> {
    let values = new Map<string, string>();
    try {
      values = parseEnvDocument(await readFile(join(this.root, '.env'), 'utf8')).values;
    } catch (e) {
      if (!isMissing(e)) fail('io_failed', `Cannot read .env: ${(e as Error).message}`);
    }
    const get = (key: string) => values.get(key) ?? process.env[key] ?? '';
    return {
      token: get('BACKUP_GITHUB_TOKEN'),
      repository: get('BACKUP_GITHUB_REPO'),
      branch: get('BACKUP_GITHUB_BRANCH') || 'main',
      autoOnStop: get('BACKUP_AUTO_ON_STOP') === 'true',
    };
  }

  // ---------------------------------------------------------------- git helpers

  private url(repository: string): string {
    return `${this.remoteBase}${repository}.git`;
  }

  private refspec(branch: string): string {
    return `+refs/heads/${branch}:refs/remotes/origin/${branch}`;
  }

  private async mustGit(args: string[], options: GitOptions = {}): Promise<GitResult> {
    const r = await this.git.run(args, { cwd: this.cache, ...options });
    if (r.code !== 0) fail(r.timedOut ? 'timeout' : 'git_failed', `git ${args[0]} failed: ${r.stderr.trim()}`);
    return r;
  }

  private async hasCache(): Promise<boolean> {
    return (await lstatOrNull(join(this.cache, '.git'))) !== null;
  }

  /** B4 step 2: clone or init the cache, normalize origin, align the local branch. */
  private async prepareCache(cfg: BackupConfig): Promise<string[]> {
    const url = this.url(cfg.repository);
    const b = cfg.branch;
    const warnings: string[] = [];
    if (!(await this.hasCache())) {
      const heads = await this.git.run(['ls-remote', '--heads', url, `refs/heads/${b}`], { token: cfg.token });
      if (heads.code !== 0) fail(networkErrorCode(heads), `Cannot reach the backup repository: ${heads.stderr.trim()}`);
      await mkdir(dirname(this.cache), { recursive: true });
      await rm(this.cache, { recursive: true, force: true });
      if (heads.stdout.trim()) {
        const r = await this.git.run(['clone', '-q', '--depth', '50', '--branch', b, url, this.cache], { token: cfg.token });
        if (r.code !== 0) fail(networkErrorCode(r), `git clone failed: ${r.stderr.trim()}`);
        return warnings;
      }
      await mkdir(this.cache, { recursive: true });
      await this.mustGit(['init', '-q', '-b', b]);
      await writeFile(join(this.cache, 'README.md'), README);
      await this.mustGit(['add', 'README.md']);
      await this.mustGit(['commit', '-q', '-m', 'Initial backup repository setup'], { env: BACKUP_IDENTITY });
      await this.mustGit(['remote', 'add', 'origin', url]);
      return warnings;
    }

    await this.normalizeRemote(url);

    const heads = await this.git.run(['ls-remote', '--heads', 'origin', `refs/heads/${b}`], { cwd: this.cache, token: cfg.token });
    if (heads.code !== 0) fail(networkErrorCode(heads), `Cannot reach the backup repository: ${heads.stderr.trim()}`);
    const hasLocal = (await this.git.run(['rev-parse', '--verify', '-q', `refs/heads/${b}`], { cwd: this.cache })).code === 0;
    if (!heads.stdout.trim()) {
      // Remote branch absent: keep (or create) the local branch; the next push publishes it
      if (hasLocal) await this.mustGit(['checkout', '-q', '-f', b]);
      else {
        await this.mustGit(['checkout', '-q', '-f', '--orphan', b]);
        await writeFile(join(this.cache, 'README.md'), README);
        await this.mustGit(['add', 'README.md']);
        await this.mustGit(['commit', '-q', '-m', 'Initial backup repository setup'], { env: BACKUP_IDENTITY });
      }
      return warnings;
    }

    const fetch = await this.git.run(['fetch', '-q', 'origin', this.refspec(b)], { cwd: this.cache, token: cfg.token });
    if (fetch.code !== 0) fail(networkErrorCode(fetch), `git fetch failed: ${fetch.stderr.trim()}`);
    const origin = `refs/remotes/origin/${b}`;
    if (hasLocal) {
      const ancestor = await this.git.run(['merge-base', '--is-ancestor', origin, `refs/heads/${b}`], { cwd: this.cache });
      if (ancestor.code === 0) {
        await this.mustGit(['checkout', '-q', '-f', b]); // (a) unpushed commits: sent by this push
        return warnings;
      }
      const [lt, ot] = await Promise.all([
        this.git.run(['rev-parse', `refs/heads/${b}^{tree}`], { cwd: this.cache }),
        this.git.run(['rev-parse', `${origin}^{tree}`], { cwd: this.cache }),
      ]);
      if (lt.stdout !== ot.stdout) {
        warnings.push(`Local backup history diverged from the remote; reset to origin/${b}`); // (c)
      } // else (b): crash between a prune push and update-ref
    }
    await this.mustGit(['checkout', '-q', '-f', '-B', b, origin]);
    return warnings;
  }

  /** One clean origin URL and no pushurl (scrubs token URLs left by backup.sh). */
  private async normalizeRemote(url: string): Promise<void> {
    await this.git.run(['config', '--unset-all', 'remote.origin.pushurl'], { cwd: this.cache });
    const setUrl = await this.git.run(['remote', 'set-url', 'origin', url], { cwd: this.cache });
    if (setUrl.code !== 0) await this.mustGit(['remote', 'add', 'origin', url]);
  }

  /** World dirs tracked by HEAD: worlds/<w> and servers/<n>/<dir>. */
  private async trackedWorlds(): Promise<string[]> {
    const top = await this.git.run(['ls-tree', '-d', '--name-only', 'HEAD', 'worlds/', 'servers/'], { cwd: this.cache });
    if (top.code !== 0) return [];
    const out: string[] = [];
    for (const path of top.stdout.split('\n').filter(Boolean)) {
      if (path.startsWith('worlds/')) out.push(path);
      else {
        const sub = await this.git.run(['ls-tree', '-d', '--name-only', 'HEAD', `${path}/`], { cwd: this.cache });
        out.push(...sub.stdout.split('\n').filter(Boolean));
      }
    }
    return out;
  }

  private async resolveCommit(commit: string, cfg: BackupConfig): Promise<string> {
    const rev = () => this.git.run(['rev-parse', '--verify', '-q', `${commit}^{commit}`], { cwd: this.cache });
    let r = await rev();
    if (r.code !== 0) {
      const shallow = await this.git.run(['rev-parse', '--is-shallow-repository'], { cwd: this.cache });
      if (shallow.stdout.trim() === 'true') {
        await this.git.run(['fetch', '-q', '--unshallow', 'origin', this.refspec(cfg.branch)], { cwd: this.cache, token: cfg.token });
        r = await rev();
      }
    }
    if (r.code !== 0) fail('commit_not_found', `Commit not found in the backup: ${commit}`);
    return r.stdout.trim();
  }

  // ---------------------------------------------------------------- source scanning and copy

  private async scanInternalWorlds(): Promise<{ worlds: InternalWorld[]; skipped: string[] }> {
    const worlds: InternalWorld[] = [];
    const skipped: string[] = [];
    const serversDir = join(this.root, 'servers');
    for (const server of await listDirs(serversDir)) {
      if (server === '_template') continue;
      const r = await this.internalWorld(server);
      if (typeof r === 'string') skipped.push(`${server}: ${r}`);
      else if (r) worlds.push(r);
    }
    return { worlds, skipped };
  }

  /** The server's internal world, null when it has none, or the reason it is skipped. */
  private async internalWorld(server: string): Promise<InternalWorld | null | string> {
    const sdir = join(this.root, 'servers', server);
    const level = await this.currentLevel(server);
    if (level === null) return null;
    if (typeof level !== 'string' || WorldName.validate(level)) return `invalid LEVEL "${String(level)}"`;
    const data = await lstatOrNull(join(sdir, 'data'));
    if (!data) return null;
    if (data.isSymbolicLink()) return 'data is a symbolic link';
    const main = await lstatOrNull(join(sdir, 'data', level));
    if (!main) return null;
    if (main.isSymbolicLink()) return `data/${level} is a symbolic link`;
    const levelDat = await lstatOrNull(join(sdir, 'data', level, 'level.dat'));
    if (!levelDat?.isFile()) return null;
    const dirs: string[] = [];
    for (const d of [level, `${level}_nether`, `${level}_the_end`]) {
      const st = await lstatOrNull(join(sdir, 'data', d));
      if (st?.isSymbolicLink()) return `data/${d} is a symbolic link`;
      if (st?.isDirectory()) dirs.push(d);
    }
    return { server, level, dirs };
  }

  /** LEVEL from servers/<n>/config.env; null when the server has no config.env. */
  private async currentLevel(server: string): Promise<string | null> {
    try {
      const env = parseEnvDocument(await readFile(join(this.root, 'servers', server, 'config.env'), 'utf8')).values;
      return resolveWorldName(Object.fromEntries(env));
    } catch (e) {
      if (isMissing(e)) return null;
      throw e;
    }
  }

  private async copy(src: string, dst: string): Promise<void> {
    await mkdir(dirname(dst), { recursive: true });
    await cp(src, dst, {
      recursive: true,
      filter: async (path) => {
        if ((await lstat(path)).isSymbolicLink()) {
          fail('unsupported_layout', `Symbolic links are not supported: ${path}`, { paths: [path] });
        }
        return true;
      },
    });
  }

  // ---------------------------------------------------------------- runtime

  private runningServers(): string[] {
    if (!this.options.environment.isAvailable()) {
      fail('runtime_unavailable', 'Cannot query the container runtime; refusing to continue');
    }
    try {
      return this.options.runtime.list({ running: true, strict: true });
    } catch (e) {
      return fail('runtime_unavailable', `Cannot list running servers; refusing to continue: ${(e as Error).message}`);
    }
  }

  private assertNothingRunning(): void {
    const running = this.runningServers();
    if (running.length > 0) {
      const servers = running.map(serverNameOf);
      fail('servers_running', `Stop all servers before restoring (running: ${servers.join(', ')})`, { servers });
    }
  }

  /** save-off → save-all flush → copy → save-on (always). Returns flushed server names. */
  private async withFlush(warnings: string[], copy: () => Promise<void>): Promise<string[]> {
    const running = this.runningServers();
    const cleanup: string[] = [];
    const rcon = async (container: string, args: string[]) => {
      const r = await this.options.console.command(container, args, {
        signal: AbortSignal.timeout(this.options.flushTimeoutMs ?? 60_000),
      });
      return r.exitCode === 0 ? undefined : r.stderr.trim() || r.stdout.trim() || `exit ${r.exitCode}`;
    };
    try {
      for (const c of running) {
        cleanup.push(c); // before sending, so save-on follows even if save-off hangs
        const err = await rcon(c, ['save-off']);
        if (err) fail('flush_failed', `save-off failed for ${serverNameOf(c)}: ${err}`, { servers: [serverNameOf(c)] });
      }
      for (const c of running) {
        const err = await rcon(c, ['save-all', 'flush']);
        if (err) fail('flush_failed', `save-all flush failed for ${serverNameOf(c)}: ${err}`, { servers: [serverNameOf(c)] });
      }
      await copy();
    } finally {
      for (const c of cleanup) {
        const err = await rcon(c, ['save-on']).catch((e: Error) => e.message);
        if (err) warnings.push(`save-on failed for ${serverNameOf(c)}: ${err}`);
      }
    }
    return cleanup.map(serverNameOf);
  }

  // ---------------------------------------------------------------- restore

  private async planRestore(staging: string): Promise<{ targets: RestoreTarget[]; skipped: string[] }> {
    await assertNoSymlinks(staging, (p) => p === join(staging, '.git'));
    const targets: RestoreTarget[] = [];
    const skipped: string[] = [];
    const stagedWorlds = await entries(join(staging, 'worlds'));
    let payload = stagedWorlds.length > 0;

    const plannedServers: Array<{ server: string; names: string[] }> = [];
    for (const server of await listDirs(join(staging, 'servers'))) {
      const commitDirs = await listDirs(join(staging, 'servers', server));
      let main: string | undefined;
      for (const d of commitDirs) {
        if (await lstatOrNull(join(staging, 'servers', server, d, 'level.dat'))) main ??= d;
      }
      if (main) payload = true;
      const sdir = await lstatOrNull(join(this.root, 'servers', server));
      if (!sdir || sdir.isSymbolicLink()) {
        skipped.push(`${server}: server directory ${sdir ? 'is a symbolic link' : 'no longer exists'}`);
        continue;
      }
      const level = await this.currentLevel(server);
      if (typeof level !== 'string' || WorldName.validate(level)) {
        skipped.push(`${server}: invalid LEVEL "${String(level)}"`);
        continue;
      }
      if (main && main !== level) {
        fail('restore_conflict', `Server ${server} now uses LEVEL=${level}, but the backup holds world "${main}"`, { servers: [server] });
      }
      const data = await lstatOrNull(join(this.root, 'servers', server, 'data'));
      if (data?.isSymbolicLink()) {
        skipped.push(`${server}: data is a symbolic link`);
        continue;
      }
      const live = [level, `${level}_nether`, `${level}_the_end`];
      plannedServers.push({ server, names: [...new Set([...commitDirs, ...live])].sort() });
    }
    if (!payload) fail('empty_source', 'The backup commit holds no restorable world');

    await this.assertSameDevice(plannedServers.map((s) => join(this.root, 'servers', s.server)), stagedWorlds.length > 0);

    if (stagedWorlds.length > 0) {
      const liveWorlds = await entries(join(this.root, 'worlds'));
      for (const name of [...new Set([...liveWorlds, ...stagedWorlds])].sort()) {
        targets.push({
          live: join(this.root, 'worlds', name),
          staged: stagedWorlds.includes(name) ? join(staging, 'worlds', name) : null,
        });
      }
    }
    for (const { server, names } of plannedServers) {
      for (const name of names) {
        const staged = join(staging, 'servers', server, name);
        targets.push({
          live: join(this.root, 'servers', server, 'data', name),
          staged: (await lstatOrNull(staged)) ? staged : null,
        });
      }
    }
    return { targets, skipped };
  }

  /** Renames only: worlds/, servers/<n>/ and backups/ must share one filesystem (S2). */
  private async assertSameDevice(serverDirs: string[], withWorlds: boolean): Promise<void> {
    const backupsDev = (await stat(join(this.root, 'backups'))).dev;
    const dirs = [...serverDirs];
    if (withWorlds) {
      await mkdir(join(this.root, 'worlds'), { recursive: true });
      dirs.push(join(this.root, 'worlds'));
    }
    const other = [];
    for (const d of dirs) if ((await stat(d)).dev !== backupsDev) other.push(d);
    if (other.length > 0) {
      fail('unsupported_layout', `Restore needs these on the same filesystem as backups/: ${other.join(', ')}`, { paths: other });
    }
  }

  // ---------------------------------------------------------------- misc

  private stamp(): string {
    return `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
  }

  private defaultMessage(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `Backup: ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
}
