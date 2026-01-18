import { Paths, log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/index.js';

/**
 * Create command options from CLI arguments
 */
export interface CreateCommandOptions {
  root?: string;
  name?: string;
  type?: string;
  version?: string;
  seed?: string;
  worldUrl?: string;
  worldName?: string;
  noStart?: boolean;
}

/**
 * Execute create server command
 *
 * If name is provided, runs in CLI mode with arguments.
 * If name is not provided, runs in interactive mode.
 */
export async function createCommand(options: CreateCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  // Check if initialized
  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  const container = getContainer(options.root);

  // Determine execution mode
  if (options.name) {
    // CLI argument mode - use executeWithConfig
    return createWithArguments(container, options);
  } else {
    // Interactive mode - use execute
    return createInteractive(container);
  }
}

/**
 * Create server with CLI arguments (non-interactive)
 */
async function createWithArguments(
  container: ReturnType<typeof getContainer>,
  options: CreateCommandOptions
): Promise<number> {
  const useCase = container.createServerUseCase;
  const prompt = container.promptPort;

  try {
    const server = await useCase.executeWithConfig({
      name: options.name!,
      type: options.type,
      version: options.version,
      seed: options.seed,
      worldUrl: options.worldUrl,
      worldName: options.worldName,
      autoStart: !options.noStart,
    });

    console.log('');
    console.log(colors.green(`✓ Server '${server.name.value}' created successfully!`));
    console.log(`  Container: ${colors.cyan(server.containerName)}`);
    console.log(`  Type: ${server.type.label}`);
    console.log(`  Version: ${server.version.value}`);
    console.log(`  Memory: ${server.memory.value}`);
    console.log('');
    console.log(`  Connect via: ${colors.cyan(server.name.hostname + ':25565')}`);
    console.log('');

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * Create server interactively (with prompts)
 */
async function createInteractive(
  container: ReturnType<typeof getContainer>
): Promise<number> {
  const useCase = container.createServerUseCase;

  try {
    await useCase.execute();
    return 0;
  } catch (error) {
    // Check if user cancelled
    const prompt = container.promptPort;
    if (prompt.isCancel(error)) {
      return 0; // User cancellation is not an error
    }

    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}
