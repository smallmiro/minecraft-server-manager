import { World } from '../../../domain/index.js';

/**
 * World Management Use Case - Inbound Port
 * Manages world assignments and locks
 */
export interface IWorldManagementUseCase {
  /**
   * List all worlds with lock status
   */
  listWorlds(): Promise<WorldListResult[]>;

  /**
   * Interactive world assignment
   */
  assignWorld(): Promise<WorldAssignResult>;

  /**
   * Assign world to server by name
   */
  assignWorldByName(worldName: string, serverName: string): Promise<WorldAssignResult>;

  /**
   * Interactive world release
   */
  releaseWorld(): Promise<WorldReleaseResult>;

  /**
   * Release world by name
   */
  releaseWorldByName(worldName: string, force?: boolean): Promise<WorldReleaseResult>;
}

/**
 * World list result
 */
export interface WorldListResult {
  name: string;
  path: string;
  isLocked: boolean;
  lockedBy?: string;
  size: string;
  lastModified?: Date;
}

/**
 * World assignment result
 */
export interface WorldAssignResult {
  success: boolean;
  worldName: string;
  serverName: string;
  error?: string;
}

/**
 * World release result
 */
export interface WorldReleaseResult {
  success: boolean;
  worldName: string;
  previousServer?: string;
  error?: string;
}
