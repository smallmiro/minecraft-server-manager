/**
 * Cross-process file lock (ADR-0001 "Backup Port", B2), used for backup
 * push/restore/prune and for servers/compose.yml (ADR-0003 §3).
 * Single host only. A holder is taken over only when it provably died on this
 * host (ESRCH, or the host rebooted); never by age.
 */
import { randomUUID } from 'node:crypto';
import { link, mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { hostname, uptime } from 'node:os';
import { basename, dirname, join } from 'node:path';
import type { BackupLockHolder } from '../../application/ports/outbound/IWorldBackupPort.js';

/** The lock file content: who holds it. `op` names the operation. */
export type FileLockHolder = Omit<BackupLockHolder, 'op'> & { op: string };

export type FileLock =
  | { ok: true; release: () => Promise<void> }
  | { ok: false; holder?: FileLockHolder };

export type BackupLock =
  | { ok: true; release: () => Promise<void> }
  | { ok: false; holder?: BackupLockHolder };

const bootTime = () => Math.round(Date.now() - uptime() * 1000);

function parseHolder(text: string): FileLockHolder | undefined {
  try {
    const h = JSON.parse(text) as FileLockHolder;
    return typeof h.pid === 'number' && typeof h.nonce === 'string' ? h : undefined;
  } catch {
    return undefined;
  }
}

function provablyDead(h: FileLockHolder): boolean {
  if (h.hostname !== hostname()) return false;
  if (Math.abs(h.bootTime - bootTime()) > 60_000) return true;
  try {
    process.kill(h.pid, 0);
    return false;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'ESRCH'; // EPERM = alive
  }
}

async function readText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw e;
  }
}

/**
 * Remove a stale lock without removing a lock someone else just took:
 * rename it away, then check it is the stale one; otherwise put it back.
 * ponytail: with three contenders the put-back can lose to a third writer
 * (two holders). Accepted (ADR B2); upgrade path is an OS advisory lock.
 */
async function takeOver(lockPath: string, stale: FileLockHolder, nonce: string): Promise<void> {
  const aside = `${lockPath}.${nonce}.stale`;
  try {
    await rename(lockPath, aside);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw e;
  }
  const moved = parseHolder((await readText(aside)) ?? '');
  if (moved?.nonce !== stale.nonce) {
    await link(aside, lockPath).catch(() => undefined);
  }
  await unlink(aside).catch(() => undefined);
}

/** Unlink of the lock file in release(); tests replace it to interleave a takeover. */
export const lockFsOps = { unlink };

/**
 * Remove our lock. A late contender may move it aside (takeOver) at any point, even
 * between our check and our unlink, and put it back when it sees our nonce; that
 * would resurrect a released lock. So after the unlink attempt we always delete any
 * aside copy holding our nonce (its put-back then fails), and re-read the lock in
 * case the put-back happened first. No timing assumptions.
 */
async function release(lockPath: string, nonce: string): Promise<void> {
  const ours = async () => parseHolder((await readText(lockPath)) ?? '')?.nonce === nonce;
  if ((await ours()) && (await lockFsOps.unlink(lockPath).then(() => true, () => false))) return;
  const dir = dirname(lockPath);
  const prefix = `${basename(lockPath)}.`;
  for (const name of await readdir(dir).catch(() => [] as string[])) {
    if (!name.startsWith(prefix) || !name.endsWith('.stale')) continue;
    const aside = join(dir, name);
    if (parseHolder((await readText(aside)) ?? '')?.nonce === nonce) await unlink(aside).catch(() => undefined);
  }
  if (await ours()) await unlink(lockPath).catch(() => undefined);
}

export async function acquireBackupLock(
  root: string,
  op: BackupLockHolder['op'],
  options: { waitMs?: number; pollMs?: number } = {}
): Promise<BackupLock> {
  const dir = join(root, 'backups');
  await mkdir(dir, { recursive: true });
  return (await acquireFileLock(join(dir, '.backup.lock'), op, options)) as BackupLock;
}

/**
 * Take `lockPath` (its directory must exist), waiting up to `waitMs` for the
 * holder; `{ ok: false, holder }` when it is still held.
 */
export async function acquireFileLock(
  lockPath: string,
  op: string,
  options: { waitMs?: number; pollMs?: number } = {}
): Promise<FileLock> {
  const me: FileLockHolder = {
    pid: process.pid,
    hostname: hostname(),
    bootTime: bootTime(),
    nonce: randomUUID(),
    op,
    startedAt: new Date().toISOString(),
  };
  const tmp = `${lockPath}.${me.nonce}.tmp`;
  await writeFile(tmp, JSON.stringify(me), { mode: 0o600 });

  const deadline = Date.now() + (options.waitMs ?? 0);
  try {
    for (;;) {
      try {
        await link(tmp, lockPath); // atomic, and the lock is never partially written
        return {
          ok: true,
          release: () => release(lockPath, me.nonce),
        };
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      }
      const text = await readText(lockPath);
      if (text === undefined) continue;
      const holder = parseHolder(text);
      if (holder && provablyDead(holder)) {
        await takeOver(lockPath, holder, me.nonce);
        continue;
      }
      if (Date.now() >= deadline) return { ok: false, holder };
      await new Promise((r) => setTimeout(r, options.pollMs ?? 1000));
    }
  } finally {
    await unlink(tmp).catch(() => undefined);
  }
}
