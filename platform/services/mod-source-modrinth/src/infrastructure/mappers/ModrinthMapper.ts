/**
 * ModrinthMapper - Maps Modrinth API responses to domain models
 *
 * Single responsibility: Transform raw API types to domain models
 * No HTTP calls, pure data transformation
 */

import type {
  ModProject,
  ModVersion,
  ModFile,
  ModDependency,
  ModProjectType,
  ModSearchResult,
} from '@minecraft-docker/shared';

import type {
  ModrinthProjectRaw,
  ModrinthSearchResultRaw,
  ModrinthSearchHitRaw,
  ModrinthVersionRaw,
  ModrinthFileRaw,
  ModrinthDependencyRaw,
  ModrinthTeamMemberRaw,
} from '../../types.js';

/**
 * Source name constant for Modrinth
 */
const SOURCE_NAME = 'modrinth';

/**
 * Mapper for transforming Modrinth API responses to domain models
 *
 * @example
 * ```typescript
 * const mapper = new ModrinthMapper();
 * const domainProject = mapper.toProject(rawProject, 'AuthorName');
 * const domainVersion = mapper.toVersion(rawVersion);
 * ```
 */
export class ModrinthMapper {
  /**
   * Map search result to domain model
   */
  toSearchResult(raw: ModrinthSearchResultRaw): ModSearchResult {
    return {
      hits: raw.hits.map(hit => this.searchHitToProject(hit)),
      totalHits: raw.total_hits,
      offset: raw.offset,
      limit: raw.limit,
    };
  }

  /**
   * Map search hit to ModProject
   */
  searchHitToProject(hit: ModrinthSearchHitRaw): ModProject {
    return {
      slug: hit.slug,
      title: hit.title,
      description: hit.description,
      downloads: hit.downloads,
      iconUrl: hit.icon_url,
      serverSide: hit.server_side,
      clientSide: hit.client_side,
      projectType: this.toProjectType(hit.project_type),
      categories: hit.categories,
      author: hit.author,
      license: hit.license,
      sourceId: hit.project_id,
      sourceName: SOURCE_NAME,
    };
  }

  /**
   * Map raw project to ModProject
   */
  toProject(raw: ModrinthProjectRaw, author: string): ModProject {
    return {
      slug: raw.slug,
      title: raw.title,
      description: raw.description,
      downloads: raw.downloads,
      iconUrl: raw.icon_url,
      serverSide: raw.server_side,
      clientSide: raw.client_side,
      projectType: this.toProjectType(raw.project_type),
      categories: raw.categories,
      author,
      license: raw.license.id,
      sourceId: raw.id,
      sourceName: SOURCE_NAME,
    };
  }

  /**
   * Map raw version to ModVersion
   */
  toVersion(raw: ModrinthVersionRaw): ModVersion {
    return {
      id: raw.id,
      projectId: raw.project_id,
      name: raw.name,
      versionNumber: raw.version_number,
      versionType: raw.version_type,
      gameVersions: raw.game_versions,
      loaders: raw.loaders,
      files: raw.files.map(f => this.toFile(f)),
      dependencies: raw.dependencies.map(d => this.toDependency(d)),
      downloads: raw.downloads,
      datePublished: raw.date_published,
      changelog: raw.changelog || undefined,
    };
  }

  /**
   * Map raw file to ModFile
   */
  toFile(raw: ModrinthFileRaw): ModFile {
    return {
      url: raw.url,
      filename: raw.filename,
      size: raw.size,
      hashes: {
        sha1: raw.hashes.sha1,
        sha512: raw.hashes.sha512,
      },
      primary: raw.primary,
    };
  }

  /**
   * Map raw dependency to ModDependency
   */
  toDependency(raw: ModrinthDependencyRaw): ModDependency {
    return {
      projectId: raw.project_id,
      dependencyType: raw.dependency_type,
      versionId: raw.version_id ?? undefined,
    };
  }

  /**
   * Extract author from team members
   */
  extractAuthor(members: ModrinthTeamMemberRaw[]): string {
    if (members.length === 0) {
      return 'Unknown';
    }
    const owner = members.find(m => m.role === 'Owner') ?? members[0];
    return owner?.user?.username ?? 'Unknown';
  }

  /**
   * Map Modrinth project type to domain type
   */
  private toProjectType(type: string): ModProjectType {
    const typeMap: Record<string, ModProjectType> = {
      mod: 'mod',
      modpack: 'modpack',
      resourcepack: 'resourcepack',
      shader: 'shader',
    };
    return typeMap[type] ?? 'mod';
  }
}
