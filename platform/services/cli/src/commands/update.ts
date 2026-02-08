import { log, colors, Paths } from '@minecraft-docker/shared';
import {
  getInstalledVersion,
  fetchLatestVersionForced,
  getCachedVersion,
  clearCache,
  isUpdateAvailable,
} from '../lib/update-checker.js';
import { checkServiceAvailability, PM2_SERVICE_NAMES } from '../lib/pm2-utils.js';
import { Pm2ServiceManagerAdapter } from '../infrastructure/adapters/Pm2ServiceManagerAdapter.js';
import { spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as prompts from '@clack/prompts';

const PACKAGE_NAME = '@minecraft-docker/mcctl';

const SERVICE_PACKAGES = {
  [PM2_SERVICE_NAMES.API]: '@minecraft-docker/mcctl-api',
  [PM2_SERVICE_NAMES.CONSOLE]: '@minecraft-docker/mcctl-console',
} as const;

/**
 * Library packages (no PM2 restart needed)
 */
const LIBRARY_PACKAGES = {
  shared: '@minecraft-docker/shared',
} as const;

/**
 * Update command options
 */
export interface UpdateCommandOptions {
  check?: boolean;
  force?: boolean;
  yes?: boolean;
  all?: boolean;
  root?: string;
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
 * Fetch latest version of a package from npm registry
 */
export async function fetchLatestServiceVersion(packageName: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://registry.npmjs.org/${packageName}/latest`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { version: string };
    return data.version;
  } catch {
    return null;
  }
}

/**
 * Get installed version of a service package from node_modules.
 * Checks .services/ directory first, then falls back to legacy rootDir location.
 */
export function getInstalledServiceVersion(rootDir: string, packageName: string): string | null {
  // Check .services/ directory first (new installs)
  const servicesPath = join(rootDir, '.services', 'node_modules', packageName, 'package.json');
  if (existsSync(servicesPath)) {
    try {
      const pkg = JSON.parse(readFileSync(servicesPath, 'utf-8'));
      return pkg.version ?? null;
    } catch {
      // fall through to legacy check
    }
  }

  // Legacy location (backward compatibility)
  try {
    const legacyPath = join(rootDir, 'node_modules', packageName, 'package.json');
    if (!existsSync(legacyPath)) {
      return null;
    }
    const pkg = JSON.parse(readFileSync(legacyPath, 'utf-8'));
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the install directory for services.
 * Returns .services/ if it exists or if the service is installed there,
 * otherwise returns rootDir for legacy installations.
 */
function getServiceInstallDir(rootDir: string): string {
  const servicesDir = join(rootDir, '.services');
  if (existsSync(servicesDir)) {
    return servicesDir;
  }
  // Legacy: install in rootDir
  return rootDir;
}

/**
 * Service update result
 */
interface ServiceUpdateResult {
  name: string;
  packageName: string;
  installed: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  updated: boolean;
  restarted: boolean;
  error?: string;
}

/**
 * Update a library package (no PM2 restart needed)
 */
async function updateLibraryPackage(
  rootDir: string,
  name: string,
  packageName: string,
  options: { check?: boolean },
  spinner: ReturnType<typeof prompts.spinner>
): Promise<ServiceUpdateResult> {
  // Check if package is installed
  const currentVersion = getInstalledServiceVersion(rootDir, packageName);

  if (!currentVersion) {
    return {
      name,
      packageName,
      installed: false,
      currentVersion: null,
      latestVersion: null,
      updated: false,
      restarted: false,
    };
  }

  // Fetch latest version from npm
  spinner.start(`Checking ${name}...`);
  const latestVersion = await fetchLatestServiceVersion(packageName);
  spinner.stop(`${name} checked`);

  if (!latestVersion) {
    return {
      name,
      packageName,
      installed: true,
      currentVersion,
      latestVersion: null,
      updated: false,
      restarted: false,
      error: 'Failed to fetch latest version',
    };
  }

  const needsUpdate = isUpdateAvailable(currentVersion, latestVersion);

  if (!needsUpdate || options.check) {
    return {
      name,
      packageName,
      installed: true,
      currentVersion,
      latestVersion,
      updated: false,
      restarted: false,
    };
  }

  // Install the latest version
  spinner.start(`Updating ${name}...`);
  const installDir = getServiceInstallDir(rootDir);
  const installResult = spawnSync('npm', ['install', `${packageName}@latest`], {
    cwd: installDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (installResult.status !== 0) {
    spinner.stop(`${name} update failed`);
    return {
      name,
      packageName,
      installed: true,
      currentVersion,
      latestVersion,
      updated: false,
      restarted: false,
      error: installResult.stderr || 'npm install failed',
    };
  }

  spinner.stop(`${name} updated`);

  return {
    name,
    packageName,
    installed: true,
    currentVersion,
    latestVersion,
    updated: true,
    restarted: false, // Libraries don't need restart
  };
}

/**
 * Update all installed services (npm install + PM2 restart)
 */
export async function updateServices(
  rootDir: string,
  options: { yes?: boolean; check?: boolean }
): Promise<number> {
  const availability = checkServiceAvailability(rootDir);
  const results: ServiceUpdateResult[] = [];

  const services = [
    { name: PM2_SERVICE_NAMES.API, available: availability.api.available },
    { name: PM2_SERVICE_NAMES.CONSOLE, available: availability.console.available },
  ];

  // Check if shared library is installed
  const sharedInstalled = getInstalledServiceVersion(rootDir, LIBRARY_PACKAGES.shared) !== null;
  const anyInstalled = services.some((s) => s.available) || sharedInstalled;

  if (!anyInstalled) {
    console.log('');
    console.log(colors.dim('  No services installed. Use "mcctl console init" to set up services.'));
    console.log('');
    return 0;
  }

  console.log(colors.bold('Updating services...'));
  console.log('');

  const spinner = prompts.spinner();

  for (const service of services) {
    const packageName = SERVICE_PACKAGES[service.name as keyof typeof SERVICE_PACKAGES];

    if (!service.available) {
      results.push({
        name: service.name,
        packageName,
        installed: false,
        currentVersion: null,
        latestVersion: null,
        updated: false,
        restarted: false,
      });
      continue;
    }

    // Get current installed version
    const currentVersion = getInstalledServiceVersion(rootDir, packageName);

    // Fetch latest version from npm
    spinner.start(`Checking ${service.name}...`);
    const latestVersion = await fetchLatestServiceVersion(packageName);
    spinner.stop(`${service.name} checked`);

    if (!latestVersion) {
      results.push({
        name: service.name,
        packageName,
        installed: true,
        currentVersion,
        latestVersion: null,
        updated: false,
        restarted: false,
        error: 'Failed to fetch latest version',
      });
      continue;
    }

    const needsUpdate = currentVersion ? isUpdateAvailable(currentVersion, latestVersion) : true;

    if (!needsUpdate) {
      results.push({
        name: service.name,
        packageName,
        installed: true,
        currentVersion,
        latestVersion,
        updated: false,
        restarted: false,
      });
      continue;
    }

    // Check-only mode: don't install
    if (options.check) {
      results.push({
        name: service.name,
        packageName,
        installed: true,
        currentVersion,
        latestVersion,
        updated: false,
        restarted: false,
      });
      continue;
    }

    // Install the latest version
    spinner.start(`Updating ${service.name}...`);
    const serviceInstallDir = getServiceInstallDir(rootDir);
    const installResult = spawnSync('npm', ['install', `${packageName}@latest`], {
      cwd: serviceInstallDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (installResult.status !== 0) {
      spinner.stop(`${service.name} update failed`);
      results.push({
        name: service.name,
        packageName,
        installed: true,
        currentVersion,
        latestVersion,
        updated: false,
        restarted: false,
        error: installResult.stderr || 'npm install failed',
      });
      continue;
    }

    // Restart PM2 service
    let restarted = false;
    try {
      const paths = new Paths(rootDir);
      const pm2Manager = new Pm2ServiceManagerAdapter(paths);
      await pm2Manager.restart(service.name);
      pm2Manager.disconnect();
      restarted = true;
    } catch {
      // PM2 restart failure is non-fatal; service was still updated
    }

    spinner.stop(`${service.name} updated`);

    results.push({
      name: service.name,
      packageName,
      installed: true,
      currentVersion,
      latestVersion,
      updated: true,
      restarted,
    });
  }

  // Update library packages (shared)
  const sharedResult = await updateLibraryPackage(
    rootDir,
    'shared',
    LIBRARY_PACKAGES.shared,
    options,
    spinner
  );
  results.push(sharedResult);

  // Print results summary
  printServiceResults(results, options.check);

  const hasErrors = results.some((r) => r.error);
  return hasErrors ? 1 : 0;
}

/**
 * Print service update results
 */
function printServiceResults(results: ServiceUpdateResult[], checkOnly?: boolean): void {
  for (const result of results) {
    if (!result.installed) {
      console.log(`  ${result.name.padEnd(16)} Not installed    ${colors.dim('- Skipped')}`);
      continue;
    }

    if (result.error) {
      console.log(`  ${result.name.padEnd(16)} ${colors.red('Error: ' + result.error)}`);
      continue;
    }

    const current = result.currentVersion ?? 'unknown';
    const latest = result.latestVersion ?? 'unknown';

    if (result.updated) {
      const restartStatus = result.restarted ? 'Updated & restarted' : 'Updated (restart manually)';
      console.log(`  ${result.name.padEnd(16)} ${current} → ${latest}  ${colors.green('✓ ' + restartStatus)}`);
    } else if (checkOnly && result.currentVersion && result.latestVersion && isUpdateAvailable(result.currentVersion, result.latestVersion)) {
      console.log(`  ${result.name.padEnd(16)} ${current} → ${colors.yellow(latest)}  ${colors.yellow('Update available')}`);
    } else {
      console.log(`  ${result.name.padEnd(16)} ${colors.green(current)}  ${colors.dim('Up to date')}`);
    }
  }
  console.log('');
}

/**
 * Execute update command
 */
export async function updateCommand(options: UpdateCommandOptions): Promise<number> {
  const currentVersion = getInstalledVersion();

  // Always clear cache when running update command to ensure fresh check
  clearCache();

  // Get latest version (always fetch from npm, ignore cache)
  const spinner = prompts.spinner();
  spinner.start('Checking for updates...');

  const latestVersion = await fetchLatestVersionForced();

  if (!latestVersion) {
    spinner.stop('Failed to fetch latest version from npm registry');
    return 1;
  }
  spinner.stop('Version check complete');

  const hasUpdate = isUpdateAvailable(currentVersion, latestVersion);

  // Print version info
  printVersionInfo(currentVersion, latestVersion, hasUpdate);

  // If --check with --all, show service info too
  if (options.check && options.all) {
    const rootDir = new Paths(options.root).root;
    await updateServices(rootDir, { check: true });
    return hasUpdate ? 1 : 0;
  }

  // If --check, just show info and exit
  if (options.check) {
    return hasUpdate ? 1 : 0; // Exit code 1 if update available (useful for scripts)
  }

  // If no update available for CLI, skip CLI update
  if (!hasUpdate) {
    // But still update services if --all
    if (options.all) {
      const rootDir = new Paths(options.root).root;
      return updateServices(rootDir, { yes: options.yes });
    }
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

    // Update services if --all
    if (options.all) {
      const rootDir = new Paths(options.root).root;
      return updateServices(rootDir, { yes: options.yes });
    }

    return 0;
  } else {
    console.log('');
    log.error('Update failed. Try running manually:');
    console.log(colors.cyan(`  sudo npm install -g ${PACKAGE_NAME}`));
    console.log('');
    return 1;
  }
}
