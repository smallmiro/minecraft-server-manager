import type { ConfigSnapshot } from '../../../domain/entities/ConfigSnapshot.js';
import type { SnapshotDiff } from '../../../domain/value-objects/SnapshotDiff.js';

/**
 * IConfigSnapshotUseCase - Inbound Port
 * Manages config snapshot CRUD, diff, and restore operations
 */
export interface IConfigSnapshotUseCase {
  /**
   * Create a new config snapshot for a server
   */
  create(serverName: string, description?: string): Promise<ConfigSnapshot>;

  /**
   * List config snapshots, optionally filtered by server
   */
  list(
    serverName?: string,
    limit?: number,
    offset?: number
  ): Promise<ConfigSnapshot[]>;

  /**
   * Find a config snapshot by ID
   */
  findById(id: string): Promise<ConfigSnapshot | null>;

  /**
   * Compute the diff between two snapshots
   */
  diff(snapshotId1: string, snapshotId2: string): Promise<SnapshotDiff>;

  /**
   * Restore server configuration from a snapshot
   */
  restore(snapshotId: string, force?: boolean): Promise<void>;

  /**
   * Delete a config snapshot
   */
  delete(id: string): Promise<void>;
}
