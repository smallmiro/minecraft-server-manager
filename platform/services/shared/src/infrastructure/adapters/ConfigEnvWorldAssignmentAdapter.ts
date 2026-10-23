import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Paths } from '../../utils/index.js';
import { applyEnvChanges, parseEnvDocument, writeFileAtomic } from '../../utils/env-file.js';
import {
  EXISTING_WORLD_NAME_PATTERN,
  WorldAssignmentError,
  checkAssign,
  planRelease,
  resolveWorldName,
  type WorldAssignment,
  type WorldAssignmentSnapshot,
} from '../../domain/index.js';
import type { IWorldAssignmentPort } from '../../application/ports/outbound/IWorldAssignmentPort.js';

/**
 * World assignments derived from each server's `LEVEL` in
 * servers/<n>/config.env (#670, ADR-0002). There is no other record:
 * deleting a server releases its world. worlds/.locks is never touched.
 */
export class ConfigEnvWorldAssignmentAdapter implements IWorldAssignmentPort {
  constructor(private readonly paths: Paths = new Paths()) {}

  async listAssignments(): Promise<WorldAssignmentSnapshot> {
    let entries: Dirent[];
    try {
      entries = await readdir(this.paths.servers, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { assignments: [], undetermined: [] };
      throw err;
    }

    const assignments: WorldAssignment[] = [];
    const undetermined: string[] = [];
    const names = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
      .map((e) => e.name)
      .sort();
    for (const server of names) {
      let content: string;
      try {
        content = await readFile(this.configPath(server), 'utf-8');
      } catch (err) {
        // Same filter as ServerRepository.listNames: no config.env, no server.
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') undetermined.push(server);
        continue;
      }
      const env = Object.fromEntries(parseEnvDocument(content).values);
      const world = resolveWorldName(env);
      if (!EXISTING_WORLD_NAME_PATTERN.test(world)) {
        undetermined.push(server);
        continue;
      }
      assignments.push({ world, server, internal: !(env['EXTRA_ARGS'] ?? '').includes('--universe') });
    }
    return { assignments, undetermined };
  }

  // ponytail: check-then-write race between CLI and API processes is accepted
  // (human-driven, findDuplicates reports the result); add an open(..., 'wx')
  // mutex file if a duplicate is ever seen.
  async assign(world: string, server: string): Promise<void> {
    const snapshot = await this.listAssignments();
    const error = checkAssign(snapshot, world, server);
    if (error) throw error;
    if (snapshot.assignments.find((a) => a.server === server)?.world === world) return;
    await this.writeLevel(server, world);
  }

  async release(world: string): Promise<{ server: string; fallback: string }> {
    const plan = planRelease(await this.listAssignments(), world);
    if (plan instanceof WorldAssignmentError) throw plan;
    await this.writeLevel(plan.server, plan.fallback);
    return plan;
  }

  private configPath(server: string): string {
    return join(this.paths.servers, server, 'config.env');
  }

  private async writeLevel(server: string, world: string): Promise<void> {
    const file = this.configPath(server);
    const [content, { mode }] = await Promise.all([readFile(file, 'utf-8'), stat(file)]);
    await writeFileAtomic(file, applyEnvChanges(content, { set: { LEVEL: world } }), mode & 0o777);
  }
}
