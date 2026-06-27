/**
 * Block / ore statistics for a world (#531, Phase 4).
 *
 * Produced by a full region scan (every chunk's section block-state palette is
 * decoded and counted). This is expensive on large worlds, so it is a batch
 * (pre-computed) analysis rather than a live query.
 */

/** A single block id and its count. */
export interface BlockCount {
  id: string;
  count: number;
}

/** Aggregated, cached result of a world block-stats analysis. */
export interface BlockStatsResult {
  /** World that was analyzed. */
  world: string;
  /** ISO timestamp of when the analysis completed. */
  analyzedAt: string;
  /** Wall-clock duration of the scan in milliseconds. */
  durationMs: number;
  /** Dimensions that were scanned (`overworld` | `nether` | `end`). */
  dimensions: string[];
  /** Region files scanned across all dimensions. */
  regionsScanned: number;
  /** Total non-air blocks counted. */
  totalBlocks: number;
  /** Number of distinct non-air block types. */
  blockTypeCount: number;
  /** Ore block id → count (includes modded `*_ore` and ancient debris). */
  ores: Record<string, number>;
  /** Most common non-air blocks, descending. */
  topBlocks: BlockCount[];
}

const AIR_BLOCKS = new Set([
  'minecraft:air',
  'minecraft:cave_air',
  'minecraft:void_air',
]);

/** True for air variants, which are excluded from totals/top blocks. */
export function isAir(id: string): boolean {
  return AIR_BLOCKS.has(id);
}

/** True for ore blocks (vanilla + modded `*_ore`, plus ancient debris). */
export function isOre(id: string): boolean {
  const name = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
  return name.endsWith('_ore') || name === 'ancient_debris';
}

/**
 * Aggregate raw block id → count data into the summary shape: total non-air
 * blocks, distinct type count, ore breakdown, and the top-N non-air blocks.
 */
export function aggregateBlockCounts(
  counts: Record<string, number> | Map<string, number>,
  topN = 20
): Pick<BlockStatsResult, 'totalBlocks' | 'blockTypeCount' | 'ores' | 'topBlocks'> {
  const entries: [string, number][] =
    counts instanceof Map ? [...counts.entries()] : Object.entries(counts);

  let totalBlocks = 0;
  let blockTypeCount = 0;
  const ores: Record<string, number> = {};
  const nonAir: BlockCount[] = [];

  for (const [id, count] of entries) {
    if (count <= 0 || isAir(id)) continue;
    totalBlocks += count;
    blockTypeCount += 1;
    nonAir.push({ id, count });
    if (isOre(id)) ores[id] = count;
  }

  nonAir.sort((a, b) => b.count - a.count);

  return {
    totalBlocks,
    blockTypeCount,
    ores,
    topBlocks: nonAir.slice(0, topN),
  };
}
