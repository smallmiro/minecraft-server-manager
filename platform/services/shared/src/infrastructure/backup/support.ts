/**
 * Shared helpers for the world backup adapter (ADR-0001 "Backup Port").
 */
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { WorldBackupError, WorldBackupErrorCode } from '../../application/ports/outbound/IWorldBackupPort.js';

export const LOCKS = '.locks';

/** A failure that ends the operation with this result. */
export class Fail extends Error {
  constructor(readonly error: WorldBackupError) {
    super(error.message);
  }
}

export const fail = (code: WorldBackupErrorCode, message: string, extra: Partial<WorldBackupError> = {}): never => {
  throw new Fail({ code, message, ...extra });
};

export const isMissing = (e: unknown) => (e as NodeJS.ErrnoException).code === 'ENOENT';

export async function lstatOrNull(path: string) {
  try {
    return await lstat(path);
  } catch (e) {
    if (isMissing(e)) return null;
    throw e;
  }
}

export async function listDirs(path: string): Promise<string[]> {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name)
      .sort();
  } catch (e) {
    if (isMissing(e)) return [];
    throw e;
  }
}

export async function entries(path: string): Promise<string[]> {
  try {
    return (await readdir(path)).filter((n) => n !== LOCKS).sort();
  } catch (e) {
    if (isMissing(e)) return [];
    throw e;
  }
}

/** Throws unsupported_layout on the first symlink under `path` (inclusive). */
export async function assertNoSymlinks(path: string, skip: (p: string) => boolean = () => false): Promise<void> {
  const st = await lstat(path);
  if (st.isSymbolicLink()) fail('unsupported_layout', `Symbolic links are not supported: ${path}`, { paths: [path] });
  if (!st.isDirectory()) return;
  for (const name of await readdir(path)) {
    const child = join(path, name);
    if (!skip(child)) await assertNoSymlinks(child, skip);
  }
}
