import { Type, Static } from '@sinclair/typebox';

// ========================================
// World Info Schemas (#525, Phase 1)
// ========================================

export const DimensionSchema = Type.Union([
  Type.Literal('overworld'),
  Type.Literal('nether'),
  Type.Literal('end'),
]);

export const WorldBorderSchema = Type.Object({
  size: Type.Number(),
  centerX: Type.Number(),
  centerZ: Type.Number(),
});

export const WorldLevelDataSchema = Type.Object({
  levelName: Type.String(),
  seed: Type.String(),
  spawn: Type.Object({
    x: Type.Number(),
    y: Type.Number(),
    z: Type.Number(),
  }),
  gameMode: Type.String(),
  difficulty: Type.String(),
  hardcore: Type.Boolean(),
  dayTime: Type.Number(),
  dayCount: Type.Number(),
  raining: Type.Boolean(),
  thundering: Type.Boolean(),
  versionName: Type.String(),
  dataVersion: Type.Number(),
  worldBorder: WorldBorderSchema,
  dataPacks: Type.Array(Type.String()),
  gameRules: Type.Optional(Type.Record(Type.String(), Type.String())),
});

export const DimensionPresenceSchema = Type.Object({
  overworld: Type.Boolean(),
  nether: Type.Boolean(),
  end: Type.Boolean(),
});

export const WorldInfoSchema = Type.Object({
  name: Type.String(),
  level: WorldLevelDataSchema,
  dimensions: DimensionPresenceSchema,
  sizeBytes: Type.Number(),
  regionCount: Type.Number(),
  lastModified: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
});

export const WorldInfoResponseSchema = Type.Object({
  info: WorldInfoSchema,
});

export const PlayerLocationSchema = Type.Object({
  uuid: Type.String(),
  name: Type.Optional(Type.String()),
  x: Type.Number(),
  y: Type.Number(),
  z: Type.Number(),
  dimension: DimensionSchema,
  health: Type.Optional(Type.Number()),
  food: Type.Optional(Type.Number()),
  xpLevel: Type.Optional(Type.Number()),
  online: Type.Boolean(),
});

export const PlayerLocationsResponseSchema = Type.Object({
  players: Type.Array(PlayerLocationSchema),
});

export type WorldInfoResponse = Static<typeof WorldInfoResponseSchema>;
export type PlayerLocationsResponse = Static<typeof PlayerLocationsResponseSchema>;
