import { Type, Static } from '@sinclair/typebox';

// ========================================
// World Block Stats Schemas (#531, Phase 4)
// ========================================

export const BlockCountSchema = Type.Object({
  id: Type.String(),
  count: Type.Number(),
});

export const BlockStatsResponseSchema = Type.Object({
  world: Type.String(),
  analyzedAt: Type.String(),
  durationMs: Type.Number(),
  dimensions: Type.Array(Type.String()),
  regionsScanned: Type.Number(),
  totalBlocks: Type.Number(),
  blockTypeCount: Type.Number(),
  ores: Type.Record(Type.String(), Type.Number()),
  topBlocks: Type.Array(BlockCountSchema),
});

/** Query for the analyze trigger (SSE follow mode). */
export const StatsAnalyzeQuerySchema = Type.Object({
  follow: Type.Optional(Type.Boolean()),
});

export type BlockStatsResponse = Static<typeof BlockStatsResponseSchema>;
export type StatsAnalyzeQuery = Static<typeof StatsAnalyzeQuerySchema>;
