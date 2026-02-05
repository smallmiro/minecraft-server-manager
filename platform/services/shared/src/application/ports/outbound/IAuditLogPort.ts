import type { AuditLog, AuditLogData } from '../../../domain/entities/AuditLog.js';
import type { AuditActionEnum } from '../../../domain/value-objects/AuditAction.js';

/**
 * Query options for filtering audit logs
 */
export interface AuditLogQueryOptions {
  action?: AuditActionEnum;
  actor?: string;
  targetType?: string;
  targetName?: string;
  status?: 'success' | 'failure';
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

/**
 * IAuditLogPort
 * Port interface for audit log persistence and retrieval
 */
export interface IAuditLogPort {
  /**
   * Log an audit entry
   * @param entry - The audit log data to persist
   */
  log(entry: AuditLogData): Promise<void>;

  /**
   * Find all audit logs with optional filtering
   * @param options - Query options for filtering
   * @returns Array of audit logs matching the criteria
   */
  findAll(options?: AuditLogQueryOptions): Promise<AuditLog[]>;

  /**
   * Find audit logs by target
   * @param targetType - The type of target (e.g., 'server', 'player')
   * @param targetName - The name of the target
   * @returns Array of audit logs for the specified target
   */
  findByTarget(targetType: string, targetName: string): Promise<AuditLog[]>;

  /**
   * Find audit logs by action
   * @param action - The action to filter by
   * @returns Array of audit logs with the specified action
   */
  findByAction(action: AuditActionEnum): Promise<AuditLog[]>;

  /**
   * Find audit logs by actor
   * @param actor - The actor (user) who performed the action
   * @returns Array of audit logs by the specified actor
   */
  findByActor(actor: string): Promise<AuditLog[]>;

  /**
   * Count audit logs with optional filtering
   * @param options - Query options for filtering
   * @returns The number of logs matching the criteria
   */
  count(options?: AuditLogQueryOptions): Promise<number>;

  /**
   * Delete audit logs older than the specified date
   * @param date - The cutoff date
   * @returns The number of logs deleted
   */
  deleteOlderThan(date: Date): Promise<number>;
}
