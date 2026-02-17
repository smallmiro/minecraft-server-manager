import { Type, Static } from '@sinclair/typebox';

// ============================================================
// Server Configuration Schemas
// ============================================================

/**
 * Game difficulty levels
 */
export const DifficultySchema = Type.Union([
  Type.Literal('peaceful'),
  Type.Literal('easy'),
  Type.Literal('normal'),
  Type.Literal('hard'),
]);

/**
 * Game mode options
 */
export const GameModeSchema = Type.Union([
  Type.Literal('survival'),
  Type.Literal('creative'),
  Type.Literal('adventure'),
  Type.Literal('spectator'),
]);

/**
 * Server configuration values (from config.env)
 */
export const ServerConfigSchema = Type.Object({
  // Server Properties (hot-reload capable)
  motd: Type.Optional(Type.String({ description: 'Message of the day' })),
  maxPlayers: Type.Optional(Type.Number({ minimum: 1, maximum: 1000, description: 'Maximum player count' })),
  difficulty: Type.Optional(DifficultySchema),
  gameMode: Type.Optional(GameModeSchema),
  pvp: Type.Optional(Type.Boolean({ description: 'Enable PvP combat' })),
  viewDistance: Type.Optional(Type.Number({ minimum: 2, maximum: 32, description: 'View distance in chunks' })),
  spawnProtection: Type.Optional(Type.Number({ minimum: 0, maximum: 100, description: 'Spawn protection radius' })),

  // Security Settings (restart required)
  onlineMode: Type.Optional(Type.Boolean({ description: 'Require Mojang authentication (online-mode)' })),
  enableWhitelist: Type.Optional(Type.Boolean({ description: 'Enable whitelist to restrict player access' })),

  // Performance Settings (restart required)
  memory: Type.Optional(Type.String({ pattern: '^\\d+[MG]$', description: 'JVM memory allocation (e.g., 4G)' })),
  useAikarFlags: Type.Optional(Type.Boolean({ description: 'Use Aikar JVM flags for optimization' })),
});

/**
 * Request schema for updating server configuration
 */
export const UpdateServerConfigRequestSchema = Type.Object({
  // Server Properties (hot-reload capable)
  motd: Type.Optional(Type.String({ minLength: 0, maxLength: 500 })),
  maxPlayers: Type.Optional(Type.Number({ minimum: 1, maximum: 1000 })),
  difficulty: Type.Optional(DifficultySchema),
  gameMode: Type.Optional(GameModeSchema),
  pvp: Type.Optional(Type.Boolean()),
  viewDistance: Type.Optional(Type.Number({ minimum: 2, maximum: 32 })),
  spawnProtection: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),

  // Security Settings (restart required)
  onlineMode: Type.Optional(Type.Boolean()),
  enableWhitelist: Type.Optional(Type.Boolean()),

  // Performance Settings (restart required)
  memory: Type.Optional(Type.String({ pattern: '^\\d+[MG]$' })),
  useAikarFlags: Type.Optional(Type.Boolean()),
});

/**
 * Response schema for getting server configuration
 */
export const ServerConfigResponseSchema = Type.Object({
  config: ServerConfigSchema,
});

/**
 * Response schema for updating server configuration
 */
export const UpdateServerConfigResponseSchema = Type.Object({
  success: Type.Boolean(),
  config: ServerConfigSchema,
  restartRequired: Type.Boolean({ description: 'Whether server restart is needed to apply changes' }),
  changedFields: Type.Array(Type.String(), { description: 'List of fields that were changed' }),
});

/**
 * Response schema for world reset operation
 */
export const WorldResetResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  worldName: Type.String(),
});

// ============================================================
// Type Exports
// ============================================================

export type Difficulty = Static<typeof DifficultySchema>;
export type GameMode = Static<typeof GameModeSchema>;
export type ServerConfig = Static<typeof ServerConfigSchema>;
export type UpdateServerConfigRequest = Static<typeof UpdateServerConfigRequestSchema>;
export type ServerConfigResponse = Static<typeof ServerConfigResponseSchema>;
export type UpdateServerConfigResponse = Static<typeof UpdateServerConfigResponseSchema>;
export type WorldResetResponse = Static<typeof WorldResetResponseSchema>;
