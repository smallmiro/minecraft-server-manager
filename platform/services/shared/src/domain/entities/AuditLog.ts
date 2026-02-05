import { randomUUID } from 'node:crypto';
import { AuditActionEnum } from '../value-objects/AuditAction.js';

/**
 * AuditLog entity data
 */
export interface AuditLogData {
  id?: string;
  action: AuditActionEnum;
  actor: string;
  targetType: string;
  targetName: string;
  details: Record<string, unknown> | null;
  status: 'success' | 'failure';
  errorMessage?: string | null;
  timestamp?: Date;
}

/**
 * Database row structure for audit_logs table
 */
export interface AuditLogRow {
  id: string;
  action: AuditActionEnum;
  actor: string;
  target_type: string;
  target_name: string;
  details: string | null;
  status: 'success' | 'failure';
  error_message: string | null;
  timestamp: string;
}

/**
 * AuditLog entity
 * Represents an audit log entry in the system
 */
export class AuditLog {
  private readonly _id: string;
  private readonly _action: AuditActionEnum;
  private readonly _actor: string;
  private readonly _targetType: string;
  private readonly _targetName: string;
  private readonly _details: Record<string, unknown> | null;
  private readonly _status: 'success' | 'failure';
  private readonly _errorMessage: string | null | undefined;
  private readonly _timestamp: Date;

  private constructor(data: AuditLogData) {
    this._id = data.id ?? randomUUID();
    this._action = data.action;
    this._actor = data.actor;
    this._targetType = data.targetType;
    this._targetName = data.targetName;
    this._details = data.details;
    this._status = data.status;
    this._errorMessage = data.errorMessage;
    this._timestamp = data.timestamp ?? new Date();
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get action(): AuditActionEnum {
    return this._action;
  }

  get actor(): string {
    return this._actor;
  }

  get targetType(): string {
    return this._targetType;
  }

  get targetName(): string {
    return this._targetName;
  }

  get details(): Record<string, unknown> | null {
    return this._details;
  }

  get status(): 'success' | 'failure' {
    return this._status;
  }

  get errorMessage(): string | null | undefined {
    return this._errorMessage;
  }

  get timestamp(): Date {
    return this._timestamp;
  }

  /**
   * Create a new AuditLog entity
   */
  static create(data: AuditLogData): AuditLog {
    return new AuditLog(data);
  }

  /**
   * Create an AuditLog from raw data (e.g., from database)
   */
  static fromRaw(row: AuditLogRow): AuditLog {
    return new AuditLog({
      id: row.id,
      action: row.action,
      actor: row.actor,
      targetType: row.target_type,
      targetName: row.target_name,
      details: row.details ? JSON.parse(row.details) : null,
      status: row.status,
      errorMessage: row.error_message,
      timestamp: new Date(row.timestamp),
    });
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): {
    id: string;
    action: AuditActionEnum;
    actor: string;
    targetType: string;
    targetName: string;
    details: Record<string, unknown> | null;
    status: 'success' | 'failure';
    errorMessage: string | null | undefined;
    timestamp: string;
  } {
    return {
      id: this._id,
      action: this._action,
      actor: this._actor,
      targetType: this._targetType,
      targetName: this._targetName,
      details: this._details,
      status: this._status,
      errorMessage: this._errorMessage,
      timestamp: this._timestamp.toISOString(),
    };
  }
}
