import { Type, Static } from '@sinclair/typebox';
import { ErrorResponseSchema } from './server.js';

// Player info schema
export const PlayerInfoSchema = Type.Object({
  username: Type.String(),
  uuid: Type.String(),
  offlineUuid: Type.Optional(Type.String()),
  skinUrl: Type.Optional(Type.String()),
});

// Player summary (Player.toJSON() shape from @minecraft-docker/shared) (#528)
export const PlayerSummarySchema = Type.Object({
  uuid: Type.String(),
  name: Type.String(),
  lastSeen: Type.Union([Type.String(), Type.Null()]),
  isOp: Type.Boolean(),
  isBanned: Type.Boolean(),
  isWhitelisted: Type.Boolean(),
  online: Type.Boolean(),
});

// Players roster response: online (RCON, when running) + known players
// (files, always available) merged (#528)
export const PlayerRosterResponseSchema = Type.Object({
  serverName: Type.String(),
  running: Type.Boolean(),
  online: Type.Number(),
  max: Type.Number(),
  players: Type.Array(Type.String()),
  roster: Type.Array(PlayerSummarySchema),
});

// Dashed Minecraft UUID, e.g. 069a79f4-44e9-4726-a5be-fca90e38aaf5 (#528)
const UUID_PATTERN =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

export const PlayerUuidParamsSchema = Type.Object({
  name: Type.String(),
  uuid: Type.String({ pattern: UUID_PATTERN }),
});

// `?include=stats,nbt,sessions` on the player detail route (#528, Phase
// 2/3/4). Comma-separated, only known values accepted (`stats`, `nbt`,
// `sessions`) in any order/combination — an unknown value 400s via the
// pattern below rather than being silently ignored.
export const PlayerDetailQuerySchema = Type.Object({
  include: Type.Optional(Type.String({ pattern: '^(stats|nbt|sessions)(,(stats|nbt|sessions))*$' })),
});

// PlayerStats.toJSON() shape from @minecraft-docker/shared (#528, Phase 2)
export const PlayerStatsSchema = Type.Object({
  playTimeSeconds: Type.Number(),
  deaths: Type.Number(),
  mobKills: Type.Number(),
  playerKills: Type.Number(),
  distanceMeters: Type.Number(),
  blocksMined: Type.Number(),
  itemsCrafted: Type.Number(),
  advancementsCompleted: Type.Number(),
});

// Minecraft dimension id, as returned by PlayerData/EntityPosition (#528, Phase 3)
const DimensionSchema = Type.Union([
  Type.Literal('overworld'),
  Type.Literal('nether'),
  Type.Literal('end'),
]);

// PlayerData.toJSON() shape from @minecraft-docker/shared (#528, Phase 3):
// last known position/vitals/game mode/inventory from playerdata/<uuid>.dat.
export const PlayerDataSchema = Type.Object({
  x: Type.Number(),
  y: Type.Number(),
  z: Type.Number(),
  dimension: DimensionSchema,
  health: Type.Optional(Type.Number()),
  food: Type.Optional(Type.Number()),
  xpLevel: Type.Optional(Type.Number()),
  gameMode: Type.Union([
    Type.Literal('survival'),
    Type.Literal('creative'),
    Type.Literal('adventure'),
    Type.Literal('spectator'),
  ]),
  inventory: Type.Object({
    slotsUsed: Type.Number(),
    items: Type.Array(Type.Object({ id: Type.String(), count: Type.Number() })),
  }),
});

// EntityPosition shape from @minecraft-docker/shared (#528, Phase 3): live RCON
// position, resolved only while the player is online.
export const LivePositionSchema = Type.Object({
  x: Type.Number(),
  y: Type.Number(),
  z: Type.Number(),
  dimension: Type.Optional(DimensionSchema),
});

// SessionHistory shape from @minecraft-docker/shared, serialized for JSON
// (#528, Phase 4): dates as ISO strings.
export const PlayerSessionEntrySchema = Type.Object({
  joinedAt: Type.String(),
  leftAt: Type.Union([Type.String(), Type.Null()]),
  durationSeconds: Type.Number(),
});

export const SessionHistorySchema = Type.Object({
  visitCount: Type.Number(),
  totalPlaytimeSeconds: Type.Number(),
  lastSeen: Type.Union([Type.String(), Type.Null()]),
  recent: Type.Array(PlayerSessionEntrySchema),
});

// PlayerSummarySchema + optional `stats`/`data`/`livePosition`/`sessions`,
// present only when their respective `?include` value was requested (#528,
// Phase 2/3/4).
export const PlayerDetailResponseSchema = Type.Object({
  uuid: Type.String(),
  name: Type.String(),
  lastSeen: Type.Union([Type.String(), Type.Null()]),
  isOp: Type.Boolean(),
  isBanned: Type.Boolean(),
  isWhitelisted: Type.Boolean(),
  online: Type.Boolean(),
  stats: Type.Optional(Type.Union([PlayerStatsSchema, Type.Null()])),
  data: Type.Optional(Type.Union([PlayerDataSchema, Type.Null()])),
  livePosition: Type.Optional(Type.Union([LivePositionSchema, Type.Null()])),
  sessions: Type.Optional(Type.Union([SessionHistorySchema, Type.Null()])),
});

