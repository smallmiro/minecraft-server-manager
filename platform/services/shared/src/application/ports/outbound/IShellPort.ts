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
   * Delete a server. Its world is moved to worlds/ unless deleteWorld is true.
   */
  deleteServer(name: ServerName, force?: boolean, deleteWorld?: boolean): Promise<ShellResult>;

  /**
   * Start a server
   */
  startServer(name: ServerName | string): Promise<ShellResult>;

  /**
   * Stop a server
   */
  stopServer(name: ServerName | string): Promise<ShellResult>;

  /**
   * Get server status
   *
   * @deprecated `mcctl.sh status` ignores the name, so this never reported one
   * server. Use IContainerRuntimePort.getStatus. Removed in v3.0.0 (#736).
   */
  serverStatus(name: string): Promise<ShellResult>;

  /**
   * Set server config value
   */
  setServerConfig(serverName: string, key: string, value: string): Promise<ShellResult>;

  /**
   * Get server logs
   *
   * @deprecated Unused by the CLI. Use `mcctl logs` (docker compose logs) directly. Removed in v3.0.0 (#736).
   */
  logs(name: ServerName, options?: LogsOptions): Promise<ShellResult>;

  /**
   * Connect to RCON console
   *
   * @deprecated Unused by the CLI. Use `mcctl console`/RCON via the runtime port. Removed in v3.0.0 (#736).
   */
  console(name: ServerName): Promise<ShellResult>;

  // ========================================
  // Status Operations
  // ========================================

  /**
   * Get status of all servers
   *
   * @deprecated Unused by the CLI. Use `mcctl status`. Removed in v3.0.0 (#736).
   */
  status(json?: boolean): Promise<ShellResult>;

  // ========================================
  // World Operations
  // ========================================

  /**
   * List worlds
   *
   * @deprecated Unused by the CLI, and fails since lock.sh was removed (#670). Use IWorldRepository /
   * `mcctl world list`. Removed in v3.0.0 (#736).
   */
  worldList(json?: boolean): Promise<ShellResult>;

  /**
   * Assign world to server
   *
   * @deprecated Writes a worlds/.locks file nothing reads (#670). Use
   * IWorldAssignmentPort.assign (or WorldManagementUseCase.assignWorldByName).
   * Removed in v3.0.0 (#736).
   */
  worldAssign(worldName: string, serverName: string, force?: boolean): Promise<ShellResult>;

  /**
   * Release world lock
   *
   * @deprecated Removes a worlds/.locks file nothing reads (#670). Use
   * IWorldAssignmentPort.release (or WorldManagementUseCase.releaseWorldByName).
   * Removed in v3.0.0 (#736).
   */
  worldRelease(worldName: string): Promise<ShellResult>;

  // ========================================
  // Player Operations
  // ========================================

  /**
   * Lookup player
   *
    * @deprecated Use `mcctl player info <name> [--offline]` (CLI, mojang-api.ts). player.sh was removed in #730. Removed in v3.0.0 (#736).
   */
  playerLookup(name: string): Promise<ShellResult>;

  /**
   * Get player UUID
   *
    * @deprecated Use `mcctl player info <name> [--offline]` (CLI, mojang-api.ts). player.sh was removed in #730. Removed in v3.0.0 (#736).
   */
  playerUuid(name: string, offline?: boolean): Promise<ShellResult>;

  // ========================================
  // Backup Operations
  // ========================================

  /**
   * Push backup
   * @deprecated Use IWorldBackupPort (#732). Removed in #736.
   */
  backupPush(message?: string): Promise<ShellResult>;

  /**
   * Get backup status
   * @deprecated Use IWorldBackupPort (#732). Removed in #736.
   */
  backupStatus(): Promise<ShellResult>;

  /**
   * Get backup history
   * @deprecated Use IWorldBackupPort (#732). Removed in #736.
   */
  backupHistory(json?: boolean): Promise<ShellResult>;

  /**
   * Restore from backup
   * @deprecated Use IWorldBackupPort (#732). Removed in #736.
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
  modpackSlug?: string;
  modpackVersion?: string;
  modLoader?: string;
  /**
   * Mods to exclude from modpack installation (e.g. client-only mods that
   * crash a dedicated server). Maps to MODRINTH_EXCLUDE_FILES / CF_EXCLUDE_MODS.
   */
  modpackExcludeFiles?: string[];
  enableWhitelist?: boolean;
  whitelistPlayers?: string[];
  playitDomain?: string;
  noPlayitDomain?: boolean;
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
