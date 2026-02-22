import type { BackupSchedule } from '../../../domain/entities/BackupSchedule.js';

/**
 * IBackupScheduleRepository - Outbound Port
 * Port interface for backup schedule persistence
 */
export interface IBackupScheduleRepository {
  /**
   * Save (insert or update) a backup schedule
   */
  save(schedule: BackupSchedule): Promise<void>;

  /**
   * Find all backup schedules
   */
  findAll(): Promise<BackupSchedule[]>;

  /**
   * Find a backup schedule by ID
   */
  findById(id: string): Promise<BackupSchedule | null>;

  /**
   * Find all enabled backup schedules
   */
  findEnabled(): Promise<BackupSchedule[]>;

  /**
   * Delete a backup schedule by ID
   */
  delete(id: string): Promise<void>;
}