// Whitelist entry
export const WhitelistEntrySchema = Type.Object({
  name: Type.String(),
  uuid: Type.String(),
});

// Banned player entry
export const BannedPlayerEntrySchema = Type.Object({
  name: Type.String(),
  uuid: Type.String(),
  reason: Type.String(),
  created: Type.String(),
  source: Type.String(),
  expires: Type.String(),
});

// Player list (whitelist, bans, ops)
export const PlayerListResponseSchema = Type.Object({
  players: Type.Array(Type.String()),
  total: Type.Number(),
  source: Type.Optional(Type.Union([
    Type.Literal('rcon'),
    Type.Literal('file'),
    Type.Literal('file+reload'),
    Type.Literal('config'),
  ])),
});

// Whitelist response
export const WhitelistResponseSchema = Type.Object({
  players: Type.Array(WhitelistEntrySchema),
  total: Type.Number(),
  source: Type.Optional(Type.Union([
    Type.Literal('rcon'),
    Type.Literal('file'),
    Type.Literal('file+reload'),
    Type.Literal('config'),
  ])),
  enabled: Type.Optional(Type.Boolean()),
});

// Whitelist status response
export const WhitelistStatusResponseSchema = Type.Object({
  enabled: Type.Boolean(),
  source: Type.Union([
    Type.Literal('config'),
  ]),
});

// Whitelist status request
export const WhitelistStatusRequestSchema = Type.Object({
  enabled: Type.Boolean(),
});

// Banned players response
export const BannedPlayersResponseSchema = Type.Object({
  players: Type.Array(BannedPlayerEntrySchema),
  total: Type.Number(),
  source: Type.Literal('file'),
});

// Add player request
export const AddPlayerRequestSchema = Type.Object({
  player: Type.String({ minLength: 1, maxLength: 16 }),
  reason: Type.Optional(Type.String()),
});

// Kick player request
export const KickPlayerRequestSchema = Type.Object({
  player: Type.String({ minLength: 1, maxLength: 16 }),
  reason: Type.Optional(Type.String()),
});

// Success response
export const PlayerActionResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  source: Type.Optional(Type.Union([
    Type.Literal('rcon'),
    Type.Literal('file'),
    Type.Literal('file+reload'),
    Type.Literal('config'),
  ])),
});

// Player params
export const PlayerParamsSchema = Type.Object({
  name: Type.String(),
  player: Type.String(),
});

export const UsernameParamsSchema = Type.Object({
  username: Type.String(),
});

// Re-export
export { ErrorResponseSchema };

// Type exports
export type PlayerInfo = Static<typeof PlayerInfoSchema>;
export type PlayerSummary = Static<typeof PlayerSummarySchema>;
export type PlayerRosterResponse = Static<typeof PlayerRosterResponseSchema>;
export type PlayerUuidParams = Static<typeof PlayerUuidParamsSchema>;
export type PlayerDetailQuery = Static<typeof PlayerDetailQuerySchema>;
export type PlayerStatsResponse = Static<typeof PlayerStatsSchema>;
export type PlayerDataResponse = Static<typeof PlayerDataSchema>;
export type LivePositionResponse = Static<typeof LivePositionSchema>;
export type PlayerSessionEntryResponse = Static<typeof PlayerSessionEntrySchema>;
export type SessionHistoryResponse = Static<typeof SessionHistorySchema>;
export type PlayerDetailResponse = Static<typeof PlayerDetailResponseSchema>;
export type PlayerListResponse = Static<typeof PlayerListResponseSchema>;
export type WhitelistEntry = Static<typeof WhitelistEntrySchema>;
export type BannedPlayerEntry = Static<typeof BannedPlayerEntrySchema>;
export type WhitelistResponse = Static<typeof WhitelistResponseSchema>;
export type WhitelistStatusResponse = Static<typeof WhitelistStatusResponseSchema>;
export type WhitelistStatusRequest = Static<typeof WhitelistStatusRequestSchema>;
export type BannedPlayersResponse = Static<typeof BannedPlayersResponseSchema>;
export type AddPlayerRequest = Static<typeof AddPlayerRequestSchema>;
export type KickPlayerRequest = Static<typeof KickPlayerRequestSchema>;
export type PlayerActionResponse = Static<typeof PlayerActionResponseSchema>;
export type PlayerParams = Static<typeof PlayerParamsSchema>;
export type UsernameParams = Static<typeof UsernameParamsSchema>;
