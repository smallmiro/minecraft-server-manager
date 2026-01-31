import { Type, Static } from '@sinclair/typebox';
import { ErrorResponseSchema } from './server.js';

// Backup status response
export const BackupStatusResponseSchema = Type.Object({
  configured: Type.Boolean(),
  repository: Type.Optional(Type.String()),
  branch: Type.Optional(Type.String()),
  lastBackup: Type.Optional(Type.String()),
});

// Backup push request
export const BackupPushRequestSchema = Type.Object({
  message: Type.Optional(Type.String()),
});

// Backup push response
export const BackupPushResponseSchema = Type.Object({
  success: Type.Boolean(),
  commitHash: Type.Optional(Type.String()),
  message: Type.String(),
});

// Backup commit info
export const BackupCommitSchema = Type.Object({
  hash: Type.String(),
  message: Type.String(),
  date: Type.String(),
  author: Type.Optional(Type.String()),
});

// Backup history response
export const BackupHistoryResponseSchema = Type.Object({
  commits: Type.Array(BackupCommitSchema),
  total: Type.Number(),
});

// Backup restore request
export const BackupRestoreRequestSchema = Type.Object({
  commitHash: Type.String({ minLength: 7 }),
});

// Backup restore response
export const BackupRestoreResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
});

// Re-export
export { ErrorResponseSchema };

// Type exports
export type BackupStatusResponse = Static<typeof BackupStatusResponseSchema>;
export type BackupPushRequest = Static<typeof BackupPushRequestSchema>;
export type BackupPushResponse = Static<typeof BackupPushResponseSchema>;
export type BackupCommit = Static<typeof BackupCommitSchema>;
export type BackupHistoryResponse = Static<typeof BackupHistoryResponseSchema>;
export type BackupRestoreRequest = Static<typeof BackupRestoreRequestSchema>;
export type BackupRestoreResponse = Static<typeof BackupRestoreResponseSchema>;
