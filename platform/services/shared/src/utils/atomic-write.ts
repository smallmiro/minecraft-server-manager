/**
 * Atomic file replacement for config files (compose, config.env, .env,
 * ops.json, ...). Readers see the old or the new content, never a truncated
 * file, and a failed write leaves the original untouched (#656).
 *
 * Steps: resolve a symlink (the link is kept), write a temp file in the same
 * directory, set mode/owner, fsync, rename over the target. The temp file is
 * removed on failure.
 */
import { randomUUID } from 'node:crypto';
import {
  closeSync, fchmodSync, fchownSync, fsyncSync, openSync, realpathSync, renameSync, rmSync, statSync, writeFileSync,
  type Stats,
} from 'node:fs';
import { open, realpath, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export interface AtomicWriteOptions {
  /** File mode. Default: the existing file's mode, or the umask default (0666 & ~umask) for a new file. */
  mode?: number;
}

function ifExists<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
}

async function ifExistsAsync<T>(read: Promise<T>): Promise<T | undefined> {
  return read.catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') return undefined;
    throw err;
  });
}

function tempPathFor(target: string): string {
  return join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
}

/** Mode to force on the temp file, or undefined to keep the umask default. */
function modeFor(options: AtomicWriteOptions, existing: Stats | undefined): number | undefined {
  return options.mode ?? (existing ? existing.mode & 0o7777 : undefined);
}

/** Atomically replace `path` with `content`. */
export async function atomicWriteFile(
  path: string,
  content: string | Uint8Array,
  options: AtomicWriteOptions = {},
): Promise<void> {
  const target = (await ifExistsAsync(realpath(path))) ?? path;
  const existing = await ifExistsAsync(stat(target));
  const mode = modeFor(options, existing);
  const tmp = tempPathFor(target);
  const file = await open(tmp, 'wx', mode ?? 0o666);
  try {
    try {
      await file.writeFile(content);
      if (mode !== undefined) await file.chmod(mode);
      // Best effort: keep the owner (only root or the owner can do this).
      if (existing) await file.chown(existing.uid, existing.gid).catch(() => undefined);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(tmp, target);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}

/** Synchronous atomicWriteFile, for callers that are synchronous. */
export function atomicWriteFileSync(
  path: string,
  content: string | Uint8Array,
  options: AtomicWriteOptions = {},
): void {
  const target = ifExists(() => realpathSync(path)) ?? path;
  const existing = ifExists(() => statSync(target));
  const mode = modeFor(options, existing);
  const tmp = tempPathFor(target);
  const fd = openSync(tmp, 'wx', mode ?? 0o666);
  try {
    try {
      writeFileSync(fd, content);
      if (mode !== undefined) fchmodSync(fd, mode);
      if (existing) {
        try {
          fchownSync(fd, existing.uid, existing.gid);
        } catch {
          // Best effort, as above.
        }
      }
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, target);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
}

/**
 * Atomically replace `path`, forcing `mode` (default 0600, for `.env` secrets).
 * @deprecated Use atomicWriteFile(path, content, { mode }).
 */
export async function writeFileAtomic(path: string, content: string | Uint8Array, mode = 0o600): Promise<void> {
  await atomicWriteFile(path, content, { mode });
}
