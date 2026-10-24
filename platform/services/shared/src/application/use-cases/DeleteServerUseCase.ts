import { Server, ServerName } from '../../domain/index.js';
import { AuditActionEnum } from '../../domain/value-objects/AuditAction.js';
import type {
  IDeleteServerUseCase,
  DeleteServerOptions,
  IPromptPort,
  IServerRepository,
  IAuditLogPort,
  IServerConsolePort,
  IContainerRuntimePort,
  IServerSpecRepository,
  IHostnameRegistrarPort,
  HostnameChangeResult,
  ServerSpecDeleteResult,
} from '../ports/index.js';

/** What TypeScript deprovisioning needs besides the runtime (#735). */
export interface ServerDeprovisionDeps {
  specRepo: IServerSpecRepository;
  /** avahi `<name>.local`; skipped when absent. */
  hostnames?: IHostnameRegistrarPort;
}

/** What deprovision did with the world, and the hostname result (undefined without a registrar). */
export interface ServerDeprovisionResult extends ServerSpecDeleteResult {
  hostname?: HostnameChangeResult;
}

/**
 * Lines that say what happened to the world (#652: the message matches
 * what was done; delete-server.sh's summary).
 */
function describeWorldOutcome(result: ServerSpecDeleteResult, deleteWorld: boolean): string[] {
  const kept = result.keptWorld
    ? [`World worlds/${result.keptWorld} was kept; it is no longer assigned to this server.`]
    : [];
  if (deleteWorld) return ['World data inside the server was deleted with it (--delete-world).', ...kept];
  if (result.movedWorlds.length > 0) {
    return [`World moved to worlds/${result.level}; it can be assigned to another server.`];
  }
  return kept.length > 0 ? kept : [`No world data found for LEVEL '${result.level}'.`];
}

/**
 * Delete Server Use Case
 * Orchestrates server deletion with confirmation
 */
export class DeleteServerUseCase implements IDeleteServerUseCase {
  /**
   * @param runtime removes the server's container (#735).
   * @param deprovisionDeps the ServerSpec repository and hostname registrar (#735).
   */
  constructor(
    private readonly prompt: IPromptPort,
    private readonly serverRepo: IServerRepository,
    private readonly runtime: IContainerRuntimePort,
    private readonly deprovisionDeps: ServerDeprovisionDeps,
    private readonly auditLog?: IAuditLogPort,
    private readonly serverConsole?: IServerConsolePort
  ) {}

  /**
   * Remove a server without asking (#735).
   * Order: plan its worlds (nothing is touched when that is unsafe, #652),
   * remove its container (a failed stop deletes nothing), move the world and
   * remove the files, then unregister `<name>.local` (best effort).
   * Rejects with what happened when the server is not deleted.
   * No backup before the delete: the world is kept in worlds/ (#652).
   */
  async deprovision(name: string, options: { deleteWorld?: boolean } = {}): Promise<ServerDeprovisionResult> {
    const { specRepo, hostnames } = this.deprovisionDeps;
    const deleteWorld = options.deleteWorld === true;

    await specRepo.delete(name, { deleteWorld, dryRun: true });
    const removed = await this.runtime.remove(ServerName.fromExisting(name));
    if (!removed.success) {
      throw new Error(`${removed.error || removed.stderr || `Failed to remove container mc-${name}`}. Nothing was deleted.`);
    }
    let result: ServerSpecDeleteResult;
    try {
      result = await specRepo.delete(name, { deleteWorld });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Container mc-${name} was stopped and removed. ${message}`, { cause: error });
    }
    const hostname = hostnames ? await hostnames.unregister(`${name}.local`) : undefined;
    return { ...result, hostname };
  }

  /**
   * Fill in who is online (the repository does not). Returns false when the
   * server runs but RCON could not tell; without a console port it stays 0.
   */
  private async loadPlayerCount(server: Server): Promise<boolean> {
    if (!server.isRunning || !this.serverConsole) return true;
    const players = await this.serverConsole.listPlayers(server.name).catch(() => null);
    if (!players) return false;
    server.setPlayerCount(players.online);
    return true;
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
      if (!(await this.loadPlayerCount(server))) {
        this.prompt.warn('Could not read the online player count over RCON.');
      }

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
  async executeWithName(name: string, options: DeleteServerOptions): Promise<boolean> {
    const { force = false, yes = false, deleteWorld = false } = options;
    // Check if server exists
    const server = await this.serverRepo.findByName(name);

    if (!server) {
      throw new Error(`Server '${name}' not found`);
    }
    const playersKnown = await this.loadPlayerCount(server);

    // Refuse without force when players are online, or when that is unknown
    if (!force && server.isRunning && (!playersKnown || server.hasPlayers)) {
      const reason = playersKnown
        ? `has ${server.playerCount} player(s) online`
        : 'is running and its online players could not be read over RCON';
      await this.auditLog?.log({
        action: AuditActionEnum.SERVER_DELETE,
        actor: 'cli:local',
        targetType: 'server',
        targetName: name,
        status: 'failure',
        errorMessage: `Server ${reason}`,
        details: null,
      });
      throw new Error(`Server '${name}' ${reason}. Use --force to delete anyway.`);
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
    const name = server.name.value;
    const spinner = this.prompt.spinner();
    const audit = (status: 'success' | 'failure', errorMessage: string | null) =>
      this.auditLog?.log({
        action: AuditActionEnum.SERVER_DELETE,
        actor: 'cli:local',
        targetType: 'server',
        targetName: name,
        status,
        errorMessage,
        details: null,
      });

    spinner.start('Removing server...');
    let result: ServerDeprovisionResult;
    try {
      result = await this.deprovision(name, { deleteWorld });
    } catch (error) {
      spinner.stop('Deletion failed');
      const message = error instanceof Error ? error.message : String(error);
      this.prompt.error(message);
      await audit('failure', message);
      return false;
    }
    spinner.stop('Server removed');

    for (const line of describeWorldOutcome(result, deleteWorld)) this.prompt.info(line);
    if (result.warning) this.prompt.warn(result.warning);
    if (result.hostname?.status === 'skipped') {
      this.prompt.warn(`mDNS hostname ${name}.local was not removed: ${result.hostname.reason}`);
    }
    await audit('success', null);
    this.prompt.success(`Server '${name}' deleted`);
    this.prompt.outro('Server removed successfully');
    return true;
  }
}
