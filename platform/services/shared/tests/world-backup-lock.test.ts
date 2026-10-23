import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir, hostname, uptime } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { acquireBackupLock } from '../src/infrastructure/backup/lock.js';

const bootTime = () => Math.round(Date.now() - uptime() * 1000);

function holder(over: Record<string, unknown> = {}) {
  return {
    pid: process.pid,
    hostname: hostname(),
    bootTime: bootTime(),
    nonce: 'other',
    op: 'push',
    startedAt: new Date().toISOString(),
    ...over,
  };
}

async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ['-e', '']);
  await new Promise((r) => child.on('exit', r));
  return child.pid!;
}

describe('backup lock (#732 B2)', () => {
  let root: string;
  let lockPath: string;
  const children: ChildProcess[] = [];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'wb-lock-'));
    lockPath = join(root, 'backups', '.backup.lock');
  });

  afterEach(async () => {
    for (const c of children.splice(0)) c.kill('SIGKILL');
    await rm(root, { recursive: true, force: true });
  });

  async function writeLock(content: unknown) {
    await mkdir(join(root, 'backups'), { recursive: true });
    await writeFile(lockPath, typeof content === 'string' ? content : JSON.stringify(content));
  }

  it('creates backups/ and the lock file, and release removes it', async () => {
    const lock = await acquireBackupLock(root, 'push');
    expect(lock.ok).toBe(true);
    expect(existsSync(lockPath)).toBe(true);
    if (lock.ok) await lock.release();
    expect(existsSync(lockPath)).toBe(false);
    expect((await readdir(join(root, 'backups'))).filter((f) => f.includes('.tmp'))).toEqual([]);
  });

  it('fails fast with the holder while another operation holds it', async () => {
    const first = await acquireBackupLock(root, 'restore');
    const second = await acquireBackupLock(root, 'push');
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.holder).toMatchObject({ pid: process.pid, op: 'restore' });
    if (first.ok) await first.release();
  });

  it('is held across processes: a live holder blocks, its death frees the lock', async () => {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
    children.push(child);
    await writeLock(holder({ pid: child.pid }));
    expect((await acquireBackupLock(root, 'push')).ok).toBe(false);

    child.kill('SIGKILL');
    await new Promise((r) => child.on('exit', r));
    const lock = await acquireBackupLock(root, 'push');
    expect(lock.ok).toBe(true);
    if (lock.ok) await lock.release();
  });

  it('takes over a lock whose pid is dead (ESRCH) on this host', async () => {
    await writeLock(holder({ pid: await deadPid() }));
    const lock = await acquireBackupLock(root, 'push');
    expect(lock.ok).toBe(true);
    if (lock.ok) await lock.release();
  });

  it('takes over a lock written before a reboot of this host', async () => {
    await writeLock(holder({ bootTime: bootTime() - 3_600_000 }));
    const lock = await acquireBackupLock(root, 'push');
    expect(lock.ok).toBe(true);
    if (lock.ok) await lock.release();
  });

  it('never takes over by age: an old lock with a live pid stays locked', async () => {
    await writeLock(holder({ startedAt: new Date(Date.now() - 48 * 3_600_000).toISOString() }));
    expect((await acquireBackupLock(root, 'push')).ok).toBe(false);
  });

  it('does not take over a lock from another host, even with a dead pid', async () => {
    await writeLock(holder({ hostname: 'other-host', pid: await deadPid() }));
    expect((await acquireBackupLock(root, 'push')).ok).toBe(false);
  });

  it('treats EPERM as alive', async () => {
    if (process.getuid?.() === 0) return; // root can signal pid 1
    await writeLock(holder({ pid: 1 }));
    expect((await acquireBackupLock(root, 'push')).ok).toBe(false);
  });

  it('fails closed on unparseable content', async () => {
    await writeLock('garbage');
    const lock = await acquireBackupLock(root, 'push');
    expect(lock.ok).toBe(false);
    if (!lock.ok) expect(lock.holder).toBeUndefined();
  });

  it('waits up to lockWaitMs and acquires once released', async () => {
    const first = await acquireBackupLock(root, 'push');
    if (!first.ok) throw new Error('first lock failed');
    setTimeout(() => void first.release(), 150);
    const second = await acquireBackupLock(root, 'prune', { waitMs: 2000, pollMs: 20 });
    expect(second.ok).toBe(true);
    if (second.ok) await second.release();
  });

  it('lets exactly one of many contenders take over the same stale lock', async () => {
    await writeLock(holder({ pid: await deadPid() }));
    const results = await Promise.all(
      Array.from({ length: 2 }, () => acquireBackupLock(root, 'push'))
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    for (const r of results) if (r.ok) await r.release();
  });

  it('release keeps a lock that is no longer ours', async () => {
    const lock = await acquireBackupLock(root, 'push');
    if (!lock.ok) throw new Error('lock failed');
    await writeLock(holder({ nonce: 'someone-else' }));
    await lock.release();
    expect(existsSync(lockPath)).toBe(true);
  });
});

describe('backup lock release race (#732 review P2)', () => {
  let root: string;
  let lockPath: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'wb-lock-race-'));
    lockPath = join(root, 'backups', '.backup.lock');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('a lock moved aside by a late contender and put back after release does not survive', async () => {
    const { rename, link, unlink } = await import('node:fs/promises');
    const a = await acquireBackupLock(root, 'push');
    if (!a.ok) throw new Error('lock failed');
    // B read the previous (stale) holder before A took the lock, then moves A's lock aside
    const aside = `${lockPath}.b.stale`;
    await rename(lockPath, aside);
    // A finishes while its lock is aside
    const released = a.release();
    await new Promise((r) => setTimeout(r, 100));
    // B sees a nonce that is not the stale one and puts the file back
    await link(aside, lockPath);
    await unlink(aside);
    await released;
    expect(existsSync(lockPath)).toBe(false);
    const next = await acquireBackupLock(root, 'push');
    expect(next.ok).toBe(true);
    if (next.ok) await next.release();
  });
});
