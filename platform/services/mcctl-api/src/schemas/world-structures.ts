import { Type, Static } from '@sinclair/typebox';
import { DimensionSchema } from './world-info.js';

// ========================================
// World Structures Schemas (#530, Phase 3)
// ========================================

export const StructureSchema = Type.Object({
  id: Type.String(),
  category: Type.String(),
  label: Type.String(),
  x: Type.Number(),
  y: Type.Number(),
  z: Type.Number(),
  dimension: DimensionSchema,
});

export const StructuresResponseSchema = Type.Object({
  structures: Type.Array(StructureSchema),
  total: Type.Number(),
});

/** Result of writing structure markers into the rendered map. */
export const MapMarkersResponseSchema = Type.Object({
  /** Marker count written per map id (overworld/nether/end). */
  counts: Type.Record(Type.String(), Type.Number()),
  total: Type.Number(),
});

export type Structure = Static<typeof StructureSchema>;
export type StructuresResponse = Static<typeof StructuresResponseSchema>;
export type MapMarkersResponse = Static<typeof MapMarkersResponseSchema>;
