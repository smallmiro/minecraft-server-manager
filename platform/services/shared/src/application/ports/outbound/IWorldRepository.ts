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
   * Get lock status for a world
   */
  getLockStatus(name: string): Promise<WorldLockData | null>;

  /**
   * Get all worlds with their server status
   * Returns worlds categorized by availability
   */
  findAllWithServerStatus(): Promise<WorldWithServerStatus[]>;

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
}

/**
 * World lock data from lock file
 */
export interface WorldLockData {
  worldName: string;
  serverName: string;
  timestamp: Date;
  pid?: number;
}
