import type { IWorldAssignmentPort, WorldAssignment, WorldAssignmentSnapshot } from '@minecraft-docker/shared';
import { WorldAssignmentError, checkAssign, holdersOf, planRelease } from '@minecraft-docker/shared';

/**
 * In-memory IWorldAssignmentPort: server -> LEVEL, enforcing the shared domain rules.
 */
export class MockWorldAssignmentPort implements IWorldAssignmentPort {
  readonly levels: Map<string, string>;
  readonly calls: Array<{ method: 'assign' | 'release'; args: string[] }> = [];
  undetermined: string[] = [];
  /** Next assign/release rejects with this error. */
  failNext?: Error;

  constructor(levels: Record<string, string> = {}) {
    this.levels = new Map(Object.entries(levels));
  }

  async getAssignment(world: string): Promise<string | null> {
    return holdersOf(await this.snapshot(), world)[0] ?? null;
  }

  async listAssignments(): Promise<WorldAssignment[]> {
    return (await this.snapshot()).assignments;
  }

  async snapshot(): Promise<WorldAssignmentSnapshot> {
    return {
      assignments: [...this.levels]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([server, world]) => ({ server, world, internal: false })),
      undetermined: [...this.undetermined],
    };
  }

  /** Parses only `LEVEL=` from the proposed config.env. */
  async preview(server: string, configEnv: string): Promise<WorldAssignmentSnapshot> {
    const levels = new Map(this.levels);
    levels.set(server, /^LEVEL=(.*)$/m.exec(configEnv)?.[1]?.trim() || 'world');
    return {
      assignments: [...levels]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, world]) => ({ server: name, world, internal: false })),
      undetermined: [...this.undetermined],
    };
  }

  /** The platform .env does not affect this in-memory port. */
  async previewPlatformEnv(_dotenv: string): Promise<WorldAssignmentSnapshot> {
    return this.snapshot();
  }

  async assign(world: string, server: string): Promise<void> {
    this.calls.push({ method: 'assign', args: [world, server] });
    this.throwPending();
    const error = checkAssign(await this.snapshot(), world, server);
    if (error) throw error;
    this.levels.set(server, world);
  }

  async release(world: string): Promise<{ server: string; fallback: string }> {
    this.calls.push({ method: 'release', args: [world] });
    this.throwPending();
    const plan = planRelease(await this.snapshot(), world);
    if (plan instanceof WorldAssignmentError) throw plan;
    this.levels.set(plan.server, plan.fallback);
    return plan;
  }

  wasCalled(method: 'assign' | 'release'): boolean {
    return this.calls.some((c) => c.method === method);
  }

  private throwPending(): void {
    const error = this.failNext;
    this.failNext = undefined;
    if (error) throw error;
  }
}
