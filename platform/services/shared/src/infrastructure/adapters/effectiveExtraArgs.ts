import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Paths } from '../../utils/index.js';
import { parseEnvDocument, type EnvDocument } from '../../utils/env-file.js';
import { EXISTING_WORLD_NAME_PATTERN, resolveWorldName } from '../../domain/value-objects/WorldName.js';
import type { WorldAssignment, WorldAssignmentSnapshot } from '../../domain/services/worldAssignment.js';
import { universeLocation } from '../../domain/server-spec/extraArgs.js';

export { universeLocation };

/**
 * How a server's effective EXTRA_ARGS (and so where its world lives) is
 * resolved, and the world assignment snapshot built from it (ADR-0002). One
 * copy for the world assignment adapter (#670) and the ServerSpec repository
 * (#675, ADR-0003), so both read a server the same way. The repository uses
 * the snapshot reader directly, not the adapter, because the adapter's
 * writes go through the repository (ADR-0003 §2).
 */

/** Inherited EXTRA_ARGS: a value, none, or unreadable (the servers relying on it are undetermined). */
export type InheritedExtraArgs = string | undefined | Error;

/**
 * Whether the effective (last) `KEY=` line is subject to Compose
 * interpolation: unquoted and double-quoted values are, single-quoted ones
 * are literal. Such a value has no fixed name, so it is undetermined (R7).
 */
export function isInterpolated(doc: EnvDocument, key: string): boolean {
  const line = [...doc.lines].reverse().find((l) => l.key === key);
  if (!line) return false;
  const raw = line.raw.slice(line.raw.indexOf('=') + 1).trim();
  return !raw.startsWith("'") && raw.includes('$');
}

/**
 * EXTRA_ARGS a server gets from servers/global.env (a bare `EXTRA_ARGS` line
 * takes the platform .env value). `dotenvOverride` replaces the .env content.
 */
export async function readInheritedExtraArgs(paths: Paths, dotenvOverride?: string): Promise<InheritedExtraArgs> {
  const read = async (file: string): Promise<string | undefined> => {
    try {
      return await readFile(file, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw err;
    }
  };
  try {
    const global = await read(join(paths.servers, 'global.env'));
    if (global === undefined) return undefined;
    const doc = parseEnvDocument(global);
    if (doc.values.has('EXTRA_ARGS')) {
      return isInterpolated(doc, 'EXTRA_ARGS') ? new Error('interpolated') : doc.values.get('EXTRA_ARGS');
    }
    if (!/^\s*EXTRA_ARGS\s*$/m.test(global)) return undefined;
    const dotenv = dotenvOverride ?? (await read(paths.envFile));
    // A bare key with no platform value leaves the variable unset.
    if (dotenv === undefined) return undefined;
    const dotenvDoc = parseEnvDocument(dotenv);
    // Compose interpolates .env values too: such a value has no fixed location (R7)
    return isInterpolated(dotenvDoc, 'EXTRA_ARGS') ? new Error('interpolated') : dotenvDoc.values.get('EXTRA_ARGS');
  } catch (err) {
    return err as Error;
  }
}

/** The server's assignment, or undefined when it cannot be determined (R7). */
function parseAssignment(server: string, content: string, inherited: InheritedExtraArgs): WorldAssignment | undefined {
  const doc = parseEnvDocument(content);
  const env = Object.fromEntries(doc.values);
  const world = resolveWorldName(env);
  const worldKey = env['LEVEL']?.trim() ? 'LEVEL' : 'WORLD_NAME';
  if (!EXISTING_WORLD_NAME_PATTERN.test(world) || isInterpolated(doc, worldKey)) return undefined;

  let extraArgs: string | undefined;
  if (doc.values.has('EXTRA_ARGS')) {
    if (isInterpolated(doc, 'EXTRA_ARGS')) return undefined;
    extraArgs = doc.values.get('EXTRA_ARGS');
  } else {
    if (inherited instanceof Error) return undefined;
    extraArgs = inherited;
  }
  const location = universeLocation(extraArgs ?? '');
  if (!location) return undefined;
  return { world, server, internal: location === 'internal' };
}

/**
 * World assignments derived from each server's config.env (ADR-0002).
 * `override` replaces one server's config.env (preview), `dotenvOverride`
 * the platform .env. Rejects only when servers/ cannot be listed.
 */
export async function readWorldAssignmentSnapshot(
  paths: Paths,
  override?: { server: string; content: string },
  dotenvOverride?: string
): Promise<WorldAssignmentSnapshot> {
  let entries: Dirent[] = [];
  try {
    entries = await readdir(paths.servers, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  const names = new Set(entries.filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name));
  if (override) names.add(override.server);

  const inherited = await readInheritedExtraArgs(paths, dotenvOverride);
  const assignments: WorldAssignment[] = [];
  const undetermined: string[] = [];
  for (const server of [...names].sort()) {
    let content: string;
    if (override?.server === server) {
      content = override.content;
    } else {
      try {
        content = await readFile(join(paths.servers, server, 'config.env'), 'utf-8');
      } catch (err) {
        // Same filter as ServerRepository.listNames: no config.env, no server.
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') undetermined.push(server);
        continue;
      }
    }
    const assignment = parseAssignment(server, content, inherited);
    if (assignment) assignments.push(assignment);
    else undetermined.push(server);
  }
  return { assignments, undetermined };
}
