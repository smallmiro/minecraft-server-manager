import { Type, Static } from '@sinclair/typebox';
import { DimensionSchema } from './world-info.js';

// ========================================
// World Map Schemas (#529, Phase 2 — BlueMap)
// ========================================

/** Strict world-name params for map routes (path-traversal safe). */
export const MapWorldNameParamsSchema = Type.Object({
  name: Type.String({ minLength: 1, pattern: '^[a-zA-Z0-9_-]+$' }),
});

/** Render trigger request body. */
export const MapRenderRequestSchema = Type.Object({
  dimensions: Type.Optional(Type.Array(DimensionSchema)),
  force: Type.Optional(Type.Boolean()),
});

/** Query for the render trigger (SSE follow mode). */
export const MapRenderQuerySchema = Type.Object({
  follow: Type.Optional(Type.Boolean()),
});

/** Successful render result. */
export const MapRenderResultSchema = Type.Object({
  world: Type.String(),
  maps: Type.Array(Type.String()),
  webroot: Type.String(),
  entry: Type.String(),
});

/** Current render status for a world. */
export const MapStatusResponseSchema = Type.Object({
  rendered: Type.Boolean(),
  maps: Type.Array(Type.String()),
  lastModified: Type.Optional(Type.String({ format: 'date-time' })),
});

export const MapErrorResponseSchema = Type.Object({
  error: Type.String(),
  message: Type.String(),
});

export type MapWorldNameParams = Static<typeof MapWorldNameParamsSchema>;
export type MapRenderRequest = Static<typeof MapRenderRequestSchema>;
export type MapRenderQuery = Static<typeof MapRenderQuerySchema>;
export type MapRenderResult = Static<typeof MapRenderResultSchema>;
export type MapStatusResponse = Static<typeof MapStatusResponseSchema>;
