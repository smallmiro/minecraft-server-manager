/**
 * ModDependency - Domain model for mod dependency
 */

import type { ModDependencyType } from './types.js';

/**
 * Represents a mod dependency relationship
 */
export interface ModDependency {
  /** Project ID of the dependency */
  projectId: string;

  /** Project slug (if available) */
  projectSlug?: string;

  /** Dependency type */
  dependencyType: ModDependencyType;

  /** Specific version ID (if pinned) */
  versionId?: string;
}
