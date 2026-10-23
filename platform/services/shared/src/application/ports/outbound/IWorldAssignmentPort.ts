export interface WorldAssignment {
  world: string;
  server: string;
}

/**
 * World Assignment Port - Outbound Port (ADR-0001, reserved)
 *
 * Provisional: A4 (#670) settles the shape and may replace it with a domain service.
 * No implementation or caller yet.
 */
export interface IWorldAssignmentPort {
  getAssignment(world: string): Promise<string | null>;
  listAssignments(): Promise<WorldAssignment[]>;
  /** Assigns `world` to `server`; rejects when another server already holds it (rule R1). */
  assign(world: string, server: string): Promise<void>;
}
