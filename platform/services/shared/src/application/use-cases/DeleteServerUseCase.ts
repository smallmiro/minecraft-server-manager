import { Server, ServerStatus } from '../../domain/index.js';
import { AuditActionEnum } from '../../domain/value-objects/AuditAction.js';
import type {
  IDeleteServerUseCase,
  IPromptPort,
  IShellPort,
  IServerRepository,
  IAuditLogPort,
} from '../ports/index.js';

/**
 * Delete Server Use Case
 * Orchestrates server deletion with confirmation
 */
export class DeleteServerUseCase implements IDeleteServerUseCase {
  constructor(
    private readonly prompt: IPromptPort,
    private readonly shell: IShellPort,
    private readonly serverRepo: IServerRepository,
    private readonly auditLog?: IAuditLogPort
  ) {}

  /**
   * Execute interactive server deletion
   */
  async execute(): Promise<boolean> {
    this.prompt.intro('Delete Minecraft Server');

    try {
      // Get all servers
      const servers = await this.serverRepo.findAll();

      if (servers.length === 0) {
        this.prompt.warn('No servers found');
        this.prompt.outro('Nothing to delete');
        return false;
      }

      // Prompt for server selection
      const server = await this.prompt.promptServerSelection(servers);

      // Show server info
      this.prompt.note(
        `Name: ${server.name.value}\n` +
          `Type: ${server.type.label} ${server.version.value}\n` +
          `Status: ${server.status}\n` +
          (server.hasPlayers ? `Players: ${server.playerCount} online` : ''),
        'Server Info'
      );

      // Warn if running with players
      if (server.isRunning && server.hasPlayers) {
        this.prompt.warn(
          `Warning: ${server.playerCount} player(s) are currently online!`
        );
      }

      // Confirm deletion
      const confirmed = await this.prompt.confirm({
        message: 'Are you sure you want to delete this server?',
        initialValue: false,
      });

      if (!confirmed) {
        this.prompt.outro('Deletion cancelled');
        return false;
      }

      // Execute deletion
      return await this.performDeletion(server);
    } catch (error) {
      if (this.prompt.isCancel(error)) {
        this.prompt.outro('Deletion cancelled');
        return false;
      }
      throw error;
    }
  }

  /**
   * Execute server deletion with provided name
   */
  async executeWithName(name: string, force = false): Promise<boolean> {
    // Check if server exists
    const server = await this.serverRepo.findByName(name);

    if (!server) {
      throw new Error(`Server '${name}' not found`);
    }

    // If not force mode and server has players, throw error
    if (!force && server.isRunning && server.hasPlayers) {
      // Log audit failure
      await this.auditLog?.log({
        action: AuditActionEnum.SERVER_DELETE,
        actor: 'cli:local',
        targetType: 'server',
        targetName: name,
        status: 'failure',
        errorMessage: `Server has ${server.playerCount} player(s) online`,
        details: null,
      });
      throw new Error(
        `Server '${name}' has ${server.playerCount} player(s) online. Use --force to delete anyway.`
      );
    }

    return await this.performDeletion(server, force);
  }

  /**
   * Perform the actual deletion
   */
  private async performDeletion(server: Server, force = false): Promise<boolean> {
    const spinner = this.prompt.spinner();

    try {
      // Stop server if running
      if (server.isRunning) {
        spinner.start('Stopping server...');
        await this.shell.stopServer(server.name);
        spinner.stop('Server stopped');
      }

      // Delete server - stop spinner before running script to avoid output conflicts
      // Always pass force=true since confirmation was already handled by UseCase
      spinner.start('Removing server...');
      spinner.stop('Running delete script...');

      const result = await this.shell.deleteServer(server.name, true);

      if (!result.success) {
        this.prompt.error(result.stderr || 'Unknown error occurred');
        // Log audit failure
        await this.auditLog?.log({
          action: AuditActionEnum.SERVER_DELETE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: server.name.value,
          status: 'failure',
          errorMessage: result.stderr || 'Unknown error occurred',
          details: null,
        });
        return false;
      }

      // Log audit success
      await this.auditLog?.log({
        action: AuditActionEnum.SERVER_DELETE,
        actor: 'cli:local',
        targetType: 'server',
        targetName: server.name.value,
        status: 'success',
        details: null,
        errorMessage: null,
      });

      this.prompt.success(`Server '${server.name.value}' deleted`);

      // Note about world preservation
      if (server.worldOptions.isExistingWorld) {
        this.prompt.note(
          `World data preserved in worlds/${server.worldOptions.worldName}/`,
          'World Data'
        );
      }

      this.prompt.outro('Server removed successfully');
      return true;
    } catch (error) {
      spinner.stop('Deletion failed');
      throw error;
    }
  }
}
