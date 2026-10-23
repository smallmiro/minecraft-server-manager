/**
 * Cross-process lock for backup push/restore/prune (ADR-0001 "Backup Port", B2).
 * Single host only. A holder is taken over only when it provably died on this
 * host (ESRCH, or the host rebooted); never by age.
 */
import { randomUUID } from 'node:crypto';
import { link, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { hostname, uptime } from 'node:os';
import { join } from 'node:path';
import type { BackupLockHolder } from '../../application/ports/outbound/IWorldBackupPort.js';

export type BackupLock =
  | { ok: true; release: () => Promise<void> }
  | { ok: false; holder?: BackupLockHolder };

const bootTime = () => Math.round(Date.now() - uptime() * 1000);

function parseHolder(text: string): BackupLockHolder | undefined {
  try {
    const h = JSON.parse(text) as BackupLockHolder;
    return typeof h.pid === 'number' && typeof h.nonce === 'string' ? h : undefined;
  } catch {
    return undefined;
  }
}

function provablyDead(h: BackupLockHolder): boolean {
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
async function takeOver(lockPath: string, stale: BackupLockHolder, nonce: string): Promise<void> {
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

export async function acquireBackupLock(
  root: string,
  op: BackupLockHolder['op'],
  options: { waitMs?: number; pollMs?: number } = {}
): Promise<BackupLock> {
  const dir = join(root, 'backups');
  const lockPath = join(dir, '.backup.lock');
  await mkdir(dir, { recursive: true });

  const me: BackupLockHolder = {
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
          release: async () => {
            if (parseHolder((await readText(lockPath)) ?? '')?.nonce === me.nonce) {
              await unlink(lockPath).catch(() => undefined);
            }
          },
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
