import type { BackupSchedule } from '../../../domain/entities/BackupSchedule.js';

/**
 * Parameters for creating a backup schedule
 */
export interface CreateBackupScheduleParams {
  name: string;
  cron: string;
  maxCount?: number;
  maxAgeDays?: number;
  enabled?: boolean;
}

/**
 * Parameters for updating a backup schedule
 */
export interface UpdateBackupScheduleParams {
  name?: string;
  cron?: string;
  maxCount?: number;
  maxAgeDays?: number;
}

/**
 * IBackupScheduleUseCase - Inbound Port
 * Manages backup schedule CRUD and lifecycle operations
 */
export interface IBackupScheduleUseCase {
  /**
   * Create a new backup schedule
   */
  create(params: CreateBackupScheduleParams): Promise<BackupSchedule>;

  /**
   * Find all backup schedules
   */
  findAll(): Promise<BackupSchedule[]>;

  /**
   * Find a backup schedule by ID
   */
  findById(id: string): Promise<BackupSchedule | null>;

  /**
   * Update a backup schedule
   */
  update(id: string, params: UpdateBackupScheduleParams): Promise<BackupSchedule>;

  /**
   * Remove a backup schedule
   */
  remove(id: string): Promise<void>;

  /**
   * Enable a backup schedule
   */
  enable(id: string): Promise<BackupSchedule>;

  /**
   * Disable a backup schedule
   */
  disable(id: string): Promise<BackupSchedule>;

  /**
   * Record a backup run result
   */
  recordRun(
    id: string,
    status: 'success' | 'failure',
    message?: string
  ): Promise<BackupSchedule>;
}
