import { World, WorldLockStatus } from '../../../domain/index.js';

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
