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
  executeWithConfig(config: CreateServerConfig): Promise<Server>;
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
  enableWhitelist?: boolean;
  whitelistPlayers?: string[];
}
