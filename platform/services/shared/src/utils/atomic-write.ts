/**
 * Atomic file replacement for config files.
 */
import { randomUUID } from 'node:crypto';
import { open, realpath, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

/**
 * Atomically replace `path`: write a temp file in the same directory, fsync,
 * set `mode`, then rename over the target. A symlink is resolved first so the
 * link itself is kept. On failure the original file is left untouched.
 */
export async function writeFileAtomic(path: string, content: string | Uint8Array, mode = 0o600): Promise<void> {
  let target = path;
  try {
    target = await realpath(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  const tmp = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
  const file = await open(tmp, 'wx', mode);
  try {
    try {
      await file.writeFile(content);
      await file.chmod(mode);
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
