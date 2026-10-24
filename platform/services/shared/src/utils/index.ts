import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { McctlConfig, EnvConfig } from '../types/index.js';
import { applyEnvChanges, parseEnvDocument } from './env-file.js';
import { atomicWriteFile, atomicWriteFileSync } from './atomic-write.js';

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
 * Get the CLI package root directory (for templates)
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
  private readonly cliPackageRoot: string;
  private readonly _templatesPath: string;

  constructor(dataDir?: string) {
    this.cliPackageRoot = getCliPackageRoot();
    this.dataDir = dataDir ?? resolveMcctlRoot();

    // Cache resolved paths at construction time
    this._templatesPath = this.resolveTemplatesPath();
  }

  private resolveTemplatesPath(): string {
    if (process.env['MCCTL_TEMPLATES']) {
      return process.env['MCCTL_TEMPLATES'];
    }
    // Single source (#651): platform/services/cli/templates
    return join(this.cliPackageRoot, 'templates');
  }

  /** User data directory (~/.minecraft-servers) */
  get root(): string {
    return this.dataDir;
  }

  /** Platform directory within data */
  get platform(): string {
    return this.dataDir;
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

  /**
   * Locks directory
   *
   * @deprecated worlds/.locks is no longer read or written by mcctl (#670).
   * Removed in v3.0.0 (#736).
   */
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

  /**
   * Get lock file path
   *
   * @deprecated worlds/.locks is no longer read or written by mcctl (#670).
   * Removed in v3.0.0 (#736).
   */
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

    atomicWriteFileSync(configPath, JSON.stringify(config, null, 2));
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
      for (const [key, value] of parseEnvDocument(readFileSync(envPath, 'utf-8')).values) {
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
    await atomicWriteFile(envPath, next, { mode: 0o600 });
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
export * from './atomic-write.js';

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
