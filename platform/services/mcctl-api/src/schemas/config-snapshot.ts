import { Type, Static } from '@sinclair/typebox';

// ============================================================
// Config Snapshot Schemas
// ============================================================

/**
 * Config snapshot file entry
 */
export const ConfigSnapshotFileSchema = Type.Object({
  path: Type.String(),
  hash: Type.String(),
  size: Type.Number(),
});

/**
 * Config snapshot entity
 */
export const ConfigSnapshotSchema = Type.Object({
  id: Type.String(),
  serverName: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
  description: Type.String(),
  files: Type.Array(ConfigSnapshotFileSchema),
  scheduleId: Type.Optional(Type.String()),
});

/**
 * File diff entry
 */
export const FileDiffSchema = Type.Object({
  path: Type.String(),
  status: Type.Union([
    Type.Literal('added'),
    Type.Literal('modified'),
    Type.Literal('deleted'),
  ]),
  oldContent: Type.Optional(Type.String()),
  newContent: Type.Optional(Type.String()),
  oldHash: Type.Optional(Type.String()),
  newHash: Type.Optional(Type.String()),
});

/**
 * Snapshot diff summary
 */
export const SnapshotDiffSummarySchema = Type.Object({
  added: Type.Number(),
  modified: Type.Number(),
  deleted: Type.Number(),
});

/**
 * Snapshot diff response
 */
export const SnapshotDiffResponseSchema = Type.Object({
  baseSnapshotId: Type.String(),
  compareSnapshotId: Type.String(),
  changes: Type.Array(FileDiffSchema),
  summary: SnapshotDiffSummarySchema,
  hasChanges: Type.Boolean(),
});

// ============================================================
// Params Schemas
// ============================================================

/**
 * Server name params
 */
export const ServerNameParamsSchema = Type.Object({
  name: Type.String({ description: 'Server name' }),
});

/**
 * Server name + snapshot ID params
 */
export const ServerSnapshotParamsSchema = Type.Object({
  name: Type.String({ description: 'Server name' }),
  id: Type.String({ description: 'Snapshot ID' }),
});

/**
 * Diff params (two snapshot IDs)
 */
export const SnapshotDiffParamsSchema = Type.Object({
  id1: Type.String({ description: 'Base snapshot ID' }),
  id2: Type.String({ description: 'Compare snapshot ID' }),
});

// ============================================================
// Query Schemas
// ============================================================

/**
 * List snapshots query params
 */
export const ListSnapshotsQuerySchema = Type.Object({
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20, description: 'Max results (default: 20)' })),
  offset: Type.Optional(Type.Number({ minimum: 0, default: 0, description: 'Offset for pagination' })),
});

// ============================================================
// Request Schemas
// ============================================================

/**
 * POST /api/servers/:name/config-snapshots request body
 */
export const CreateSnapshotRequestSchema = Type.Object({
  description: Type.Optional(Type.String({ maxLength: 500, description: 'Snapshot description' })),
});

/**
 * POST /api/servers/:name/config-snapshots/:id/restore request body
 */
export const RestoreSnapshotRequestSchema = Type.Object({
  createSnapshotBeforeRestore: Type.Optional(Type.Boolean({ default: true, description: 'Create a safety snapshot before restoring' })),
  force: Type.Optional(Type.Boolean({ default: false, description: 'Force restore even if server is running' })),
});

// ============================================================
// Response Schemas
// ============================================================

/**
 * GET /api/servers/:name/config-snapshots response
 */
export const ListSnapshotsResponseSchema = Type.Object({
  snapshots: Type.Array(ConfigSnapshotSchema),
  total: Type.Number(),
});

/**
 * POST /api/servers/:name/config-snapshots/:id/restore response
 */
export const RestoreSnapshotResponseSchema = Type.Object({
  restored: ConfigSnapshotSchema,
  safetySnapshot: Type.Optional(ConfigSnapshotSchema),
});

/**
 * Error response schema
 */
export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
  message: Type.String(),
});

// ============================================================
// Type exports
// ============================================================

export type ConfigSnapshotResponse = Static<typeof ConfigSnapshotSchema>;
export type ServerNameParams = Static<typeof ServerNameParamsSchema>;
export type ServerSnapshotParams = Static<typeof ServerSnapshotParamsSchema>;
export type SnapshotDiffParams = Static<typeof SnapshotDiffParamsSchema>;
export type ListSnapshotsQuery = Static<typeof ListSnapshotsQuerySchema>;
export type CreateSnapshotRequest = Static<typeof CreateSnapshotRequestSchema>;
export type RestoreSnapshotRequest = Static<typeof RestoreSnapshotRequestSchema>;
export type ListSnapshotsResponse = Static<typeof ListSnapshotsResponseSchema>;
export type RestoreSnapshotResponse = Static<typeof RestoreSnapshotResponseSchema>;
