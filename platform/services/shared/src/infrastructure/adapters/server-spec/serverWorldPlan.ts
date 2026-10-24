import { lstat, readdir, realpath } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import type { Paths } from '../../../utils/index.js';
import { ServerSpecError } from '../../../domain/server-spec/ServerSpecDocument.js';
import { readWorldAssignmentSnapshot } from '../effectiveExtraArgs.js';

/**
 * Where a server's world is before the server directory is deleted (#652,
 * delete-server.sh plan_worlds / worlds_outside_server, #735). Worlds outlive
 * their server: without deleteWorld nothing is deleted unless every world
 * inside the server is located and can move to worlds/.
 */
export interface ServerWorldPlan {
  /** LEVEL as the world assignments read it (ADR-0002); undefined when undetermined. */
  level?: string;
  /** data/<LEVEL>, data/<LEVEL>_nether, data/<LEVEL>_the_end that are real folders. */
  internal: string[];
  /** worlds/<LEVEL> exists and stays where it is. */
  keptWorld?: string;
}

const within = (path: string, dir: string) => path === dir || path.startsWith(dir + sep);

async function lstatOrNull(path: string) {
  try {
    return await lstat(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/** World folders (level.dat, level.dat_old, *.mca, region/) and symlinks under `dir`, not following links. */
async function scan(dir: string, out: { worlds: Set<string>; links: string[] }): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      out.links.push(path);
    } else if (entry.isDirectory()) {
      if (entry.name === 'region') out.worlds.add(dir);
      await scan(path, out);
    } else if (entry.name === 'level.dat' || entry.name === 'level.dat_old' || entry.name.endsWith('.mca')) {
      out.worlds.add(basename(dir) === 'region' ? dirname(dir) : dir);
    }
  }
}

/**
 * The plan, or why it is not safe. `error` with a partial plan: the world
 * cannot be kept with certainty (deleteWorld may go ahead).
 */
async function planWorlds(paths: Paths, name: string, serverReal: string): Promise<ServerWorldPlan & { error?: ServerSpecError }> {
  const dir = paths.serverDir(name);
  const plan: ServerWorldPlan = { internal: [] };
  const refuse = (reason: string, code: 'undetermined' | 'conflict' = 'undetermined') => ({
    ...plan,
    error: new ServerSpecError(
      code,
      `${reason}; nothing was deleted. Move the world(s) yourself, or delete them with the server (--delete-world)`,
      name
    ),
  });

  // The same reading of LEVEL (and EXTRA_ARGS) as every world assignment; no config.env is the image default.
  const snapshot = await readWorldAssignmentSnapshot(paths);
  const assignment = snapshot.assignments.find((a) => a.server === name);
  if (assignment) plan.level = assignment.world;
  else if (snapshot.undetermined.includes(name)) {
    return refuse(`cannot determine the world of servers/${name} from its config.env (LEVEL, EXTRA_ARGS)`);
  } else plan.level = 'world';
  const level = plan.level;

  // A symlinked server or data directory would move or delete data elsewhere.
  if ((await lstatOrNull(dir))?.isSymbolicLink() || (await lstatOrNull(join(dir, 'data')))?.isSymbolicLink()) {
    return refuse(`servers/${name} or its data/ is a symlink`);
  }

  // Symlinked world folders are not moved: deleting the server removes only the link.
  for (const world of [level, `${level}_nether`, `${level}_the_end`]) {
    if ((await lstatOrNull(join(dir, 'data', world)))?.isDirectory()) plan.internal.push(world);
  }
  if (plan.internal.length > 0 && plan.internal[0] !== level) {
    return refuse(`data/ has dimension folders of '${level}' but no data/${level}`);
  }

  const found = { worlds: new Set<string>(), links: [] as string[] };
  try {
    await scan(dir, found);
  } catch {
    return refuse(`cannot scan servers/${name} for worlds`);
  }
  // Any other world in the server would be deleted with it.
  const hidden = [...found.worlds]
    .filter((w) => !plan.internal.some((i) => within(w, join(dir, 'data', i))))
    .map((w) => relative(dir, w));
  if (hidden.length > 0) return refuse(`worlds that are not LEVEL '${level}' would be deleted: ${hidden.join(', ')}`);

  // A symlink whose target is inside the server: the target is deleted with the server.
  const inside: string[] = [];
  for (const link of found.links) {
    let target: string;
    try {
      target = await realpath(link);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue; // a broken link holds nothing
      return refuse(`cannot resolve symlink ${relative(dir, link)}`);
    }
    if (within(target, serverReal)) inside.push(relative(dir, link));
  }
  if (inside.length > 0) {
    return refuse(`symlinks point inside servers/${name}, so their targets would be deleted: ${inside.join(', ')}`);
  }

  for (const world of plan.internal) {
    if (await lstatOrNull(join(paths.worlds, world))) {
      return refuse(`worlds/${world} already exists, so the server's world cannot be moved there`, 'conflict');
    }
  }
  if ((await lstatOrNull(join(paths.worlds, level)))?.isDirectory()) plan.keptWorld = level;
  return plan;
}

/**
 * Plan what happens to the server's worlds; rejects ServerSpecError when that
 * is not safe. worlds/ resolving inside the server is refused even with
 * deleteWorld: that would delete worlds that are not the server's.
 */
export async function planServerWorlds(paths: Paths, name: string, deleteWorld: boolean): Promise<ServerWorldPlan> {
  const outside = (reason: string) =>
    new ServerSpecError('undetermined', `${reason}; nothing was deleted. Point worlds/ outside servers/${name} first`, name);
  let serverReal: string;
  try {
    serverReal = await realpath(paths.serverDir(name));
  } catch {
    throw outside(`cannot resolve servers/${name}`);
  }
  const worlds = await lstatOrNull(paths.worlds);
  if (worlds) {
    let worldsReal: string;
    try {
      worldsReal = await realpath(paths.worlds);
    } catch {
      throw outside(worlds.isSymbolicLink() ? 'worlds/ is a broken symlink' : 'cannot resolve worlds/');
    }
    if (within(worldsReal, serverReal)) {
      throw outside(`worlds/ resolves to ${worldsReal}, inside servers/${name}, which would be deleted`);
    }
  }

  const { error, ...plan } = await planWorlds(paths, name, serverReal);
  if (error && !deleteWorld) throw error;
  return plan;
}
