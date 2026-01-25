/**
 * World creation options
 */
export interface WorldCreateOptions {
  name?: string;
  seed?: string;
  serverName?: string;
  autoStart?: boolean;
}

/**
 * World creation result
 */
export interface WorldCreateResult {
  success: boolean;
  worldName: string;
  seed?: string;
  serverName?: string;
  started?: boolean;
  error?: string;
}

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
   * Interactive world creation with seed support
   */
  createWorld(options?: WorldCreateOptions): Promise<WorldCreateResult>;

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

  /**
   * Interactive world deletion
   */
  deleteWorld(): Promise<WorldDeleteResult>;

  /**
   * Delete world by name
   */
  deleteWorldByName(worldName: string, force?: boolean): Promise<WorldDeleteResult>;
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

/**
 * World delete result
 */
export interface WorldDeleteResult {
  success: boolean;
  worldName: string;
  size?: string;
  error?: string;
}

