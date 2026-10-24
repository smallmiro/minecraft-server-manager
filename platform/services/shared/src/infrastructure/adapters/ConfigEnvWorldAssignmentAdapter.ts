import { Paths } from '../../utils/index.js';
import { assertEnvFileValue } from '../../utils/env-file.js';
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
import { FileServerSpecRepository } from './server-spec/FileServerSpecRepository.js';
import { updateServerSpec } from '../../application/use-cases/updateServerSpec.js';
import { setEnvKeys } from '../../domain/server-spec/setEnvKeys.js';
import type { IServerSpecRepository } from '../../application/ports/outbound/IServerSpecRepository.js';

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
  /**
   * @param specRepo where LEVEL and SEED writes go (#675, ADR-0003 §6): the
   *   ServerSpec repository, built with a runtime so it can check the server is
   *   stopped. Default: a repository without one, which refuses LEVEL changes (R7).
   */
  constructor(
    private readonly paths: Paths = new Paths(),
    private readonly specRepo?: IServerSpecRepository
  ) {}

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
  async assign(world: string, server: string, options: { seed?: string } = {}): Promise<void> {
    const { seed } = options;
    if (seed !== undefined) assertEnvFileValue('SEED', seed);
    const snapshot = await this.read();
    const error = checkAssign(snapshot, world, server);
    if (error) throw error;
    const unchanged = snapshot.assignments.find((a) => a.server === server)?.world === world;
    if (unchanged && seed === undefined) return;
    await this.writeConfig(server, unchanged ? { SEED: seed! } : { LEVEL: world, ...(seed === undefined ? {} : { SEED: seed }) });
  }

  async release(world: string): Promise<{ server: string; fallback: string }> {
    const plan = planRelease(await this.read(), world);
    if (plan instanceof WorldAssignmentError) throw plan;
    await this.writeConfig(plan.server, { LEVEL: plan.fallback });
    return plan;
  }

  private read(
    override?: { server: string; content: string },
    dotenvOverride?: string
  ): Promise<WorldAssignmentSnapshot> {
    return readWorldAssignmentSnapshot(this.paths, override, dotenvOverride);
  }

  /** LEVEL/SEED through the ServerSpec (#675): server.yaml is the one record, config.env its rendering. */
  private async writeConfig(server: string, set: Record<string, string>): Promise<void> {
    const repo = this.specRepo ?? new FileServerSpecRepository(this.paths);
    await updateServerSpec(repo, server, (doc) => setEnvKeys(doc, { set }));
  }
}
