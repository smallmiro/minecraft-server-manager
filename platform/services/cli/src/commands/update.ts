import { log, colors } from '@minecraft-docker/shared';
import {
  getInstalledVersion,
  fetchLatestVersionForced,
  getCachedVersion,
  clearCache,
  isUpdateAvailable,
} from '../lib/update-checker.js';
import { spawnSync } from 'child_process';
import * as prompts from '@clack/prompts';

const PACKAGE_NAME = '@minecraft-docker/mcctl';

/**
 * Update command options
 */
export interface UpdateCommandOptions {
  check?: boolean;
  force?: boolean;
  yes?: boolean;
}

/**
 * Print version comparison box
 */
function printVersionInfo(
  currentVersion: string,
  latestVersion: string,
  hasUpdate: boolean
): void {
  console.log('');
  console.log(colors.bold('mcctl Version Info'));
  console.log('');
  console.log(`  Installed: ${colors.cyan(currentVersion)}`);
  console.log(`  Latest:    ${hasUpdate ? colors.yellow(latestVersion) : colors.green(latestVersion)}`);
  console.log('');

  if (hasUpdate) {
    console.log(colors.yellow(`  Update available: ${currentVersion} → ${latestVersion}`));
    console.log('');
  } else {
    console.log(colors.green('  You are using the latest version.'));
    console.log('');
  }
}

/**
 * Execute npm install command using spawnSync (safe, no shell injection)
 */
function runNpmInstall(): boolean {
  console.log('');
  console.log(colors.dim(`Running: npm install -g ${PACKAGE_NAME}`));
  console.log('');

  const result = spawnSync('npm', ['install', '-g', PACKAGE_NAME], {
    stdio: 'inherit',
  });

  return result.status === 0;
}

/**
 * Execute update command
 */
export async function updateCommand(options: UpdateCommandOptions): Promise<number> {
  const currentVersion = getInstalledVersion();

  // If --force, clear cache first
  if (options.force) {
    clearCache();
  }

  // Get latest version
  let latestVersion: string | null;

  if (options.force) {
    // Force fetch from npm
    const spinner = prompts.spinner();
    spinner.start('Checking for updates...');

    latestVersion = await fetchLatestVersionForced();

    if (!latestVersion) {
      spinner.stop('Failed to fetch latest version from npm registry');
      return 1;
    }
    spinner.stop('Version check complete');
  } else {
    // Try cache first, then fetch
    latestVersion = getCachedVersion();

    if (!latestVersion) {
      const spinner = prompts.spinner();
      spinner.start('Checking for updates...');

      latestVersion = await fetchLatestVersionForced();

      if (!latestVersion) {
        spinner.stop('Failed to fetch latest version from npm registry');
        return 1;
      }
      spinner.stop('Version check complete');
    }
  }

  const hasUpdate = isUpdateAvailable(currentVersion, latestVersion);

  // Print version info
  printVersionInfo(currentVersion, latestVersion, hasUpdate);

  // If --check, just show info and exit
  if (options.check) {
    return hasUpdate ? 1 : 0; // Exit code 1 if update available (useful for scripts)
  }

  // If no update available, we're done
  if (!hasUpdate) {
    return 0;
  }

  // Ask user if they want to update (unless --yes)
  if (!options.yes) {
    const confirm = await prompts.confirm({
      message: `Update mcctl to ${latestVersion}?`,
    });

    if (prompts.isCancel(confirm) || !confirm) {
      console.log('');
      console.log(colors.dim('Update cancelled.'));
      console.log('');
      console.log(`  To update manually, run:`);
      console.log(colors.cyan(`    npm install -g ${PACKAGE_NAME}`));
      console.log('');
      return 0;
    }
  }

  // Run npm install
  const success = runNpmInstall();

  if (success) {
    console.log('');
    console.log(colors.green('✓ mcctl updated successfully!'));
    console.log('');

    // Clear cache after successful update
    clearCache();

    return 0;
  } else {
    console.log('');
    log.error('Update failed. Try running manually:');
    console.log(colors.cyan(`  sudo npm install -g ${PACKAGE_NAME}`));
    console.log('');
    return 1;
  }
}
