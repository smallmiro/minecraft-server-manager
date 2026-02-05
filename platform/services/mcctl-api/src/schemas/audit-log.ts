import { Type, Static } from '@sinclair/typebox';

// ============================================================
// Audit Log Schemas
// ============================================================

/**
 * Audit log action enum values (matches AuditActionEnum from shared)
 */
export const AuditActionSchema = Type.Union([
  Type.Literal('server.create'),
  Type.Literal('server.delete'),
  Type.Literal('server.start'),
  Type.Literal('server.stop'),
  Type.Literal('server.restart'),
  Type.Literal('player.whitelist.add'),
  Type.Literal('player.whitelist.remove'),
  Type.Literal('player.ban'),
  Type.Literal('player.unban'),
  Type.Literal('player.op'),
  Type.Literal('player.deop'),
  Type.Literal('player.kick'),
  Type.Literal('audit.purge'),
]);

/**
 * Audit log status
 */
export const AuditStatusSchema = Type.Union([
  Type.Literal('success'),
  Type.Literal('failure'),
]);

/**
 * Single audit log entry
 */
export const AuditLogEntrySchema = Type.Object({
  id: Type.String(),
  action: Type.String(),
  actor: Type.String(),
  targetType: Type.String(),
  targetName: Type.String(),
  details: Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()]),
  status: AuditStatusSchema,
  errorMessage: Type.Union([Type.String(), Type.Null(), Type.Undefined()]),
  timestamp: Type.String({ format: 'date-time' }),
});

/**
 * Brief audit log entry (for related logs)
 */
export const AuditLogBriefSchema = Type.Object({
  id: Type.String(),
  action: Type.String(),
  targetName: Type.Optional(Type.String()),
  timestamp: Type.String({ format: 'date-time' }),
});

// ============================================================
// Query Schemas
// ============================================================

/**
 * GET /api/audit-logs query parameters
 */
export const AuditLogListQuerySchema = Type.Object({
  action: Type.Optional(Type.String({ description: 'Action filter (comma-separated for multiple)' })),
  actor: Type.Optional(Type.String({ description: 'Actor filter (e.g., cli:local, api:admin)' })),
  targetType: Type.Optional(Type.String({ description: 'Target type filter (server, player)' })),
  targetName: Type.Optional(Type.String({ description: 'Target name filter (partial match)' })),
  status: Type.Optional(Type.String({ description: 'Status filter (success, failure)' })),
  from: Type.Optional(Type.String({ format: 'date-time', description: 'Start date (ISO 8601)' })),
  to: Type.Optional(Type.String({ format: 'date-time', description: 'End date (ISO 8601)' })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 200, default: 50, description: 'Page size (max: 200)' })),
  offset: Type.Optional(Type.Number({ minimum: 0, default: 0, description: 'Offset for pagination' })),
  sort: Type.Optional(Type.String({ default: 'timestamp:desc', description: 'Sort order (timestamp:asc, timestamp:desc)' })),
});

/**
 * GET /api/audit-logs/:id params
 */
export const AuditLogIdParamsSchema = Type.Object({
  id: Type.String({ description: 'Audit log entry ID' }),
});

// ============================================================
// Request Schemas
// ============================================================

/**
 * DELETE /api/audit-logs request body
 */
export const AuditLogPurgeRequestSchema = Type.Object({
  before: Type.String({ format: 'date-time', description: 'Delete logs before this date (ISO 8601)' }),
  dryRun: Type.Optional(Type.Boolean({ default: false, description: 'If true, only count logs to be deleted' })),
});

// ============================================================
// Response Schemas
// ============================================================

/**
 * Filters applied in the response
 */
export const AuditLogFiltersSchema = Type.Object({
  action: Type.Union([Type.String(), Type.Null()]),
  actor: Type.Union([Type.String(), Type.Null()]),
  targetType: Type.Union([Type.String(), Type.Null()]),
  targetName: Type.Union([Type.String(), Type.Null()]),
  status: Type.Union([Type.String(), Type.Null()]),
  from: Type.Union([Type.String(), Type.Null()]),
  to: Type.Union([Type.String(), Type.Null()]),
});

/**
 * GET /api/audit-logs response
 */
export const AuditLogListResponseSchema = Type.Object({
  logs: Type.Array(AuditLogEntrySchema),
  total: Type.Number(),
  limit: Type.Number(),
  offset: Type.Number(),
  filters: AuditLogFiltersSchema,
});

/**
 * GET /api/audit-logs/stats response
 */
export const AuditLogStatsResponseSchema = Type.Object({
  total: Type.Number(),
  byAction: Type.Record(Type.String(), Type.Number()),
  byStatus: Type.Object({
    success: Type.Number(),
    failure: Type.Number(),
  }),
  byActor: Type.Record(Type.String(), Type.Number()),
  recentActivity: Type.Array(AuditLogEntrySchema),
  oldestEntry: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  newestEntry: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
});

/**
 * GET /api/audit-logs/:id response
 */
export const AuditLogDetailResponseSchema = Type.Object({
  log: AuditLogEntrySchema,
  relatedLogs: Type.Object({
    sameTarget: Type.Array(AuditLogBriefSchema),
    sameActor: Type.Array(AuditLogBriefSchema),
  }),
});

/**
 * DELETE /api/audit-logs response
 */
export const AuditLogPurgeResponseSchema = Type.Object({
  deleted: Type.Number(),
  dryRun: Type.Boolean(),
  message: Type.String(),
});

/**
 * Error response schema (reused)
 */
export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
  message: Type.String(),
});

// ============================================================
// Type exports
// ============================================================

export type AuditLogEntry = Static<typeof AuditLogEntrySchema>;
export type AuditLogBrief = Static<typeof AuditLogBriefSchema>;
export type AuditLogListQuery = Static<typeof AuditLogListQuerySchema>;
export type AuditLogIdParams = Static<typeof AuditLogIdParamsSchema>;
export type AuditLogPurgeRequest = Static<typeof AuditLogPurgeRequestSchema>;
export type AuditLogListResponse = Static<typeof AuditLogListResponseSchema>;
export type AuditLogStatsResponse = Static<typeof AuditLogStatsResponseSchema>;
export type AuditLogDetailResponse = Static<typeof AuditLogDetailResponseSchema>;
export type AuditLogPurgeResponse = Static<typeof AuditLogPurgeResponseSchema>;
