import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Paths } from '../../utils/index.js';
import { execScript, execScriptInteractive } from '../../docker/index.js';
import { ServerName } from '../../domain/index.js';
import type {
  IShellPort,
  CreateServerOptions,
  LogsOptions,
  ShellResult,
} from '../../application/ports/outbound/IShellPort.js';

export interface ShellAdapterOptions {
  paths?: Paths;
  sudoPassword?: string;
}

/**
 * ShellAdapter
 * Implements IShellPort by executing bash scripts
 */
export class ShellAdapter implements IShellPort {
  private readonly paths: Paths;
  private readonly env: Record<string, string>;
  private readonly sudoPassword?: string;

  constructor(pathsOrOptions?: Paths | ShellAdapterOptions) {
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
      MCCTL_SCRIPTS: this.paths.scripts,
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

    // Add modpack options if provided
    if (options.modpackSlug) {
      args.push('--modpack', options.modpackSlug);
    }
    if (options.modpackVersion) {
      args.push('--modpack-version', options.modpackVersion);
    }
    if (options.modLoader) {
      args.push('--mod-loader', options.modLoader);
    }

    if (options.enableWhitelist === false) {
      args.push('--no-whitelist');
    }
    if (options.whitelistPlayers && options.whitelistPlayers.length > 0) {
      args.push('--whitelist', options.whitelistPlayers.join(','));
    }

    // Add playit domain options
    if (options.playitDomain) {
      args.push('--playit-domain', options.playitDomain);
    }
    if (options.noPlayitDomain) {
      args.push('--no-playit-domain');
    }

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

  async startServer(name: ServerName | string): Promise<ShellResult> {
    const serverName = typeof name === 'string' ? name : name.value;
    return this.executeScript('mcctl.sh', ['start', serverName]);
  }

  async stopServer(name: ServerName | string): Promise<ShellResult> {
    const serverName = typeof name === 'string' ? name : name.value;
    return this.executeScript('mcctl.sh', ['stop', serverName]);
  }

  async serverStatus(name: string): Promise<ShellResult> {
    return this.executeScript('mcctl.sh', ['status', name, '--json']);
  }

  async setServerConfig(serverName: string, key: string, value: string): Promise<ShellResult> {
    return this.executeScript('mcctl.sh', ['config', serverName, key, value]);
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
    // Use mcctl.sh world assign which delegates to lock.sh lock
    const args: string[] = ['world', 'assign', worldName, serverName];
    if (force) {
      args.push('--force');
    }
    return this.executeScript('mcctl.sh', args);
  }

  async worldRelease(worldName: string): Promise<ShellResult> {
    // Use mcctl.sh world release which delegates to lock.sh unlock
    return this.executeScript('mcctl.sh', ['world', 'release', worldName]);
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
