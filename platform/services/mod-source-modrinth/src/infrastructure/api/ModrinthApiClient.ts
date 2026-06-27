/**
 * ModrinthApiClient - HTTP client for Modrinth API
 *
 * Single responsibility: Make HTTP requests to Modrinth API
 * Returns raw API responses without transformation
 *
 * @see https://docs.modrinth.com/api-spec
 */

import JSZip from 'jszip';
import type {
  ModrinthProjectRaw,
  ModrinthSearchResultRaw,
  ModrinthVersionRaw,
  ModrinthTeamMemberRaw,
} from '../../types.js';

const MODRINTH_API = 'https://api.modrinth.com/v2';

/**
 * A single file entry from a modpack's `modrinth.index.json`.
 */
export interface ModrinthIndexFileRaw {
  path: string;
  downloads: string[];
  env?: { client?: string; server?: string };
}

/**
 * Search options for Modrinth API
 */
export interface ModrinthSearchParams {
  query: string;
  limit?: number;
  offset?: number;
  index?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';
  facets?: string[][];
}

/**
 * Version filter options for Modrinth API
 */
export interface ModrinthVersionParams {
  loaders?: string[];
  gameVersions?: string[];
  featured?: boolean;
}

/**
 * HTTP client for Modrinth API
 *
 * @example
 * ```typescript
 * const client = new ModrinthApiClient();
 * const result = await client.search({ query: 'sodium' });
 * const project = await client.getProject('sodium');
 * ```
 */
export class ModrinthApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = MODRINTH_API) {
    this.baseUrl = baseUrl;
  }

  /**
   * Search for projects
   */
  async search(params: ModrinthSearchParams): Promise<ModrinthSearchResultRaw> {
    const urlParams = new URLSearchParams({
      query: params.query,
      limit: String(params.limit ?? 10),
      offset: String(params.offset ?? 0),
      index: params.index ?? 'relevance',
    });

    if (params.facets && params.facets.length > 0) {
      urlParams.set('facets', JSON.stringify(params.facets));
    }

    const response = await fetch(`${this.baseUrl}/search?${urlParams}`);

    if (!response.ok) {
      throw new Error(`Modrinth API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<ModrinthSearchResultRaw>;
  }

  /**
   * Get project by slug or ID
   */
  async getProject(slugOrId: string): Promise<ModrinthProjectRaw | null> {
    const response = await fetch(`${this.baseUrl}/project/${slugOrId}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Modrinth API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<ModrinthProjectRaw>;
  }

  /**
   * Get project versions
   */
  async getVersions(slugOrId: string, params?: ModrinthVersionParams): Promise<ModrinthVersionRaw[]> {
    const urlParams = new URLSearchParams();

    if (params?.loaders?.length) {
      urlParams.set('loaders', JSON.stringify(params.loaders));
    }
    if (params?.gameVersions?.length) {
      urlParams.set('game_versions', JSON.stringify(params.gameVersions));
    }
    if (params?.featured !== undefined) {
      urlParams.set('featured', String(params.featured));
    }

    const queryString = urlParams.toString();
    const url = `${this.baseUrl}/project/${slugOrId}/version${queryString ? '?' + queryString : ''}`;
    const response = await fetch(url);

    // A non-existent project returns 404. Treat it as "no versions" (empty list)
    // rather than throwing, mirroring getProject()'s 404 handling. This lets the
    // API layer respond with a clean 404 instead of a 500 when a user types a
    // partial/unknown slug into the modpack search.
    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`Modrinth API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<ModrinthVersionRaw[]>;
  }

  /**
   * Get team members for a project
   */
  async getTeamMembers(teamId: string): Promise<ModrinthTeamMemberRaw[]> {
    const response = await fetch(`${this.baseUrl}/team/${teamId}/members`);

    if (!response.ok) {
      return [];
    }

    return response.json() as Promise<ModrinthTeamMemberRaw[]>;
  }

  /**
   * Get multiple projects by slugs or IDs (batch)
   * @see https://docs.modrinth.com/#tag/projects/operation/getProjects
   */
  async getProjects(slugsOrIds: string[]): Promise<ModrinthProjectRaw[]> {
    if (slugsOrIds.length === 0) return [];

    const params = new URLSearchParams({
      ids: JSON.stringify(slugsOrIds),
    });

    const response = await fetch(`${this.baseUrl}/projects?${params}`);

    if (!response.ok) {
      throw new Error(`Modrinth API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<ModrinthProjectRaw[]>;
  }

  /**
   * Download a `.mrpack` (a zip archive) and return the file entries from its
   * `modrinth.index.json`. Used to enumerate the mods a modpack installs.
   *
   * @param mrpackUrl - Direct download URL of the `.mrpack` file
   */
  async getModpackIndexFiles(mrpackUrl: string): Promise<ModrinthIndexFileRaw[]> {
    const response = await fetch(mrpackUrl);
    if (!response.ok) {
      throw new Error(`Failed to download modpack: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const indexEntry = zip.file('modrinth.index.json');
    if (!indexEntry) {
      throw new Error('modrinth.index.json not found in modpack archive');
    }

    const index = JSON.parse(await indexEntry.async('string')) as {
      files?: ModrinthIndexFileRaw[];
    };
    return index.files ?? [];
  }

  /**
   * Check if API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
