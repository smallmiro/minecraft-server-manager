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
 * Level type options
 */
export const LevelTypeSchema = Type.Union([
  Type.Literal('default'),
  Type.Literal('flat'),
  Type.Literal('largeBiomes'),
  Type.Literal('amplified'),
  Type.Literal('buffet'),
]);

/**
 * Server configuration values (from config.env)
 */
export const ServerConfigSchema = Type.Object({
  // ── Gameplay (Essential) ──
  difficulty: Type.Optional(DifficultySchema),
  gameMode: Type.Optional(GameModeSchema),
  maxPlayers: Type.Optional(Type.Number({ minimum: 1, maximum: 1000, description: 'Maximum player count' })),
  pvp: Type.Optional(Type.Boolean({ description: 'Enable PvP combat' })),

  // ── Gameplay (Advanced) ──
  forceGamemode: Type.Optional(Type.Boolean({ description: 'Force game mode on player join' })),
  hardcore: Type.Optional(Type.Boolean({ description: 'Enable hardcore mode (one life)' })),
  allowFlight: Type.Optional(Type.Boolean({ description: 'Allow flight in survival mode' })),
  allowNether: Type.Optional(Type.Boolean({ description: 'Allow Nether portal access' })),
  enableCommandBlock: Type.Optional(Type.Boolean({ description: 'Enable command blocks' })),
  spawnProtection: Type.Optional(Type.Number({ minimum: 0, maximum: 256, description: 'Spawn protection radius' })),
  spawnAnimals: Type.Optional(Type.Boolean({ description: 'Spawn passive mobs' })),
  spawnMonsters: Type.Optional(Type.Boolean({ description: 'Spawn hostile mobs' })),
  spawnNpcs: Type.Optional(Type.Boolean({ description: 'Spawn villagers and NPCs' })),

  // ── World (Essential) ──
  motd: Type.Optional(Type.String({ description: 'Message of the day' })),
  level: Type.Optional(Type.String({ description: 'World save folder name' })),
  levelType: Type.Optional(LevelTypeSchema),
  seed: Type.Optional(Type.String({ description: 'World generation seed' })),

  // ── World (Advanced) ──
  generateStructures: Type.Optional(Type.Boolean({ description: 'Generate structures like villages' })),
  maxWorldSize: Type.Optional(Type.Number({ minimum: 1, maximum: 29999984, description: 'Maximum world radius in blocks' })),
  icon: Type.Optional(Type.String({ description: 'Server icon URL (64x64 PNG)' })),

  // ── Security (Essential) ──
  onlineMode: Type.Optional(Type.Boolean({ description: 'Require Mojang authentication' })),
  enableWhitelist: Type.Optional(Type.Boolean({ description: 'Enable whitelist' })),

  // ── Security (Advanced) ──
  enforceWhitelist: Type.Optional(Type.Boolean({ description: 'Kick non-whitelisted players already online' })),
  enforceSecureProfile: Type.Optional(Type.Boolean({ description: 'Require signed chat messages' })),

  // ── Performance & JVM (Essential) ──
  memory: Type.Optional(Type.String({ description: 'JVM heap memory (e.g., 4G)' })),
  useAikarFlags: Type.Optional(Type.Boolean({ description: 'Use Aikar JVM flags for optimization' })),
  viewDistance: Type.Optional(Type.Number({ minimum: 2, maximum: 32, description: 'View distance in chunks' })),

  // ── Performance & JVM (Advanced) ──
  simulationDistance: Type.Optional(Type.Number({ minimum: 3, maximum: 32, description: 'Simulation distance in chunks' })),
  maxTickTime: Type.Optional(Type.Number({ minimum: -1, description: 'Max tick time ms (-1 to disable watchdog)' })),
  initMemory: Type.Optional(Type.String({ description: 'Initial JVM heap size (e.g., 2G)' })),
  maxMemory: Type.Optional(Type.String({ description: 'Maximum JVM heap size (e.g., 8G)' })),
  jvmXxOpts: Type.Optional(Type.String({ description: 'Additional -XX JVM options' })),

  // ── Auto-pause / Auto-stop (Essential) ──
  enableAutopause: Type.Optional(Type.Boolean({ description: 'Pause server when no players connected' })),
  autopauseTimeoutEst: Type.Optional(Type.Number({ minimum: 0, description: 'Seconds to wait after last player leaves' })),

  // ── Auto-pause / Auto-stop (Advanced) ──
  autopauseTimeoutInit: Type.Optional(Type.Number({ minimum: 0, description: 'Seconds after start without connections' })),
  autopausePeriod: Type.Optional(Type.Number({ minimum: 1, description: 'Status check interval in seconds' })),
  enableAutostop: Type.Optional(Type.Boolean({ description: 'Stop container when no players connected' })),
  autostopTimeoutEst: Type.Optional(Type.Number({ minimum: 0, description: 'Seconds to wait before autostop' })),

  // ── System (Essential) ──
  tz: Type.Optional(Type.String({ description: 'Timezone (e.g., Asia/Seoul)' })),
  resourcePack: Type.Optional(Type.String({ description: 'Resource pack download URL' })),
  enableRcon: Type.Optional(Type.Boolean({ description: 'Enable RCON remote console' })),

  // ── System (Advanced) ──
  resourcePackSha1: Type.Optional(Type.String({ description: 'Resource pack SHA1 checksum' })),
  resourcePackEnforce: Type.Optional(Type.Boolean({ description: 'Kick players who decline resource pack' })),
  resourcePackPrompt: Type.Optional(Type.String({ description: 'Custom prompt message for resource pack' })),
  rconPassword: Type.Optional(Type.String({ description: 'RCON password' })),
  rconPort: Type.Optional(Type.Number({ minimum: 1024, maximum: 65535, description: 'RCON port' })),
  stopDuration: Type.Optional(Type.Number({ minimum: 0, description: 'Graceful stop timeout in seconds' })),
  uid: Type.Optional(Type.Number({ minimum: 0, description: 'Container user ID' })),
  gid: Type.Optional(Type.Number({ minimum: 0, description: 'Container group ID' })),
});

/**
 * Request schema for updating server configuration
 * Same fields as ServerConfig (all optional for partial updates)
 */
export const UpdateServerConfigRequestSchema = ServerConfigSchema;

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
export type LevelType = Static<typeof LevelTypeSchema>;
export type ServerConfig = Static<typeof ServerConfigSchema>;
export type UpdateServerConfigRequest = Static<typeof UpdateServerConfigRequestSchema>;
export type ServerConfigResponse = Static<typeof ServerConfigResponseSchema>;
export type UpdateServerConfigResponse = Static<typeof UpdateServerConfigResponseSchema>;
export type WorldResetResponse = Static<typeof WorldResetResponseSchema>;
