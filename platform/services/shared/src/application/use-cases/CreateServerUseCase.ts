import {
  Server,
  ServerName,
  ServerType,
  McVersion,
  Memory,
  WorldOptions,
} from '../../domain/index.js';
import type {
  ICreateServerUseCase,
  CreateServerConfig,
  IPromptPort,
  IShellPort,
  IServerRepository,
} from '../ports/index.js';

/**
 * Create Server Use Case
 * Orchestrates interactive server creation flow
 */
export class CreateServerUseCase implements ICreateServerUseCase {
  constructor(
    private readonly prompt: IPromptPort,
    private readonly shell: IShellPort,
    private readonly serverRepo: IServerRepository
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
      const worldOptions = await this.prompt.promptWorldOptions();

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

      // Execute creation
      const spinner = this.prompt.spinner();
      spinner.start('Creating server...');

      const result = await this.shell.createServer(name, {
        type,
        version,
        worldOptions,
        memory,
        autoStart: true,
      });

      if (!result.success) {
        spinner.stop('Failed to create server');
        this.prompt.error(result.stderr || 'Unknown error occurred');
        throw new Error(result.stderr || 'Server creation failed');
      }

      spinner.stop('Server created successfully');

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
      throw new Error(result.stderr || 'Server creation failed');
    }

    return server;
  }
}
