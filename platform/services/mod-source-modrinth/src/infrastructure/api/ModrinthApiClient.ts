/**
 * ModrinthApiClient - HTTP client for Modrinth API
 *
 * Single responsibility: Make HTTP requests to Modrinth API
 * Returns raw API responses without transformation
 *
 * @see https://docs.modrinth.com/api-spec
 */

import type {
  ModrinthProjectRaw,
  ModrinthSearchResultRaw,
  ModrinthVersionRaw,
  ModrinthTeamMemberRaw,
} from '../../types.js';

const MODRINTH_API = 'https://api.modrinth.com/v2';

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
