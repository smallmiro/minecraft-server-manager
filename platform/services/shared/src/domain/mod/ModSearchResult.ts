/**
 * ModSearchResult - Domain model for search results
 */

import type { ModProject } from './ModProject.js';

/**
 * Represents paginated search results
 */
export interface ModSearchResult {
  /** Found projects */
  hits: ModProject[];

  /** Total number of matches */
  totalHits: number;

  /** Current offset */
  offset: number;

  /** Results per page */
  limit: number;
}
