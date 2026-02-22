import { randomUUID } from 'node:crypto';
import { ServerName } from '../value-objects/ServerName.js';
import { CronExpression } from '../value-objects/CronExpression.js';

/**
 * ConfigSnapshotSchedule entity data for construction
 */
export interface ConfigSnapshotScheduleData {
  id?: string;
  serverName: ServerName;
  name: string;
  cronExpression: string;
  enabled?: boolean;
  retentionCount?: number;
  lastRunAt?: Date | null;
  lastRunStatus?: 'success' | 'failure' | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Database row structure for config_snapshot_schedules table
 */
export interface ConfigSnapshotScheduleRow {
  id: string;
  server_name: string;
  name: string;
  cron_expression: string;
  enabled: number; // SQLite boolean (0/1)
  retention_count: number;
  last_run_at: string | null;
  last_run_status: 'success' | 'failure' | null;
  created_at: string;
  updated_at: string;
}

/**
 * ConfigSnapshotSchedule Entity
 * Represents a scheduled configuration snapshot
 */
export class ConfigSnapshotSchedule {
  private readonly _id: string;
  private readonly _serverName: ServerName;
  private readonly _name: string;
  private readonly _cronExpression: CronExpression;
  private readonly _enabled: boolean;
  private readonly _retentionCount: number;
  private readonly _lastRunAt: Date | null;
  private readonly _lastRunStatus: 'success' | 'failure' | null;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor(data: {
    id: string;
    serverName: ServerName;
    name: string;
    cronExpression: CronExpression;
    enabled: boolean;
    retentionCount: number;
    lastRunAt: Date | null;
    lastRunStatus: 'success' | 'failure' | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this._id = data.id;
    this._serverName = data.serverName;
    this._name = data.name;
    this._cronExpression = data.cronExpression;
    this._enabled = data.enabled;
    this._retentionCount = data.retentionCount;
    this._lastRunAt = data.lastRunAt;
    this._lastRunStatus = data.lastRunStatus;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get serverName(): ServerName {
    return this._serverName;
  }

  get name(): string {
    return this._name;
  }

  get cronExpression(): CronExpression {
    return this._cronExpression;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get retentionCount(): number {
    return this._retentionCount;
  }

  get lastRunAt(): Date | null {
    return this._lastRunAt;
  }

  get lastRunStatus(): 'success' | 'failure' | null {
    return this._lastRunStatus;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Create a new ConfigSnapshotSchedule entity
   */
  static create(data: ConfigSnapshotScheduleData): ConfigSnapshotSchedule {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error('name cannot be empty');
    }

    const retentionCount = data.retentionCount ?? 10;
    if (!Number.isInteger(retentionCount) || retentionCount < 1) {
      throw new Error('retentionCount must be a positive integer (>= 1)');
    }

    const now = new Date();
    return new ConfigSnapshotSchedule({
      id: data.id ?? randomUUID(),
      serverName: data.serverName,
      name: trimmedName,
      cronExpression: CronExpression.create(data.cronExpression),
      enabled: data.enabled ?? true,
      retentionCount,
      lastRunAt: data.lastRunAt ?? null,
      lastRunStatus: data.lastRunStatus ?? null,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    });
  }

  /**
   * Create a ConfigSnapshotSchedule from a database row
   */
  static fromRaw(row: ConfigSnapshotScheduleRow): ConfigSnapshotSchedule {
    return new ConfigSnapshotSchedule({
      id: row.id,
      serverName: ServerName.create(row.server_name),
      name: row.name,
      cronExpression: CronExpression.create(row.cron_expression),
      enabled: row.enabled === 1,
      retentionCount: row.retention_count,
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
      lastRunStatus: row.last_run_status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  /**
   * Return a new ConfigSnapshotSchedule with enabled = true
   */
  enable(): ConfigSnapshotSchedule {
    return new ConfigSnapshotSchedule({
      id: this._id,
      serverName: this._serverName,
      name: this._name,
      cronExpression: this._cronExpression,
      enabled: true,
      retentionCount: this._retentionCount,
      lastRunAt: this._lastRunAt,
      lastRunStatus: this._lastRunStatus,
      createdAt: this._createdAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Return a new ConfigSnapshotSchedule with enabled = false
   */
  disable(): ConfigSnapshotSchedule {
    return new ConfigSnapshotSchedule({
      id: this._id,
      serverName: this._serverName,
      name: this._name,
      cronExpression: this._cronExpression,
      enabled: false,
      retentionCount: this._retentionCount,
      lastRunAt: this._lastRunAt,
      lastRunStatus: this._lastRunStatus,
      createdAt: this._createdAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Return a new ConfigSnapshotSchedule with the run recorded
   */
  recordRun(status: 'success' | 'failure'): ConfigSnapshotSchedule {
    return new ConfigSnapshotSchedule({
      id: this._id,
      serverName: this._serverName,
      name: this._name,
      cronExpression: this._cronExpression,
      enabled: this._enabled,
      retentionCount: this._retentionCount,
      lastRunAt: new Date(),
      lastRunStatus: status,
      createdAt: this._createdAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): {
    id: string;
    serverName: string;
    name: string;
    cronExpression: string;
    cronHumanReadable: string;
    enabled: boolean;
    retentionCount: number;
    lastRunAt: string | null;
    lastRunStatus: 'success' | 'failure' | null;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: this._id,
      serverName: this._serverName.value,
      name: this._name,
      cronExpression: this._cronExpression.expression,
      cronHumanReadable: this._cronExpression.toHumanReadable(),
      enabled: this._enabled,
      retentionCount: this._retentionCount,
      lastRunAt: this._lastRunAt?.toISOString() ?? null,
      lastRunStatus: this._lastRunStatus,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
