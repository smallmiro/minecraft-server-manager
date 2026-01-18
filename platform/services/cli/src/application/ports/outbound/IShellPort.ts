import { ServerName, ServerType, McVersion, WorldOptions, Memory } from '../../../domain/index.js';

/**
 * Shell Port - Outbound Port
 * Interface for shell script execution
 */
export interface IShellPort {
  // ========================================
  // Server Operations
  // ========================================

  /**
   * Create a new server
   */
  createServer(
    name: ServerName,
    options: CreateServerOptions
  ): Promise<ShellResult>;

  /**
   * Delete a server
   */
  deleteServer(name: ServerName, force?: boolean): Promise<ShellResult>;

  /**
   * Start a server
   */
  startServer(name: ServerName): Promise<ShellResult>;

  /**
   * Stop a server
   */
  stopServer(name: ServerName): Promise<ShellResult>;

  /**
   * Get server logs
   */
  logs(name: ServerName, options?: LogsOptions): Promise<ShellResult>;

  /**
   * Connect to RCON console
   */
  console(name: ServerName): Promise<ShellResult>;

  // ========================================
  // Status Operations
  // ========================================

  /**
   * Get status of all servers
   */
  status(json?: boolean): Promise<ShellResult>;

  // ========================================
  // World Operations
  // ========================================

  /**
   * List worlds
   */
  worldList(json?: boolean): Promise<ShellResult>;

  /**
   * Assign world to server
   */
  worldAssign(worldName: string, serverName: string, force?: boolean): Promise<ShellResult>;

  /**
   * Release world lock
   */
  worldRelease(worldName: string): Promise<ShellResult>;

  // ========================================
  // Player Operations
  // ========================================

  /**
   * Lookup player
   */
  playerLookup(name: string): Promise<ShellResult>;

  /**
   * Get player UUID
   */
  playerUuid(name: string, offline?: boolean): Promise<ShellResult>;

  // ========================================
  // Backup Operations
  // ========================================

  /**
   * Push backup
   */
  backupPush(message?: string): Promise<ShellResult>;

  /**
   * Get backup status
   */
  backupStatus(): Promise<ShellResult>;

  /**
   * Get backup history
   */
  backupHistory(json?: boolean): Promise<ShellResult>;

  /**
   * Restore from backup
   */
  backupRestore(commitHash: string): Promise<ShellResult>;

  // ========================================
  // General Execution
  // ========================================

  /**
   * Execute arbitrary script
   */
  exec(script: string, args?: string[]): Promise<ShellResult>;

  /**
   * Execute script interactively
   */
  execInteractive(script: string, args?: string[]): Promise<number>;
}

/**
 * Create server options
 */
export interface CreateServerOptions {
  type: ServerType;
  version: McVersion;
  worldOptions: WorldOptions;
  memory?: Memory;
  autoStart?: boolean;
}

/**
 * Logs options
 */
export interface LogsOptions {
  follow?: boolean;
  lines?: number;
}

/**
 * Shell execution result
 */
export interface ShellResult {
  code: number;
  stdout: string;
  stderr: string;
  success: boolean;
}
