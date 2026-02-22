import type { ConfigSnapshot } from '../../../domain/entities/ConfigSnapshot.js';

/**
 * IConfigSnapshotRepository - Outbound Port
 * Port interface for config snapshot persistence
 */
export interface IConfigSnapshotRepository {
  /**
   * Save a config snapshot
   */
  save(snapshot: ConfigSnapshot): Promise<void>;

  /**
   * Find a config snapshot by ID
   */
  findById(id: string): Promise<ConfigSnapshot | null>;

  /**
   * Find all config snapshots with pagination (across all servers)
   */
  findAll(limit?: number, offset?: number): Promise<ConfigSnapshot[]>;

  /**
   * Find config snapshots by server name with pagination
   */
  findByServer(
    serverName: string,
    limit?: number,
    offset?: number
  ): Promise<ConfigSnapshot[]>;

  /**
   * Count config snapshots for a server
   */
  countByServer(serverName: string): Promise<number>;

  /**
   * Delete a config snapshot by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all config snapshots for a server
   */
  deleteByServer(serverName: string): Promise<void>;
}
