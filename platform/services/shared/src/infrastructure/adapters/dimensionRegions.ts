import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Dimension } from '../../domain/index.js';

/** A dimension and the resolved directory holding its region (`.mca`) files. */
export interface DimensionRegionDir {
  dimension: Dimension;
  dir: string;
  /**
   * World-save root that holds {@link dir}: the world itself, or a Paper
   * satellite (`<name>_nether` / `<name>_the_end`). BlueMap mounts this and
   * resolves `DIM-1`/`DIM1`/`dimensions/minecraft/<dim>` below it.
   */
  root: string;
}

/** A layout candidate: a region directory and the world-save root holding it. */
interface RegionCandidate {
  dir: string;
  root: string;
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
 * actually using. Ties keep the earlier candidate (the split satellite).
 * Returns undefined when none have data.
 */
function pickRegionDir(candidates: RegionCandidate[]): RegionCandidate | undefined {
  const withData = candidates.filter((c) => hasRegionData(c.dir));
  if (withData.length <= 1) return withData[0];
  let best = withData[0]!;
  let bestMtime = newestRegionMtime(best.dir);
  for (const candidate of withData.slice(1)) {
    const m = newestRegionMtime(candidate.dir);
    if (m > bestMtime) {
      best = candidate;
      bestMtime = m;
    }
  }
  return best;
}

/**
 * Resolve each present dimension's region directory for a world, handling
 * vanilla (DIM-1/DIM1), Paper/Spigot split-folder (`<name>_nether` /
 * `<name>_the_end`) and latest-Minecraft (`dimensions/minecraft/<dim>/region`,
 * #546) layouts. A candidate only wins if it actually contains region data;
 * when several layouts hold data the more recently written one is chosen, so a
 * stale layout never shadows the active one. Single source of truth shared by
 * the structure reader (#530), block scanner (#531) and map renderer (#733).
 */
export function resolveRegionDirs(worldPath: string): DimensionRegionDir[] {
  const nether = `${worldPath}_nether`;
  const end = `${worldPath}_the_end`;
  const at = (root: string, ...dir: string[]): RegionCandidate => ({ dir: join(root, ...dir), root });
  // Layout candidates per dimension, oldest-style first. The last entry is the
  // `dimensions/minecraft/<dim>/region` layout used by latest Minecraft, where
  // every dimension (overworld included) lives under `dimensions/` (#546).
  const candidates: Record<Dimension, RegionCandidate[]> = {
    [Dimension.Overworld]: [
      at(worldPath, 'region'),
      at(worldPath, 'dimensions', 'minecraft', 'overworld', 'region'),
    ],
    [Dimension.Nether]: [
      at(nether, 'DIM-1', 'region'),
      at(worldPath, 'DIM-1', 'region'),
      at(worldPath, 'dimensions', 'minecraft', 'the_nether', 'region'),
    ],
    [Dimension.End]: [
      at(end, 'DIM1', 'region'),
      at(worldPath, 'DIM1', 'region'),
      at(worldPath, 'dimensions', 'minecraft', 'the_end', 'region'),
    ],
  };

  const out: DimensionRegionDir[] = [];
  for (const dimension of [Dimension.Overworld, Dimension.Nether, Dimension.End]) {
    const picked = pickRegionDir(candidates[dimension]);
    if (picked) out.push({ dimension, ...picked });
  }
  return out;
}
