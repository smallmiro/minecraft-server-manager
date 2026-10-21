import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { McctlConfig, EnvConfig } from '../types/index.js';
import { applyEnvChanges, writeFileAtomic } from './env-file.js';

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
    this.dataDir = dataDir ?? resolveMcctlRoot();

    // Cache resolved paths at construction time
    this._scriptsPath = this.resolveScriptsPath();
    this._templatesPath = this.resolveTemplatesPath();
  }

  private resolveScriptsPath(): string {
    if (process.env['MCCTL_SCRIPTS']) {
      return process.env['MCCTL_SCRIPTS'];
    }
    // Monorepo: always run the original platform/scripts so a generated copy can't go stale
    const repoScripts = join(this.packageRoot, '..', '..', 'scripts');
    if (existsSync(repoScripts)) {
      return repoScripts;
    }
    // npm install: scripts bundled into the CLI package at pack time
    return join(this.cliPackageRoot, 'scripts');
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

  /** Services installation directory (.services/) - isolates node_modules from user data */
  get services(): string {
    return join(this.dataDir, '.services');
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
 * The mcctl data root, resolved in one place for every package:
 * MCCTL_ROOT (made absolute), else ~/minecraft-servers.
 */
export function resolveMcctlRoot(): string {
  return resolve(process.env['MCCTL_ROOT'] || join(homedir(), 'minecraft-servers'));
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

  /**
   * Return the persistent install id, generating and saving one if absent.
   * Returns null (and writes nothing) when .mcctl.json is missing, unreadable
   * or cannot be written, so callers treat that as "telemetry off".
   */
  getOrCreateInstallId(): string | null {
    const config = this.load();
    if (!config) return null;
    if (config.installId) return config.installId;

    const installId = randomUUID();
    try {
      this.save({ ...config, installId });
    } catch {
      return null;
    }
    return installId;
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

  /**
   * Update specific keys in .env (other lines kept byte-identical). Values are
   * quoted so bash `source` reads them literally; the write is atomic.
   * Throws on a value that cannot be represented safely (see serializeEnvValue).
   */
  async updateEnv(updates: Record<string, string | boolean>): Promise<void> {
    const envPath = this.paths.envFile;
    const content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
    const set = Object.fromEntries(Object.entries(updates).map(([key, value]) => [key, String(value)]));
    const next = applyEnvChanges(content, { set });

    mkdirSync(dirname(envPath), { recursive: true });
    await writeFileAtomic(envPath, next);
  }
}

/**
 * Whether mcctl-console telemetry may run. Opt-out via `.mcctl.json`
 * (`"telemetry": false`) or `DO_NOT_TRACK=1|true`; off when there is no config.
 */
export function isTelemetryEnabled(
  config: McctlConfig | null,
  env: Record<string, string | undefined> = process.env
): boolean {
  if (!config || config.telemetry === false) return false;
  const dnt = env['DO_NOT_TRACK'];
  return dnt !== '1' && dnt !== 'true';
}

// Re-export the pure formatter (kept in a dependency-free module so the domain
// layer can use it without importing this I/O-bearing barrel).
export { formatWorldBytes } from './format.js';

export * from './env-file.js';

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
