import type { WorldAssignment, WorldAssignmentSnapshot } from '../../../domain/services/worldAssignment.js';

export type { WorldAssignment, WorldAssignmentSnapshot };

/**
 * World Assignment Port - Outbound Port (ADR-0001, final in ADR-0002 / #670)
 *
 * Assignments are derived from each server's LEVEL; the rules are the pure
 * domain functions in domain/services/worldAssignment.ts. Errors are
 * WorldAssignmentError. `server_running` is the use case's job: the port knows
 * nothing about the runtime.
 */
export interface IWorldAssignmentPort {
  /** Rejects only when servers/ cannot be listed (ENOENT = empty). A bad server goes to `undetermined`. */
  listAssignments(): Promise<WorldAssignmentSnapshot>;
  /**
   * The snapshot as it would be with `server`'s config.env replaced by
   * `configEnv` (snapshot restore, migrate). Writes nothing.
   */
  preview(server: string, configEnv: string): Promise<WorldAssignmentSnapshot>;
  /** Writes LEVEL=<world> after checkAssign on a fresh snapshot; no-op if already assigned. */
  assign(world: string, server: string): Promise<void>;
  /** Unassign (#715): the holder's LEVEL becomes `<holder>`. */
  release(world: string): Promise<{ server: string; fallback: string }>;
}
