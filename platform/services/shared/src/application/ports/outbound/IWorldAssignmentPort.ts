import type { WorldAssignment, WorldAssignmentSnapshot } from '../../../domain/services/worldAssignment.js';

export type { WorldAssignment, WorldAssignmentSnapshot };

/**
 * World Assignment Port - Outbound Port (ADR-0001, final in ADR-0002 / #670)
 *
 * Assignments are derived from each server's LEVEL; the rules are the pure
 * domain functions in domain/services/worldAssignment.ts. Errors are
 * WorldAssignmentError. `server_running` is the use case's job: the port knows
 * nothing about the runtime. getAssignment/listAssignments keep their v2
 * shape (#715, #736); snapshot, preview and release were added by #670.
 */
export interface IWorldAssignmentPort {
  /**
   * The server holding `world` (or one of its dimension folders), or null.
   * Rejects with `undetermined` instead of answering null while a server's
   * assignment cannot be read.
   *
   * @deprecated Use snapshot() with holdersOf. Removed in v3.0.0 (#736).
   */
  getAssignment(world: string): Promise<string | null>;
  /** The readable assignments. Undetermined servers are left out: use snapshot() to see them. */
  listAssignments(): Promise<WorldAssignment[]>;
  /** Assignments plus undetermined servers. Rejects only when servers/ cannot be listed (ENOENT = empty). */
  snapshot(): Promise<WorldAssignmentSnapshot>;
  /**
   * The snapshot as it would be with `server`'s config.env replaced by
   * `configEnv` (snapshot restore, migrate, config writes). Writes nothing.
   */
  preview(server: string, configEnv: string): Promise<WorldAssignmentSnapshot>;
  /**
   * The snapshot as it would be with the platform .env replaced by `dotenv`
   * (its EXTRA_ARGS reaches servers through a bare key in servers/global.env).
   * Writes nothing.
   */
  previewPlatformEnv(dotenv: string): Promise<WorldAssignmentSnapshot>;
  /** Writes LEVEL=<world> after checkAssign on a fresh snapshot; no-op if already assigned. */
  assign(world: string, server: string): Promise<void>;
  /** Unassign (#715): the holder's LEVEL becomes `<holder>`. */
  release(world: string): Promise<{ server: string; fallback: string }>;
}
