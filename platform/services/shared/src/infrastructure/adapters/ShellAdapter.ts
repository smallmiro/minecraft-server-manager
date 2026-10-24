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

const BACKUP_REMOVED: ShellResult = {
  code: 1,
  stdout: '',
  stderr: 'backup.sh was removed; use IWorldBackupPort (GitWorldBackupAdapter)',
  success: false,
};

export interface ShellAdapterOptions {
  paths?: Paths;
  sudoPassword?: string;
}

/** Result of the deprecated methods that ran mcctl.sh: a failure, no script is run. */
function mcctlRemoved(replacement: string): ShellResult {
  return { code: 1, stdout: '', stderr: `mcctl.sh was removed (#734); use ${replacement}`, success: false };
}

/** Result of the deprecated lock.sh world methods: a failure, no script is run. */
function worldLockRemoved(replacement: string): ShellResult {
  return { code: 1, stdout: '', stderr: `lock.sh was removed (#670); use ${replacement}`, success: false };
}

/**
 * ShellAdapter
 * Implements IShellPort by executing bash scripts
 */
/** Why the shell create path fails since #675 (ADR-0003 §5). */
export const CREATE_SERVER_SCRIPT_REMOVED =
  'create-server.sh was removed in #675; pass specRepo / use ServerSpec provision';

