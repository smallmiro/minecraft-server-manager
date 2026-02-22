import { Type, Static } from '@sinclair/typebox';
import { ErrorResponseSchema } from './server.js';

// Backup schedule item
export const BackupScheduleSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  cronExpression: Type.String(),
  cronHumanReadable: Type.String(),
  retentionPolicy: Type.Object({
    maxCount: Type.Optional(Type.Number()),
    maxAgeDays: Type.Optional(Type.Number()),
  }),
  enabled: Type.Boolean(),
  lastRunAt: Type.Union([Type.String(), Type.Null()]),
  lastRunStatus: Type.Union([
    Type.Literal('success'),
    Type.Literal('failure'),
    Type.Null(),
  ]),
  lastRunMessage: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

// List response
export const BackupScheduleListResponseSchema = Type.Object({
  schedules: Type.Array(BackupScheduleSchema),
  total: Type.Number(),
});

// Create request
export const CreateBackupScheduleRequestSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  cron: Type.String({ minLength: 1 }),
  maxCount: Type.Optional(Type.Number({ minimum: 1 })),
  maxAgeDays: Type.Optional(Type.Number({ minimum: 1 })),
  enabled: Type.Optional(Type.Boolean()),
});

// Update request
export const UpdateBackupScheduleRequestSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  cron: Type.Optional(Type.String({ minLength: 1 })),
  maxCount: Type.Optional(Type.Number({ minimum: 1 })),
  maxAgeDays: Type.Optional(Type.Number({ minimum: 1 })),
});

// Toggle (enable/disable) request
export const ToggleBackupScheduleRequestSchema = Type.Object({
  enabled: Type.Boolean(),
});

// Params with schedule ID
export const ScheduleIdParamsSchema = Type.Object({
  id: Type.String(),
});

// Re-export
export { ErrorResponseSchema };

// Type exports
export type BackupScheduleResponse = Static<typeof BackupScheduleSchema>;
export type BackupScheduleListResponse = Static<
  typeof BackupScheduleListResponseSchema
>;
export type CreateBackupScheduleRequest = Static<
  typeof CreateBackupScheduleRequestSchema
>;
export type UpdateBackupScheduleRequest = Static<
  typeof UpdateBackupScheduleRequestSchema
>;
export type ToggleBackupScheduleRequest = Static<
  typeof ToggleBackupScheduleRequestSchema
>;
export type ScheduleIdParams = Static<typeof ScheduleIdParamsSchema>;
