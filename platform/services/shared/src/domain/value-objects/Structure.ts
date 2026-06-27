import { Dimension } from './WorldInfo.js';

/**
 * Structure / world feature markers (#530, Phase 3).
 *
 * Generated structures (villages, fortresses, temples, outposts, end cities,
 * …) are recorded per-chunk in the Anvil region NBT under
 * `structures.starts.<id>`. We normalize the raw structure id into a small set
 * of display categories used for grouping map marker-sets.
 */

/** Normalized structure category for grouping/labelling markers. */
export enum StructureCategory {
  Village = 'village',
  Fortress = 'fortress',
  Bastion = 'bastion',
  Temple = 'temple',
  Outpost = 'outpost',
  EndCity = 'end_city',
  Monument = 'monument',
  Mansion = 'mansion',
  Stronghold = 'stronghold',
  Mineshaft = 'mineshaft',
  Shipwreck = 'shipwreck',
  RuinedPortal = 'ruined_portal',
  TrialChambers = 'trial_chambers',
  Other = 'other',
}

/** A located world structure. */
export interface Structure {
  /** Raw structure id, e.g. `minecraft:village_plains`. */
  id: string;
  /** Normalized category for marker grouping. */
  category: StructureCategory;
  /** Human-friendly label, e.g. `Village`. */
  label: string;
  /** Block coordinates (approximate — start-chunk / bounding-box centre). */
  x: number;
  y: number;
  z: number;
  /** Dimension the structure belongs to. */
  dimension: Dimension;
}

/** Friendly display labels per category. */
export const STRUCTURE_CATEGORY_LABELS: Record<StructureCategory, string> = {
  [StructureCategory.Village]: 'Village',
  [StructureCategory.Fortress]: 'Nether Fortress',
  [StructureCategory.Bastion]: 'Bastion Remnant',
  [StructureCategory.Temple]: 'Temple',
  [StructureCategory.Outpost]: 'Pillager Outpost',
  [StructureCategory.EndCity]: 'End City',
  [StructureCategory.Monument]: 'Ocean Monument',
  [StructureCategory.Mansion]: 'Woodland Mansion',
  [StructureCategory.Stronghold]: 'Stronghold',
  [StructureCategory.Mineshaft]: 'Mineshaft',
  [StructureCategory.Shipwreck]: 'Shipwreck',
  [StructureCategory.RuinedPortal]: 'Ruined Portal',
  [StructureCategory.TrialChambers]: 'Trial Chambers',
  [StructureCategory.Other]: 'Structure',
};

/**
 * Map a raw structure id (e.g. `minecraft:village_plains`) to a normalized
 * category. Unknown ids fall back to {@link StructureCategory.Other}.
 */
export function categorizeStructure(rawId: string): StructureCategory {
  const id = rawId.replace(/^minecraft:/, '');
  if (id.startsWith('village')) return StructureCategory.Village;
  if (id === 'fortress' || id === 'nether_fortress') return StructureCategory.Fortress;
  if (id === 'bastion_remnant') return StructureCategory.Bastion;
  if (id === 'pillager_outpost') return StructureCategory.Outpost;
  if (id === 'end_city') return StructureCategory.EndCity;
  if (id === 'monument' || id === 'ocean_monument') return StructureCategory.Monument;
  if (id === 'mansion' || id === 'woodland_mansion') return StructureCategory.Mansion;
  if (id === 'stronghold') return StructureCategory.Stronghold;
  if (id === 'mineshaft' || id === 'mineshaft_mesa') return StructureCategory.Mineshaft;
  if (id === 'shipwreck' || id === 'shipwreck_beached') return StructureCategory.Shipwreck;
  if (id === 'ruined_portal' || id.startsWith('ruined_portal')) return StructureCategory.RuinedPortal;
  if (id === 'trial_chambers') return StructureCategory.TrialChambers;
  if (
    id === 'desert_pyramid' ||
    id === 'jungle_pyramid' ||
    id === 'jungle_temple' ||
    id === 'igloo' ||
    id === 'swamp_hut' ||
    id === 'witch_hut'
  ) {
    return StructureCategory.Temple;
  }
  return StructureCategory.Other;
}
