import { Paths, log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/index.js';

/**
 * Delete command options from CLI arguments
 */
export interface DeleteCommandOptions {
  root?: string;
  name?: string;
  force?: boolean;
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

  const container = getContainer({
    rootDir: options.root,
    sudoPassword: options.sudoPassword,
  });

  // Determine execution mode
  if (options.name) {
    // CLI argument mode - use executeWithName
    return deleteWithArguments(container, options);
  } else {
    // Interactive mode - use execute
    return deleteInteractive(container);
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
    const deleted = await useCase.executeWithName(options.name!, options.force ?? false);

    if (deleted) {
      console.log('');
      console.log(colors.green(`✓ Server '${options.name}' deleted successfully!`));
      console.log(colors.dim('  World data has been preserved in worlds/ directory.'));
      console.log('');
    }

    return deleted ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

/**
 * Delete server interactively (with prompts)
 */
async function deleteInteractive(
  container: ReturnType<typeof getContainer>
): Promise<number> {
  const useCase = container.deleteServerUseCase;

  try {
    const deleted = await useCase.execute();
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
