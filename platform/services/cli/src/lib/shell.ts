import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { Paths, execScript, execScriptInteractive, log } from '@minecraft-docker/shared';

/**
 * Shell script executor with environment variable injection
 */
export class ShellExecutor {
  private readonly paths: Paths;
  private readonly env: Record<string, string>;

  constructor(paths?: Paths) {
    this.paths = paths ?? new Paths();
    this.env = this.buildEnv();
  }

  private buildEnv(): Record<string, string> {
    return {
      MCCTL_ROOT: this.paths.root,
      MCCTL_TEMPLATES: this.paths.templates,
      MCCTL_SCRIPTS: this.paths.scripts,
    };
  }

  /**
   * Get script path and validate existence
   */
  private getScriptPath(script: string): string | null {
    const scriptPath = join(this.paths.scripts, script);
    if (!existsSync(scriptPath)) {
      log.error(`Script not found: ${scriptPath}`);
      return null;
    }
    return scriptPath;
  }

  /**
   * Execute a script and return the result
   */
  async exec(script: string, args: string[] = []): Promise<number> {
    const scriptPath = this.getScriptPath(script);
    if (!scriptPath) return 1;

    const result = await execScript(scriptPath, args, this.env);
    return result.code;
  }

  /**
   * Execute a script interactively (with inherited stdio)
   */
  async execInteractive(script: string, args: string[] = []): Promise<number> {
    const scriptPath = this.getScriptPath(script);
    if (!scriptPath) return 1;

    return execScriptInteractive(scriptPath, args, this.env);
  }

  /**
   * Execute mcctl.sh with arguments
   */
  async mcctl(args: string[]): Promise<number> {
    return this.execInteractive('mcctl.sh', args);
  }

  /**
   * Create a new server
   */
  async createServer(name: string, options: string[] = []): Promise<number> {
    return this.execInteractive('create-server.sh', [name, ...options]);
  }

  /**
   * Delete a server
   */
  async deleteServer(name: string, options: string[] = []): Promise<number> {
    return this.execInteractive('delete-server.sh', [name, ...options]);
  }

  /**
   * View logs
   */
  async logs(server: string, options: string[] = []): Promise<number> {
    return this.execInteractive('logs.sh', [server, ...options]);
  }

  /**
   * Lock operations
   */
  async lock(args: string[]): Promise<number> {
    return this.execInteractive('lock.sh', args);
  }

  /**
   * Player lookup
   */
  async player(args: string[]): Promise<number> {
    return this.execInteractive('player.sh', args);
  }

  /**
   * Backup operations
   */
  async backup(args: string[]): Promise<number> {
    return this.execInteractive('backup.sh', args);
  }

  /**
   * Run init.sh (for Docker/network setup)
   */
  async initPlatform(options: string[] = []): Promise<number> {
    return this.execInteractive('init.sh', options);
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
   * Execute RCON command on a server
   */
  async execRcon(server: string, command: string[]): Promise<number> {
    const containerName = server.startsWith('mc-') ? server : `mc-${server}`;

    return new Promise((resolve) => {
      const child = spawn('docker', ['exec', containerName, 'rcon-cli', ...command], {
        cwd: this.paths.root,
        stdio: 'inherit',
        env: { ...process.env, ...this.env },
      });

      child.on('close', (code) => {
        resolve(code ?? 0);
      });

      child.on('error', (err) => {
        log.error(`Failed to execute RCON command: ${err.message}`);
        resolve(1);
      });
    });
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
   */
  async startAll(): Promise<number> {
    log.info('Starting all Minecraft servers...');
    // Start all mc-* containers except mc-router
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c',
        'docker ps -a --filter "name=mc-" --filter "status=exited" --format "{{.Names}}" | grep -v mc-router | xargs -r docker start'
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
   */
  async stopAll(): Promise<number> {
    log.info('Stopping all Minecraft servers...');
    // Stop all mc-* containers except mc-router
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c',
        'docker ps --filter "name=mc-" --format "{{.Names}}" | grep -v mc-router | xargs -r docker stop'
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
}
