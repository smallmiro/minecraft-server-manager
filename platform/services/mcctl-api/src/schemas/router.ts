import { Type, Static } from '@sinclair/typebox';
import { ContainerStatusSchema, HealthStatusSchema, ErrorResponseSchema } from './server.js';

// Route info schema
export const RouteInfoSchema = Type.Object({
  hostname: Type.String(),
  target: Type.String(),
  serverStatus: ContainerStatusSchema,
  serverType: Type.Optional(Type.String()),
  serverVersion: Type.Optional(Type.String()),
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
});

// Re-export error schema
export { ErrorResponseSchema };

// Type exports
export type RouteInfo = Static<typeof RouteInfoSchema>;
export type RouterDetail = Static<typeof RouterDetailSchema>;
export type AvahiInfo = Static<typeof AvahiInfoSchema>;
export type RouterStatusResponse = Static<typeof RouterStatusResponseSchema>;
