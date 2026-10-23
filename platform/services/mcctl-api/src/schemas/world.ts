import { Type, Static } from '@sinclair/typebox';
import { WORLD_NAME_PATTERN } from '@minecraft-docker/shared';
import { ENV_FILE_VALUE_RE } from '@minecraft-docker/shared/utils';
import { ExistingServerNameSchema } from './server.js';

// ========================================
// World Schemas
// ========================================

/**
 * World summary for list responses
 */
export const WorldSummarySchema = Type.Object({
  name: Type.String(),
  path: Type.String(),
  isLocked: Type.Boolean(),
  lockedBy: Type.Optional(Type.String()),
  size: Type.String(),
  lastModified: Type.Optional(Type.String({ format: 'date-time' })),
  servers: Type.Array(Type.String()),
  dimensions: Type.Optional(Type.Object({
    nether: Type.Boolean(),
    end: Type.Boolean(),
  })),
});

/**
 * World detail response
 */
export const WorldDetailSchema = Type.Object({
  name: Type.String(),
  path: Type.String(),
  isLocked: Type.Boolean(),
  lockedBy: Type.Optional(Type.String()),
  size: Type.String(),
  lastModified: Type.Optional(Type.String({ format: 'date-time' })),
  servers: Type.Array(Type.String()),
  dimensions: Type.Optional(Type.Object({
    nether: Type.Boolean(),
    end: Type.Boolean(),
  })),
});

// ========================================
// Request Schemas
// ========================================

/**
 * Name of a world that already exists (#720). Hand-made folders (e.g. a
 * legacy LEVEL like "My World") stay reachable; only names that are not one
 * safe path segment are rejected: path separators, control characters, and a
 * leading '.' ('.', '..', hidden dirs). A leading '-' is allowed like in
 * WORLD_NAME_PATTERN: scripts only take the name as a positional argument.
 */
const EXISTING_WORLD_NAME_PATTERN = /^[^./\\\x00-\x1f\x7f][^/\\\x00-\x1f\x7f]*$/;

/**
 * World name path parameter
 */
export const WorldNameParamsSchema = Type.Object({
  name: Type.String({ pattern: EXISTING_WORLD_NAME_PATTERN.source, description: 'World name' }),
});

/**
 * Create world request body
 */
export const CreateWorldRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, pattern: WORLD_NAME_PATTERN.source }),
  // Written to the server's config.env as SEED=<seed> (#726)
  seed: Type.Optional(Type.String({ pattern: ENV_FILE_VALUE_RE.source })),
  serverName: Type.Optional(ExistingServerNameSchema),
  autoStart: Type.Optional(Type.Boolean({ default: false })),
});

/**
 * Assign world request body
 */
export const AssignWorldRequestSchema = Type.Object({
  serverName: ExistingServerNameSchema,
});

/**
 * Delete world query parameters
 */
export const DeleteWorldQuerySchema = Type.Object({
  force: Type.Optional(Type.Boolean({ default: false })),
});

/**
 * Upload world query parameters (multipart route)
 */
export const UploadWorldQuerySchema = Type.Object({
  name: Type.String({ minLength: 1, pattern: WORLD_NAME_PATTERN.source }),
  seed: Type.Optional(Type.String()),
});

/**
 * Release world query parameters
 */
export const ReleaseWorldQuerySchema = Type.Object({
  force: Type.Optional(Type.Boolean({ default: false })),
});

// ========================================
// Response Schemas
// ========================================

/**
 * World list response
 */
export const WorldListResponseSchema = Type.Object({
  worlds: Type.Array(WorldSummarySchema),
  total: Type.Number(),
});

/**
 * World detail response
 */
export const WorldDetailResponseSchema = Type.Object({
  world: WorldDetailSchema,
});

/**
 * Create world response
 */
export const CreateWorldResponseSchema = Type.Object({
  success: Type.Boolean(),
  worldName: Type.String(),
  seed: Type.Optional(Type.String()),
  serverName: Type.Optional(Type.String()),
  started: Type.Optional(Type.Boolean()),
  error: Type.Optional(Type.String()),
});

/**
 * Assign world response
 */
export const AssignWorldResponseSchema = Type.Object({
  success: Type.Boolean(),
  worldName: Type.String(),
  serverName: Type.String(),
  error: Type.Optional(Type.String()),
});

/**
 * Release world response
 */
export const ReleaseWorldResponseSchema = Type.Object({
  success: Type.Boolean(),
  worldName: Type.String(),
  previousServer: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
});

/**
 * Delete world response
 */
export const DeleteWorldResponseSchema = Type.Object({
  success: Type.Boolean(),
  worldName: Type.String(),
  size: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
});

/**
 * Error response
 */
export const WorldErrorResponseSchema = Type.Object({
  error: Type.String(),
  message: Type.String(),
});

// ========================================
// Type Exports
// ========================================

export type WorldSummary = Static<typeof WorldSummarySchema>;
export type WorldDetail = Static<typeof WorldDetailSchema>;
export type WorldNameParams = Static<typeof WorldNameParamsSchema>;
export type CreateWorldRequest = Static<typeof CreateWorldRequestSchema>;
export type AssignWorldRequest = Static<typeof AssignWorldRequestSchema>;
export type DeleteWorldQuery = Static<typeof DeleteWorldQuerySchema>;
export type ReleaseWorldQuery = Static<typeof ReleaseWorldQuerySchema>;
export type UploadWorldQuery = Static<typeof UploadWorldQuerySchema>;
export type WorldListResponse = Static<typeof WorldListResponseSchema>;
export type WorldDetailResponse = Static<typeof WorldDetailResponseSchema>;
export type CreateWorldResponse = Static<typeof CreateWorldResponseSchema>;
export type AssignWorldResponse = Static<typeof AssignWorldResponseSchema>;
export type ReleaseWorldResponse = Static<typeof ReleaseWorldResponseSchema>;
export type DeleteWorldResponse = Static<typeof DeleteWorldResponseSchema>;
