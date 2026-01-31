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
 * Get the CLI package root directory (for scripts/templates)
 */
export function getCliPackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  let dir = dirname(currentFile);

  // Walk up until we find package.json with @minecraft-docker/mcctl
  while (dir !== '/') {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === '@minecraft-docker/mcctl') {
          return dir;
        }
      } catch {
        // Continue searching
      }
    }
    dir = dirname(dir);
  }

  // Fallback: try to find CLI package in node_modules
  const sharedRoot = getPackageRoot();
  const possibleCliPaths = [
    join(sharedRoot, '..', 'mcctl'),           // sibling in node_modules/@minecraft-docker/
    join(sharedRoot, '..', '..', '..'),        // parent CLI package in global install (shared inside mcctl/node_modules)
    join(sharedRoot, '..', 'cli'),             // development structure
    join(sharedRoot, '..', '..', '..', 'cli'), // workspace structure
  ];

  for (const cliPath of possibleCliPaths) {
    const cliPkgPath = join(cliPath, 'package.json');
    if (existsSync(cliPkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(cliPkgPath, 'utf-8'));
        if (pkg.name === '@minecraft-docker/mcctl') {
          return cliPath;
        }
      } catch {
        // Continue searching
      }
    }
  }

  // Final fallback: return shared package root
  return sharedRoot;
}

/**
 * Path resolution utilities
 */
export class Paths {
  private readonly dataDir: string;
  private readonly packageRoot: string;
  private readonly cliPackageRoot: string;
  private readonly _scriptsPath: string;
  private readonly _templatesPath: string;

  constructor(dataDir?: string) {
    this.packageRoot = getPackageRoot();
    this.cliPackageRoot = getCliPackageRoot();
    this.dataDir = dataDir ?? process.env['MCCTL_ROOT'] ?? join(homedir(), 'minecraft-servers');

    // Cache resolved paths at construction time
    this._scriptsPath = this.resolveScriptsPath();
    this._templatesPath = this.resolveTemplatesPath();
  }

  private resolveScriptsPath(): string {
    if (process.env['MCCTL_SCRIPTS']) {
      return process.env['MCCTL_SCRIPTS'];
    }
    // Check CLI package's bundled scripts first
    const cliScripts = join(this.cliPackageRoot, 'scripts');
    if (existsSync(cliScripts)) {
      return cliScripts;
    }
    // Fallback to development structure
    return join(this.packageRoot, '..', '..', 'scripts');
  }

  private resolveTemplatesPath(): string {
    if (process.env['MCCTL_TEMPLATES']) {
      return process.env['MCCTL_TEMPLATES'];
    }
    // Check CLI package's bundled templates first
    const cliTemplates = join(this.cliPackageRoot, 'templates');
    if (existsSync(cliTemplates)) {
      return cliTemplates;
    }
    // Fallback to development structure
    return join(this.packageRoot, '..', '..', '..', 'templates');
  }

  /** User data directory (~/.minecraft-servers) */
  get root(): string {
    return this.dataDir;
  }

  /** Platform directory within data */
  get platform(): string {
    return this.dataDir;
  }

  /** Scripts directory (from CLI package) */
  get scripts(): string {
    return this._scriptsPath;
  }

  /** Templates directory (from CLI package) */
  get templates(): string {
    return this._templatesPath;
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
