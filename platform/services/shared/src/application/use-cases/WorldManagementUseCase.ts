import type {
  IWorldManagementUseCase,
  WorldListResult,
  WorldAssignResult,
  WorldReleaseResult,
  IPromptPort,
  IShellPort,
  IWorldRepository,
  IServerRepository,
} from '../ports/index.js';

/**
 * World Management Use Case
 * Manages world assignments and locks
 */
export class WorldManagementUseCase implements IWorldManagementUseCase {
  constructor(
    private readonly prompt: IPromptPort,
    private readonly shell: IShellPort,
    private readonly worldRepo: IWorldRepository,
    private readonly serverRepo: IServerRepository
  ) {}

  /**
   * List all worlds with lock status
   */
  async listWorlds(): Promise<WorldListResult[]> {
    const worlds = await this.worldRepo.findAll();

    return worlds.map((world) => ({
      name: world.name,
      path: world.path,
      isLocked: world.isLocked,
      lockedBy: world.lockedBy,
      size: world.sizeFormatted,
      lastModified: world.lastModified,
    }));
  }

  /**
   * Interactive world assignment
   */
  async assignWorld(): Promise<WorldAssignResult> {
    this.prompt.intro('Assign World to Server');

    try {
      // Get unlocked worlds
      const worlds = await this.worldRepo.findUnlocked();

      if (worlds.length === 0) {
        this.prompt.warn('No unlocked worlds available');
        this.prompt.outro('All worlds are currently assigned');
        return {
          success: false,
          worldName: '',
          serverName: '',
          error: 'No unlocked worlds available',
        };
      }

      // Prompt for world selection
      const world = await this.prompt.promptWorldSelection(worlds);

      // Get servers
      const servers = await this.serverRepo.findAll();

      if (servers.length === 0) {
        this.prompt.warn('No servers available');
        this.prompt.outro('Create a server first');
        return {
          success: false,
          worldName: world.name,
          serverName: '',
          error: 'No servers available',
        };
      }

      // Prompt for server selection
      const server = await this.prompt.promptServerSelection(servers);

      // Execute assignment
      const spinner = this.prompt.spinner();
      spinner.start('Assigning world...');

      const result = await this.shell.worldAssign(
        world.name,
        server.name.value
      );

      if (!result.success) {
        spinner.stop('Failed to assign world');
        this.prompt.error(result.stderr || 'Unknown error');
        return {
          success: false,
          worldName: world.name,
          serverName: server.name.value,
          error: result.stderr,
        };
      }

      spinner.stop('World assigned');
      this.prompt.success(`World '${world.name}' assigned to '${server.name.value}'`);
      this.prompt.outro('Assignment complete');

      return {
        success: true,
        worldName: world.name,
        serverName: server.name.value,
      };
    } catch (error) {
      if (this.prompt.isCancel(error)) {
        this.prompt.outro('Assignment cancelled');
        return {
          success: false,
          worldName: '',
          serverName: '',
          error: 'Cancelled',
        };
      }
      throw error;
    }
  }

  /**
   * Assign world to server by name
   */
  async assignWorldByName(
    worldName: string,
    serverName: string
  ): Promise<WorldAssignResult> {
    // Check world exists
    const world = await this.worldRepo.findByName(worldName);
    if (!world) {
      return {
        success: false,
        worldName,
        serverName,
        error: `World '${worldName}' not found`,
      };
    }

    // Check world is not locked
    if (world.isLocked) {
      return {
        success: false,
        worldName,
        serverName,
        error: `World '${worldName}' is already locked by '${world.lockedBy}'`,
      };
    }

    // Check server exists
    if (!(await this.serverRepo.exists(serverName))) {
      return {
        success: false,
        worldName,
        serverName,
        error: `Server '${serverName}' not found`,
      };
    }

    // Execute assignment
    const result = await this.shell.worldAssign(worldName, serverName);

    return {
      success: result.success,
      worldName,
      serverName,
      error: result.success ? undefined : result.stderr,
    };
  }

  /**
   * Interactive world release
   */
  async releaseWorld(): Promise<WorldReleaseResult> {
    this.prompt.intro('Release World Lock');

    try {
      // Get locked worlds
      const worlds = await this.worldRepo.findLocked();

      if (worlds.length === 0) {
        this.prompt.warn('No locked worlds found');
        this.prompt.outro('All worlds are unlocked');
        return {
          success: false,
          worldName: '',
          error: 'No locked worlds found',
        };
      }

      // Prompt for world selection
      const world = await this.prompt.promptWorldSelection(worlds);

      // Confirm release
      const confirmed = await this.prompt.confirm({
        message: `Release lock on '${world.name}' (locked by ${world.lockedBy})?`,
        initialValue: true,
      });

      if (!confirmed) {
        this.prompt.outro('Release cancelled');
        return {
          success: false,
          worldName: world.name,
          error: 'Cancelled',
        };
      }

      // Execute release
      const spinner = this.prompt.spinner();
      spinner.start('Releasing lock...');

      const result = await this.shell.worldRelease(world.name);

      if (!result.success) {
        spinner.stop('Failed to release lock');
        this.prompt.error(result.stderr || 'Unknown error');
        return {
          success: false,
          worldName: world.name,
          previousServer: world.lockedBy,
          error: result.stderr,
        };
      }

      spinner.stop('Lock released');
      this.prompt.success(`World '${world.name}' is now unlocked`);
      this.prompt.outro('Release complete');

      return {
        success: true,
        worldName: world.name,
        previousServer: world.lockedBy,
      };
    } catch (error) {
      if (this.prompt.isCancel(error)) {
        this.prompt.outro('Release cancelled');
        return {
          success: false,
          worldName: '',
          error: 'Cancelled',
        };
      }
      throw error;
    }
  }

  /**
   * Release world by name
   */
  async releaseWorldByName(
    worldName: string,
    force = false
  ): Promise<WorldReleaseResult> {
    // Check world exists
    const world = await this.worldRepo.findByName(worldName);
    if (!world) {
      return {
        success: false,
        worldName,
        error: `World '${worldName}' not found`,
      };
    }

    // Check world is locked
    if (!world.isLocked) {
      return {
        success: false,
        worldName,
        error: `World '${worldName}' is not locked`,
      };
    }

    // Execute release
    const result = await this.shell.worldRelease(worldName);

    return {
      success: result.success,
      worldName,
      previousServer: world.lockedBy,
      error: result.success ? undefined : result.stderr,
    };
  }
}
