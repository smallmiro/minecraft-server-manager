import { Paths, execScript, execScriptInteractive } from '@minecraft-docker/shared';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { ServerName, ServerType, McVersion, WorldOptions, Memory } from '../../domain/index.js';
import type {
  IShellPort,
  CreateServerOptions,
  LogsOptions,
  ShellResult,
} from '../../application/ports/outbound/IShellPort.js';

/**
 * ShellAdapter
 * Implements IShellPort by executing bash scripts
 */
export class ShellAdapter implements IShellPort {
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

  private getScriptPath(script: string): string | null {
    const scriptPath = join(this.paths.scripts, script);
    if (!existsSync(scriptPath)) {
      return null;
    }
    return scriptPath;
  }

  private async executeScript(
    script: string,
    args: string[] = []
  ): Promise<ShellResult> {
    const scriptPath = this.getScriptPath(script);
    if (!scriptPath) {
      return {
        code: 1,
        stdout: '',
        stderr: `Script not found: ${script}`,
        success: false,
      };
    }

    const result = await execScript(scriptPath, args, this.env);
    return {
      code: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      success: result.code === 0,
    };
  }

  // ========================================
  // Server Operations
  // ========================================

  async createServer(
    name: ServerName,
    options: CreateServerOptions
  ): Promise<ShellResult> {
    const args: string[] = [name.value];

    args.push('-t', options.type.value);
    args.push('-v', options.version.value);

    // Add world options
    args.push(...options.worldOptions.toCliArgs());

    if (options.autoStart === false) {
      args.push('--no-start');
    }

    return this.executeScript('create-server.sh', args);
  }

  async deleteServer(name: ServerName, force = false): Promise<ShellResult> {
    const args: string[] = [name.value];
    if (force) {
      args.push('--force');
    }
    return this.executeScript('delete-server.sh', args);
  }

  async startServer(name: ServerName): Promise<ShellResult> {
    return this.executeScript('mcctl.sh', ['start', name.value]);
  }

  async stopServer(name: ServerName): Promise<ShellResult> {
    return this.executeScript('mcctl.sh', ['stop', name.value]);
  }

  async logs(name: ServerName, options?: LogsOptions): Promise<ShellResult> {
    const args: string[] = [name.value];
    if (options?.follow) {
      args.push('-f');
    }
    if (options?.lines) {
      args.push('-n', options.lines.toString());
    }
    return this.executeScript('logs.sh', args);
  }

  async console(name: ServerName): Promise<ShellResult> {
    return this.executeScript('mcctl.sh', ['console', name.value]);
  }

  // ========================================
  // Status Operations
  // ========================================

  async status(json = false): Promise<ShellResult> {
    const args: string[] = ['status'];
    if (json) {
      args.push('--json');
    }
    return this.executeScript('mcctl.sh', args);
  }

  // ========================================
  // World Operations
  // ========================================

  async worldList(json = false): Promise<ShellResult> {
    const args: string[] = ['list'];
    if (json) {
      args.push('--json');
    }
    return this.executeScript('lock.sh', args);
  }

  async worldAssign(
    worldName: string,
    serverName: string,
    force = false
  ): Promise<ShellResult> {
    const args: string[] = ['assign', worldName, serverName];
    if (force) {
      args.push('--force');
    }
    return this.executeScript('lock.sh', args);
  }

  async worldRelease(worldName: string): Promise<ShellResult> {
    return this.executeScript('lock.sh', ['release', worldName]);
  }

  // ========================================
  // Player Operations
  // ========================================

  async playerLookup(name: string): Promise<ShellResult> {
    return this.executeScript('player.sh', ['lookup', name]);
  }

  async playerUuid(name: string, offline = false): Promise<ShellResult> {
    const args: string[] = ['uuid', name];
    if (offline) {
      args.push('--offline');
    }
    return this.executeScript('player.sh', args);
  }

  // ========================================
  // Backup Operations
  // ========================================

  async backupPush(message?: string): Promise<ShellResult> {
    const args: string[] = ['push'];
    if (message) {
      args.push('-m', message);
    }
    return this.executeScript('backup.sh', args);
  }

  async backupStatus(): Promise<ShellResult> {
    return this.executeScript('backup.sh', ['status']);
  }

  async backupHistory(json = false): Promise<ShellResult> {
    const args: string[] = ['history'];
    if (json) {
      args.push('--json');
    }
    return this.executeScript('backup.sh', args);
  }

  async backupRestore(commitHash: string): Promise<ShellResult> {
    return this.executeScript('backup.sh', ['restore', commitHash]);
  }

  // ========================================
  // General Execution
  // ========================================

  async exec(script: string, args: string[] = []): Promise<ShellResult> {
    return this.executeScript(script, args);
  }

  async execInteractive(script: string, args: string[] = []): Promise<number> {
    const scriptPath = this.getScriptPath(script);
    if (!scriptPath) {
      return 1;
    }
    return execScriptInteractive(scriptPath, args, this.env);
  }
}
