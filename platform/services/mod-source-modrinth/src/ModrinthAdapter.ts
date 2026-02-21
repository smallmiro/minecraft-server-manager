/**
 * ModrinthAdapter - Modrinth API implementation of IModSourcePort
 *
 * This adapter composes infrastructure components to provide
 * access to Modrinth's mod repository.
 *
 * Architecture:
 * - ModrinthApiClient: HTTP requests to Modrinth API
 * - ModrinthMapper: Raw API responses → Domain models
 * - ModrinthAdapter: Orchestrates client and mapper, implements IModSourcePort
 *
 * @see https://docs.modrinth.com/api-spec
 */

import type {
  IModSourcePort,
  ModProject,
  ModVersion,
  ModSearchResult,
  ModSearchOptions,
  ModVersionOptions,
} from '@minecraft-docker/shared';

import { ModrinthApiClient } from './infrastructure/api/index.js';
import { ModrinthMapper } from './infrastructure/mappers/index.js';

/**
 * Modrinth adapter implementing IModSourcePort
 *
 * Uses composition to combine API client and mapper.
 * Follows Single Responsibility Principle - this class only
 * orchestrates the components, not implement HTTP or mapping logic.
 *
 * @example
 * ```typescript
 * const adapter = new ModrinthAdapter();
 * const result = await adapter.search('sodium');
 * const project = await adapter.getProject('sodium');
 * ```
 */
export class ModrinthAdapter implements IModSourcePort {
  readonly sourceName = 'modrinth';
  readonly displayName = 'Modrinth';

  private readonly apiClient: ModrinthApiClient;
  private readonly mapper: ModrinthMapper;

  constructor(
    apiClient: ModrinthApiClient = new ModrinthApiClient(),
    mapper: ModrinthMapper = new ModrinthMapper()
  ) {
    this.apiClient = apiClient;
    this.mapper = mapper;
  }

  /**
   * Search for mods on Modrinth
   */
  async search(query: string, options?: ModSearchOptions): Promise<ModSearchResult> {
    // Build facets for filtering
    const facets: string[][] = [];
    if (options?.gameVersions?.length) {
      facets.push(options.gameVersions.map(v => `versions:${v}`));
    }
    if (options?.loaders?.length) {
      facets.push(options.loaders.map(l => `categories:${l}`));
    }

    const raw = await this.apiClient.search({
      query,
      limit: options?.limit,
      offset: options?.offset,
      index: options?.index,
      facets: facets.length > 0 ? facets : undefined,
    });

    return this.mapper.toSearchResult(raw);
  }

  /**
   * Get project details by slug or ID
   */
  async getProject(slugOrId: string): Promise<ModProject | null> {
    const raw = await this.apiClient.getProject(slugOrId);

    if (!raw) {
      return null;
    }

    // Get author from team
    const members = await this.apiClient.getTeamMembers(raw.team);
    const author = this.mapper.extractAuthor(members);

    return this.mapper.toProject(raw, author);
  }

  /**
   * Get multiple projects by slugs or IDs (batch)
   */
  async getProjects(slugsOrIds: string[]): Promise<Map<string, ModProject>> {
    if (slugsOrIds.length === 0) return new Map();

    const rawProjects = await this.apiClient.getProjects(slugsOrIds);

    // Collect unique team IDs and fetch members in parallel
    const uniqueTeamIds = [...new Set(rawProjects.map(p => p.team))];
    const teamMembersMap = new Map<string, string>();

    const teamResults = await Promise.all(
      uniqueTeamIds.map(async (teamId) => {
        const members = await this.apiClient.getTeamMembers(teamId);
        return { teamId, author: this.mapper.extractAuthor(members) };
      })
    );

    for (const { teamId, author } of teamResults) {
      teamMembersMap.set(teamId, author);
    }

    const result = new Map<string, ModProject>();
    for (const raw of rawProjects) {
      const author = teamMembersMap.get(raw.team) ?? 'Unknown';
      result.set(raw.slug, this.mapper.toProject(raw, author));
    }

    return result;
  }

  /**
   * Get versions for a project
   */
  async getVersions(slugOrId: string, options?: ModVersionOptions): Promise<ModVersion[]> {
    const rawVersions = await this.apiClient.getVersions(slugOrId, {
      loaders: options?.loaders,
      gameVersions: options?.gameVersions,
      featured: options?.featured,
    });

    return rawVersions.map(v => this.mapper.toVersion(v));
  }

  /**
   * Check if Modrinth API is available
   */
  async isAvailable(): Promise<boolean> {
    return this.apiClient.isAvailable();
  }

  /**
   * Get environment variable key for Modrinth
   */
  getEnvKey(): string {
    return 'MODRINTH_PROJECTS';
  }

  /**
   * Format project for config.env
   */
  formatForEnv(project: ModProject): string {
    return project.slug;
  }
}
