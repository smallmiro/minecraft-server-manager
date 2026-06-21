/**
 * Modpack compatibility matrix - Domain utility
 *
 * Aggregates a list of {@link ModVersion} (e.g. from a Modrinth modpack project)
 * into a loader → game-version compatibility matrix. This lets the UI present
 * only valid (loader, Minecraft version) combinations and lets the API validate
 * server creation requests, preventing the "No files available" failure that
 * occurs when an incompatible VERSION/MODRINTH_LOADER pair is passed to itzg.
 *
 * Pure domain logic: no external dependencies, no I/O.
 */

import type { ModVersion } from './ModVersion.js';

/**
 * Compatibility information for a single mod loader.
 */
export interface LoaderCompatibility {
  /** Minecraft versions supported by this loader, sorted newest-first. */
  gameVersions: string[];
  /**
   * Recommended modpack version number for each game version
   * (the newest modpack release supporting that game version).
   * Keyed by Minecraft game version.
   */
  recommended: Record<string, string>;
}

/**
 * Loader → compatibility matrix for a modpack project.
 */
export interface ModpackCompatibilityMatrix {
  /** Supported mod loaders, sorted alphabetically. */
  loaders: string[];
  /** Per-loader compatibility info. */
  byLoader: Record<string, LoaderCompatibility>;
}

/**
 * Compare two Minecraft game-version strings, newest-first.
 *
 * Standard release versions ("1.21.1", "1.20.4") sort numerically by
 * their dotted components in descending order. Non-standard versions
 * (snapshots like "24w14a", "1.21-rc1") are pushed to the end so the
 * UI surfaces stable releases first.
 */
function compareGameVersionsDesc(a: string, b: string): number {
  const isStandard = (v: string) => /^\d+(\.\d+)*$/.test(v);
  const aStd = isStandard(a);
  const bStd = isStandard(b);

  if (aStd && !bStd) return -1;
  if (!aStd && bStd) return 1;
  if (!aStd && !bStd) return a < b ? 1 : a > b ? -1 : 0;

  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const av = aParts[i] ?? 0;
    const bv = bParts[i] ?? 0;
    if (av !== bv) return bv - av; // descending
  }
  return 0;
}

/**
 * Build a loader → game-version compatibility matrix from modpack versions.
 *
 * Versions are expected to be supplied newest-first (as Modrinth returns them),
 * so for each (loader, game version) cell the first version encountered is
 * treated as the recommended/latest one.
 *
 * Versions with no loaders are ignored.
 *
 * @param versions - Modpack project versions
 * @returns Aggregated compatibility matrix
 */
export function buildModpackCompatibilityMatrix(
  versions: ModVersion[]
): ModpackCompatibilityMatrix {
  const byLoader: Record<string, LoaderCompatibility> = {};

  for (const version of versions) {
    for (const rawLoader of version.loaders) {
      const loader = rawLoader.toLowerCase();
      let entry = byLoader[loader];
      if (!entry) {
        entry = { gameVersions: [], recommended: {} };
        byLoader[loader] = entry;
      }

      for (const gameVersion of version.gameVersions) {
        if (!entry.gameVersions.includes(gameVersion)) {
          entry.gameVersions.push(gameVersion);
        }
        // First-seen wins (input is newest-first).
        if (!(gameVersion in entry.recommended)) {
          entry.recommended[gameVersion] = version.versionNumber;
        }
      }
    }
  }

  // Sort game versions newest-first for each loader.
  for (const entry of Object.values(byLoader)) {
    entry.gameVersions.sort(compareGameVersionsDesc);
  }

  return {
    loaders: Object.keys(byLoader).sort(),
    byLoader,
  };
}

/**
 * Check whether a (loader, game version) combination is supported by the matrix.
 *
 * Loader comparison is case-insensitive.
 *
 * @param matrix - Compatibility matrix from {@link buildModpackCompatibilityMatrix}
 * @param loader - Mod loader name (e.g. "neoforge")
 * @param gameVersion - Minecraft version (e.g. "1.21.1")
 * @returns true if the modpack has a release for this combination
 */
export function isModpackCompatible(
  matrix: ModpackCompatibilityMatrix,
  loader: string,
  gameVersion: string
): boolean {
  const entry = matrix.byLoader[loader.toLowerCase()];
  if (!entry) return false;
  return entry.gameVersions.includes(gameVersion);
}
