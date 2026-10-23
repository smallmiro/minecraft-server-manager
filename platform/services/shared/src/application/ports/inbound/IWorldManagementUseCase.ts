import type { WorldAssignmentErrorCode } from '../../../domain/services/worldAssignment.js';

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
  /** Set when an assignment rule refused the request (#670). */
  errorCode?: WorldAssignmentErrorCode;
}

/**
 * Options for importing a world from a zip archive
 */
export interface WorldImportOptions {
  zipPath: string;
  worldName: string;
}

/**
 * Result of importing a world from a zip archive
 */
export interface WorldImportResult {
  success: boolean;
  worldName: string;
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
   * List worlds that are not mapped to any server (servers.length === 0).
   * Satellites are already folded into their parent by listWorlds().
   */
  listUnmappedWorlds(): Promise<WorldListResult[]>;

  /**
   * Interactive world creation with seed support
   */
  createWorld(options?: WorldCreateOptions): Promise<WorldCreateResult>;

  /**
   * Interactive world assignment
   */
  assignWorld(): Promise<WorldAssignResult>;

  /**
   * Assign world to server by name (writes the server's LEVEL).
   * `requireExisting` (default true): the world must already exist in worlds/.
   */
  assignWorldByName(
    worldName: string,
    serverName: string,
    options?: { requireExisting?: boolean }
  ): Promise<WorldAssignResult>;

  /**
   * Interactive world release
   */
  releaseWorld(): Promise<WorldReleaseResult>;

  /**
   * Release world by name: the holder falls back to its own world `<server>`.
   * `force` is accepted and ignored (#670).
   */
  releaseWorldByName(worldName: string, force?: boolean): Promise<WorldReleaseResult>;

  /**
   * Interactive world deletion
   */
  deleteWorld(): Promise<WorldDeleteResult>;

  /**
   * Delete world by name. Refused while a server's LEVEL points at it;
   * `force` only skips the prompt, it no longer bypasses that check (#670).
   */
  deleteWorldByName(worldName: string, force?: boolean): Promise<WorldDeleteResult>;

  /**
   * Import a world from a zip archive (non-interactive)
   */
  importWorldFromZip(options: WorldImportOptions): Promise<WorldImportResult>;
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
  /** Names of servers configured to use this world (via their LEVEL config). */
  servers: string[];
  /** Whether split-dimension satellites exist alongside this world. */
  dimensions?: { nether: boolean; end: boolean };
}

/**
 * World assignment result
 */
export interface WorldAssignResult {
  success: boolean;
  worldName: string;
  serverName: string;
  error?: string;
  errorCode?: WorldAssignmentErrorCode;
}

/**
 * World release result
 */
export interface WorldReleaseResult {
  success: boolean;
  worldName: string;
  previousServer?: string;
  /** The world the previous holder now uses: its own name (#670). */
  fallbackWorld?: string;
  /** Whether worlds/<fallbackWorld> already exists (adopted) or is created on next start. */
  fallbackExists?: boolean;
  error?: string;
  errorCode?: WorldAssignmentErrorCode;
}

/**
 * World delete result
 */
export interface WorldDeleteResult {
  success: boolean;
  worldName: string;
  size?: string;
  error?: string;
  errorCode?: WorldAssignmentErrorCode;
}

