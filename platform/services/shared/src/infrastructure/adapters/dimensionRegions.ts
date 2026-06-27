import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Dimension } from '../../domain/index.js';

/** A dimension and the resolved directory holding its region (`.mca`) files. */
export interface DimensionRegionDir {
  dimension: Dimension;
  dir: string;
}

/** True when a directory holds at least one `.mca` region file. */
export function hasRegionData(dir: string): boolean {
  try {
    return existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.mca'));
  } catch {
    return false;
  }
}

/**
 * Resolve each present dimension's region directory for a world, handling both
 * vanilla (DIM-1/DIM1) and Paper/Spigot split-folder (`<name>_nether` /
 * `<name>_the_end`) layouts. A candidate only wins if it actually contains
 * region data, so an empty split folder never shadows populated vanilla data
 * (mirrors render-map.sh's has_region_data). Single source of truth shared by
 * the structure reader (#530) and block scanner (#531).
 */
export function resolveRegionDirs(worldPath: string): DimensionRegionDir[] {
  const candidates: Record<Dimension, string[]> = {
    [Dimension.Overworld]: [join(worldPath, 'region')],
    [Dimension.Nether]: [
      join(`${worldPath}_nether`, 'DIM-1', 'region'),
      join(worldPath, 'DIM-1', 'region'),
    ],
    [Dimension.End]: [
      join(`${worldPath}_the_end`, 'DIM1', 'region'),
      join(worldPath, 'DIM1', 'region'),
    ],
  };

  const out: DimensionRegionDir[] = [];
  for (const dimension of [Dimension.Overworld, Dimension.Nether, Dimension.End]) {
    const dir = candidates[dimension].find(hasRegionData);
    if (dir) out.push({ dimension, dir });
  }
  return out;
}
