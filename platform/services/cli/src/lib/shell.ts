import { join } from 'node:path';
import { existsSync } from 'node:fs';
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
}
