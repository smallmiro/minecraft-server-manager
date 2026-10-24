import type {
  IWorldManagementUseCase,
  WorldListResult,
  WorldAssignResult,
  WorldReleaseResult,
  WorldDeleteResult,
  WorldCreateOptions,
  WorldCreateResult,
  WorldImportOptions,
  WorldImportResult,
  IPromptPort,
  IShellPort,
  IWorldRepository,
  IServerRepository,
  IWorldAssignmentPort,
  IContainerRuntimePort,
} from '../ports/index.js';
import { checkConfigEnvChange, checkPlatformEnvChange, checkServerStopped } from './checkServerStopped.js';
import { formatWorldBytes } from '../../utils/index.js';
import { applyEnvChanges, assertEnvFileValue } from '../../utils/env-file.js';
import {
  ServerName,
  WORLD_NAME_PATTERN,
  WorldAssignmentError,
  checkAssign,
  holdersOf,
  checkRemoval,
  checkReset,
  findDuplicates,
  planRelease,
  resolveWorldName,
  type WorldAssignmentErrorCode,
  type WorldAssignmentSnapshot,
} from '../../domain/index.js';

const NO_ASSIGNMENTS: WorldAssignmentSnapshot = { assignments: [], undetermined: [] };

/** Why `seed` cannot be a config.env SEED value, or null. */
function invalidSeed(seed: string | undefined): Error | null {
  try {
    if (seed) {
      assertEnvFileValue('SEED', seed);
      applyEnvChanges('', { set: { SEED: seed } }, { raw: true }); // what the config.env writer refuses
    }
    return null;
  } catch (error) {
    return error as Error;
  }
}

function toFailure(error: unknown): { error: string; errorCode?: WorldAssignmentErrorCode } {
  if (error instanceof WorldAssignmentError) return { error: error.message, errorCode: error.code };
  return { error: error instanceof Error ? error.message : String(error) };
}

/**
 * World Management Use Case
 *
 * A server's world is its LEVEL (#670, ADR-0002). Assignment changes go
 * through IWorldAssignmentPort, which enforces R1/R6/R7, and only on a
 * stopped server (IContainerRuntimePort). Both ports are optional for
 * constructor compatibility; without them every assignment change and
 * world delete is refused (fail-closed).
 */
export class WorldManagementUseCase implements IWorldManagementUseCase {
  /**
   * @param _shell Unused since #734 (mcctl.sh was removed); pass undefined.
   *   @deprecated Kept for constructor compatibility; removed in v3.0.0 (#736).
   */
  constructor(
    private readonly prompt: IPromptPort,
    _shell: IShellPort | undefined,
    private readonly worldRepo: IWorldRepository,
    private readonly serverRepo: IServerRepository,
    private readonly assignments?: IWorldAssignmentPort,
    private readonly runtime?: IContainerRuntimePort
  ) {}

  /** The current assignments, or why they cannot be read (R7). */
  private async snapshot(): Promise<WorldAssignmentSnapshot | WorldAssignmentError> {
    if (!this.assignments) {
      return new WorldAssignmentError('undetermined', 'World assignments cannot be read: no assignment port configured');
    }
    try {
      return await this.assignments.snapshot();
    } catch (error) {
      return new WorldAssignmentError('undetermined', `Cannot read world assignments: ${toFailure(error).error}`);
    }
  }

  private checkStopped(server: string): WorldAssignmentError | null {
    return checkServerStopped(this.runtime, server);
  }

