import { randomUUID } from 'node:crypto';
import { CronExpression } from '../value-objects/CronExpression.js';
import {
  BackupRetentionPolicy,
  type BackupRetentionPolicyData,
} from '../value-objects/BackupRetentionPolicy.js';

/**
 * BackupSchedule entity data for construction
 */
export interface BackupScheduleData {
  id?: string;
  name: string;
  cronExpression: string;
  retentionPolicy?: BackupRetentionPolicyData;
  enabled?: boolean;
  lastRunAt?: Date | null;
  lastRunStatus?: 'success' | 'failure' | null;
  lastRunMessage?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Database row structure for backup_schedules table
 */
export interface BackupScheduleRow {
  id: string;
  name: string;
  cron_expression: string;
  retention_max_count: number | null;
  retention_max_age_days: number | null;
  enabled: number; // SQLite boolean (0/1)
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * BackupSchedule Entity
 * Represents a scheduled backup configuration
 */
export class BackupSchedule {
  private readonly _id: string;
  private readonly _name: string;
  private readonly _cronExpression: CronExpression;
  private readonly _retentionPolicy: BackupRetentionPolicy;
  private readonly _enabled: boolean;
  private readonly _lastRunAt: Date | null;
  private readonly _lastRunStatus: 'success' | 'failure' | null;
  private readonly _lastRunMessage: string | null;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor(data: {
    id: string;
    name: string;
    cronExpression: CronExpression;
    retentionPolicy: BackupRetentionPolicy;
    enabled: boolean;
    lastRunAt: Date | null;
    lastRunStatus: 'success' | 'failure' | null;
    lastRunMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this._id = data.id;
    this._name = data.name;
    this._cronExpression = data.cronExpression;
    this._retentionPolicy = data.retentionPolicy;
    this._enabled = data.enabled;
    this._lastRunAt = data.lastRunAt;
    this._lastRunStatus = data.lastRunStatus;
    this._lastRunMessage = data.lastRunMessage;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get cronExpression(): CronExpression {
    return this._cronExpression;
  }

  get retentionPolicy(): BackupRetentionPolicy {
    return this._retentionPolicy;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get lastRunAt(): Date | null {
    return this._lastRunAt;
  }

  get lastRunStatus(): 'success' | 'failure' | null {
    return this._lastRunStatus;
  }

  get lastRunMessage(): string | null {
    return this._lastRunMessage;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Create a new BackupSchedule entity
   */
  static create(data: BackupScheduleData): BackupSchedule {
    const now = new Date();
    return new BackupSchedule({
      id: data.id ?? randomUUID(),
      name: data.name,
      cronExpression: CronExpression.create(data.cronExpression),
      retentionPolicy: data.retentionPolicy
        ? BackupRetentionPolicy.create(data.retentionPolicy)
        : BackupRetentionPolicy.default(),
      enabled: data.enabled ?? true,
      lastRunAt: data.lastRunAt ?? null,
      lastRunStatus: data.lastRunStatus ?? null,
      lastRunMessage: data.lastRunMessage ?? null,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    });
  }

  /**
   * Create a BackupSchedule from a database row
   */
  static fromRaw(row: BackupScheduleRow): BackupSchedule {
    return new BackupSchedule({
      id: row.id,
      name: row.name,
      cronExpression: CronExpression.create(row.cron_expression),
      retentionPolicy: BackupRetentionPolicy.create({
        maxCount: row.retention_max_count ?? undefined,
        maxAgeDays: row.retention_max_age_days ?? undefined,
      }),
      enabled: row.enabled === 1,
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
      lastRunStatus: row.last_run_status as 'success' | 'failure' | null,
      lastRunMessage: row.last_run_message,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  /**
   * Return a new BackupSchedule with enabled = true
   */
  enable(): BackupSchedule {
    return new BackupSchedule({
      id: this._id,
      name: this._name,
      cronExpression: this._cronExpression,
      retentionPolicy: this._retentionPolicy,
      enabled: true,
      lastRunAt: this._lastRunAt,
      lastRunStatus: this._lastRunStatus,
      lastRunMessage: this._lastRunMessage,
      createdAt: this._createdAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Return a new BackupSchedule with enabled = false
   */
  disable(): BackupSchedule {
    return new BackupSchedule({
      id: this._id,
      name: this._name,
      cronExpression: this._cronExpression,
      retentionPolicy: this._retentionPolicy,
      enabled: false,
      lastRunAt: this._lastRunAt,
      lastRunStatus: this._lastRunStatus,
      lastRunMessage: this._lastRunMessage,
      createdAt: this._createdAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Return a new BackupSchedule with the run recorded
   */
  recordRun(
    status: 'success' | 'failure',
    message?: string
  ): BackupSchedule {
    return new BackupSchedule({
      id: this._id,
      name: this._name,
      cronExpression: this._cronExpression,
      retentionPolicy: this._retentionPolicy,
      enabled: this._enabled,
      lastRunAt: new Date(),
      lastRunStatus: status,
      lastRunMessage: message ?? null,
      createdAt: this._createdAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): {
    id: string;
    name: string;
    cronExpression: string;
    cronHumanReadable: string;
    retentionPolicy: BackupRetentionPolicyData;
    enabled: boolean;
    lastRunAt: string | null;
    lastRunStatus: 'success' | 'failure' | null;
    lastRunMessage: string | null;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: this._id,
      name: this._name,
      cronExpression: this._cronExpression.expression,
      cronHumanReadable: this._cronExpression.toHumanReadable(),
      retentionPolicy: this._retentionPolicy.toJSON(),
      enabled: this._enabled,
      lastRunAt: this._lastRunAt?.toISOString() ?? null,
      lastRunStatus: this._lastRunStatus,
      lastRunMessage: this._lastRunMessage,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
