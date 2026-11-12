import { World, WorldLockStatus } from '../../../domain/index.js';

/**
 * Server status for world availability
 */
export type ServerStatus = 'running' | 'stopped' | 'not_found';

/**
 * World availability category
 */
export type WorldAvailabilityCategory = 'available' | 'stopped' | 'running';

/**
 * World with server status information
 */
export interface WorldWithServerStatus {
  world: World;
  assignedServer?: string;
  serverStatus?: ServerStatus;
  category: WorldAvailabilityCategory;
}

/**
 * A world inside servers/<server>/data, not in worlds/ (D-1, #655):
 * `mcctl migrate worlds` should move it.
 */
export interface ServerInternalWorld {
  server: string;
  /** The server's LEVEL (default `world`) */
  world: string;
  /** servers/<server>/data/<world> */
  path: string;
  /** Split-dimension folders next to it (Paper/Spigot): data/<world>_nether, data/<world>_the_end */
  dimensions: string[];
  /** false: the server already reads worlds/; an earlier migrate left this copy behind */
  inUse: boolean;
}

/**
 * World Repository Port - Outbound Port
 * Interface for world data access
 */
export interface IWorldRepository {
  /**
   * Get all worlds
   */
  findAll(): Promise<World[]>;

  /**
   * Find world by name
   */
  findByName(name: string): Promise<World | null>;

  /**
   * Check if world exists
   */
  exists(name: string): Promise<boolean>;

  /**
   * Get unlocked worlds
   */
  findUnlocked(): Promise<World[]>;

  /**
   * Get locked worlds
   */
  findLocked(): Promise<World[]>;

  /**
   * Get worlds locked by a specific server
   */
  findByServer(serverName: string): Promise<World[]>;

  /**
   * List world names
   */
  listNames(): Promise<string[]>;

  /**
   * Get all worlds with their server status
   * Returns worlds categorized by availability
   */
  findAllWithServerStatus(): Promise<WorldWithServerStatus[]>;

  /**
   * Worlds in servers/<n>/data/<LEVEL> (real directories, not links), one per
   * server whose assignment can be read (#655).
   */
  findServerInternalWorlds(): Promise<ServerInternalWorld[]>;

  /**
   * Delete a world directory
   * @param name World name to delete
   * @returns true if deleted successfully
   */
  delete(name: string): Promise<boolean>;

  /**
   * Create a new world directory with optional seed
   * @param name World name to create
   * @param seed Optional seed for world generation
   * @returns Created World entity
   */
  create(name: string, seed?: string): Promise<World>;

  /**
   * Get seed for a world from .meta file
   * @param name World name
   * @returns Seed string or null if not found
   */
  getSeed(name: string): Promise<string | null>;

  /**
   * Import a world from a .zip archive at zipPath.
   * Extracts, validates a level.dat exists, places the main world at worlds/<name>/
   * and any split satellites at worlds/<name>_nether/ and worlds/<name>_the_end/.
   * Writes .meta. Throws if name exists or no level.dat found.
   */
  importFromZip(name: string, zipPath: string): Promise<World>;
}
