/**
 * Console Remove Command
 *
 * Completely removes Console Service:
 * - Stop and remove PM2 processes
 * - Delete configuration files (optional)
 * - Delete ecosystem.config.cjs
 */

import { join } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';
import { Paths, log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../../infrastructure/index.js';
import { AdminConfigManager } from '../../lib/admin-config.js';
import { Pm2ServiceManagerAdapter } from '../../infrastructure/adapters/Pm2ServiceManagerAdapter.js';
import {
  checkPm2Installation,
  ECOSYSTEM_CONFIG_FILE,
  PM2_SERVICE_NAMES,
} from '../../lib/pm2-utils.js';

/**
 * Console remove command options
 */
export interface ConsoleRemoveOptions {
  root?: string;
  force?: boolean;
  keepConfig?: boolean;
}

/**
 * Check if console service is initialized
 */
function isConsoleInitialized(paths: Paths): boolean {
  const configManager = new AdminConfigManager(paths.root);
  return configManager.isInitialized();
}

/**
 * Stop and remove PM2 processes
 */
async function stopAndRemoveProcesses(paths: Paths): Promise<{
  success: boolean;
  message: string;
  stopped: string[];
}> {
  const pm2Check = checkPm2Installation();
  if (!pm2Check.installed) {
    return { success: true, message: 'PM2 not installed', stopped: [] };
  }

  const pm2Adapter = new Pm2ServiceManagerAdapter(paths);
  const stopped: string[] = [];

  try {
    for (const serviceName of [PM2_SERVICE_NAMES.API, PM2_SERVICE_NAMES.CONSOLE]) {
      const exists = await pm2Adapter.exists(serviceName);
      if (exists) {
        await pm2Adapter.delete(serviceName);
        stopped.push(serviceName);
      }
    }

    // Save process list after removal
    if (stopped.length > 0) {
      await pm2Adapter.save();
    }

    return {
      success: true,
      message:
        stopped.length > 0
          ? `Stopped and removed: ${stopped.join(', ')}`
          : 'No PM2 processes running',
      stopped,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to stop processes: ${error instanceof Error ? error.message : String(error)}`,
      stopped,
    };
  } finally {
    pm2Adapter.disconnect();
  }
}

/**
 * Delete configuration files
 */
function deleteConfigFiles(paths: Paths): { deleted: string[]; errors: string[] } {
  const configManager = new AdminConfigManager(paths.root);
  const filesToDelete = [
    configManager.path, // .mcctl-admin.yml
    join(paths.root, 'users.yaml'),
    join(paths.platform, ECOSYSTEM_CONFIG_FILE), // ecosystem.config.cjs
  ];

  const deleted: string[] = [];
  const errors: string[] = [];

  for (const file of filesToDelete) {
    if (existsSync(file)) {
      try {
        unlinkSync(file);
        deleted.push(file);
      } catch (err) {
        errors.push(
          `Failed to delete ${file}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  return { deleted, errors };
}

/**
 * Execute console remove command
 *
 * Removes all Console Service components:
 * 1. Stop and remove PM2 processes
 * 2. Delete configuration files (unless --keep-config)
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
      console.log('    - PM2 processes (mcctl-api, mcctl-console)');
      if (!options.keepConfig) {
        console.log('    - Configuration files (.mcctl-admin.yml, users.yaml)');
        console.log('    - PM2 ecosystem config (ecosystem.config.cjs)');
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
    // Step 1: Stop and remove PM2 processes
    spinner.start('Stopping and removing PM2 processes...');
    const processResult = await stopAndRemoveProcesses(paths);
    spinner.stop(processResult.message);

    if (!processResult.success) {
      log.warn(processResult.message);
    }

    // Step 2: Delete configuration files (unless --keep-config)
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

    if (options.keepConfig) {
      console.log(colors.dim('  Note: Configuration files were kept as requested'));
      console.log(colors.dim('    - .mcctl-admin.yml'));
      console.log(colors.dim('    - users.yaml'));
      console.log(colors.dim('    - ecosystem.config.cjs'));
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
