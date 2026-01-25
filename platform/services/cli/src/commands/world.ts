import { Paths, log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/index.js';

/**
 * World command options
 */
export interface WorldCommandOptions {
  root?: string;
  subCommand?: string;
  worldName?: string;
  serverName?: string;
  seed?: string;
  autoStart?: boolean;
  json?: boolean;
  force?: boolean;
}

/**
 * Execute world management command
 */
export async function worldCommand(options: WorldCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  // Check if initialized
  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  const container = getContainer(options.root);
  const subCommand = options.subCommand ?? 'list';

  switch (subCommand) {
    case 'list':
      return worldList(container, options);

    case 'new':
      return worldNew(container, options);

    case 'assign':
      return worldAssign(container, options);

    case 'release':
      return worldRelease(container, options);

    case 'delete':
      return worldDelete(container, options);

    default:
      log.error(`Unknown world subcommand: ${subCommand}`);
      console.log('Usage: mcctl world [list|new|assign|release|delete]');
      return 1;
  }
}

/**
 * Create a new world with optional seed
 */
async function worldNew(
  container: ReturnType<typeof getContainer>,
  options: WorldCommandOptions
): Promise<number> {
  const useCase = container.worldManagementUseCase;

  try {
    const result = await useCase.createWorld({
      name: options.worldName,
      seed: options.seed,
      serverName: options.serverName,
      autoStart: options.autoStart,
    });

    if (result.success) {
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('');
        console.log(colors.green(`✓ World '${result.worldName}' created`));
        if (result.seed) {
          console.log(colors.dim(`  Seed: ${result.seed}`));
        }
        if (result.serverName) {
          console.log(colors.dim(`  Server: ${result.serverName}`));
        }
        if (result.started) {
          console.log(colors.dim(`  Server started: yes`));
        }
        console.log('');
      }
      return 0;
    } else {
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        log.error(result.error || 'Failed to create world');
      }
      return 1;
    }
  } catch (error) {
    const prompt = container.promptPort;
    if (prompt.isCancel(error)) {
      return 0;
    }

    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * List all worlds
 */
async function worldList(
  container: ReturnType<typeof getContainer>,
  options: WorldCommandOptions
): Promise<number> {
  const useCase = container.worldManagementUseCase;

  try {
    const worlds = await useCase.listWorlds();

    if (worlds.length === 0) {
      console.log('No worlds found in worlds/ directory');
      return 0;
    }

    if (options.json) {
      console.log(JSON.stringify(worlds, null, 2));
      return 0;
    }

    console.log('');
    console.log(colors.bold('Worlds:'));
    console.log('');

    for (const world of worlds) {
      const lockStatus = world.isLocked
        ? colors.yellow(`locked: ${world.lockedBy}`)
        : colors.green('unlocked');

      console.log(`  ${colors.cyan(world.name)}`);
      console.log(`    Status: ${lockStatus}`);
      console.log(`    Size: ${world.size}`);
      console.log(`    Path: ${world.path}`);
      console.log('');
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * Assign world to server
 */
async function worldAssign(
  container: ReturnType<typeof getContainer>,
  options: WorldCommandOptions
): Promise<number> {
  const useCase = container.worldManagementUseCase;

  try {
    // If both world and server provided, use direct assignment
    if (options.worldName && options.serverName) {
      const result = await useCase.assignWorldByName(
        options.worldName,
        options.serverName
      );

      if (result.success) {
        console.log('');
        console.log(
          colors.green(
            `✓ World '${result.worldName}' assigned to '${result.serverName}'`
          )
        );
        console.log('');
        return 0;
      } else {
        log.error(result.error || 'Failed to assign world');
        return 1;
      }
    }

    // Interactive mode
    const result = await useCase.assignWorld();
    return result.success ? 0 : 1;
  } catch (error) {
    const prompt = container.promptPort;
    if (prompt.isCancel(error)) {
      return 0;
    }

    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * Release world lock
 */
async function worldRelease(
  container: ReturnType<typeof getContainer>,
  options: WorldCommandOptions
): Promise<number> {
  const useCase = container.worldManagementUseCase;

  try {
    // If world name provided, use direct release
    if (options.worldName) {
      const result = await useCase.releaseWorldByName(
        options.worldName,
        options.force ?? false
      );

      if (result.success) {
        console.log('');
        console.log(colors.green(`✓ World '${result.worldName}' lock released`));
        if (result.previousServer) {
          console.log(colors.dim(`  Previously locked by: ${result.previousServer}`));
        }
        console.log('');
        return 0;
      } else {
        log.error(result.error || 'Failed to release world lock');
        return 1;
      }
    }

    // Interactive mode
    const result = await useCase.releaseWorld();
    return result.success ? 0 : 1;
  } catch (error) {
    const prompt = container.promptPort;
    if (prompt.isCancel(error)) {
      return 0;
    }

    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * Delete world
 */
async function worldDelete(
  container: ReturnType<typeof getContainer>,
  options: WorldCommandOptions
): Promise<number> {
  const useCase = container.worldManagementUseCase;

  try {
    // If world name provided, use direct deletion
    if (options.worldName) {
      const result = await useCase.deleteWorldByName(
        options.worldName,
        options.force ?? false
      );

      if (result.success) {
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('');
          console.log(colors.green(`✓ World '${result.worldName}' deleted`));
          if (result.size) {
            console.log(colors.dim(`  Freed: ${result.size}`));
          }
          console.log('');
        }
        return 0;
      } else {
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          log.error(result.error || 'Failed to delete world');
        }
        return 1;
      }
    }

    // Interactive mode
    const result = await useCase.deleteWorld();
    return result.success ? 0 : 1;
  } catch (error) {
    const prompt = container.promptPort;
    if (prompt.isCancel(error)) {
      return 0;
    }

    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}
