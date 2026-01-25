/**
 * IModSourcePort - Outbound port for mod source adapters
 *
 * This interface defines the contract for mod source implementations.
 * Each mod source (Modrinth, CurseForge, Spiget, etc.) must implement this interface.
 *
 * @example
 * ```typescript
 * class ModrinthAdapter implements IModSourcePort {
 *   readonly sourceName = 'modrinth';
 *
 *   async search(query: string): Promise<ModSearchResult> {
 *     // Implementation
 *   }
 * }
 * ```
 */

import type {
  ModProject,
  ModVersion,
  ModSearchResult,
  ModSearchOptions,
  ModVersionOptions,
} from '../../../domain/mod/index.js';

/**
 * Port interface for mod source adapters
 */
export interface IModSourcePort {
  /**
   * Unique identifier for this source
   * @example 'modrinth', 'curseforge', 'spiget'
   */
  readonly sourceName: string;

  /**
   * Human-readable display name
   * @example 'Modrinth', 'CurseForge', 'SpigotMC'
   */
  readonly displayName: string;

  /**
   * Search for mods/plugins
   * @param query - Search query string
   * @param options - Search options (pagination, filters)
   * @returns Paginated search results
   */
  search(query: string, options?: ModSearchOptions): Promise<ModSearchResult>;

  /**
   * Get project details by slug or ID
   * @param slugOrId - Project slug or ID
   * @returns Project details or null if not found
   */
  getProject(slugOrId: string): Promise<ModProject | null>;

  /**
   * Get available versions for a project
   * @param slugOrId - Project slug or ID
   * @param options - Version filter options
   * @returns List of versions
   */
  getVersions(slugOrId: string, options?: ModVersionOptions): Promise<ModVersion[]>;

  /**
   * Check if this source is available (API accessible, credentials valid)
   * @returns true if the source is ready to use
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the environment variable key for this source
   * Used for config.env configuration
   * @example 'MODRINTH_PROJECTS', 'CURSEFORGE_FILES', 'SPIGET_RESOURCES'
   */
  getEnvKey(): string;

  /**
   * Format a project reference for config.env
   * @param project - Project to format
   * @returns Formatted string for environment variable
   */
  formatForEnv(project: ModProject): string;
}
