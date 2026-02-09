import { Type, Static } from '@sinclair/typebox';
import { ErrorResponseSchema } from './server.js';

// Player info schema
export const PlayerInfoSchema = Type.Object({
  username: Type.String(),
  uuid: Type.String(),
  offlineUuid: Type.Optional(Type.String()),
  skinUrl: Type.Optional(Type.String()),
});

// Online players response
export const OnlinePlayersResponseSchema = Type.Object({
  online: Type.Number(),
  max: Type.Number(),
  players: Type.Array(Type.String()),
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
    Type.Literal('config'),
  ])),
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
export type OnlinePlayersResponse = Static<typeof OnlinePlayersResponseSchema>;
export type PlayerListResponse = Static<typeof PlayerListResponseSchema>;
export type WhitelistEntry = Static<typeof WhitelistEntrySchema>;
export type BannedPlayerEntry = Static<typeof BannedPlayerEntrySchema>;
export type WhitelistResponse = Static<typeof WhitelistResponseSchema>;
export type BannedPlayersResponse = Static<typeof BannedPlayersResponseSchema>;
export type AddPlayerRequest = Static<typeof AddPlayerRequestSchema>;
export type KickPlayerRequest = Static<typeof KickPlayerRequestSchema>;
export type PlayerActionResponse = Static<typeof PlayerActionResponseSchema>;
export type PlayerParams = Static<typeof PlayerParamsSchema>;
export type UsernameParams = Static<typeof UsernameParamsSchema>;
