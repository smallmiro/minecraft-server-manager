import { Server, ServerStatus } from '../../domain/index.js';
import { AuditActionEnum } from '../../domain/value-objects/AuditAction.js';
import type {
  IDeleteServerUseCase,
  DeleteServerOptions,
  IPromptPort,
  IShellPort,
  IServerRepository,
  IAuditLogPort,
  IServerConsolePort,
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
    private readonly auditLog?: IAuditLogPort,
    private readonly serverConsole?: IServerConsolePort
  ) {}

  /** Fill in who is online (the repository does not); unknown stays 0. */
  private async loadPlayerCount(server: Server): Promise<void> {
    if (!server.isRunning || !this.serverConsole) return;
    const players = await this.serverConsole.listPlayers(server.containerName);
    if (players) server.setPlayerCount(players.online);
  }

  private confirmMessage(deleteWorld: boolean): string {
    return deleteWorld
      ? 'Delete this server AND the world inside it? This cannot be undone.'
      : 'Delete this server? Its world will be kept in worlds/.';
  }

  /**
   * Execute interactive server deletion
   */
  async execute(options: Pick<DeleteServerOptions, 'deleteWorld'> = {}): Promise<boolean> {
    const deleteWorld = options.deleteWorld ?? false;
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
      await this.loadPlayerCount(server);

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
        message: this.confirmMessage(deleteWorld),
        initialValue: false,
      });

      if (!confirmed) {
        this.prompt.outro('Deletion cancelled');
        return false;
      }

      // Execute deletion
      return await this.performDeletion(server, deleteWorld);
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
  async executeWithName(name: string, options: DeleteServerOptions = {}): Promise<boolean> {
    const { force = false, yes = false, deleteWorld = false } = options;
    // Check if server exists
    const server = await this.serverRepo.findByName(name);

    if (!server) {
      throw new Error(`Server '${name}' not found`);
    }
    await this.loadPlayerCount(server);

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

    if (!yes) {
      const confirmed = await this.prompt.confirm({
        message: this.confirmMessage(deleteWorld),
        initialValue: false,
      });
      if (!confirmed) {
        this.prompt.outro('Deletion cancelled');
        return false;
      }
    }

    return await this.performDeletion(server, deleteWorld);
  }

  /**
   * Perform the actual deletion
   */
  private async performDeletion(server: Server, deleteWorld: boolean): Promise<boolean> {
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

      const result = await this.shell.deleteServer(server.name, true, deleteWorld);

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

      // The script's summary already says what happened to the world.
      this.prompt.success(`Server '${server.name.value}' deleted`);

      this.prompt.outro('Server removed successfully');
      return true;
    } catch (error) {
      spinner.stop('Deletion failed');
      throw error;
    }
  }
}
