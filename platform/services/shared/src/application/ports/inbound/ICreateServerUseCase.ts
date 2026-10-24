import { Server } from '../../../domain/index.js';

/**
 * Create Server Use Case - Inbound Port
 * Orchestrates interactive server creation flow
 */
export interface ICreateServerUseCase {
  /**
   * Execute interactive server creation
   * Prompts user for all configuration options
   */
  execute(): Promise<Server>;

  /**
   * Execute server creation with provided configuration
   * Used when arguments are passed via CLI
   */
  executeWithConfig(config: CreateServerConfig, options?: CreateServerRunOptions): Promise<Server>;
}

/**
 * Server creation configuration
 * Used for non-interactive mode
 */
export interface CreateServerConfig {
  name: string;
  type?: string;
  version?: string;
  memory?: string;
  seed?: string;
  worldName?: string;
  worldUrl?: string;
  autoStart?: boolean;
  modpackSlug?: string;
  modpackVersion?: string;
  modLoader?: string;
  /**
   * Mods to exclude from modpack installation (client-only mods that crash a
   * dedicated server). Maps to MODRINTH_EXCLUDE_FILES / CF_EXCLUDE_MODS.
   */
  modpackExcludeFiles?: string[];
  /** Off by default; on when true or whitelistPlayers is non-empty. false always wins. */
  enableWhitelist?: boolean;
  whitelistPlayers?: string[];
  playitDomain?: string;
  noPlayitDomain?: boolean;
}

/**
 * Progress of a TypeScript provision (#675, ADR-0003 §5). The stages are the
 * statuses of the API `server-create` SSE event; log lines become
 * `server-create-log`.
 */
export interface CreateServerRunOptions {
  onProgress?(stage: 'creating' | 'configuring' | 'starting', message: string): void;
  onLog?(line: string): void;
}
