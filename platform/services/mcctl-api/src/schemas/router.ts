import { Type, Static } from '@sinclair/typebox';
import { ContainerStatusSchema, HealthStatusSchema, ErrorResponseSchema } from './server.js';
import { PlayitSummarySchema } from './playit.js';

// Route info schema
export const RouteInfoSchema = Type.Object({
  hostname: Type.String(),
  target: Type.String(),
  serverStatus: ContainerStatusSchema,
  serverType: Type.Optional(Type.String()),
  serverVersion: Type.Optional(Type.String()),
  autoScaleUp: Type.Optional(Type.Boolean()),
  autoScaleDown: Type.Optional(Type.Boolean()),
  discoveredByRouter: Type.Optional(Type.Boolean()),
});

// Auto-scale settings schema
export const RouterAutoScaleSchema = Type.Object({
  up: Type.Boolean(),
  down: Type.Boolean(),
  downAfter: Type.Optional(Type.String()),
  asleepMotd: Type.Optional(Type.String()),
});

// Resolver (host IP) schema
export const RouterResolverSchema = Type.Object({
  hostIp: Type.Optional(Type.String()),
  hostIps: Type.Array(Type.String()),
});

// Router detail schema
export const RouterDetailSchema = Type.Object({
  name: Type.String(),
  status: ContainerStatusSchema,
  health: HealthStatusSchema,
  port: Type.Number(),
  uptime: Type.Optional(Type.String()),
  uptimeSeconds: Type.Optional(Type.Number()),
  mode: Type.Optional(Type.String()),
  routes: Type.Array(RouteInfoSchema),
  image: Type.Optional(Type.String()),
  autoScale: Type.Optional(RouterAutoScaleSchema),
  resolver: Type.Optional(RouterResolverSchema),
});

// Restart response schema
export const RouterRestartResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
});

// SSE query schemas
export const RouterLogsStreamQuerySchema = Type.Object({
  // String on purpose: out-of-range / non-numeric values are clamped by the route, not rejected
  tail: Type.Optional(Type.String({ description: 'Initial log lines to replay (integer, clamped to 1-500, default 100)' })),
});

export const RouterStatusStreamQuerySchema = Type.Object({
  interval: Type.Optional(Type.Integer({ minimum: 1000, maximum: 60000, default: 5000, description: 'Poll interval in ms' })),
});

// Avahi info schema
export const AvahiInfoSchema = Type.Object({
  name: Type.String(),
  status: Type.String(),
  type: Type.String(),
});

// Response schema
export const RouterStatusResponseSchema = Type.Object({
  router: RouterDetailSchema,
  avahi: Type.Optional(AvahiInfoSchema),
  playit: Type.Optional(PlayitSummarySchema),
});

// Re-export error schema
export { ErrorResponseSchema };

// Type exports
export type RouteInfo = Static<typeof RouteInfoSchema>;
export type RouterDetail = Static<typeof RouterDetailSchema>;
export type RouterRestartResponse = Static<typeof RouterRestartResponseSchema>;
export type AvahiInfo = Static<typeof AvahiInfoSchema>;
export type RouterStatusResponse = Static<typeof RouterStatusResponseSchema>;
