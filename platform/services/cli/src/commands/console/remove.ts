/**
 * Console Remove Command
 *
 * Completely removes Console Service:
 * - Stop and remove Docker containers
 * - Delete Docker images (optional)
 * - Delete configuration files (optional)
 */

import { join } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Paths, log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../../infrastructure/index.js';
import { AdminConfigManager } from '../../lib/admin-config.js';
import { deleteAdminImages } from './init.js';

/**
 * Console remove command options
 */
export interface ConsoleRemoveOptions {
  root?: string;
  force?: boolean;
  keepImages?: boolean;
  keepConfig?: boolean;
}

const ADMIN_COMPOSE_FILE = 'docker-compose.admin.yml';
const API_CONTAINER = 'mcctl-api';
const CONSOLE_CONTAINER = 'mcctl-console';

/**
 * Check if console service is initialized
 */
function isConsoleInitialized(paths: Paths): boolean {
  const configManager = new AdminConfigManager(paths.root);
  return configManager.isInitialized();
}

/**
 * Stop and remove containers using docker compose
 */
function stopAndRemoveContainers(paths: Paths): { success: boolean; message: string } {
  const composePath = join(paths.platform, ADMIN_COMPOSE_FILE);

  if (!existsSync(composePath)) {
    return { success: true, message: 'No compose file found' };
  }

  // First, try docker compose down
  const downResult = spawnSync('docker', [
    'compose',
    '-f', composePath,
    'down',
    '--remove-orphans',
  ], {
    encoding: 'utf-8',
    cwd: paths.platform,
  });

  if (downResult.status === 0) {
    return { success: true, message: 'Containers stopped and removed' };
  }

  // Fallback: manually stop and remove containers
  const containers = [API_CONTAINER, CONSOLE_CONTAINER];
  let stopped = 0;
  let removed = 0;

  for (const container of containers) {
    // Stop container
    const stopResult = spawnSync('docker', ['stop', container], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (stopResult.status === 0) stopped++;

    // Remove container
    const rmResult = spawnSync('docker', ['rm', '-f', container], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (rmResult.status === 0) removed++;
  }

  return {
    success: true,
    message: `Stopped ${stopped}, removed ${removed} container(s)`,
  };
}

/**
 * Delete configuration files
 */
function deleteConfigFiles(paths: Paths): { deleted: string[]; errors: string[] } {
  const configManager = new AdminConfigManager(paths.root);
  const filesToDelete = [
    configManager.path, // .mcctl-admin.yml
    join(paths.root, 'users.yaml'),
  ];

  const deleted: string[] = [];
  const errors: string[] = [];

  for (const file of filesToDelete) {
    if (existsSync(file)) {
      try {
        unlinkSync(file);
        deleted.push(file);
      } catch (err) {
        errors.push(`Failed to delete ${file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return { deleted, errors };
}

/**
 * Execute console remove command
 *
 * Removes all Console Service components:
 * 1. Stop and remove Docker containers
 * 2. Delete Docker images (unless --keep-images)
 * 3. Delete configuration files (unless --keep-config)
 */
export async function consoleRemoveCommand(
  options: ConsoleRemoveOptions
): Promise<number> {
  const paths = new Paths(options.root);

  // Check if platform is initialized
  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Nothing to remove.');
    return 1;
  }

  // Check if console service is initialized
  if (!isConsoleInitialized(paths)) {
    log.warn('Console Service is not initialized. Nothing to remove.');
    return 0;
  }

  const container = getContainer({ rootDir: options.root });
  const prompt = container.promptPort;

  // Confirm removal unless --force
  if (!options.force) {
    try {
      console.log('');
      console.log(colors.yellow('  This will remove:'));
      if (!options.keepImages) {
        console.log('    - Docker images (mcctl-api, mcctl-console)');
      }
      console.log('    - Docker containers');
      if (!options.keepConfig) {
        console.log('    - Configuration files (.mcctl-admin.yml, users.yaml)');
      }
      console.log('');

      const shouldRemove = await prompt.confirm({
        message: 'Are you sure you want to remove Console Service?',
        initialValue: false,
      });

      if (prompt.isCancel(shouldRemove) || !shouldRemove) {
        log.info('Cancelled');
        return 0;
      }
    } catch (error) {
      if (prompt.isCancel(error)) {
        return 0;
      }
      throw error;
    }
  }

  const spinner = prompt.spinner();

  try {
    // Step 1: Stop and remove containers
    spinner.start('Stopping and removing containers...');
    const containerResult = stopAndRemoveContainers(paths);
    spinner.stop(containerResult.message);

    // Step 2: Delete Docker images (unless --keep-images)
    if (!options.keepImages) {
      spinner.start('Removing Docker images...');
      const imageResult = deleteAdminImages();
      if (imageResult.deleted.length > 0) {
        spinner.stop(`Removed ${imageResult.deleted.length} Docker image(s)`);
      } else {
        spinner.stop('No Docker images to remove');
      }

      if (imageResult.errors.length > 0) {
        for (const error of imageResult.errors) {
          log.warn(error);
        }
      }
    } else {
      log.info('Keeping Docker images (--keep-images)');
    }

    // Step 3: Delete configuration files (unless --keep-config)
    if (!options.keepConfig) {
      spinner.start('Removing configuration files...');
      const configResult = deleteConfigFiles(paths);
      if (configResult.deleted.length > 0) {
        spinner.stop(`Removed ${configResult.deleted.length} configuration file(s)`);
      } else {
        spinner.stop('No configuration files to remove');
      }

      if (configResult.errors.length > 0) {
        for (const error of configResult.errors) {
          log.warn(error);
        }
      }
    } else {
      log.info('Keeping configuration files (--keep-config)');
    }

    // Summary
    console.log('');
    prompt.success('Console Service removed successfully');
    console.log('');

    if (options.keepImages || options.keepConfig) {
      console.log(colors.dim('  Note: Some components were kept as requested'));
      if (options.keepImages) {
        console.log(colors.dim('    - Docker images are still available'));
      }
      if (options.keepConfig) {
        console.log(colors.dim('    - Configuration files are preserved'));
      }
      console.log('');
    }

    console.log(colors.dim('  To reinstall, run: mcctl console init'));
    console.log('');

    return 0;
  } catch (error) {
    if (prompt.isCancel(error)) {
      return 0;
    }

    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}
