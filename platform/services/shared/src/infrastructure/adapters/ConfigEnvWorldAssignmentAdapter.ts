import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Paths } from '../../utils/index.js';
import { applyEnvChanges } from '../../utils/env-file.js';
import { atomicWriteFile } from '../../utils/atomic-write.js';
import {
  WorldAssignmentError,
  checkAssign,
  checkRemoval,
  holdersOf,
  planRelease,
  type WorldAssignment,
  type WorldAssignmentSnapshot,
} from '../../domain/index.js';
import type { IWorldAssignmentPort } from '../../application/ports/outbound/IWorldAssignmentPort.js';
import { readWorldAssignmentSnapshot } from './effectiveExtraArgs.js';

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

  private read(
    override?: { server: string; content: string },
    dotenvOverride?: string
  ): Promise<WorldAssignmentSnapshot> {
    return readWorldAssignmentSnapshot(this.paths, override, dotenvOverride);
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
