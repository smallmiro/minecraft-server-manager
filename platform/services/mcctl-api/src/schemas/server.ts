import { Type, Static } from '@sinclair/typebox';

// Container and Health Status
export const ContainerStatusSchema = Type.Union([
  Type.Literal('running'),
  Type.Literal('exited'),
  Type.Literal('paused'),
  Type.Literal('restarting'),
  Type.Literal('dead'),
  Type.Literal('created'),
  Type.Literal('not_found'),
]);

export const HealthStatusSchema = Type.Union([
  Type.Literal('healthy'),
  Type.Literal('unhealthy'),
  Type.Literal('starting'),
  Type.Literal('none'),
  Type.Literal('unknown'),
]);

// Player and Stats
export const PlayerListSchema = Type.Object({
  online: Type.Number(),
  max: Type.Number(),
  players: Type.Array(Type.String()),
});

export const ContainerStatsSchema = Type.Object({
  memoryUsage: Type.Number(),
  memoryLimit: Type.Number(),
  memoryPercent: Type.Number(),
  cpuPercent: Type.Number(),
});

// Server Schemas
export const ServerSummarySchema = Type.Object({
  name: Type.String(),
  container: Type.String(),
  status: ContainerStatusSchema,
  health: HealthStatusSchema,
  hostname: Type.String(),
});

export const ServerDetailSchema = Type.Object({
  name: Type.String(),
  container: Type.String(),
  status: ContainerStatusSchema,
  health: HealthStatusSchema,
  hostname: Type.String(),
  type: Type.Optional(Type.String()),
  version: Type.Optional(Type.String()),
  memory: Type.Optional(Type.String()),
  uptime: Type.Optional(Type.String()),
  uptimeSeconds: Type.Optional(Type.Number()),
  players: Type.Optional(PlayerListSchema),
  stats: Type.Optional(ContainerStatsSchema),
  worldName: Type.Optional(Type.String()),
  worldSize: Type.Optional(Type.String()),
});

// Request Schemas
export const ExecCommandRequestSchema = Type.Object({
  command: Type.String({ minLength: 1, maxLength: 1024 }),
});

// Response Schemas
export const ServerListResponseSchema = Type.Object({
  servers: Type.Array(ServerSummarySchema),
  total: Type.Number(),
});

export const ServerDetailResponseSchema = Type.Object({
  server: ServerDetailSchema,
});

export const ExecCommandResponseSchema = Type.Object({
  success: Type.Boolean(),
  output: Type.String(),
});

export const LogsResponseSchema = Type.Object({
  logs: Type.String(),
  lines: Type.Number(),
});

export const LogsQuerySchema = Type.Object({
  lines: Type.Optional(Type.Number({ minimum: 1, maximum: 10000, default: 100 })),
});

export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
  message: Type.String(),
});

export const ServerNameParamsSchema = Type.Object({
  name: Type.String(),
});

// Type exports
export type ServerSummary = Static<typeof ServerSummarySchema>;
export type ServerDetail = Static<typeof ServerDetailSchema>;
export type ServerNameParams = Static<typeof ServerNameParamsSchema>;
export type ExecCommandRequest = Static<typeof ExecCommandRequestSchema>;
export type LogsQuery = Static<typeof LogsQuerySchema>;
