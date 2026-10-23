import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Paths } from '../../utils/index.js';
import { applyEnvChanges, parseEnvDocument, type EnvDocument } from '../../utils/env-file.js';
import { atomicWriteFile } from '../../utils/atomic-write.js';
import {
  EXISTING_WORLD_NAME_PATTERN,
  WorldAssignmentError,
  checkAssign,
  checkRemoval,
  holdersOf,
  planRelease,
  resolveWorldName,
  type WorldAssignment,
  type WorldAssignmentSnapshot,
} from '../../domain/index.js';
import type { IWorldAssignmentPort } from '../../application/ports/outbound/IWorldAssignmentPort.js';

/** Inherited EXTRA_ARGS: a value, none, or unreadable (the servers relying on it are undetermined). */
type Inherited = string | undefined | Error;

/**
 * Whether the effective (last) `KEY=` line is subject to Compose
 * interpolation: unquoted and double-quoted values are, single-quoted ones
 * are literal. Such a value has no fixed name, so it is undetermined (R7).
 */
function isInterpolated(doc: EnvDocument, key: string): boolean {
  const line = [...doc.lines].reverse().find((l) => l.key === key);
  if (!line) return false;
  const raw = line.raw.slice(line.raw.indexOf('=') + 1).trim();
  return !raw.startsWith("'") && raw.includes('$');
}

/**
 * Where --universe puts worlds: 'worlds' for /worlds, 'internal' for none or
 * /data (the container's working directory), undefined for anything else.
 */
function universeLocation(extraArgs: string): 'worlds' | 'internal' | undefined {
  const args = extraArgs.trim().split(/\s+/).filter(Boolean);
  const i = args.findIndex((a) => a === '--universe' || a.startsWith('--universe='));
  if (i < 0) return 'internal';
  const value = args[i]!.startsWith('--universe=') ? args[i]!.slice('--universe='.length) : args[i + 1];
  if (!value || value.includes('$')) return undefined;
  const path = value.replace(/\/+$/, '') || '/';
  if (path === '/worlds') return 'worlds';
  if (path === '/data' || path === '.' || path === './') return 'internal';
  return undefined;
}

/**
 * World assignments derived from each server's `LEVEL` in
 * servers/<n>/config.env (#670, ADR-0002). There is no other record:
 * deleting a server releases its world. worlds/.locks is never touched.
 *
 * A server is internal (D-1) unless its effective EXTRA_ARGS puts the
 * universe at /worlds. EXTRA_ARGS follows the template compose env_file
 * order: servers/global.env (a bare `EXTRA_ARGS` line takes the platform
 * .env value), then the server's config.env, which wins.
 */
export class ConfigEnvWorldAssignmentAdapter implements IWorldAssignmentPort {
  constructor(private readonly paths: Paths = new Paths()) {}

  /** @deprecated Use snapshot() with holdersOf. Removed in v3.0.0 (#736). */
  async getAssignment(world: string): Promise<string | null> {
    const snapshot = await this.read();
    const holder = holdersOf(snapshot, world)[0];
    if (holder) return holder;
    const undetermined = checkRemoval(snapshot, world);
    if (undetermined) throw undetermined;
    return null;
  }

  async listAssignments(): Promise<WorldAssignment[]> {
    return (await this.read()).assignments;
  }

  snapshot(): Promise<WorldAssignmentSnapshot> {
    return this.read();
  }

  preview(server: string, configEnv: string): Promise<WorldAssignmentSnapshot> {
    return this.read({ server, content: configEnv });
  }

  previewPlatformEnv(dotenv: string): Promise<WorldAssignmentSnapshot> {
    return this.read(undefined, dotenv);
  }

  // ponytail: check-then-write race between CLI and API processes is accepted
  // (human-driven, findDuplicates reports the result); add an open(..., 'wx')
  // mutex file if a duplicate is ever seen.
  async assign(world: string, server: string): Promise<void> {
    const snapshot = await this.read();
    const error = checkAssign(snapshot, world, server);
    if (error) throw error;
    if (snapshot.assignments.find((a) => a.server === server)?.world === world) return;
    await this.writeLevel(server, world);
  }

  async release(world: string): Promise<{ server: string; fallback: string }> {
    const plan = planRelease(await this.read(), world);
    if (plan instanceof WorldAssignmentError) throw plan;
    await this.writeLevel(plan.server, plan.fallback);
    return plan;
  }

  private async read(
    override?: { server: string; content: string },
    dotenvOverride?: string
  ): Promise<WorldAssignmentSnapshot> {
    let entries: Dirent[] = [];
    try {
      entries = await readdir(this.paths.servers, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    const names = new Set(entries.filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name));
    if (override) names.add(override.server);

    const inherited = await this.inheritedExtraArgs(dotenvOverride);
    const assignments: WorldAssignment[] = [];
    const undetermined: string[] = [];
    for (const server of [...names].sort()) {
      let content: string;
      if (override?.server === server) {
        content = override.content;
      } else {
        try {
          content = await readFile(this.configPath(server), 'utf-8');
        } catch (err) {
          // Same filter as ServerRepository.listNames: no config.env, no server.
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') undetermined.push(server);
          continue;
        }
      }
      const assignment = this.parse(server, content, inherited);
      if (assignment) assignments.push(assignment);
      else undetermined.push(server);
    }
    return { assignments, undetermined };
  }

  /** The server's assignment, or undefined when it cannot be determined (R7). */
  private parse(server: string, content: string, inherited: Inherited): WorldAssignment | undefined {
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

  /** EXTRA_ARGS a server gets from servers/global.env (and the platform .env). */
  private async inheritedExtraArgs(dotenvOverride?: string): Promise<Inherited> {
    const read = async (file: string): Promise<string | undefined> => {
      try {
        return await readFile(file, 'utf-8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw err;
      }
    };
    try {
      const global = await read(join(this.paths.servers, 'global.env'));
      if (global === undefined) return undefined;
      const doc = parseEnvDocument(global);
      if (doc.values.has('EXTRA_ARGS')) {
        return isInterpolated(doc, 'EXTRA_ARGS') ? new Error('interpolated') : doc.values.get('EXTRA_ARGS');
      }
      if (!/^\s*EXTRA_ARGS\s*$/m.test(global)) return undefined;
      const dotenv = dotenvOverride ?? (await read(this.paths.envFile));
      // A bare key with no platform value leaves the variable unset.
      if (dotenv === undefined) return undefined;
      const dotenvDoc = parseEnvDocument(dotenv);
      // Compose interpolates .env values too: such a value has no fixed location (R7)
      return isInterpolated(dotenvDoc, 'EXTRA_ARGS') ? new Error('interpolated') : dotenvDoc.values.get('EXTRA_ARGS');
    } catch (err) {
      return err as Error;
    }
  }

  private configPath(server: string): string {
    return join(this.paths.servers, server, 'config.env');
  }

  private async writeLevel(server: string, world: string): Promise<void> {
    const file = this.configPath(server);
    const content = await readFile(file, 'utf-8');
    // config.env is a Compose env_file: raw style (#656); atomicWriteFile keeps the mode
    await atomicWriteFile(file, applyEnvChanges(content, { set: { LEVEL: world } }, { raw: true }));
  }
}
