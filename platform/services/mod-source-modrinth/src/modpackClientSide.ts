/**
 * Pure helpers for detecting client-only mods inside a Modrinth modpack.
 *
 * The goal is to flag mods whose *canonical* Modrinth `server_side` is
 * `unsupported` (i.e. client-only), regardless of how the modpack's own
 * `modrinth.index.json` labels them. A modpack that mislabels a client mod as
 * server-compatible (or bundles it in overrides) would otherwise install it on
 * a dedicated server and break it.
 */

import type { ModSideSupport } from '@minecraft-docker/shared';

/** A single mod entry resolved from a modpack's `modrinth.index.json`. */
export interface ModpackIndexEntry {
  /** File path inside the pack, e.g. `mods/searchables-1.21.1-1.0.jar`. */
  path: string;
  /** Modrinth project id this file belongs to. */
  projectId: string;
}

/**
 * Extract the Modrinth project id from a `cdn.modrinth.com` download URL.
 *
 * URLs look like:
 *   https://cdn.modrinth.com/data/{PROJECT_ID}/versions/{VERSION_ID}/{file}
 *
 * @returns the project id, or null if the URL is not a Modrinth CDN data URL.
 */
export function extractProjectIdFromCdnUrl(url: string): string | null {
  const match = /\/data\/([^/]+)\//.exec(url);
  return match?.[1] ?? null;
}

/**
 * Strip a directory and `.jar` extension from a pack path, yielding a partial
 * file name suitable for `MODRINTH_EXCLUDE_FILES`.
 */
function toExcludeName(path: string): string {
  const base = path.split('/').pop() ?? path;
  return base.replace(/\.jar$/i, '');
}

/**
 * Given modpack mod entries and a map of canonical `server_side` values keyed by
 * project id, return the exclude names (basename without `.jar`) of the mods
 * that are `unsupported` on the server — i.e. client-only mods to exclude.
 *
 * Entries whose project metadata is unknown (absent from the map) and non-`.jar`
 * paths are skipped.
 */
export function selectClientOnlyFilenames(
  entries: ModpackIndexEntry[],
  serverSideById: Map<string, ModSideSupport>
): string[] {
  const result: string[] = [];
  for (const entry of entries) {
    if (!/\.jar$/i.test(entry.path)) continue;
    if (serverSideById.get(entry.projectId) === 'unsupported') {
      result.push(toExcludeName(entry.path));
    }
  }
  return result;
}
