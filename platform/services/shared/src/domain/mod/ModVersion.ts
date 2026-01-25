/**
 * ModVersion - Domain model for mod version
 */

import type { ModVersionType } from './types.js';
import type { ModFile } from './ModFile.js';
import type { ModDependency } from './ModDependency.js';

/**
 * Represents a specific version of a mod
 */
export interface ModVersion {
  /** Version ID */
  id: string;

  /** Parent project ID */
  projectId: string;

  /** Version display name */
  name: string;

  /** Semantic version number */
  versionNumber: string;

  /** Release type */
  versionType: ModVersionType;

  /** Supported Minecraft versions */
  gameVersions: string[];

  /** Supported mod loaders */
  loaders: string[];

  /** Downloadable files */
  files: ModFile[];

  /** Dependencies */
  dependencies: ModDependency[];

  /** Download count for this version */
  downloads: number;

  /** Publication date (ISO string) */
  datePublished: string;

  /** Changelog (may be empty) */
  changelog?: string;
}
