import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Dimension, type Structure } from '../../domain/index.js';

/**
 * BlueMap marker writer (#530, Phase 3).
 *
 * Converts extracted {@link Structure}s into BlueMap's native marker format and
 * writes them to each map's `live/markers.json` — the file the BlueMap webapp
 * polls — so structure markers appear directly in the embedded viewer with
 * per-category toggle and click popups. This needs no tile re-render.
 */

/** A single BlueMap POI marker. */
export interface BlueMapMarker {
  type: 'poi';
  position: { x: number; y: number; z: number };
  label: string;
  detail: string;
  anchor: { x: number; y: number };
  classes: string[];
  minDistance: number;
  maxDistance: number;
  sorting: number;
  listed: boolean;
}

/** A toggleable set of markers (one per structure category). */
export interface BlueMapMarkerSet {
  label: string;
  toggleable: boolean;
  defaultHidden: boolean;
  sorting: number;
  markers: Record<string, BlueMapMarker>;
}

/** Map a structure's dimension to its BlueMap map id (matches render-map.sh). */
const DIMENSION_MAP_ID: Record<Dimension, string> = {
  [Dimension.Overworld]: 'overworld',
  [Dimension.Nether]: 'nether',
  [Dimension.End]: 'end',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Build the popup detail HTML (label + selectable coordinates). */
function markerDetail(s: Structure): string {
  return `<div class="structure-marker"><b>${escapeHtml(s.label)}</b><br/>X: ${s.x}, Y: ${s.y}, Z: ${s.z}</div>`;
}

/**
 * Group structures into one toggleable marker-set per category, in BlueMap's
 * native `live/markers.json` schema.
 */
export function buildMarkerSets(structures: Structure[]): Record<string, BlueMapMarkerSet> {
  const sets: Record<string, BlueMapMarkerSet> = {};
  for (const s of structures) {
    let set = sets[s.category];
    if (!set) {
      set = {
        label: s.label,
        toggleable: true,
        defaultHidden: false,
        sorting: 0,
        markers: {},
      };
      sets[s.category] = set;
    }
    const id = `${s.category}-${s.x}-${s.y}-${s.z}`;
    set.markers[id] = {
      type: 'poi',
      position: { x: s.x, y: s.y, z: s.z },
      label: s.label,
      detail: markerDetail(s),
      anchor: { x: 25, y: 45 },
      classes: [],
      minDistance: 0,
      maxDistance: 10000000,
      sorting: 0,
      listed: true,
    };
  }
  return sets;
}

export class BlueMapMarkerWriter {
  /**
   * Write structure markers into the rendered webroot. Only dimensions whose
   * map directory exists (i.e. were rendered) are written. Returns the number
   * of markers written per map id.
   *
   * @param webroot Absolute path to the rendered BlueMap webroot.
   * @param structures Structures across all dimensions.
   */
  async writeMarkers(
    webroot: string,
    structures: Structure[]
  ): Promise<Record<string, number>> {
    const byDimension = new Map<Dimension, Structure[]>();
    for (const s of structures) {
      const list = byDimension.get(s.dimension) ?? [];
      list.push(s);
      byDimension.set(s.dimension, list);
    }

    const counts: Record<string, number> = {};
    for (const dimension of [Dimension.Overworld, Dimension.Nether, Dimension.End]) {
      const mapId = DIMENSION_MAP_ID[dimension];
      const mapDir = join(webroot, 'maps', mapId);
      if (!existsSync(mapDir)) continue; // dimension not rendered → skip

      const dimStructures = byDimension.get(dimension) ?? [];
      // Never overwrite an existing markers.json with an empty set: a transient
      // region-read failure yields zero structures, and blindly writing `{}`
      // would silently erase previously-visible markers. Only write when this
      // dimension actually has structures to place.
      if (dimStructures.length === 0) continue;

      const sets = buildMarkerSets(dimStructures);
      const liveDir = join(mapDir, 'live');
      await mkdir(liveDir, { recursive: true });
      await writeFile(join(liveDir, 'markers.json'), JSON.stringify(sets), 'utf-8');
      counts[mapId] = dimStructures.length;
    }

    return counts;
  }
}
