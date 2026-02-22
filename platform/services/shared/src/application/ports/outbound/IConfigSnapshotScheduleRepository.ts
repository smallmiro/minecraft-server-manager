import type { ConfigSnapshotSchedule } from '../../../domain/entities/ConfigSnapshotSchedule.js';

/**
 * IConfigSnapshotScheduleRepository - Outbound Port
 * Port interface for config snapshot schedule persistence
 */
export interface IConfigSnapshotScheduleRepository {
  /**
   * Save (insert) a config snapshot schedule
   */
  save(schedule: ConfigSnapshotSchedule): Promise<void>;

  /**
   * Find a config snapshot schedule by ID
   */
  findById(id: string): Promise<ConfigSnapshotSchedule | null>;

  /**
   * Find config snapshot schedules by server name
   */
  findByServer(serverName: string): Promise<ConfigSnapshotSchedule[]>;

  /**
   * Find all config snapshot schedules (both enabled and disabled)
   */
  findAll(): Promise<ConfigSnapshotSchedule[]>;

  /**
   * Find all enabled config snapshot schedules
   */
  findAllEnabled(): Promise<ConfigSnapshotSchedule[]>;

  /**
   * Update an existing config snapshot schedule
   */
  update(schedule: ConfigSnapshotSchedule): Promise<void>;

  /**
   * Delete a config snapshot schedule by ID
   */
  delete(id: string): Promise<void>;
}
