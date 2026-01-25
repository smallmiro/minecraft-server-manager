/**
 * Modrinth API Client
 * https://docs.modrinth.com/api-spec
 */

const MODRINTH_API = 'https://api.modrinth.com/v2';

/**
 * Modrinth project (mod/plugin)
 */
export interface ModrinthProject {
  slug: string;
  title: string;
  description: string;
  categories: string[];
  client_side: 'required' | 'optional' | 'unsupported';
  server_side: 'required' | 'optional' | 'unsupported';
  project_type: 'mod' | 'modpack' | 'resourcepack' | 'shader';
  downloads: number;
  icon_url: string | null;
  project_id: string;
  author: string;
  versions: string[];
  follows: number;
  date_created: string;
  date_modified: string;
  license: string;
  gallery: string[];
}

/**
 * Search result from Modrinth
 */
export interface ModrinthSearchResult {
  hits: ModrinthProject[];
  offset: number;
  limit: number;
  total_hits: number;
}

/**
 * Project version info
 */
export interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  changelog: string;
  date_published: string;
  downloads: number;
  version_type: 'release' | 'beta' | 'alpha';
  files: ModrinthFile[];
  dependencies: ModrinthDependency[];
  game_versions: string[];
  loaders: string[];
}

export interface ModrinthFile {
  hashes: { sha1: string; sha512: string };
  url: string;
  filename: string;
  primary: boolean;
  size: number;
}

export interface ModrinthDependency {
  version_id: string | null;
  project_id: string;
  file_name: string | null;
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
}

/**
 * Search mods on Modrinth
 */
export async function searchMods(
  query: string,
  options?: {
    limit?: number;
    offset?: number;
    facets?: string[][];
    index?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';
  }
): Promise<ModrinthSearchResult> {
  const params = new URLSearchParams({
    query,
    limit: String(options?.limit ?? 10),
    offset: String(options?.offset ?? 0),
    index: options?.index ?? 'relevance',
  });

  if (options?.facets) {
    params.set('facets', JSON.stringify(options.facets));
  }

  const response = await fetch(`${MODRINTH_API}/search?${params}`);

  if (!response.ok) {
    throw new Error(`Modrinth API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<ModrinthSearchResult>;
}

/**
 * Get project by slug or ID
 */
export async function getProject(slugOrId: string): Promise<ModrinthProject | null> {
  const response = await fetch(`${MODRINTH_API}/project/${slugOrId}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Modrinth API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<ModrinthProject>;
}

/**
 * Get project versions
 */
export async function getProjectVersions(
  slugOrId: string,
  options?: {
    loaders?: string[];
    game_versions?: string[];
    featured?: boolean;
  }
): Promise<ModrinthVersion[]> {
  const params = new URLSearchParams();

  if (options?.loaders) {
    params.set('loaders', JSON.stringify(options.loaders));
  }
  if (options?.game_versions) {
    params.set('game_versions', JSON.stringify(options.game_versions));
  }
  if (options?.featured !== undefined) {
    params.set('featured', String(options.featured));
  }

  const url = `${MODRINTH_API}/project/${slugOrId}/version${params.toString() ? '?' + params : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Modrinth API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<ModrinthVersion[]>;
}

/**
 * Format download count for display
 */
export function formatDownloads(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return String(count);
}

/**
 * Get loader type from server type
 */
export function getLoaderFromServerType(serverType: string): string | null {
  const loaderMap: Record<string, string> = {
    FORGE: 'forge',
    NEOFORGE: 'neoforge',
    FABRIC: 'fabric',
    QUILT: 'quilt',
    PAPER: 'paper',
    SPIGOT: 'spigot',
    BUKKIT: 'bukkit',
    PURPUR: 'purpur',
  };

  return loaderMap[serverType.toUpperCase()] ?? null;
}
