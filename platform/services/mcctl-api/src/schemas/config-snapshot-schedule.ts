import { Type, Static } from '@sinclair/typebox';
import { ErrorResponseSchema } from './config-snapshot.js';

// ============================================================
// Config Snapshot Schedule Schemas
// ============================================================

/**
 * Config snapshot schedule entity
 */
export const ConfigSnapshotScheduleSchema = Type.Object({
  id: Type.String(),
  serverName: Type.String(),
  name: Type.String(),
  cronExpression: Type.String(),
  cronHumanReadable: Type.String(),
  enabled: Type.Boolean(),
  retentionCount: Type.Number({ minimum: 1, maximum: 100 }),
  lastRunAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  lastRunStatus: Type.Union([
    Type.Literal('success'),
    Type.Literal('failure'),
    Type.Null(),
  ]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

/**
 * List response
 */
export const ConfigSnapshotScheduleListResponseSchema = Type.Object({
  schedules: Type.Array(ConfigSnapshotScheduleSchema),
});

/**
 * Schedule ID params
 */
export const ScheduleIdParamsSchema = Type.Object({
  id: Type.String({ description: 'Schedule ID' }),
});

/**
 * List query params
 */
export const ListSchedulesQuerySchema = Type.Object({
  serverName: Type.Optional(
    Type.String({ description: 'Filter schedules by server name' })
  ),
});

/**
 * POST /api/config-snapshot-schedules request body
 */
export const CreateConfigSnapshotScheduleRequestSchema = Type.Object({
  serverName: Type.String({ minLength: 1, description: 'Server name' }),
  name: Type.String({ minLength: 1, description: 'Schedule name' }),
  cronExpression: Type.String({
    minLength: 1,
    description: 'Cron expression (e.g. "0 3 * * *")',
  }),
  retentionCount: Type.Optional(
    Type.Number({
      minimum: 1,
      maximum: 100,
      description: 'Number of snapshots to retain (default: 10)',
    })
  ),
  enabled: Type.Optional(
    Type.Boolean({ description: 'Whether the schedule is enabled (default: true)' })
  ),
});

/**
 * PUT /api/config-snapshot-schedules/:id request body
 */
export const UpdateConfigSnapshotScheduleRequestSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, description: 'Schedule name' })),
  cronExpression: Type.Optional(
    Type.String({ minLength: 1, description: 'Cron expression' })
  ),
  retentionCount: Type.Optional(
    Type.Number({
      minimum: 1,
      maximum: 100,
      description: 'Number of snapshots to retain',
    })
  ),
});

/**
 * PATCH /api/config-snapshot-schedules/:id/toggle request body
 */
export const ToggleConfigSnapshotScheduleRequestSchema = Type.Object({
  enabled: Type.Boolean({ description: 'Whether to enable or disable the schedule' }),
});

// Re-export error schema
export { ErrorResponseSchema };

// ============================================================
// Type exports
// ============================================================

export type ConfigSnapshotScheduleResponse = Static<typeof ConfigSnapshotScheduleSchema>;
export type ConfigSnapshotScheduleListResponse = Static<typeof ConfigSnapshotScheduleListResponseSchema>;
export type ScheduleIdParams = Static<typeof ScheduleIdParamsSchema>;
export type ListSchedulesQuery = Static<typeof ListSchedulesQuerySchema>;
export type CreateConfigSnapshotScheduleRequest = Static<typeof CreateConfigSnapshotScheduleRequestSchema>;
export type UpdateConfigSnapshotScheduleRequest = Static<typeof UpdateConfigSnapshotScheduleRequestSchema>;
export type ToggleConfigSnapshotScheduleRequest = Static<typeof ToggleConfigSnapshotScheduleRequestSchema>;
