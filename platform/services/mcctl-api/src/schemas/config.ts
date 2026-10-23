import { Type, Static, type StringOptions } from '@sinclair/typebox';
import { SINGLE_LINE_RE } from '@minecraft-docker/shared/utils';

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
 * Free text written to config.env as one KEY=value line: a line break would
 * add another setting to the container's env_file (#726).
 */
const SingleLineString = (options: StringOptions) =>
  Type.String({ pattern: SINGLE_LINE_RE.source, ...options });

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
  motd: Type.Optional(SingleLineString({ maxLength: 500, description: 'Message of the day' })),
  level: Type.Optional(SingleLineString({ description: 'World save folder name' })),
  levelType: Type.Optional(LevelTypeSchema),
  seed: Type.Optional(SingleLineString({ description: 'World generation seed' })),

  // ── World (Advanced) ──
  generateStructures: Type.Optional(Type.Boolean({ description: 'Generate structures like villages' })),
  maxWorldSize: Type.Optional(Type.Number({ minimum: 1, maximum: 29999984, description: 'Maximum world radius in blocks' })),
  icon: Type.Optional(SingleLineString({ description: 'Server icon URL (64x64 PNG)' })),

  // ── Security (Essential) ──
  onlineMode: Type.Optional(Type.Boolean({ description: 'Require Mojang authentication' })),
  enableWhitelist: Type.Optional(Type.Boolean({ description: 'Enable whitelist' })),

  // ── Security (Advanced) ──
  enforceWhitelist: Type.Optional(Type.Boolean({ description: 'Kick non-whitelisted players already online' })),
  enforceSecureProfile: Type.Optional(Type.Boolean({ description: 'Require signed chat messages' })),

  // ── Performance & JVM (Essential) ──
  memory: Type.Optional(Type.String({ pattern: '^\\d+[MG]$', description: 'JVM heap memory (e.g., 4G)' })),
  useAikarFlags: Type.Optional(Type.Boolean({ description: 'Use Aikar JVM flags for optimization' })),
  viewDistance: Type.Optional(Type.Number({ minimum: 2, maximum: 32, description: 'View distance in chunks' })),

  // ── Performance & JVM (Advanced) ──
  simulationDistance: Type.Optional(Type.Number({ minimum: 3, maximum: 32, description: 'Simulation distance in chunks' })),
  maxTickTime: Type.Optional(Type.Number({ minimum: -1, description: 'Max tick time ms (-1 to disable watchdog)' })),
  initMemory: Type.Optional(SingleLineString({ description: 'Initial JVM heap size (e.g., 2G)' })),
  maxMemory: Type.Optional(SingleLineString({ description: 'Maximum JVM heap size (e.g., 8G)' })),
  jvmXxOpts: Type.Optional(SingleLineString({ description: 'Additional -XX JVM options' })),

  // ── Auto-pause / Auto-stop (Essential) ──
  enableAutopause: Type.Optional(Type.Boolean({ description: 'Pause server when no players connected' })),
  autopauseTimeoutEst: Type.Optional(Type.Number({ minimum: 0, description: 'Seconds to wait after last player leaves' })),

  // ── Auto-pause / Auto-stop (Advanced) ──
  autopauseTimeoutInit: Type.Optional(Type.Number({ minimum: 0, description: 'Seconds after start without connections' })),
  autopausePeriod: Type.Optional(Type.Number({ minimum: 1, description: 'Status check interval in seconds' })),
  enableAutostop: Type.Optional(Type.Boolean({ description: 'Stop container when no players connected' })),
  autostopTimeoutEst: Type.Optional(Type.Number({ minimum: 0, description: 'Seconds to wait before autostop' })),

  // ── Native Auto-pause (MC 1.21.2+) ──
  pauseWhenEmptySeconds: Type.Optional(Type.Number({ minimum: 0, description: 'Native pause: seconds to wait before pausing when empty (MC 1.21.2+)' })),

  // ── System (Essential) ──
  tz: Type.Optional(SingleLineString({ description: 'Timezone (e.g., Asia/Seoul)' })),
  resourcePack: Type.Optional(SingleLineString({ description: 'Resource pack download URL' })),
  enableRcon: Type.Optional(Type.Boolean({ description: 'Enable RCON remote console' })),

  // ── System (Advanced) ──
  resourcePackSha1: Type.Optional(SingleLineString({ description: 'Resource pack SHA1 checksum' })),
  resourcePackEnforce: Type.Optional(Type.Boolean({ description: 'Kick players who decline resource pack' })),
  resourcePackPrompt: Type.Optional(SingleLineString({ description: 'Custom prompt message for resource pack' })),
  rconPassword: Type.Optional(SingleLineString({ description: 'RCON password' })),
  rconPort: Type.Optional(Type.Number({ minimum: 1024, maximum: 65535, description: 'RCON port' })),
  stopDuration: Type.Optional(Type.Number({ minimum: 0, description: 'Graceful stop timeout in seconds' })),
  uid: Type.Optional(Type.Number({ minimum: 0, description: 'Container user ID' })),
  gid: Type.Optional(Type.Number({ minimum: 0, description: 'Container group ID' })),

  // ── Remote Access ──
  websocketConsole: Type.Optional(Type.Boolean({ description: 'Enable WebSocket console' })),
  websocketAddress: Type.Optional(SingleLineString({ description: 'WebSocket bind address (e.g., 0.0.0.0:80)' })),
  websocketPassword: Type.Optional(SingleLineString({ description: 'WebSocket password (uses RCON password if unset)' })),
  websocketDisableAuthentication: Type.Optional(Type.Boolean({ description: 'Disable WebSocket authentication' })),
  websocketAllowedOrigins: Type.Optional(SingleLineString({ description: 'Allowed origins for WebSocket (comma-separated)' })),
  websocketLogBufferSize: Type.Optional(Type.Number({ minimum: 1, description: 'WebSocket log history buffer size' })),
  enableSsh: Type.Optional(Type.Boolean({ description: 'Enable SSH console (port 2222)' })),
  // ── Configuration Repositories ──
  paperConfigRepo: Type.Optional(SingleLineString({ description: 'Paper optimized config repository URL' })),
  pufferfishConfigRepo: Type.Optional(SingleLineString({ description: 'Pufferfish config repository URL' })),
  purpurConfigRepo: Type.Optional(SingleLineString({ description: 'Purpur config repository URL' })),
  serverPropertiesRepoUrl: Type.Optional(SingleLineString({ description: 'Base server.properties repository URL' })),
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
