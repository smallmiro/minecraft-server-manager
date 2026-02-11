import { Paths, log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/index.js';
import { promptSudoPasswordIfNeeded } from '../lib/sudo-utils.js';

/**
 * Modpack server types
 */
const MODPACK_TYPES = ['MODRINTH', 'AUTO_CURSEFORGE'] as const;

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
  noWhitelist?: boolean;
  whitelist?: string;
  sudoPassword?: string;
  modpack?: string;
  modpackVersion?: string;
  modLoader?: string;
  playitDomain?: string;
  noPlayitDomain?: boolean;
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

  // Prompt for sudo password if needed (avahi installed but no password provided)
  const sudoPassword = await promptSudoPasswordIfNeeded(options.sudoPassword);

  const container = getContainer({
    rootDir: options.root,
    sudoPassword,
  });

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
    // Validate modpack options before calling use case
    const validationError = validateModpackOptions(options);
    if (validationError) {
      return validationError;
    }

    // Warn if conflicting whitelist flags are provided
    if (options.noWhitelist && options.whitelist) {
      log.warn('--whitelist is ignored when --no-whitelist is specified');
    }

    const server = await useCase.executeWithConfig({
      name: options.name!,
      type: options.type,
      version: options.version,
      seed: options.seed,
      worldUrl: options.worldUrl,
      worldName: options.worldName,
      autoStart: !options.noStart,
      modpackSlug: options.modpack,
      modpackVersion: options.modpackVersion,
      modLoader: options.modLoader,
      enableWhitelist: !options.noWhitelist,
      whitelistPlayers: options.whitelist
        ? options.whitelist.split(',').map((p) => p.trim()).filter(Boolean)
        : undefined,
      playitDomain: options.playitDomain,
      noPlayitDomain: options.noPlayitDomain,
    });

    console.log('');
    console.log(colors.green(`✓ Server '${server.name.value}' created successfully!`));
    console.log(`  Container: ${colors.cyan(server.containerName)}`);
    console.log(`  Type: ${server.type.label}`);

    // Show modpack info if it's a modpack server
    if (server.type.isModpack && server.modpackOptions) {
      console.log(`  Modpack: ${server.modpackOptions.slug}`);
      if (server.modpackOptions.version) {
        console.log(`  Modpack Version: ${server.modpackOptions.version}`);
      }
      if (server.modpackOptions.loader) {
        console.log(`  Mod Loader: ${server.modpackOptions.loader}`);
      }
    } else {
      console.log(`  Version: ${server.version.value}`);
    }

    console.log(`  Memory: ${server.memory.value}`);
    console.log(`  Whitelist: ${options.noWhitelist ? 'disabled' : colors.green('enabled')}`);
    if (options.whitelist && !options.noWhitelist) {
      console.log(`  Whitelisted: ${options.whitelist}`);
    }
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
 * Validate modpack options consistency
 * Returns non-zero exit code if validation fails, undefined otherwise
 */
function validateModpackOptions(options: CreateCommandOptions): number | undefined {
  if (!options.type) {
    return undefined; // No type specified, let use case handle defaults
  }

  const normalizedType = options.type.toUpperCase();

  // Check if MODRINTH type without modpack slug
  if (normalizedType === 'MODRINTH' && !options.modpack) {
    log.error('--modpack <slug> is required when using -t MODRINTH');
    log.info('Example: mcctl create myserver -t MODRINTH --modpack cobblemon');
    return 1;
  }

  // Warn if modpack option used with non-modpack type
  if (options.modpack && !MODPACK_TYPES.includes(normalizedType as typeof MODPACK_TYPES[number])) {
    log.warn(`--modpack option is only used for modpack server types (${MODPACK_TYPES.join(', ')}).`);
    log.warn(`Server type ${normalizedType} does not use modpacks. The --modpack option will be ignored.`);
  }

  return undefined; // Validation passed
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
