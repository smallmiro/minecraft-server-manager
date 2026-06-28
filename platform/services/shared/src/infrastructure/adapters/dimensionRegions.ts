import { existsSync, readdirSync, statSync } from 'node:fs';
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

/** Newest `.mca` modification time (epoch ms) in a dir, or 0 if none/missing. */
function newestRegionMtime(dir: string): number {
  try {
    let newest = 0;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.mca')) continue;
      const m = statSync(join(dir, f)).mtimeMs;
      if (m > newest) newest = m;
    }
    return newest;
  } catch {
    return 0;
  }
}

/**
 * Choose the active region directory among layout candidates. When more than
 * one candidate holds region data — e.g. a world migrated from Paper (split
 * folders) to a single-folder server type leaves a stale satellite behind —
 * pick whichever was written most recently, i.e. the layout the server is
 * actually using. Ties keep the earlier candidate (the split satellite),
 * matching render-map.sh's behavior. Returns undefined when none have data.
 */
function pickRegionDir(candidates: string[]): string | undefined {
  const withData = candidates.filter(hasRegionData);
  if (withData.length <= 1) return withData[0];
  let best = withData[0]!;
  let bestMtime = newestRegionMtime(best);
  for (const dir of withData.slice(1)) {
    const m = newestRegionMtime(dir);
    if (m > bestMtime) {
      best = dir;
      bestMtime = m;
    }
  }
  return best;
}

/**
 * Resolve each present dimension's region directory for a world, handling both
 * vanilla (DIM-1/DIM1) and Paper/Spigot split-folder (`<name>_nether` /
 * `<name>_the_end`) layouts. A candidate only wins if it actually contains
 * region data; when both layouts hold data the more recently written one is
 * chosen, so a stale split satellite never shadows the active single-folder
 * data (mirrors render-map.sh). Single source of truth shared by the structure
 * reader (#530) and block scanner (#531).
 */
export function resolveRegionDirs(worldPath: string): DimensionRegionDir[] {
  // Layout candidates per dimension, oldest-style first. The last entry is the
  // `dimensions/minecraft/<dim>/region` layout used by latest Minecraft, where
  // every dimension (overworld included) lives under `dimensions/` (#546).
  const candidates: Record<Dimension, string[]> = {
    [Dimension.Overworld]: [
      join(worldPath, 'region'),
      join(worldPath, 'dimensions', 'minecraft', 'overworld', 'region'),
    ],
    [Dimension.Nether]: [
      join(`${worldPath}_nether`, 'DIM-1', 'region'),
      join(worldPath, 'DIM-1', 'region'),
      join(worldPath, 'dimensions', 'minecraft', 'the_nether', 'region'),
    ],
    [Dimension.End]: [
      join(`${worldPath}_the_end`, 'DIM1', 'region'),
      join(worldPath, 'DIM1', 'region'),
      join(worldPath, 'dimensions', 'minecraft', 'the_end', 'region'),
    ],
  };

  const out: DimensionRegionDir[] = [];
  for (const dimension of [Dimension.Overworld, Dimension.Nether, Dimension.End]) {
    const dir = pickRegionDir(candidates[dimension]);
    if (dir) out.push({ dimension, dir });
  }
  return out;
}
