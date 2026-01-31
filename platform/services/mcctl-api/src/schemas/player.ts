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

// Player list (whitelist, bans, ops)
export const PlayerListResponseSchema = Type.Object({
  players: Type.Array(Type.String()),
  total: Type.Number(),
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
export type AddPlayerRequest = Static<typeof AddPlayerRequestSchema>;
export type KickPlayerRequest = Static<typeof KickPlayerRequestSchema>;
export type PlayerActionResponse = Static<typeof PlayerActionResponseSchema>;
export type PlayerParams = Static<typeof PlayerParamsSchema>;
export type UsernameParams = Static<typeof UsernameParamsSchema>;
