import { Type, Static } from '@sinclair/typebox';

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
});

// ========================================
// Request Schemas
// ========================================

/**
 * World name path parameter
 */
export const WorldNameParamsSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
});

/**
 * Create world request body
 */
export const CreateWorldRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, pattern: '^[a-zA-Z0-9_-]+$' }),
  seed: Type.Optional(Type.String()),
  serverName: Type.Optional(Type.String()),
  autoStart: Type.Optional(Type.Boolean({ default: false })),
});

/**
 * Assign world request body
 */
export const AssignWorldRequestSchema = Type.Object({
  serverName: Type.String({ minLength: 1 }),
});

/**
 * Delete world query parameters
 */
export const DeleteWorldQuerySchema = Type.Object({
  force: Type.Optional(Type.Boolean({ default: false })),
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
export type WorldListResponse = Static<typeof WorldListResponseSchema>;
export type WorldDetailResponse = Static<typeof WorldDetailResponseSchema>;
export type CreateWorldResponse = Static<typeof CreateWorldResponseSchema>;
export type AssignWorldResponse = Static<typeof AssignWorldResponseSchema>;
export type ReleaseWorldResponse = Static<typeof ReleaseWorldResponseSchema>;
export type DeleteWorldResponse = Static<typeof DeleteWorldResponseSchema>;
