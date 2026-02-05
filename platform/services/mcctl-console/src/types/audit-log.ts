/**
 * Audit Log Type Definitions
 * Type-safe structures for audit log API and components
 */

/**
 * Audit log action values
 */
export type AuditAction =
  | 'server.create'
  | 'server.delete'
  | 'server.start'
  | 'server.stop'
  | 'server.restart'
  | 'player.whitelist.add'
  | 'player.whitelist.remove'
  | 'player.ban'
  | 'player.unban'
  | 'player.op'
  | 'player.deop'
  | 'player.kick'
  | 'audit.purge';

/**
 * Audit log status
 */
export type AuditStatus = 'success' | 'failure';

/**
 * Target type for audit logs
 */
export type AuditTargetType = 'server' | 'player' | 'audit';

/**
 * Single audit log entry
 */
export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actor: string;
  targetType: string;
  targetName: string;
  details: Record<string, unknown> | null;
  status: AuditStatus;
  errorMessage: string | null;
  timestamp: string;
}

/**
 * Brief audit log entry (for related logs)
 */
export interface AuditLogBrief {
  id: string;
  action: string;
  targetName?: string;
  timestamp: string;
}

/**
 * Applied filters in list response
 */
export interface AuditLogFilters {
  action: string | null;
  actor: string | null;
  targetType: string | null;
  targetName: string | null;
  status: string | null;
  from: string | null;
  to: string | null;
}

/**
 * Query parameters for fetching audit logs
 */
export interface AuditLogQueryParams {
  action?: string;
  actor?: string;
  targetType?: string;
  targetName?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  sort?: 'timestamp:asc' | 'timestamp:desc';
}

/**
 * GET /api/audit-logs response
 */
export interface AuditLogListResponse {
  logs: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
  filters: AuditLogFilters;
}

/**
 * GET /api/audit-logs/stats response
 */
export interface AuditLogStatsResponse {
  total: number;
  byAction: Record<string, number>;
  byStatus: {
    success: number;
    failure: number;
  };
  byActor: Record<string, number>;
  recentActivity: AuditLogEntry[];
  oldestEntry: string | null;
  newestEntry: string | null;
}

/**
 * GET /api/audit-logs/:id response
 */
export interface AuditLogDetailResponse {
  log: AuditLogEntry;
  relatedLogs: {
    sameTarget: AuditLogBrief[];
    sameActor: AuditLogBrief[];
  };
}

/**
 * DELETE /api/audit-logs request
 */
export interface AuditLogPurgeRequest {
  before: string;
  dryRun?: boolean;
}

/**
 * DELETE /api/audit-logs response
 */
export interface AuditLogPurgeResponse {
  deleted: number;
  dryRun: boolean;
  message: string;
}

/**
 * Export options
 */
export interface AuditLogExportOptions {
  format: 'csv' | 'json';
  filters: AuditLogQueryParams;
}

/**
 * Action color mapping for UI chips
 */
export const AUDIT_ACTION_COLORS: Record<string, 'success' | 'error' | 'info' | 'warning' | 'secondary' | 'default'> = {
  'server.create': 'success',
  'server.delete': 'error',
  'server.start': 'info',
  'server.stop': 'warning',
  'server.restart': 'secondary',
  'player.whitelist.add': 'success',
  'player.whitelist.remove': 'warning',
  'player.ban': 'error',
  'player.unban': 'success',
  'player.op': 'info',
  'player.deop': 'warning',
  'player.kick': 'error',
  'audit.purge': 'default',
};

/**
 * Action display labels
 */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'server.create': 'Create',
  'server.delete': 'Delete',
  'server.start': 'Start',
  'server.stop': 'Stop',
  'server.restart': 'Restart',
  'player.whitelist.add': 'Whitelist Add',
  'player.whitelist.remove': 'Whitelist Remove',
  'player.ban': 'Ban',
  'player.unban': 'Unban',
  'player.op': 'Op',
  'player.deop': 'Deop',
  'player.kick': 'Kick',
  'audit.purge': 'Purge',
};

/**
 * All available audit actions for filter dropdowns
 */
export const ALL_AUDIT_ACTIONS: AuditAction[] = [
  'server.create',
  'server.delete',
  'server.start',
  'server.stop',
  'server.restart',
  'player.whitelist.add',
  'player.whitelist.remove',
  'player.ban',
  'player.unban',
  'player.op',
  'player.deop',
  'player.kick',
  'audit.purge',
];

/**
 * Server-related actions
 */
export const SERVER_ACTIONS: AuditAction[] = [
  'server.create',
  'server.delete',
  'server.start',
  'server.stop',
  'server.restart',
];

/**
 * Player-related actions
 */
export const PLAYER_ACTIONS: AuditAction[] = [
  'player.whitelist.add',
  'player.whitelist.remove',
  'player.ban',
  'player.unban',
  'player.op',
  'player.deop',
  'player.kick',
];
