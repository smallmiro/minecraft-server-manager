import { Server } from '../../../domain/index.js';

/**
 * Delete Server Use Case - Inbound Port
 * Orchestrates server deletion with confirmation
 */
export interface IDeleteServerUseCase {
  /**
   * Execute interactive server deletion
   * Shows server selection and confirmation prompts
   */
  execute(): Promise<boolean>;

  /**
   * Execute server deletion with provided name
   * Used when server name is passed via CLI
   */
  executeWithName(name: string, force?: boolean): Promise<boolean>;
}

/**
 * Server deletion result
 */
export interface DeleteServerResult {
  success: boolean;
  serverName: string;
  worldPreserved?: string;
  error?: string;
}
