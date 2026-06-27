import { Type, Static } from '@sinclair/typebox';

// ========================================
// World Structures Schemas (#530, Phase 3)
// ========================================

/** Result of writing structure markers into the rendered map. */
export const MapMarkersResponseSchema = Type.Object({
  /** Marker count written per map id (overworld/nether/end). */
  counts: Type.Record(Type.String(), Type.Number()),
  /** Total markers actually written (sum of counts). */
  total: Type.Number(),
});

export type MapMarkersResponse = Static<typeof MapMarkersResponseSchema>;
