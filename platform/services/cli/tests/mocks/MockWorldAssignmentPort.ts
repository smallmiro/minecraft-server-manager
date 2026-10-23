import type { IWorldAssignmentPort, WorldAssignmentSnapshot } from '@minecraft-docker/shared';
import { WorldAssignmentError, checkAssign, planRelease } from '@minecraft-docker/shared';

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

  async listAssignments(): Promise<WorldAssignmentSnapshot> {
    return {
      assignments: [...this.levels]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([server, world]) => ({ server, world, internal: false })),
      undetermined: [...this.undetermined],
    };
  }

  async assign(world: string, server: string): Promise<void> {
    this.calls.push({ method: 'assign', args: [world, server] });
    this.throwPending();
    const error = checkAssign(await this.listAssignments(), world, server);
    if (error) throw error;
    this.levels.set(server, world);
  }

  async release(world: string): Promise<{ server: string; fallback: string }> {
    this.calls.push({ method: 'release', args: [world] });
    this.throwPending();
    const plan = planRelease(await this.listAssignments(), world);
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
