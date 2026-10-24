import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import { Paths, log } from '@minecraft-docker/shared';
import { assertEnvFileValue, parseEnvDocument } from '@minecraft-docker/shared/utils';
import { writeServerConfig } from '../lib/server-config.js';

export interface ShellExecutorOptions {
  paths?: Paths;
  sudoPassword?: string;
}

/**
 * Compose-project operations (pull, up/down, startAll/stopAll, router) and
 * server config.env access. Not runtime-port work: platform lifecycle on k8s
 * belongs to Helm (ADR-0001 row 15).
 */
export class ShellExecutor {
  private readonly paths: Paths;
  private readonly env: Record<string, string>;
  private readonly sudoPassword?: string;

  constructor(pathsOrOptions?: Paths | ShellExecutorOptions) {
    if (pathsOrOptions instanceof Paths) {
      this.paths = pathsOrOptions;
      this.sudoPassword = undefined;
    } else if (pathsOrOptions) {
      this.paths = pathsOrOptions.paths ?? new Paths();
      this.sudoPassword = pathsOrOptions.sudoPassword;
    } else {
      this.paths = new Paths();
      this.sudoPassword = undefined;
    }
    this.env = this.buildEnv();
  }

  private buildEnv(): Record<string, string> {
    const env: Record<string, string> = {
      MCCTL_ROOT: this.paths.root,
      MCCTL_TEMPLATES: this.paths.templates,
    };

    // Support MCCTL_SUDO_PASSWORD from:
    // 1. Constructor option (--sudo-password CLI flag)
    // 2. Environment variable (for automation)
    const sudoPassword = this.sudoPassword ?? process.env.MCCTL_SUDO_PASSWORD;
    if (sudoPassword) {
      env.MCCTL_SUDO_PASSWORD = sudoPassword;
    }

    return env;
  }

  /**
   * Pull a Docker image
   */
  async dockerPull(image: string): Promise<number> {
    return new Promise((resolve) => {
      const child = spawn('docker', ['pull', image], {
        cwd: this.paths.root,
        stdio: 'inherit',
        env: { ...process.env, ...this.env },
      });

      child.on('close', (code) => {
        resolve(code ?? 0);
      });

      child.on('error', (err) => {
        log.error(`Failed to pull Docker image ${image}: ${err.message}`);
        resolve(1);
      });
    });
  }

  /**
   * The container's ID and state (`docker inspect`), or null when it cannot be
   * inspected (no such container, or docker failed). The ID lets callers tell
   * whether compose recreated it, without parsing compose output.
   */
  containerState(container: string): Promise<{ id: string; status: string } | null> {
    return new Promise((resolve) => {
      execFile('docker', ['inspect', '-f', '{{.Id}} {{.State.Status}}', '--', container], (err, stdout) => {
        const [id, status] = stdout.trim().split(' ');
        resolve(err || !id || !status ? null : { id, status });
      });
    });
  }

  /**
   * Execute docker compose command
   */
  async dockerCompose(args: string[]): Promise<number> {
    return new Promise((resolve) => {
      const child = spawn('docker', ['compose', ...args], {
        cwd: this.paths.root,
        stdio: 'inherit',
        env: { ...process.env, ...this.env },
      });

      child.on('close', (code) => {
        resolve(code ?? 0);
      });

      child.on('error', (err) => {
        log.error(`Failed to execute docker compose: ${err.message}`);
        resolve(1);
      });
    });
  }

  /**
   * Get server config.env path
   */
  getConfigPath(server: string): string {
    const serverName = server.startsWith('mc-') ? server.slice(3) : server;
    return join(this.paths.servers, serverName, 'config.env');
  }

  /**
   * Read server config.env as key-value pairs
   */
  readConfig(server: string): Record<string, string> | null {
    const configPath = this.getConfigPath(server);
    if (!existsSync(configPath)) {
      return null;
    }

    return Object.fromEntries(parseEnvDocument(readFileSync(configPath, 'utf-8')).values);
  }

  /**
   * Set a config value of a server through its ServerSpec (#675): server.yaml
   * is updated and config.env is rendered from it (comments kept).
   * A world-location key (EXTRA_ARGS) may move the world; callers check that first.
   */
  async writeConfigValue(server: string, key: string, value: string): Promise<boolean> {
    const serverName = server.startsWith('mc-') ? server.slice(3) : server;
    if (!existsSync(this.getConfigPath(server))) {
      log.error(`Config file not found: ${this.getConfigPath(server)}`);
      return false;
    }
    try {
      // config.env is an env_file: the key and value must stay one setting (#726)
      assertEnvFileValue(key, value);
      await writeServerConfig(this.paths, serverName, { set: { [key]: value } }, { allowStorageChange: key === 'EXTRA_ARGS' });
      return true;
    } catch (error) {
      log.error((error as Error).message);
      return false;
    }
  }

  /**
   * Start all infrastructure (router + all servers)
   */
  async up(): Promise<number> {
    log.info('Starting all infrastructure...');
    return this.dockerCompose(['up', '-d']);
  }

  /**
   * Stop all infrastructure
   */
  async down(): Promise<number> {
    log.info('Stopping all infrastructure...');
    // First stop all mc-* containers (including those from included compose files)
    await new Promise<void>((resolve) => {
      const child = spawn('sh', ['-c',
        'docker ps --filter "name=mc-" --format "{{.Names}}" | xargs -r docker stop'
      ], {
        cwd: this.paths.root,
        stdio: 'inherit',
        env: { ...process.env, ...this.env },
      });
      child.on('close', () => resolve());
      child.on('error', () => resolve());
    });
    // Then run docker compose down to clean up network
    return this.dockerCompose(['down']);
  }

  /**
   * Start all Minecraft servers (not router)
   * Uses docker compose up to create containers if they don't exist
   */
  async startAll(): Promise<number> {
    log.info('Starting all Minecraft servers...');
    // Get all mc-* services from compose config and start them
    // This works even if containers haven't been created yet
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c',
        'docker compose config --services | grep "^mc-" | xargs -r docker compose up -d'
      ], {
        cwd: this.paths.root,
        stdio: 'inherit',
        env: { ...process.env, ...this.env },
      });

      child.on('close', (code) => {
        resolve(code ?? 0);
      });

      child.on('error', (err) => {
        log.error(`Failed to start servers: ${err.message}`);
        resolve(1);
      });
    });
  }

  /**
   * Stop all Minecraft servers (not router)
   * Uses docker compose stop for consistency
   */
  async stopAll(): Promise<number> {
    log.info('Stopping all Minecraft servers...');
    // Get all mc-* services from compose config and stop them
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c',
        'docker compose config --services | grep "^mc-" | xargs -r docker compose stop'
      ], {
        cwd: this.paths.root,
        stdio: 'inherit',
        env: { ...process.env, ...this.env },
      });

      child.on('close', (code) => {
        resolve(code ?? 0);
      });

      child.on('error', (err) => {
        log.error(`Failed to stop servers: ${err.message}`);
        resolve(1);
      });
    });
  }

  /**
   * Start mc-router only
   */
  async routerStart(): Promise<number> {
    log.info('Starting mc-router...');
    return this.dockerCompose(['up', '-d', 'router']);
  }

  /**
   * Stop mc-router only
   */
  async routerStop(): Promise<number> {
    log.info('Stopping mc-router...');
    return this.dockerCompose(['stop', 'router']);
  }

  /**
   * Restart mc-router
   */
  async routerRestart(): Promise<number> {
    log.info('Restarting mc-router...');
    return this.dockerCompose(['restart', 'router']);
  }
}