/** Why the shell delete path fails since #735. */
const DELETE_SERVER_SCRIPT_REMOVED =
  'delete-server.sh was removed in #735; use DeleteServerUseCase with ServerSpec deprovision';

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

  /**
   * @deprecated create-server.sh was removed in #675: use CreateServerUseCase
   * with ServerSpec provisioning. Rejects without running anything; removed in v3.0.0 (#736).
   */
  async createServer(_name: ServerName, _options: CreateServerOptions): Promise<ShellResult> {
    throw new Error(CREATE_SERVER_SCRIPT_REMOVED);
  }

  /**
   * @deprecated delete-server.sh was removed in #735: use DeleteServerUseCase
   * with ServerSpec deprovision. Rejects without running anything; removed in v3.0.0 (#736).
   */
  async deleteServer(_name: ServerName, _force = false, _deleteWorld = false): Promise<ShellResult> {
    throw new Error(DELETE_SERVER_SCRIPT_REMOVED);
  }

  /**
   * @deprecated mcctl.sh was removed (#734); always fails. Use IContainerRuntimePort.start.
   * Removed in v3.0.0 (#736).
   */
  async startServer(_name: ServerName | string): Promise<ShellResult> {
    return mcctlRemoved('IContainerRuntimePort.start / mcctl start <server>');
  }

  /**
   * @deprecated mcctl.sh was removed (#734); always fails. Use IContainerRuntimePort.stop
   * (and autoBackupOnStop for BACKUP_AUTO_ON_STOP). Removed in v3.0.0 (#736).
   */
  async stopServer(_name: ServerName | string): Promise<ShellResult> {
    return mcctlRemoved('IContainerRuntimePort.stop / mcctl stop <server>');
  }

  /**
   * @deprecated mcctl.sh was removed (#734); always fails. Use IContainerRuntimePort.getStatus.
   * Removed in v3.0.0 (#736).
   */
  async serverStatus(_name: string): Promise<ShellResult> {
    return mcctlRemoved('IContainerRuntimePort.getStatus / mcctl status');
  }

  /**
   * @deprecated mcctl.sh was removed (#734); always fails. Write config.env with the env codec
   * (utils/env-file.ts applyEnvChanges with { raw: true }, atomicWriteFile). Removed in v3.0.0 (#736).
   */
  async setServerConfig(_serverName: string, _key: string, _value: string): Promise<ShellResult> {
    return mcctlRemoved('the env codec (utils/env-file.ts) / mcctl config <server> <key> <value>');
  }

  /**
   * @deprecated mcctl.sh was removed (#734); always fails. Use IContainerRuntimePort.getLogs/followLogs.
   * Removed in v3.0.0 (#736).
   */
  async logs(_name: ServerName, _options?: LogsOptions): Promise<ShellResult> {
    return mcctlRemoved('IContainerRuntimePort.followLogs / mcctl logs <server>');
  }

  /**
   * @deprecated mcctl.sh was removed (#734); always fails. Use IServerConsolePort.getEndpoint
   * with an RCON client. Removed in v3.0.0 (#736).
   */
  async console(_name: ServerName): Promise<ShellResult> {
    return mcctlRemoved('IServerConsolePort.getEndpoint / mcctl console <server>');
  }

  // ========================================
  // Status Operations
  // ========================================

  /**
   * @deprecated mcctl.sh was removed (#734); always fails. Use `mcctl status`.
   * Removed in v3.0.0 (#736).
   */
  async status(_json = false): Promise<ShellResult> {
    return mcctlRemoved('mcctl status');
  }

  // ========================================
  // World Operations
  // ========================================

  /**
   * @deprecated lock.sh was removed (#670); always fails. Use IWorldAssignmentPort /
   * `mcctl world list`. Removed in v3.0.0 (#736).
   */
  async worldList(_json = false): Promise<ShellResult> {
    return worldLockRemoved('IWorldAssignmentPort.snapshot / mcctl world list');
  }

  /**
   * @deprecated lock.sh was removed (#670); always fails. Use IWorldAssignmentPort.assign.
   * Removed in v3.0.0 (#736).
   */
  async worldAssign(_worldName: string, _serverName: string, _force = false): Promise<ShellResult> {
    return worldLockRemoved('IWorldAssignmentPort.assign / mcctl world assign');
  }

  /**
   * @deprecated lock.sh was removed (#670); always fails. Use IWorldAssignmentPort.release.
   * Removed in v3.0.0 (#736).
   */
  async worldRelease(_worldName: string): Promise<ShellResult> {
    return worldLockRemoved('IWorldAssignmentPort.release / mcctl world release');
  }

  // ========================================
  // Player Operations
  // ========================================

  /**
    * @deprecated Use `mcctl player info <name> [--offline]` (CLI, mojang-api.ts). player.sh was removed in #730. Removed in v3.0.0 (#736).
   */
  async playerLookup(_name: string): Promise<ShellResult> {
    return removedPlayerScript();
  }

  /**
    * @deprecated Use `mcctl player info <name> [--offline]` (CLI, mojang-api.ts). player.sh was removed in #730. Removed in v3.0.0 (#736).
   */
  async playerUuid(_name: string, _offline = false): Promise<ShellResult> {
    return removedPlayerScript();
  }

  // ========================================
  // Backup Operations
  // ========================================

  /** @deprecated backup.sh was removed (#732). Use IWorldBackupPort. Removed in #736. */
  async backupPush(_message?: string): Promise<ShellResult> {
    return BACKUP_REMOVED;
  }

  /** @deprecated backup.sh was removed (#732). Use IWorldBackupPort. Removed in #736. */
  async backupStatus(): Promise<ShellResult> {
    return BACKUP_REMOVED;
  }

  /** @deprecated backup.sh was removed (#732). Use IWorldBackupPort. Removed in #736. */
  async backupHistory(_json = false): Promise<ShellResult> {
    return BACKUP_REMOVED;
  }

  /** @deprecated backup.sh was removed (#732). Use IWorldBackupPort. Removed in #736. */
  async backupRestore(_commitHash: string): Promise<ShellResult> {
    return BACKUP_REMOVED;
  }

  // ========================================
  // General Execution
  // ========================================

  /** @deprecated See IShellPort.exec (#665). Removed in v3.0.0 (#736). */
  async exec(script: string, args: string[] = []): Promise<ShellResult> {
    return this.executeScript(script, args);
  }

  /** @deprecated See IShellPort.execInteractive (#665). Removed in v3.0.0 (#736). */
  async execInteractive(script: string, args: string[] = []): Promise<number> {
    const scriptPath = this.getScriptPath(script);
    if (!scriptPath) {
      return 1;
    }
    return execScriptInteractive(scriptPath, args, this.env);
  }
}

/** player.sh was removed (#730); fail clearly instead of running a missing script. */
function removedPlayerScript(): ShellResult {
  const stderr = 'player.sh was removed. Use `mcctl player info <name> [--offline]` instead.';
  return { code: 1, stdout: '', stderr, success: false };
}
