import { Type, Static } from '@sinclair/typebox';
import { ContainerStatusSchema, ErrorResponseSchema } from './server.js';

/**
 * Playit server info schema
 */
export const PlayitServerInfoSchema = Type.Object({
  serverName: Type.String(),
  playitDomain: Type.Union([Type.String(), Type.Null()]),
  lanHostname: Type.String(),
});

/**
 * Playit agent status schema
 */
export const PlayitAgentStatusSchema = Type.Object({
  enabled: Type.Boolean(),
  agentRunning: Type.Boolean(),
  secretKeyConfigured: Type.Boolean(),
  containerStatus: ContainerStatusSchema,
  uptime: Type.Optional(Type.String()),
  uptimeSeconds: Type.Optional(Type.Number()),
  servers: Type.Array(PlayitServerInfoSchema),
});

/**
 * Playit start/stop response schema
 */
export const PlayitActionResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
});

/**
 * Playit summary schema for router status
 */
export const PlayitSummarySchema = Type.Object({
  enabled: Type.Boolean(),
  agentRunning: Type.Boolean(),
  secretKeyConfigured: Type.Boolean(),
});

// Re-export error schema
export { ErrorResponseSchema };

// Type exports
export type PlayitServerInfo = Static<typeof PlayitServerInfoSchema>;
export type PlayitAgentStatus = Static<typeof PlayitAgentStatusSchema>;
export type PlayitActionResponse = Static<typeof PlayitActionResponseSchema>;
export type PlayitSummary = Static<typeof PlayitSummarySchema>;
