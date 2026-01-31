import { config as loadEnv } from 'dotenv';
import * as path from 'path';
import * as os from 'os';

// Load .env file
loadEnv();

// ============================================================
// Types
// ============================================================

export type AuthMode = 'disabled' | 'api-key' | 'ip-whitelist' | 'basic' | 'combined';

export interface AuthUser {
  username: string;
  passwordHash: string;
}

export interface AuthConfig {
  mode: AuthMode;
  apiKey?: string;
  ipWhitelist?: string[];
  users?: AuthUser[];
  excludePaths?: string[];
}

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: 'development' | 'production' | 'test';
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  auth: AuthConfig;
  /**
   * Root directory for mcctl data.
   * Default: MCCTL_ROOT env or ~/minecraft-servers
   */
  mcctlRoot: string;
  /**
   * Platform directory containing docker-compose.yml and server configurations.
   * Default: PLATFORM_PATH env or mcctlRoot
   */
  platformPath: string;
}

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getNodeEnv(): AppConfig['nodeEnv'] {
  const env = process.env['NODE_ENV'];
  if (env === 'production' || env === 'test') {
    return env;
  }
  return 'development';
}

function getLogLevel(): AppConfig['logLevel'] {
  const level = process.env['LOG_LEVEL'];
  const validLevels: AppConfig['logLevel'][] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
  if (level && validLevels.includes(level as AppConfig['logLevel'])) {
    return level as AppConfig['logLevel'];
  }
  // Default based on NODE_ENV
  return getNodeEnv() === 'production' ? 'info' : 'debug';
}

function getAuthMode(): AuthMode {
  const mode = process.env['AUTH_MODE'];
  const validModes: AuthMode[] = ['disabled', 'api-key', 'ip-whitelist', 'basic', 'combined'];
  if (mode && validModes.includes(mode as AuthMode)) {
    return mode as AuthMode;
  }
  // Default based on NODE_ENV
  return getNodeEnv() === 'production' ? 'api-key' : 'disabled';
}

function getIpWhitelist(): string[] | undefined {
  const whitelist = process.env['AUTH_IP_WHITELIST'];
  if (!whitelist) {
    return undefined;
  }
  // Split by comma and trim whitespace
  return whitelist.split(',').map((ip) => ip.trim()).filter((ip) => ip.length > 0);
}

function getAuthUsers(): AuthUser[] | undefined {
  const usersJson = process.env['AUTH_USERS'];
  if (!usersJson) {
    return undefined;
  }
  try {
    const users = JSON.parse(usersJson);
    if (!Array.isArray(users)) {
      return undefined;
    }
    return users.filter(
      (u): u is AuthUser =>
        typeof u === 'object' &&
        u !== null &&
        typeof u.username === 'string' &&
        typeof u.passwordHash === 'string'
    );
  } catch {
    return undefined;
  }
}

function getExcludePaths(): string[] {
  const paths = process.env['AUTH_EXCLUDE_PATHS'];
  if (!paths) {
    return ['/health', '/health/'];
  }
  return paths.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
}

function getAuthConfig(): AuthConfig {
  return {
    mode: getAuthMode(),
    apiKey: process.env['AUTH_API_KEY'],
    ipWhitelist: getIpWhitelist(),
    users: getAuthUsers(),
    excludePaths: getExcludePaths(),
  };
}

/**
 * Get MCCTL_ROOT directory.
 * Priority:
 *   1. MCCTL_ROOT environment variable
 *   2. ~/minecraft-servers (default for native execution)
 */
function getMcctlRoot(): string {
  const envRoot = process.env['MCCTL_ROOT'];
  if (envRoot) {
    return path.resolve(envRoot);
  }
  // Default: ~/minecraft-servers (user's home directory)
  return path.join(os.homedir(), 'minecraft-servers');
}

/**
 * Get platform directory path.
 * Priority:
 *   1. PLATFORM_PATH environment variable
 *   2. MCCTL_ROOT (same as mcctlRoot)
 */
function getPlatformPath(mcctlRoot: string): string {
  const envPath = process.env['PLATFORM_PATH'];
  if (envPath) {
    return path.resolve(envPath);
  }
  // Default: same as MCCTL_ROOT
  return mcctlRoot;
}

const mcctlRoot = getMcctlRoot();

export const config: AppConfig = {
  port: getEnvNumber('PORT', 5001),
  host: getEnv('HOST', '0.0.0.0'),
  nodeEnv: getNodeEnv(),
  logLevel: getLogLevel(),
  auth: getAuthConfig(),
  mcctlRoot,
  platformPath: getPlatformPath(mcctlRoot),
};

export default config;
