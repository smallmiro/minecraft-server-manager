import type { ConfigSnapshotSchedule } from '../../../domain/entities/ConfigSnapshotSchedule.js';

/**
 * IConfigSnapshotScheduleUseCase - Inbound Port
 * Manages config snapshot schedule lifecycle operations
 */
export interface IConfigSnapshotScheduleUseCase {
  /**
   * Create a new config snapshot schedule
   */
  create(
    serverName: string,
    name: string,
    cronExpression: string,
    retentionCount?: number
  ): Promise<ConfigSnapshotSchedule>;

  /**
   * Update a config snapshot schedule
   */
  update(
    id: string,
    updates: Partial<
      Pick<ConfigSnapshotSchedule, 'name' | 'cronExpression' | 'retentionCount'>
    >
  ): Promise<ConfigSnapshotSchedule>;

  /**
   * Enable a config snapshot schedule
   */
  enable(id: string): Promise<void>;

  /**
   * Disable a config snapshot schedule
   */
  disable(id: string): Promise<void>;

  /**
   * Delete a config snapshot schedule
   */
  delete(id: string): Promise<void>;

  /**
   * Find all config snapshot schedules
   */
  findAll(): Promise<ConfigSnapshotSchedule[]>;

  /**
   * Find config snapshot schedules by server name
   */
  findByServer(serverName: string): Promise<ConfigSnapshotSchedule[]>;

  /**
   * Record a schedule run result (update lastRunAt and lastRunStatus)
   */
  recordRun(id: string, status: 'success' | 'failure'): Promise<void>;
}
