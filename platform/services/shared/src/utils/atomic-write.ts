/**
 * Atomic file replacement for config files (compose, config.env, .env,
 * ops.json, ...). Readers see the old or the new content, never a truncated
 * file, and a failed write leaves the original untouched (#656).
 *
 * Steps: follow symlinks to the file they name (the links are kept, and a
 * dangling link gets its target created), write a temp file in the same
 * directory, set mode and owner, fsync, rename over the target. The temp file
 * is removed on failure. An existing file that is not writable is refused
 * (EACCES) like an in-place write would be.
 *
 * Renaming hands the file to the writing user, so when the existing owner or
 * group cannot be kept (chown fails, i.e. not root and not our file) the file
 * is written in place instead: not atomic, but its owner stays.
 */
import { randomUUID } from 'node:crypto';
import {
  accessSync, constants, closeSync, fchmodSync, fchownSync, fsyncSync, lstatSync, openSync, readlinkSync, renameSync,
  rmSync, statSync, writeFileSync,
  type Stats,
} from 'node:fs';
import { access, lstat, open, readlink, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

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

const MAX_SYMLINKS = 40;

function tooManySymlinks(path: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`ELOOP: too many symbolic links: ${path}`), { code: 'ELOOP' });
}

/** The file `path` names after following symlinks, even when the last one dangles. */
function linkTargetSync(path: string): string {
  let current = path;
  for (let i = 0; i < MAX_SYMLINKS; i++) {
    if (!ifExists(() => lstatSync(current))?.isSymbolicLink()) return current;
    current = resolve(dirname(current), readlinkSync(current));
  }
  throw tooManySymlinks(path);
}

async function linkTarget(path: string): Promise<string> {
  let current = path;
  for (let i = 0; i < MAX_SYMLINKS; i++) {
    if (!(await ifExistsAsync(lstat(current)))?.isSymbolicLink()) return current;
    current = resolve(dirname(current), await readlink(current));
  }
  throw tooManySymlinks(path);
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
  const target = await linkTarget(path);
  const existing = await ifExistsAsync(stat(target));
  // A read-only file stays read-only, as with an in-place write.
  if (existing) await access(target, constants.W_OK);
  const mode = modeFor(options, existing);
  const tmp = tempPathFor(target);
  const file = await open(tmp, 'wx', mode ?? 0o666);
  let ownerKept = true;
  try {
    try {
      await file.writeFile(content);
      if (mode !== undefined) await file.chmod(mode);
      if (existing) ownerKept = await file.chown(existing.uid, existing.gid).then(() => true, () => false);
      if (ownerKept) await file.sync();
    } finally {
      await file.close();
    }
    if (ownerKept) await rename(tmp, target);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
  if (!ownerKept) {
    await rm(tmp, { force: true });
    await writeFile(target, content);
  }
}

/** Synchronous atomicWriteFile, for callers that are synchronous. */
export function atomicWriteFileSync(
  path: string,
  content: string | Uint8Array,
  options: AtomicWriteOptions = {},
): void {
  const target = linkTargetSync(path);
  const existing = ifExists(() => statSync(target));
  if (existing) accessSync(target, constants.W_OK);
  const mode = modeFor(options, existing);
  const tmp = tempPathFor(target);
  const fd = openSync(tmp, 'wx', mode ?? 0o666);
  let ownerKept = true;
  try {
    try {
      writeFileSync(fd, content);
      if (mode !== undefined) fchmodSync(fd, mode);
      if (existing) {
        try {
          fchownSync(fd, existing.uid, existing.gid);
        } catch {
          ownerKept = false;
        }
      }
      if (ownerKept) fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    if (ownerKept) renameSync(tmp, target);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  if (!ownerKept) {
    rmSync(tmp, { force: true });
    writeFileSync(target, content);
  }
}

/**
 * Atomically replace `path`, forcing `mode` (default 0600, for `.env` secrets).
 * @deprecated Use atomicWriteFile(path, content, { mode }).
 */
export async function writeFileAtomic(path: string, content: string | Uint8Array, mode = 0o600): Promise<void> {
  await atomicWriteFile(path, content, { mode });
}
