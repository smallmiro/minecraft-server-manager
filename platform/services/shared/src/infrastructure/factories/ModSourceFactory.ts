/**
 * ModSourceFactory - Factory pattern for mod source adapters
 *
 * This factory manages registration and retrieval of mod source adapters.
 * Adapters register themselves when their modules are imported.
 *
 * @example
 * ```typescript
 * // Register an adapter
 * ModSourceFactory.register(new ModrinthAdapter());
 *
 * // Get an adapter by name
 * const source = ModSourceFactory.get('modrinth');
 * const results = await source.search('sodium');
 *
 * // List available sources
 * const sources = ModSourceFactory.getSupportedSources();
 * ```
 */

import type { IModSourcePort } from '../../application/ports/outbound/IModSourcePort.js';

/**
 * Factory for creating and managing mod source adapters
 */
export class ModSourceFactory {
  /** Registered adapters by source name */
  private static adapters = new Map<string, IModSourcePort>();

  /**
   * Register a mod source adapter
   * @param adapter - Adapter instance to register
   * @throws Error if an adapter with the same name is already registered
   */
  static register(adapter: IModSourcePort): void {
    const key = adapter.sourceName.toLowerCase();

    if (this.adapters.has(key)) {
      throw new Error(
        `Mod source adapter '${adapter.sourceName}' is already registered`
      );
    }

    this.adapters.set(key, adapter);
  }

  /**
   * Get a registered adapter by source name
   * @param source - Source name (case-insensitive)
   * @returns The registered adapter
   * @throws Error if no adapter is registered for the given source
   */
  static get(source: string): IModSourcePort {
    const key = source.toLowerCase();
    const adapter = this.adapters.get(key);

    if (!adapter) {
      const available = this.getSupportedSources().join(', ');
      throw new Error(
        `Unknown mod source: '${source}'. Available sources: ${available || 'none'}`
      );
    }

    return adapter;
  }

  /**
   * Get a registered adapter or null if not found
   * @param source - Source name (case-insensitive)
   * @returns The registered adapter or null
   */
  static getOrNull(source: string): IModSourcePort | null {
    return this.adapters.get(source.toLowerCase()) ?? null;
  }

  /**
   * Check if a source is registered
   * @param source - Source name (case-insensitive)
   * @returns true if the source is registered
   */
  static isSupported(source: string): boolean {
    return this.adapters.has(source.toLowerCase());
  }

  /**
   * Get list of all registered source names
   * @returns Array of source names
   */
  static getSupportedSources(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get all registered adapters
   * @returns Array of all adapters
   */
  static getAllAdapters(): IModSourcePort[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get the default source name
   * @returns 'modrinth' as the default source
   */
  static getDefaultSource(): string {
    return 'modrinth';
  }

  /**
   * Clear all registered adapters
   * Primarily used for testing
   */
  static clear(): void {
    this.adapters.clear();
  }
}
