import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { McctlConfig, EnvConfig } from '../types/index.js';

/**
 * Get the package root directory
 */
export function getPackageRoot(): string {
  // When running from npm package, find the package root
  const currentFile = fileURLToPath(import.meta.url);
  let dir = dirname(currentFile);

  // Walk up until we find package.json with @minecraft-docker
  while (dir !== '/') {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.name?.startsWith('@minecraft-docker/')) {
          return dir;
        }
      } catch {
        // Continue searching
      }
    }
    dir = dirname(dir);
  }

  return dirname(currentFile);
}

/**
 * Path resolution utilities
 */
export class Paths {
  private readonly dataDir: string;
  private readonly packageRoot: string;

  constructor(dataDir?: string) {
    this.packageRoot = getPackageRoot();
    this.dataDir = dataDir ?? process.env['MCCTL_ROOT'] ?? join(homedir(), 'minecraft-servers');
  }

  /** User data directory (~/.minecraft-servers) */
  get root(): string {
    return this.dataDir;
  }

  /** Platform directory within data */
  get platform(): string {
    return this.dataDir;
  }

  /** Scripts directory (from package or local) */
  get scripts(): string {
    // Priority: env var > CLI package scripts > repo root scripts
    if (process.env['MCCTL_SCRIPTS']) {
      return process.env['MCCTL_SCRIPTS'];
    }

    // Try to find scripts in mcctl CLI package (npm global install)
    const cliScripts = join(this.packageRoot, '..', 'mcctl', 'scripts');
    if (existsSync(cliScripts)) {
      return cliScripts;
    }

    // Try scripts in current package (if CLI is packageRoot)
    const localScripts = join(this.packageRoot, 'scripts');
    if (existsSync(localScripts)) {
      return localScripts;
    }

    // Fallback: repo root scripts (local dev)
    return join(this.packageRoot, '..', '..', 'scripts');
  }

  /** Templates directory (from package) */
  get templates(): string {
    // Priority: env var > CLI package templates > repo root templates
    if (process.env['MCCTL_TEMPLATES']) {
      return process.env['MCCTL_TEMPLATES'];
    }

    // Try to find templates in mcctl CLI package (npm global install)
    const cliTemplates = join(this.packageRoot, '..', 'mcctl', 'templates');
    if (existsSync(cliTemplates)) {
      return cliTemplates;
    }

    // Try templates in current package (if CLI is packageRoot)
    const localTemplates = join(this.packageRoot, 'templates');
    if (existsSync(localTemplates)) {
      return localTemplates;
    }

    // Fallback: repo root templates (local dev)
    return join(this.packageRoot, '..', '..', '..', 'templates');
  }

  /** Servers directory */
  get servers(): string {
    return join(this.dataDir, 'servers');
  }

  /** Worlds directory */
  get worlds(): string {
    return join(this.dataDir, 'worlds');
  }

  /** Locks directory */
  get locks(): string {
    return join(this.dataDir, 'worlds', '.locks');
  }

  /** Shared plugins directory */
  get plugins(): string {
    return join(this.dataDir, 'shared', 'plugins');
  }

  /** Shared mods directory */
  get mods(): string {
    return join(this.dataDir, 'shared', 'mods');
  }

  /** Backups directory */
  get backups(): string {
    return join(this.dataDir, 'backups');
  }

  /** .env file path */
  get envFile(): string {
    return join(this.dataDir, '.env');
  }

  /** docker-compose.yml path */
  get composeFile(): string {
    return join(this.dataDir, 'docker-compose.yml');
  }

  /** Server template directory */
  get serverTemplate(): string {
    return join(this.servers, '_template');
  }

  /** Config file path */
  get configFile(): string {
    return join(this.dataDir, '.mcctl.json');
  }

  /** Check if platform is initialized */
  isInitialized(): boolean {
    return existsSync(this.composeFile);
  }

  /** Get server directory */
  serverDir(name: string): string {
    return join(this.servers, name);
  }

  /** Get world directory */
  worldDir(name: string): string {
    return join(this.worlds, name);
  }

  /** Get lock file path */
  lockFile(world: string): string {
    return join(this.locks, `${world}.lock`);
  }
}

/**
 * Configuration utilities
 */
export class Config {
  private readonly paths: Paths;

  constructor(paths?: Paths) {
    this.paths = paths ?? new Paths();
  }

  /** Load mcctl config */
  load(): McctlConfig | null {
    const configPath = this.paths.configFile;
    if (!existsSync(configPath)) {
      return null;
    }

    try {
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content) as McctlConfig;
    } catch {
      return null;
    }
  }

  /** Save mcctl config */
  save(config: McctlConfig): void {
    const configPath = this.paths.configFile;
    const dir = dirname(configPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /** Load .env file */
  loadEnv(): EnvConfig {
    const envPath = this.paths.envFile;
    const config: EnvConfig = {};

    if (!existsSync(envPath)) {
      return config;
    }

    try {
      const content = readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        // Remove quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        (config as Record<string, string | boolean>)[key] =
          value === 'true' ? true : value === 'false' ? false : value;
      }
    } catch {
      // Return empty config on error
    }

    return config;
  }

  /** Update specific keys in .env file (preserves comments and other settings) */
  updateEnv(updates: Record<string, string | boolean>): void {
    const envPath = this.paths.envFile;
    let content = '';

    if (existsSync(envPath)) {
      content = readFileSync(envPath, 'utf-8');
    }

    const lines = content.split('\n');
    const updatedKeys = new Set<string>();

    // Update existing keys
    const updatedLines = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return line;

      const key = trimmed.slice(0, eqIndex).trim();

      if (key in updates) {
        updatedKeys.add(key);
        const value = updates[key];
        const strValue = typeof value === 'boolean' ? String(value) : value;
        return `${key}=${strValue}`;
      }

      return line;
    });

    // Add new keys that weren't updated
    const newKeys = Object.entries(updates).filter(([key]) => !updatedKeys.has(key));

    if (newKeys.length > 0) {
      // Add blank line before new section if file has content
      if (updatedLines.length > 0 && updatedLines[updatedLines.length - 1]?.trim() !== '') {
        updatedLines.push('');
      }

      for (const [key, value] of newKeys) {
        const strValue = typeof value === 'boolean' ? String(value) : value;
        updatedLines.push(`${key}=${strValue}`);
      }
    }

    // Ensure directory exists
    const dir = dirname(envPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(envPath, updatedLines.join('\n'), 'utf-8');
  }
}

/**
 * Console output utilities with colors
 */
export const colors = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

export const log = {
  info: (msg: string) => console.log(`${colors.green('[INFO]')} ${msg}`),
  warn: (msg: string) => console.error(`${colors.yellow('[WARN]')} ${msg}`),
  error: (msg: string) => console.error(`${colors.red('[ERROR]')} ${msg}`),
  debug: (msg: string) => {
    if (process.env['DEBUG'] === 'true') {
      console.error(`${colors.blue('[DEBUG]')} ${msg}`);
    }
  },
};
