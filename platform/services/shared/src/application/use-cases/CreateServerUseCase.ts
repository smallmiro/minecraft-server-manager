import {
  Server,
  ServerName,
  ServerType,
  McVersion,
  Memory,
  WorldOptions,
  WorldSetupType,
} from '../../domain/index.js';
import { AuditActionEnum } from '../../domain/value-objects/AuditAction.js';
import type {
  ICreateServerUseCase,
  CreateServerConfig,
  IPromptPort,
  IShellPort,
  IServerRepository,
  IWorldRepository,
  IAuditLogPort,
} from '../ports/index.js';

/**
 * Create Server Use Case
 * Orchestrates interactive server creation flow
 */
export class CreateServerUseCase implements ICreateServerUseCase {
  constructor(
    private readonly prompt: IPromptPort,
    private readonly shell: IShellPort,
    private readonly serverRepo: IServerRepository,
    private readonly worldRepo?: IWorldRepository,
    private readonly auditLog?: IAuditLogPort
  ) {}

  /**
   * Execute interactive server creation
   */
  async execute(): Promise<Server> {
    this.prompt.intro('Create Minecraft Server');

    try {
      // Prompt for server name
      const name = await this.prompt.promptServerName();

      // Check if server already exists
      if (await this.serverRepo.exists(name.value)) {
        this.prompt.error(`Server '${name.value}' already exists`);
        this.prompt.handleCancel();
      }

      // Prompt for server type
      const type = await this.prompt.promptServerType();

      // Prompt for Minecraft version
      const version = await this.prompt.promptMcVersion(type);

      // Prompt for world options
      let worldOptions = await this.prompt.promptWorldOptions();

      // If "existing" was selected and we have a world repository,
      // show the enhanced world selection with availability status
      if (
        worldOptions.setupType === WorldSetupType.EXISTING &&
        this.worldRepo
      ) {
        const worldsWithStatus = await this.worldRepo.findAllWithServerStatus();
        const selectedWorld =
          await this.prompt.promptExistingWorldSelection(worldsWithStatus);

        if (selectedWorld) {
          worldOptions = WorldOptions.existingWorld(selectedWorld.name);
        } else {
          // User cancelled or no world available, fallback to new world
          this.prompt.info('Creating a new world instead');
          worldOptions = WorldOptions.newWorld();
        }
      }

      // Prompt for memory
      const memory = await this.prompt.promptMemory();

      // Create server configuration
      const server = Server.create({
        name,
        type,
        version,
        memory,
        worldOptions,
      });

      // Execute creation - stop spinner before running script to avoid output conflicts
      const spinner = this.prompt.spinner();
      spinner.start('Creating server...');
      spinner.stop('Running create script...');

      const result = await this.shell.createServer(name, {
        type,
        version,
        worldOptions,
        memory,
        autoStart: true,
      });

      if (!result.success) {
        this.prompt.error(result.stderr || 'Unknown error occurred');
        // Log audit failure
        await this.auditLog?.log({
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: name.value,
          status: 'failure',
          errorMessage: result.stderr || 'Unknown error occurred',
          details: null,
        });
        throw new Error(result.stderr || 'Server creation failed');
      }

      // Log audit success
      await this.auditLog?.log({
        action: AuditActionEnum.SERVER_CREATE,
        actor: 'cli:local',
        targetType: 'server',
        targetName: name.value,
        status: 'success',
        details: {
          type: type.value,
          version: version.value,
          memory: memory.value,
        },
        errorMessage: null,
      });

      this.prompt.success(`Server '${name.value}' created!`);
      this.prompt.note(
        `Connect via: ${name.hostname}:25565`,
        'Connection Info'
      );

      this.prompt.outro('Happy mining!');

      return server;
    } catch (error) {
      if (this.prompt.isCancel(error)) {
        this.prompt.outro('Server creation cancelled');
        throw error;
      }
      throw error;
    }
  }

  /**
   * Execute server creation with provided configuration
   */
  async executeWithConfig(config: CreateServerConfig): Promise<Server> {
    // Parse configuration
    const name = ServerName.create(config.name);
    const type = config.type
      ? ServerType.create(config.type)
      : ServerType.getRecommended();
    const version = config.version
      ? McVersion.create(config.version)
      : McVersion.latest();
    const memory = config.memory
      ? Memory.create(config.memory)
      : Memory.default();

    // Determine world options
    let worldOptions: WorldOptions;
    if (config.worldUrl) {
      worldOptions = WorldOptions.downloadWorld(config.worldUrl);
    } else if (config.worldName) {
      worldOptions = WorldOptions.existingWorld(config.worldName);
    } else if (config.seed) {
      worldOptions = WorldOptions.newWorld(config.seed);
    } else {
      worldOptions = WorldOptions.default();
    }

    // Check if server already exists
    if (await this.serverRepo.exists(name.value)) {
      throw new Error(`Server '${name.value}' already exists`);
    }

    // Create server
    const server = Server.create({
      name,
      type,
      version,
      memory,
      worldOptions,
    });

    // Execute creation
    const result = await this.shell.createServer(name, {
      type,
      version,
      worldOptions,
      memory,
      autoStart: config.autoStart ?? true,
    });

    if (!result.success) {
      // Log audit failure
      await this.auditLog?.log({
        action: AuditActionEnum.SERVER_CREATE,
        actor: 'cli:local',
        targetType: 'server',
        targetName: name.value,
        status: 'failure',
        errorMessage: result.stderr || 'Server creation failed',
        details: null,
      });
      throw new Error(result.stderr || 'Server creation failed');
    }

    // Log audit success
    await this.auditLog?.log({
      action: AuditActionEnum.SERVER_CREATE,
      actor: 'cli:local',
      targetType: 'server',
      targetName: name.value,
      status: 'success',
      details: {
        type: type.value,
        version: version.value,
        memory: memory.value,
      },
      errorMessage: null,
    });

    return server;
  }
}
