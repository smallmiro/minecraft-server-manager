/**
 * Mod Domain Types
 * Common types and enums for mod management
 */

/**
 * Side support for mods (client/server)
 */
export type ModSideSupport = 'required' | 'optional' | 'unsupported';

/**
 * Project type
 */
export type ModProjectType = 'mod' | 'modpack' | 'resourcepack' | 'shader' | 'plugin';

/**
 * Version release type
 */
export type ModVersionType = 'release' | 'beta' | 'alpha';

/**
 * Dependency type
 */
export type ModDependencyType = 'required' | 'optional' | 'incompatible' | 'embedded';

/**
 * Search result sort index
 */
export type ModSearchIndex = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';

/**
 * Search options
 */
export interface ModSearchOptions {
  limit?: number;
  offset?: number;
  gameVersions?: string[];
  loaders?: string[];
  index?: ModSearchIndex;
  /** Restrict results to a specific project type (e.g. 'modpack', 'mod'). */
  projectType?: ModProjectType;
}

/**
 * Version filter options
 */
export interface ModVersionOptions {
  gameVersions?: string[];
  loaders?: string[];
  featured?: boolean;
}
