/**
 * Restore swap and slot bookkeeping (ADR-0001 "Backup Port", B5 steps 6-8).
 * Renames only: callers check that all paths share one filesystem.
 */
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { entries, fail, listDirs, lstatOrNull } from './support.js';

/** One path to replace: `staged` moves in, the current `live` moves to the slot. */
export interface RestoreTarget {
  live: string;
  staged: string | null;
}

const KEEP_SLOTS = 3;

/** Filesystem calls of the swap; tests replace `rename` to inject failures. */
export const fsOps = { rename };

/** Moves live → slot and staged → live; rolls back in reverse on failure (K2, R4). */
export async function swapIntoPlace(root: string, oid: string, targets: RestoreTarget[], stamp: string): Promise<string> {
  const slot = join(root, 'backups', 'restore-previous', stamp);
  const marker = join(slot, 'INCOMPLETE');
  const saved = (live: string) => join(slot, relative(root, live));
  await mkdir(slot, { recursive: true });
  await writeFile(
    marker,
    JSON.stringify({ commit: oid, targets: targets.map((t) => ({ live: t.live, previous: saved(t.live) })) }, null, 2)
  );

  const done: Array<{ kind: 'aside' | 'in'; live: string }> = [];
  try {
    for (const t of targets) {
      if (await lstatOrNull(t.live)) {
        await mkdir(dirname(saved(t.live)), { recursive: true });
        await fsOps.rename(t.live, saved(t.live));
        done.push({ kind: 'aside', live: t.live });
      }
      if (t.staged) {
        await mkdir(dirname(t.live), { recursive: true });
        await fsOps.rename(t.staged, t.live);
        done.push({ kind: 'in', live: t.live });
      }
    }
  } catch (e) {
    let complete = true;
    for (const step of done.reverse()) {
      try {
        if (step.kind === 'in') {
          const parked = join(slot, '.new', relative(root, step.live));
          await mkdir(dirname(parked), { recursive: true });
          await fsOps.rename(step.live, parked);
        } else {
          await fsOps.rename(saved(step.live), step.live);
        }
      } catch {
        complete = false;
      }
    }
    if (complete) {
      await rm(marker, { force: true });
      fail('io_failed', `Restore failed and was rolled back: ${(e as Error).message}`);
    }
    fail('io_failed', `Restore failed and could not be fully rolled back; recover manually from ${slot}`, { paths: [slot] });
  }
  await rm(marker, { force: true });
  return slot;
}

export async function incompleteSlots(root: string): Promise<string[]> {
  const dir = join(root, 'backups', 'restore-previous');
  const out: string[] = [];
  for (const name of await listDirs(dir)) {
    if (await lstatOrNull(join(dir, name, 'INCOMPLETE'))) out.push(join(dir, name));
  }
  return out;
}

export async function rotateSlots(root: string): Promise<void> {
  const dir = join(root, 'backups', 'restore-previous');
  const complete: string[] = [];
  for (const name of await listDirs(dir)) {
    if (!(await lstatOrNull(join(dir, name, 'INCOMPLETE')))) complete.push(name);
  }
  for (const name of complete.sort().slice(0, Math.max(0, complete.length - KEEP_SLOTS))) {
    await rm(join(dir, name), { recursive: true, force: true });
  }
}

export async function cleanStaging(root: string): Promise<void> {
  const dir = join(root, 'backups');
  for (const name of await entries(dir)) {
    if (name.startsWith('.restore-')) await rm(join(dir, name), { recursive: true, force: true });
  }
}
