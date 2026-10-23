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
  execute(options?: Pick<DeleteServerOptions, 'deleteWorld'>): Promise<boolean>;

  /**
   * Execute server deletion with provided name
   * Used when server name is passed via CLI
   *
   * A boolean second argument is the deprecated `force` form: it deletes
   * without asking, as before. Use `DeleteServerOptions`; the boolean form is
   * removed in v3.0.0 (#736).
   */
  executeWithName(name: string, options?: DeleteServerOptions | boolean): Promise<boolean>;
}

export interface DeleteServerOptions {
  /** Delete even when players are online. */
  force?: boolean;
  /** Skip the confirmation question. */
  yes?: boolean;
  /** Delete the world inside the server instead of moving it to worlds/. */
  deleteWorld?: boolean;
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