  /**
   * Reasons a new world cannot be assigned to `serverName` (create --server):
   * checked before the directory is created.
   */
  private async checkNewWorldTarget(worldName: string, serverName: string): Promise<WorldAssignmentError | null> {
    const snapshot = await this.snapshot();
    if (snapshot instanceof WorldAssignmentError) return snapshot;
    return checkAssign(snapshot, worldName, serverName) ?? this.checkStopped(serverName);
  }

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
            if (!WORLD_NAME_PATTERN.test(value)) {
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

      // Refuse before creating anything: a seed config.env cannot hold (#726),
      // a held name, an undetermined assignment, or a server that is not
      // stopped (no auto-stop, #670)
      if (serverName) {
        const refused = invalidSeed(seed) ?? (await this.checkNewWorldTarget(worldName, serverName));
        if (refused) {
          if (isInteractive) {
            this.prompt.error(refused.message);
            this.prompt.outro('World creation cancelled');
          }
          return { success: false, worldName, seed, serverName, ...toFailure(refused) };
        }
      }

      // Execute world creation
      const spinner = isInteractive ? this.prompt.spinner() : null;
      spinner?.start('Creating world...');

      // Create the world directory with seed
      try {
        await this.worldRepo.create(worldName, seed);
        spinner?.message('World directory created');
      } catch (error) {
        spinner?.stop('Failed to create world');
        const errorMsg = error instanceof Error ? error.message : String(error);
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

      // If server specified, configure it to use the new world
      if (serverName) {
        spinner?.message('Configuring server...');

        // LEVEL and SEED in one config.env write through the assignment port
        // (re-checks R1 on a fresh snapshot; mcctl.sh config is gone, #734)
        try {
          await this.assignments!.assign(worldName, serverName, seed ? { seed } : {});
        } catch (error) {
          spinner?.stop('Failed to configure server');
          const failure = toFailure(error);
          if (isInteractive) {
            this.prompt.error(failure.error);
            this.prompt.outro('World created but server configuration failed');
          }
          return { success: false, worldName, seed, serverName, ...failure };
        }
      }

      spinner?.stop('World created');

      // Start server if requested
      let started = false;
      if (autoStart && serverName) {
        const startSpinner = isInteractive ? this.prompt.spinner() : null;
        startSpinner?.start('Starting server...');

        const startResult = await this.runtime!.start(ServerName.fromExisting(serverName));
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
   * List all worlds with lock status.
   * Excludes split-dimension satellites (<name>_nether, <name>_the_end)
   * from the returned list. Each primary world gains a `dimensions` field
   * and its size includes satellite sizes.
   */
  async listWorlds(): Promise<WorldListResult[]> {
    const allWorlds = await this.worldRepo.findAll();
    // Same parser and folder rule as the assignment checks (#670)
    const read = this.assignments ? await this.snapshot() : undefined;
    const snapshot = read instanceof WorldAssignmentError ? { assignments: [], undetermined: [] } : read;
    const serversByWorld = snapshot ? new Map<string, string[]>() : await this.getServersByWorld();
    const serversOf = (name: string) =>
      (snapshot ? holdersOf(snapshot, name) : serversByWorld.get(name)) ?? [];

    // Build a set of all world names for O(1) satellite detection
    const allNames = new Set(allWorlds.map((w) => w.name));

    // Identify satellites: name matches /<base>_(nether|the_end)/ AND base exists
    const satelliteRegex = /^(.+)_(nether|the_end)$/;
    const satelliteNames = new Set<string>();
    const satellitesByBase = new Map<string, { nether?: (typeof allWorlds)[0]; theEnd?: (typeof allWorlds)[0] }>();

    for (const world of allWorlds) {
      const match = satelliteRegex.exec(world.name);
      if (match) {
        const base = match[1]!;
        const kind = match[2]! as 'nether' | 'the_end';
        if (allNames.has(base)) {
          satelliteNames.add(world.name);
          const entry = satellitesByBase.get(base) ?? {};
          if (kind === 'nether') entry.nether = world;
          else entry.theEnd = world;
          satellitesByBase.set(base, entry);
        }
      }
    }

    // Build results from primary worlds only
    return allWorlds
      .filter((world) => !satelliteNames.has(world.name))
      .map((world) => {
        const satellites = satellitesByBase.get(world.name) ?? {};

        // Aggregate size
        let size: string;
        if (world.sizeBytes !== undefined) {
          const total =
            world.sizeBytes +
            (satellites.nether?.sizeBytes ?? 0) +
            (satellites.theEnd?.sizeBytes ?? 0);
          size = formatWorldBytes(total);
        } else {
          size = 'Unknown';
        }

        return {
          name: world.name,
          path: world.path,
          isLocked: world.isLocked,
          lockedBy: world.lockedBy,
          size,
          lastModified: world.lastModified,
          servers: serversOf(world.name),
          dimensions: {
            nether: !!satellites.nether,
            end: !!satellites.theEnd,
          },
        } satisfies WorldListResult;
      });
  }

  /**
   * List worlds not mapped to any server (no server's LEVEL points at them).
   * Builds on listWorlds(), which already excludes split-dimension satellites.
   */
  async listUnmappedWorlds(): Promise<WorldListResult[]> {
    const worlds = await this.listWorlds();
    return worlds.filter((w) => w.servers.length === 0);
  }

  /**
   * Build a reverse map of world name -> server names that use it.
   *
   * A server's world directory is its LEVEL config value (or the WORLD_NAME
   * alias); when neither is set itzg uses worlds/world. This mirrors the
   * world-name precedence used for detailed server info (resolveWorldName).
   */
  private async getServersByWorld(): Promise<Map<string, string[]>> {
    const names = await this.serverRepo.listNames();
    const map = new Map<string, string[]>();

    for (const name of names) {
      const config = await this.serverRepo.getConfig(name);
      if (!config) continue;

      const level = resolveWorldName(config.customEnv ?? {});
      const servers = map.get(level) ?? [];
      servers.push(name);
      map.set(level, servers);
    }

    return map;
  }

  /**
   * Interactive world assignment
   */
  async assignWorld(): Promise<WorldAssignResult> {
    this.prompt.intro('Assign World to Server');

    try {
      // Worlds no server is assigned to
      const worlds = await this.worldRepo.findUnlocked();

      if (worlds.length === 0) {
        this.prompt.warn('No unassigned worlds available');
        this.prompt.outro('All worlds are currently assigned');
        return {
          success: false,
          worldName: '',
          serverName: '',
          error: 'No unassigned worlds available',
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

      const spinner = this.prompt.spinner();
      spinner.start('Assigning world...');

      const result = await this.assignWorldByName(world.name, server.name.value);
      if (!result.success) {
        spinner.stop('Failed to assign world');
        this.prompt.error(result.error || 'Unknown error');
        return result;
      }

      spinner.stop('World assigned');
      this.prompt.success(`World '${world.name}' assigned to '${server.name.value}'`);
      this.prompt.outro('Assignment complete');
      return result;
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
   * Assign world to server by name: the server's LEVEL becomes the world.
   */
  async assignWorldByName(
    worldName: string,
    serverName: string,
    options: { requireExisting?: boolean } = {}
  ): Promise<WorldAssignResult> {
    const fail = (error: unknown): WorldAssignResult => ({
      success: false,
      worldName,
      serverName,
      ...toFailure(error),
    });

    // The world name becomes the server's LEVEL (#649): validate before any lookup
    const invalid = checkAssign(NO_ASSIGNMENTS, worldName, serverName, { newServer: true });
    if (invalid) return fail(invalid);

    if (options.requireExisting !== false && !(await this.worldRepo.exists(worldName))) {
      return fail(new Error(`World '${worldName}' not found`));
    }

    const snapshot = await this.snapshot();
    if (snapshot instanceof WorldAssignmentError) return fail(snapshot);
    const refused = checkAssign(snapshot, worldName, serverName);
    if (refused) return fail(refused);

    // Already assigned: nothing to write, so the runtime state does not matter
    if (snapshot.assignments.find((a) => a.server === serverName)?.world === worldName) {
      return { success: true, worldName, serverName };
    }

    const running = this.checkStopped(serverName);
    if (running) return fail(running);

    try {
      await this.assignments!.assign(worldName, serverName);
    } catch (error) {
      return fail(error);
    }
    return { success: true, worldName, serverName };
  }

  /**
   * Interactive world release
   */
  async releaseWorld(): Promise<WorldReleaseResult> {
    this.prompt.intro('Release World');

    try {
      // Worlds a server is assigned to
      const worlds = await this.worldRepo.findLocked();

      if (worlds.length === 0) {
        this.prompt.warn('No assigned worlds found');
        this.prompt.outro('No server uses a world in worlds/');
        return {
          success: false,
          worldName: '',
          error: 'No assigned worlds found',
        };
      }

      // Prompt for world selection
      const world = await this.prompt.promptWorldSelection(worlds);

      // Confirm release
      const confirmed = await this.prompt.confirm({
        message:
          `Release '${world.name}' from '${world.lockedBy}'? ` +
          `'${world.lockedBy}' switches to its own world '${world.lockedBy}'.`,
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

      const spinner = this.prompt.spinner();
      spinner.start('Releasing world...');

      const result = await this.releaseWorldByName(world.name);
      if (!result.success) {
        spinner.stop('Failed to release world');
        this.prompt.error(result.error || 'Unknown error');
        return result;
      }

      spinner.stop('World released');
      this.prompt.success(
        `World '${world.name}' released from '${result.previousServer}'; ` +
          `'${result.previousServer}' now uses world '${result.fallbackWorld}'` +
          (result.fallbackExists ? '' : ' (created on next start)')
      );
      this.prompt.outro('Release complete');
      return result;
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
   * Release world by name: the holder's LEVEL falls back to its own name.
   * `force` is accepted for compatibility and ignored (#670).
   */
  async releaseWorldByName(
    worldName: string,
    _force = false
  ): Promise<WorldReleaseResult> {
    const fail = (error: unknown, previousServer?: string): WorldReleaseResult => ({
      success: false,
      worldName,
      previousServer,
      ...toFailure(error),
    });

    const snapshot = await this.snapshot();
    if (snapshot instanceof WorldAssignmentError) return fail(snapshot);
    const plan = planRelease(snapshot, worldName);
    if (plan instanceof WorldAssignmentError) {
      if (plan.code === 'not_assigned' && !(await this.worldRepo.exists(worldName))) {
        return fail(new Error(`World '${worldName}' not found`));
      }
      return fail(plan);
    }

    const running = this.checkStopped(plan.server);
    if (running) return fail(running, plan.server);

    let released: { server: string; fallback: string };
    try {
      released = await this.assignments!.release(worldName);
    } catch (error) {
      return fail(error, plan.server);
    }
    return {
      success: true,
      worldName,
      previousServer: released.server,
      fallbackWorld: released.fallback,
      fallbackExists: await this.worldRepo.exists(released.fallback),
    };
  }

  /**
   * The world `serverName` may reset (worlds/<world>, resolved like every
   * other assignment read), or why not: the server keeps its world inside
   * its data directory, another server uses the same world family, or the
   * assignments cannot be read (#670). The caller still checks that the
   * server is stopped.
   */
  async planWorldReset(serverName: string): Promise<{ world: string } | WorldAssignmentError> {
    const snapshot = await this.snapshot();
    if (snapshot instanceof WorldAssignmentError) return snapshot;
    const refused = checkReset(snapshot, serverName);
    if (refused) return refused;
    return { world: snapshot.assignments.find((a) => a.server === serverName)!.world };
  }

  /**
   * Why `serverName`'s config.env may not become `configEnv` (a config write
   * that moves its world, e.g. EXTRA_ARGS --universe), or null (#670).
   */
  checkConfigChange(serverName: string, configEnv: string): Promise<WorldAssignmentError | null> {
    return checkConfigEnvChange(this.assignments, this.runtime, serverName, configEnv);
  }

  /**
   * Why the platform .env may not become `dotenv`, or null (#670): a new
   * EXTRA_ARGS reaches every server that inherits it (bare key in
   * servers/global.env) and may move their worlds.
   */
  checkPlatformEnvChange(dotenv: string): Promise<WorldAssignmentError | null> {
    return checkPlatformEnvChange(this.assignments, this.runtime, dotenv);
  }

  /**
   * Existing duplicate assignments and servers whose assignment cannot be
   * read (plan item 6). Reported, never fixed. Rejects when the assignments
   * cannot be read at all.
   */
  async getAssignmentReport(): Promise<{
    duplicates: { world: string; servers: string[] }[];
    undetermined: string[];
  }> {
    const snapshot = await this.snapshot();
    if (snapshot instanceof WorldAssignmentError) throw snapshot;
    return { duplicates: findDuplicates(snapshot), undetermined: snapshot.undetermined };
  }

  /** Why worlds/<worldName> may not be deleted, or null (#670). */
  private async checkWorldDeletion(worldName: string): Promise<WorldAssignmentError | null> {
    const snapshot = await this.snapshot();
    return snapshot instanceof WorldAssignmentError ? snapshot : checkRemoval(snapshot, worldName);
  }

  /**
   * Interactive world deletion
   */
  async deleteWorld(): Promise<WorldDeleteResult> {
    this.prompt.intro('Delete World');

    try {
      // Get all worlds
      const worlds = await this.worldRepo.findAll();

      if (worlds.length === 0) {
        this.prompt.warn('No worlds found');
        this.prompt.outro('Nothing to delete');
        return {
          success: false,
          worldName: '',
          error: 'No worlds found',
        };
      }

      // Prompt for world selection
      const world = await this.prompt.promptWorldSelection(worlds);

      // Show world info
      this.prompt.note(
        `Name: ${world.name}\n` +
          `Size: ${world.sizeFormatted}\n` +
          `Status: ${world.isLocked ? `assigned to ${world.lockedBy}` : 'unassigned'}`,
        'World Info'
      );

      // A world a server uses cannot be deleted (#670)
      const refused = await this.checkWorldDeletion(world.name);
      if (refused) {
        this.prompt.error(refused.message);
        this.prompt.outro('Deletion cancelled');
        return { success: false, worldName: world.name, ...toFailure(refused) };
      }

      // Confirm deletion
      const confirmed = await this.prompt.confirm({
        message: 'Are you sure you want to delete this world? This action cannot be undone!',
        initialValue: false,
      });

      if (!confirmed) {
        this.prompt.outro('Deletion cancelled');
        return {
          success: false,
          worldName: world.name,
          error: 'Cancelled',
        };
      }

      // Execute deletion
      return await this.performWorldDeletion(world.name, world.sizeFormatted);
    } catch (error) {
      if (this.prompt.isCancel(error)) {
        this.prompt.outro('Deletion cancelled');
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
   * Delete world by name
   */
  async deleteWorldByName(
    worldName: string,
    force = false
  ): Promise<WorldDeleteResult> {
    // Check world exists
    const world = await this.worldRepo.findByName(worldName);
    if (!world) {
      return {
        success: false,
        worldName,
        error: `World '${worldName}' not found`,
      };
    }

    // A world a server uses cannot be deleted; force no longer bypasses this (#670)
    const refused = await this.checkWorldDeletion(worldName);
    if (refused) {
      return { success: false, worldName, ...toFailure(refused) };
    }

    return await this.performWorldDeletion(worldName, world.sizeFormatted, force);
  }

  /**
   * Import a world from a zip archive (non-interactive).
   * Returns {success:false} if the world already exists or extraction fails.
   */
  async importWorldFromZip(options: WorldImportOptions): Promise<WorldImportResult> {
    const { worldName, zipPath } = options;

    // Check for duplicate before attempting extraction
    const existing = await this.worldRepo.findByName(worldName);
    if (existing) {
      return {
        success: false,
        worldName,
        error: `World '${worldName}' already exists`,
      };
    }

    try {
      await this.worldRepo.importFromZip(worldName, zipPath);
      return { success: true, worldName };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, worldName, error };
    }
  }

  /**
   * Perform the actual world deletion
   */
  private async performWorldDeletion(
    worldName: string,
    size: string,
    force = false
  ): Promise<WorldDeleteResult> {
    const spinner = this.prompt.spinner();

    try {
      spinner.start('Deleting world...');

      // Delete the world
      const success = await this.worldRepo.delete(worldName);

      if (!success) {
        spinner.stop('Deletion failed');
        this.prompt.error('Failed to delete world directory');
        return {
          success: false,
          worldName,
          error: 'Failed to delete world directory',
        };
      }

      spinner.stop('World deleted');
      this.prompt.success(`World '${worldName}' deleted (${size})`);
      this.prompt.outro('World removed successfully');

      return {
        success: true,
        worldName,
        size,
      };
    } catch (error) {
      spinner.stop('Deletion failed');
      const message = error instanceof Error ? error.message : String(error);
      this.prompt.error(message);
      return {
        success: false,
        worldName,
        error: message,
      };
    }
  }
}
