import type {
  IWorldManagementUseCase,
  WorldListResult,
  WorldAssignResult,
  WorldReleaseResult,
  WorldCreateOptions,
  WorldCreateResult,
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
   * Create a new world with optional seed
   * Interactive mode if options not fully provided
   */
  async createWorld(options?: WorldCreateOptions): Promise<WorldCreateResult> {
    const isInteractive = !options?.name;

    if (isInteractive) {
      this.prompt.intro('Create New World');
    }

    try {
      // Get world name
      let worldName = options?.name;
      if (!worldName) {
        worldName = await this.prompt.text({
          message: 'Enter world name:',
          placeholder: 'myworld',
          validate: (value: string) => {
            if (!value || value.trim() === '') {
              return 'World name is required';
            }
            if (!/^[a-z0-9_-]+$/i.test(value)) {
              return 'World name can only contain letters, numbers, hyphens, and underscores';
            }
            return undefined;
          },
        });
      }

      // Check if world already exists
      const existingWorld = await this.worldRepo.findByName(worldName);
      if (existingWorld) {
        const errorMsg = `World '${worldName}' already exists`;
        if (isInteractive) {
          this.prompt.error(errorMsg);
          this.prompt.outro('World creation cancelled');
        }
        return {
          success: false,
          worldName,
          error: errorMsg,
        };
      }

      // Get seed (optional)
      let seed = options?.seed;
      if (isInteractive && seed === undefined) {
        seed = await this.prompt.text({
          message: 'Enter seed (leave empty for random):',
          placeholder: 'random',
          validate: () => undefined, // Allow empty
        });
        if (seed === '' || seed === 'random') {
          seed = undefined;
        }
      }

      // Get servers for selection
      const servers = await this.serverRepo.findAll();
      if (servers.length === 0) {
        const errorMsg = 'No servers available. Create a server first.';
        if (isInteractive) {
          this.prompt.warn(errorMsg);
          this.prompt.outro('World creation cancelled');
        }
        return {
          success: false,
          worldName,
          seed,
          error: errorMsg,
        };
      }

      // Get server to assign
      let serverName = options?.serverName;
      let selectedServer;
      if (!serverName && isInteractive) {
        selectedServer = await this.prompt.promptServerSelection(servers);
        serverName = selectedServer.name.value;
      } else if (serverName) {
        // Validate server exists
        if (!(await this.serverRepo.exists(serverName))) {
          const errorMsg = `Server '${serverName}' not found`;
          if (isInteractive) {
            this.prompt.error(errorMsg);
            this.prompt.outro('World creation cancelled');
          }
          return {
            success: false,
            worldName,
            seed,
            serverName,
            error: errorMsg,
          };
        }
      }

      // Ask about auto-start
      let autoStart = options?.autoStart;
      if (autoStart === undefined && isInteractive) {
        autoStart = await this.prompt.confirm({
          message: 'Start server after creating world?',
          initialValue: true,
        });
      }

      // Execute world creation
      const spinner = isInteractive ? this.prompt.spinner() : null;
      spinner?.start('Creating world...');

      // Check if server is running and stop it
      if (serverName) {
        const statusResult = await this.shell.serverStatus(serverName);
        if (statusResult.success && statusResult.stdout?.includes('running')) {
          spinner?.message('Stopping server...');
          await this.shell.stopServer(serverName);
        }
      }

      // Set LEVEL and SEED in server config
      if (serverName) {
        spinner?.message('Configuring server...');

        // Set LEVEL to new world name
        const levelResult = await this.shell.setServerConfig(serverName, 'LEVEL', worldName);
        if (!levelResult.success) {
          spinner?.stop('Failed to configure server');
          const errorMsg = levelResult.stderr || 'Failed to set LEVEL';
          if (isInteractive) {
            this.prompt.error(errorMsg);
            this.prompt.outro('World creation failed');
          }
          return {
            success: false,
            worldName,
            seed,
            serverName,
            error: errorMsg,
          };
        }

        // Set SEED if provided
        if (seed) {
          const seedResult = await this.shell.setServerConfig(serverName, 'SEED', seed);
          if (!seedResult.success) {
            spinner?.stop('Failed to set seed');
            const errorMsg = seedResult.stderr || 'Failed to set SEED';
            if (isInteractive) {
              this.prompt.error(errorMsg);
              this.prompt.outro('World creation failed');
            }
            return {
              success: false,
              worldName,
              seed,
              serverName,
              error: errorMsg,
            };
          }
        }
      }

      spinner?.stop('World configured');

      // Start server if requested
      let started = false;
      if (autoStart && serverName) {
        const startSpinner = isInteractive ? this.prompt.spinner() : null;
        startSpinner?.start('Starting server...');

        const startResult = await this.shell.startServer(serverName);
        if (startResult.success) {
          started = true;
          startSpinner?.stop('Server started');
        } else {
          startSpinner?.stop('Server start failed (world was created)');
          if (isInteractive) {
            this.prompt.warn('World created but server failed to start');
          }
        }
      }

      if (isInteractive) {
        this.prompt.success(`World '${worldName}' created${seed ? ` with seed '${seed}'` : ''}`);
        if (serverName) {
          this.prompt.note(`Assigned to server '${serverName}'`);
        }
        this.prompt.outro('World creation complete');
      }

      return {
        success: true,
        worldName,
        seed,
        serverName,
        started,
      };
    } catch (error) {
      if (this.prompt.isCancel(error)) {
        if (isInteractive) {
          this.prompt.outro('World creation cancelled');
        }
        return {
          success: false,
          worldName: options?.name || '',
          error: 'Cancelled',
        };
      }
      throw error;
    }
  }

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
