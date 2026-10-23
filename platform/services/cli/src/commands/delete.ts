import { Paths, log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/index.js';
import { promptSudoPasswordIfNeeded } from '../lib/sudo-utils.js';

/**
 * Delete command options from CLI arguments
 */
export interface DeleteCommandOptions {
  root?: string;
  name?: string;
  /** Delete even when players are online (implies yes). */
  force?: boolean;
  /** Skip the confirmation question. */
  yes?: boolean;
  /** Delete the world inside the server instead of moving it to worlds/. */
  deleteWorld?: boolean;
  sudoPassword?: string;
}

/**
 * Execute delete server command
 *
 * If name is provided, runs in CLI mode with direct deletion.
 * If name is not provided, runs in interactive mode with selection.
 */
export async function deleteCommand(options: DeleteCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  // Check if initialized
  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  const yes = options.yes === true || options.force === true;
  // Nobody can answer the question: refuse rather than delete unasked.
  if (!yes && !process.stdin.isTTY) {
    log.error('Refusing to delete without confirmation in a non-interactive shell. Pass --yes to confirm.');
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
    // CLI argument mode - use executeWithName
    return deleteWithArguments(container, { ...options, yes });
  } else {
    // Interactive mode - use execute
    return deleteInteractive(container, options.deleteWorld ?? false);
  }
}

/**
 * Delete server with CLI arguments (non-interactive)
 */
async function deleteWithArguments(
  container: ReturnType<typeof getContainer>,
  options: DeleteCommandOptions
): Promise<number> {
  const useCase = container.deleteServerUseCase;

  try {
    const deleted = await useCase.executeWithName(options.name!, {
      force: options.force ?? false,
      yes: options.yes ?? false,
      deleteWorld: options.deleteWorld ?? false,
    });

    if (deleted) {
      console.log('');
      console.log(colors.green(`✓ Server '${options.name}' deleted successfully!`));
      console.log('');
    }

    return deleted ? 0 : 1;
  } catch (error) {
    if (container.promptPort.isCancel(error)) {
      return 1; // Not deleted
    }
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * Delete server interactively (with prompts)
 */
async function deleteInteractive(
  container: ReturnType<typeof getContainer>,
  deleteWorld: boolean
): Promise<number> {
  const useCase = container.deleteServerUseCase;

  try {
    const deleted = await useCase.execute({ deleteWorld });
    return deleted ? 0 : 1;
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
