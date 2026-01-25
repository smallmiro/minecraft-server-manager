/**
 * ModrinthAdapter - Modrinth API implementation of IModSourcePort
 *
 * This adapter provides access to Modrinth's mod repository.
 * https://docs.modrinth.com/api-spec
 */

import type {
  IModSourcePort,
  ModProject,
  ModVersion,
  ModSearchResult,
  ModSearchOptions,
  ModVersionOptions,
  ModFile,
  ModDependency,
  ModProjectType,
} from '@minecraft-docker/shared';

import type {
  ModrinthProjectRaw,
  ModrinthSearchResultRaw,
  ModrinthSearchHitRaw,
  ModrinthVersionRaw,
  ModrinthTeamMemberRaw,
} from './types.js';

const MODRINTH_API = 'https://api.modrinth.com/v2';

/**
 * Modrinth adapter implementing IModSourcePort
 */
export class ModrinthAdapter implements IModSourcePort {
  readonly sourceName = 'modrinth';
  readonly displayName = 'Modrinth';

  /**
   * Search for mods on Modrinth
   */
  async search(query: string, options?: ModSearchOptions): Promise<ModSearchResult> {
    const params = new URLSearchParams({
      query,
      limit: String(options?.limit ?? 10),
      offset: String(options?.offset ?? 0),
      index: options?.index ?? 'relevance',
    });

    // Build facets for filtering
    const facets: string[][] = [];
    if (options?.gameVersions?.length) {
      facets.push(options.gameVersions.map(v => `versions:${v}`));
    }
    if (options?.loaders?.length) {
      facets.push(options.loaders.map(l => `categories:${l}`));
    }
    if (facets.length > 0) {
      params.set('facets', JSON.stringify(facets));
    }

    const response = await fetch(`${MODRINTH_API}/search?${params}`);

    if (!response.ok) {
      throw new Error(`Modrinth API error: ${response.status} ${response.statusText}`);
    }

    const raw = (await response.json()) as ModrinthSearchResultRaw;

    return {
      hits: raw.hits.map(hit => this.mapSearchHitToProject(hit)),
      totalHits: raw.total_hits,
      offset: raw.offset,
      limit: raw.limit,
    };
  }

  /**
   * Get project details by slug or ID
   */
  async getProject(slugOrId: string): Promise<ModProject | null> {
    const response = await fetch(`${MODRINTH_API}/project/${slugOrId}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Modrinth API error: ${response.status} ${response.statusText}`);
    }

    const raw = (await response.json()) as ModrinthProjectRaw;

    // Get author from team
    const author = await this.getProjectAuthor(raw.team);

    return this.mapProjectRawToProject(raw, author);
  }

  /**
   * Get versions for a project
   */
  async getVersions(slugOrId: string, options?: ModVersionOptions): Promise<ModVersion[]> {
    const params = new URLSearchParams();

    if (options?.loaders?.length) {
      params.set('loaders', JSON.stringify(options.loaders));
    }
    if (options?.gameVersions?.length) {
      params.set('game_versions', JSON.stringify(options.gameVersions));
    }
    if (options?.featured !== undefined) {
      params.set('featured', String(options.featured));
    }

    const url = `${MODRINTH_API}/project/${slugOrId}/version${params.toString() ? '?' + params : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Modrinth API error: ${response.status} ${response.statusText}`);
    }

    const raw = (await response.json()) as ModrinthVersionRaw[];

    return raw.map(v => this.mapVersionRawToVersion(v));
  }

  /**
   * Check if Modrinth API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${MODRINTH_API}/`);
      return response.ok;
    } catch {
      return false;
    }
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

  /**
   * Get project author from team ID
   */
  private async getProjectAuthor(teamId: string): Promise<string> {
    try {
      const response = await fetch(`${MODRINTH_API}/team/${teamId}/members`);
      if (!response.ok) {
        return 'Unknown';
      }

      const members = (await response.json()) as ModrinthTeamMemberRaw[];
      const owner = members.find(m => m.role === 'Owner') ?? members[0];
      return owner?.user?.username ?? 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Map search hit to domain model
   */
  private mapSearchHitToProject(hit: ModrinthSearchHitRaw): ModProject {
    return {
      slug: hit.slug,
      title: hit.title,
      description: hit.description,
      downloads: hit.downloads,
      iconUrl: hit.icon_url,
      serverSide: hit.server_side,
      clientSide: hit.client_side,
      projectType: this.mapProjectType(hit.project_type),
      categories: hit.categories,
      author: hit.author,
      license: hit.license,
      sourceId: hit.project_id,
      sourceName: this.sourceName,
    };
  }

  /**
   * Map raw project to domain model
   */
  private mapProjectRawToProject(raw: ModrinthProjectRaw, author: string): ModProject {
    return {
      slug: raw.slug,
      title: raw.title,
      description: raw.description,
      downloads: raw.downloads,
      iconUrl: raw.icon_url,
      serverSide: raw.server_side,
      clientSide: raw.client_side,
      projectType: this.mapProjectType(raw.project_type),
      categories: raw.categories,
      author,
      license: raw.license.id,
      sourceId: raw.id,
      sourceName: this.sourceName,
    };
  }

  /**
   * Map raw version to domain model
   */
  private mapVersionRawToVersion(raw: ModrinthVersionRaw): ModVersion {
    return {
      id: raw.id,
      projectId: raw.project_id,
      name: raw.name,
      versionNumber: raw.version_number,
      versionType: raw.version_type,
      gameVersions: raw.game_versions,
      loaders: raw.loaders,
      files: raw.files.map(
        (f): ModFile => ({
          url: f.url,
          filename: f.filename,
          size: f.size,
          hashes: {
            sha1: f.hashes.sha1,
            sha512: f.hashes.sha512,
          },
          primary: f.primary,
        })
      ),
      dependencies: raw.dependencies.map(
        (d): ModDependency => ({
          projectId: d.project_id,
          dependencyType: d.dependency_type,
          versionId: d.version_id ?? undefined,
        })
      ),
      downloads: raw.downloads,
      datePublished: raw.date_published,
      changelog: raw.changelog || undefined,
    };
  }

  /**
   * Map Modrinth project type to domain type
   */
  private mapProjectType(type: string): ModProjectType {
    const typeMap: Record<string, ModProjectType> = {
      mod: 'mod',
      modpack: 'modpack',
      resourcepack: 'resourcepack',
      shader: 'shader',
    };
    return typeMap[type] ?? 'mod';
  }
}
