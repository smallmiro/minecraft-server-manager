import { Type, Static } from '@sinclair/typebox';
import {
  SERVER_NAME_PATTERN,
  SERVER_NAME_MIN_LENGTH,
  SERVER_NAME_MAX_LENGTH,
  EXISTING_SERVER_NAME_PATTERN,
  WORLD_NAME_PATTERN,
} from '@minecraft-docker/shared';

// Container and Health Status
export const ContainerStatusSchema = Type.Union([
  Type.Literal('running'),
  Type.Literal('exited'),
  Type.Literal('paused'),
  Type.Literal('restarting'),
  Type.Literal('dead'),
  Type.Literal('created'),
  Type.Literal('not_found'),
  Type.Literal('not_created'),
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
  playitDomain: Type.Optional(Type.Union([Type.String(), Type.Null()])),
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
  follow: Type.Optional(Type.Boolean({ default: false, description: 'Enable SSE streaming for real-time logs' })),
});

// Status SSE Schemas (for real-time status streaming)
export const StatusQuerySchema = Type.Object({
  follow: Type.Optional(Type.Boolean({ default: false, description: 'Enable SSE streaming for real-time status updates' })),
  interval: Type.Optional(Type.Number({
    minimum: 1000,
    maximum: 60000,
    default: 5000,
    description: 'Polling interval in milliseconds (SSE mode only)',
  })),
});

// Status values compatible with frontend ServerStatusEvent
export const SSEStatusSchema = Type.Union([
  Type.Literal('running'),
  Type.Literal('stopped'),
  Type.Literal('created'),
  Type.Literal('exited'),
  Type.Literal('unknown'),
]);

export const SSEHealthSchema = Type.Union([
  Type.Literal('healthy'),
  Type.Literal('unhealthy'),
  Type.Literal('starting'),
  Type.Literal('none'),
  Type.Literal('unknown'),
]);

export const StatusResponseSchema = Type.Object({
  serverName: Type.String(),
  status: SSEStatusSchema,
  health: SSEHealthSchema,
  timestamp: Type.String({ format: 'date-time', description: 'ISO 8601 timestamp' }),
});

export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
  message: Type.String(),
});

/**
 * Name of a server that already exists (#649). Names that predate the strict
 * rule stay reachable; only path/shell-unsafe names are rejected.
 */
export const ExistingServerNameSchema = Type.String({
  pattern: EXISTING_SERVER_NAME_PATTERN.source,
  description: 'Server name',
});

export const ServerNameParamsSchema = Type.Object({
  name: ExistingServerNameSchema,
});

/**
 * create-server.sh writes these values into config.env as KEY=value lines,
 * so a line break would add another setting (#720).
 */
const SINGLE_LINE_PATTERN = '^[^\\x00-\\x1f\\x7f]*$';

// Create Server Request Schema
export const CreateServerRequestSchema = Type.Object({
  name: Type.String({
    minLength: SERVER_NAME_MIN_LENGTH,
    maxLength: SERVER_NAME_MAX_LENGTH,
    pattern: SERVER_NAME_PATTERN.source,
  }),
  type: Type.Optional(Type.Union([
    Type.Literal('PAPER'),
    Type.Literal('VANILLA'),
    Type.Literal('FORGE'),
    Type.Literal('FABRIC'),
    Type.Literal('SPIGOT'),
    Type.Literal('NEOFORGE'),
    Type.Literal('MODRINTH'),
    Type.Literal('AUTO_CURSEFORGE'),
  ])),
  version: Type.Optional(Type.String({
    // Minecraft version (1.21.1, LATEST, 24w14a, 1.20.5-rc1); also a sed
    // replacement in create-server.sh, so no '/', '&' or '\\'.
    pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$',
    maxLength: 64,
  })),
  memory: Type.Optional(Type.String({ pattern: '^\\d+[MG]$' })),
  seed: Type.Optional(Type.String({ pattern: SINGLE_LINE_PATTERN, maxLength: 256 })),
  worldUrl: Type.Optional(Type.String({ format: 'uri' })),
  worldName: Type.Optional(Type.String({ pattern: WORLD_NAME_PATTERN.source })),
  autoStart: Type.Optional(Type.Boolean({ default: true })),
  sudoPassword: Type.Optional(Type.String({ writeOnly: true })),
  modpack: Type.Optional(Type.String({
    // Restrict to Modrinth slug/ID/URL characters. Excludes shell
    // metacharacters (quotes, ;, spaces, $, backticks, etc.) to harden the
    // non-SSE create path that interpolates args into a shell command.
    pattern: '^[A-Za-z0-9_./:-]+$',
    description: 'Modrinth modpack slug, ID, or URL (required for MODRINTH/AUTO_CURSEFORGE)',
  })),
  modpackVersion: Type.Optional(Type.String({
    // Modrinth version numbers are free-form ("Release 5 (beta)")
    pattern: SINGLE_LINE_PATTERN,
    maxLength: 128,
    description: 'Specific modpack version ID',
  })),
  modLoader: Type.Optional(Type.Union([
    Type.Literal('forge'),
    Type.Literal('fabric'),
    Type.Literal('neoforge'),
    Type.Literal('quilt'),
  ], { description: 'Mod loader override' })),
  excludeFiles: Type.Optional(Type.Array(
    Type.String({
      // Partial file names (Modrinth) or project IDs/slugs (CurseForge).
      // Restricted to safe characters to harden the non-SSE create path that
      // interpolates args into a shell command. No commas (the join delimiter),
      // quotes, spaces, or other shell metacharacters allowed.
      pattern: '^[A-Za-z0-9_.-]+$',
      minLength: 1,
    }),
    {
      maxItems: 100,
      description: 'Mods to exclude from the modpack (e.g. client-only mods that crash a dedicated server). Maps to MODRINTH_EXCLUDE_FILES / CF_EXCLUDE_MODS.',
    }
  )),
});

// Create Server Query Schema (for SSE streaming support)
export const CreateServerQuerySchema = Type.Object({
  follow: Type.Optional(Type.Boolean({ default: false, description: 'Enable SSE streaming for real-time creation progress' })),
});

// Create Server Response Schema
export const CreateServerResponseSchema = Type.Object({
  success: Type.Boolean(),
  server: Type.Object({
    name: Type.String(),
    container: Type.String(),
    status: Type.String(),
  }),
});

// Delete Server Response Schema
export const DeleteServerResponseSchema = Type.Object({
  success: Type.Boolean(),
  server: Type.String(),
  message: Type.String(),
});

// Delete Server Query Schema
export const DeleteServerQuerySchema = Type.Object({
  force: Type.Optional(Type.Boolean({ default: false })),
});

// Type exports
export type ServerSummary = Static<typeof ServerSummarySchema>;
export type ServerDetail = Static<typeof ServerDetailSchema>;
export type ServerNameParams = Static<typeof ServerNameParamsSchema>;
export type ExecCommandRequest = Static<typeof ExecCommandRequestSchema>;
export type LogsQuery = Static<typeof LogsQuerySchema>;
export type StatusQuery = Static<typeof StatusQuerySchema>;
export type StatusResponse = Static<typeof StatusResponseSchema>;
export type CreateServerRequest = Static<typeof CreateServerRequestSchema>;
export type CreateServerQuery = Static<typeof CreateServerQuerySchema>;
export type DeleteServerQuery = Static<typeof DeleteServerQuerySchema>;
