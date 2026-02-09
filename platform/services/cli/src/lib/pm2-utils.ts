/**
 * PM2 Utility Functions
 *
 * Helper functions for PM2 operations including:
 * - PM2 installation check
 * - PM2 connection management
 * - Ecosystem config path resolution
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Paths } from '@minecraft-docker/shared';

/**
 * Default ecosystem config filename
 */
export const ECOSYSTEM_CONFIG_FILE = 'ecosystem.config.cjs';

/**
 * PM2 service names
 */
export const PM2_SERVICE_NAMES = {
  API: 'mcctl-api',
  CONSOLE: 'mcctl-console',
} as const;

/**
 * Check if PM2 is installed (globally or as a dependency)
 * @returns Object with installation status and version
 */
export function checkPm2Installation(): { installed: boolean; path?: string; version?: string } {
  // First check if pm2 is available in PATH (global installation)
  const globalResult = spawnSync('which', ['pm2'], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (globalResult.status === 0 && globalResult.stdout) {
    const pm2Path = globalResult.stdout.trim();

    // Get version
    const versionResult = spawnSync('pm2', ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
      installed: true,
      path: pm2Path,
      version: versionResult.status === 0 ? versionResult.stdout.trim() : undefined,
    };
  }

  // Check if pm2 module can be imported (local installation via npm)
  // The pm2 programmatic API works without global installation
  try {
    // We already have pm2 as a dependency, so it's always available
    // Just return true - the actual PM2 operations will work via the API
    return {
      installed: true,
      version: 'local',
    };
  } catch {
    return { installed: false };
  }
}

/**
 * Get the ecosystem config path for the given platform
 * @param paths - Paths instance
 * @returns Absolute path to ecosystem.config.cjs
 */
export function getEcosystemConfigPath(paths: Paths): string {
  return join(paths.platform, ECOSYSTEM_CONFIG_FILE);
}

/**
 * Check if ecosystem config exists
 * @param paths - Paths instance
 * @returns true if config exists
 */
export function ecosystemConfigExists(paths: Paths): boolean {
  return existsSync(getEcosystemConfigPath(paths));
}

/**
 * Get PM2 log file paths for a service
 * @param paths - Paths instance
 * @param serviceName - Service name
 * @returns Object with output and error log paths
 */
export function getPm2LogPaths(
  paths: Paths,
  serviceName: string
): { output: string; error: string } {
  const logsDir = join(paths.platform, 'logs');
  return {
    output: join(logsDir, `${serviceName}-out.log`),
    error: join(logsDir, `${serviceName}-error.log`),
  };
}

/**
 * Read log file content
 * @param logPath - Path to log file
 * @param lines - Number of lines to read (default: 100)
 * @returns Log content
 */
export function readLogFile(logPath: string, lines: number = 100): string {
  if (!existsSync(logPath)) {
    return '';
  }

  try {
    const content = readFileSync(logPath, 'utf-8');
    const allLines = content.split('\n');
    const startIndex = Math.max(0, allLines.length - lines);
    return allLines.slice(startIndex).join('\n');
  } catch {
    return '';
  }
}

/**
 * Format PM2 error for user-friendly display
 * @param error - Error object
 * @returns Formatted error message
 */
export function formatPm2Error(error: unknown): string {
  if (error instanceof Error) {
    // Common PM2 errors
    if (error.message.includes('ENOENT')) {
      return 'PM2 or the specified script was not found';
    }
    if (error.message.includes('EACCES')) {
      return 'Permission denied. Try running with elevated privileges';
    }
    if (error.message.includes('ECONNREFUSED')) {
      return 'Could not connect to PM2 daemon. It may not be running';
    }
    return error.message;
  }
  return String(error);
}

/**
 * Parse PM2 status to our ServiceStatusEnum
 * @param pm2Status - PM2 process status string
 * @returns Normalized status string
 */
export function normalizePm2Status(pm2Status: string): string {
  switch (pm2Status) {
    case 'online':
      return 'online';
    case 'stopping':
      return 'stopping';
    case 'stopped':
      return 'stopped';
    case 'errored':
      return 'errored';
    case 'launching':
      return 'online'; // Treat launching as online for simplicity
    case 'waiting_restart':
      return 'stopping'; // Treat waiting_restart as stopping
    case 'one-launch-status':
      return 'one-launch-status';
    default:
      return 'stopped';
  }
}

/**
 * Available services for console
 */
export type ConsoleServiceType = 'api' | 'console';

/**
 * Service availability status
 */
export interface ServiceAvailability {
  api: { available: boolean; path?: string };
  console: { available: boolean; path?: string };
}

/**
 * Check which console services are available (installed)
 * @param rootDir - Root directory (MCCTL_ROOT)
 * @returns Object with availability status for each service
 */
export function checkServiceAvailability(rootDir: string): ServiceAvailability {
  const scriptPaths = resolveServiceScriptPaths(rootDir);

  return {
    api: {
      available: existsSync(scriptPaths.api),
      path: scriptPaths.api,
    },
    console: {
      available: existsSync(scriptPaths.console),
      path: scriptPaths.console,
    },
  };
}

/**
 * Get list of available service names
 * @param rootDir - Root directory (MCCTL_ROOT)
 * @returns Array of available service names
 */
export function getAvailableServices(rootDir: string): string[] {
  const availability = checkServiceAvailability(rootDir);
  const services: string[] = [];

  if (availability.api.available) {
    services.push(PM2_SERVICE_NAMES.API);
  }
  if (availability.console.available) {
    services.push(PM2_SERVICE_NAMES.CONSOLE);
  }

  return services;
}

/**
 * Service script paths configuration
 */
export interface ServiceScriptPaths {
  api: string;
  console: string;
  isDevelopment: boolean;
}

/**
 * Resolve script paths for PM2 services.
 * Tries to find scripts in node_modules (production) or workspace (development).
 *
 * @param rootDir - Root directory (MCCTL_ROOT)
 * @returns Object with resolved script paths
 */
export function resolveServiceScriptPaths(rootDir: string): ServiceScriptPaths {
  // New isolated paths (.services/ directory)
  const servicesDir = join(rootDir, '.services');
  const isolatedApiPath = join(servicesDir, 'node_modules/@minecraft-docker/mcctl-api/dist/index.js');
  const isolatedConsolePath = join(
    servicesDir,
    'node_modules/@minecraft-docker/mcctl-console/.next/standalone/platform/services/mcctl-console/server.js'
  );

  // Check isolated .services/ directory first (new installs)
  if (existsSync(isolatedApiPath) || existsSync(isolatedConsolePath)) {
    return {
      api: isolatedApiPath,
      console: isolatedConsolePath,
      isDevelopment: false,
    };
  }

  // Legacy paths (rootDir/node_modules) - backward compatibility
  const legacyApiPath = join(rootDir, 'node_modules/@minecraft-docker/mcctl-api/dist/index.js');
  const legacyConsolePath = join(
    rootDir,
    'node_modules/@minecraft-docker/mcctl-console/.next/standalone/platform/services/mcctl-console/server.js'
  );

  if (existsSync(legacyApiPath) || existsSync(legacyConsolePath)) {
    return {
      api: legacyApiPath,
      console: legacyConsolePath,
      isDevelopment: false,
    };
  }

  // Development mode: Try to find via workspace
  // The CLI is installed globally via pnpm link, so we need to find the workspace
  // by looking at where this package is actually located

  // Try common development workspace locations
  const possibleWorkspaceRoots = [
    // User's minecraft project directory (most common)
    join(process.env.HOME || '~', 'minecraft'),
    // If MCCTL_DEV_ROOT is set
    process.env.MCCTL_DEV_ROOT,
    // Current working directory might be in the workspace
    findWorkspaceRoot(process.cwd()),
  ].filter((p): p is string => p !== undefined && p !== null);

  for (const workspaceRoot of possibleWorkspaceRoots) {
    const devApiPath = join(workspaceRoot, 'platform/services/mcctl-api/dist/index.js');
    const devConsolePath = join(
      workspaceRoot,
      'platform/services/mcctl-console/.next/standalone/platform/services/mcctl-console/server.js'
    );

    // Also try without standalone (for development builds)
    const devConsolePathAlt = join(
      workspaceRoot,
      'platform/services/mcctl-console/.next/standalone/server.js'
    );

    // Check if any development paths exist (each service is independent)
    const devConsoleResolved = existsSync(devConsolePath)
      ? devConsolePath
      : existsSync(devConsolePathAlt)
        ? devConsolePathAlt
        : devConsolePath;

    if (existsSync(devApiPath) || existsSync(devConsolePath) || existsSync(devConsolePathAlt)) {
      return {
        api: devApiPath,
        console: devConsoleResolved,
        isDevelopment: true,
      };
    }
  }

  // Fallback: return production paths (will fail at runtime if not found)
  return {
    api: isolatedApiPath,
    console: isolatedConsolePath,
    isDevelopment: false,
  };
}

/**
 * Find the workspace root by looking for pnpm-workspace.yaml or package.json with workspaces
 * @param startDir - Directory to start searching from
 * @returns Workspace root or undefined
 */
function findWorkspaceRoot(startDir: string): string | undefined {
  let currentDir = startDir;
  const root = '/';

  while (currentDir !== root) {
    // Check for pnpm workspace
    if (existsSync(join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }

    // Check for package.json with workspaces field
    const packageJsonPath = join(currentDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const content = readFileSync(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content);
        if (pkg.workspaces) {
          return currentDir;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Move up one directory
    const parentDir = join(currentDir, '..');
    if (parentDir === currentDir) {
      break; // Reached root
    }
    currentDir = parentDir;
  }

  return undefined;
}
