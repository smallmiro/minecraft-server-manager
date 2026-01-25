/**
 * ModProject - Domain model for mod/plugin project
 */

import type { ModSideSupport, ModProjectType } from './types.js';

/**
 * Represents a mod/plugin project from any source
 */
export interface ModProject {
  /** Unique slug identifier */
  slug: string;

  /** Display title */
  title: string;

  /** Short description */
  description: string;

  /** Total download count */
  downloads: number;

  /** Icon/logo URL */
  iconUrl: string | null;

  /** Server-side support requirement */
  serverSide: ModSideSupport;

  /** Client-side support requirement */
  clientSide: ModSideSupport;

  /** Project type */
  projectType: ModProjectType;

  /** Category tags */
  categories: string[];

  /** Author/owner name */
  author: string;

  /** License identifier */
  license: string;

  /** Source-specific project ID */
  sourceId: string;

  /** Source name (modrinth, curseforge, spiget) */
  sourceName: string;
}
