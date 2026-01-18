import type {
  IShellPort,
  CreateServerOptions,
  LogsOptions,
  ShellResult,
} from '../../src/application/ports/outbound/IShellPort.js';
import type { ServerName } from '../../src/domain/index.js';

/**
 * Mock shell configuration for testing
 */
export interface MockShellConfig {
  createServerResult?: Partial<ShellResult>;
  deleteServerResult?: Partial<ShellResult>;
  startServerResult?: Partial<ShellResult>;
  stopServerResult?: Partial<ShellResult>;
  statusResult?: Partial<ShellResult>;
  worldAssignResult?: Partial<ShellResult>;
  worldReleaseResult?: Partial<ShellResult>;
  backupPushResult?: Partial<ShellResult>;
  backupStatusResult?: Partial<ShellResult>;
  backupHistoryResult?: Partial<ShellResult>;
  backupRestoreResult?: Partial<ShellResult>;
}

/**
 * Command log entry for verification
 */
export interface CommandLog {
  command: string;
  args: unknown[];
  timestamp: Date;
}

/**
 * Mock Shell Adapter for testing
 * Records commands and returns configured results
 */
export class MockShellAdapter implements IShellPort {
  private config: MockShellConfig;
  private _commandLog: CommandLog[] = [];

  constructor(config: MockShellConfig = {}) {
    this.config = config;
  }

  // ========================================
  // Testing Helpers
  // ========================================

  get commandLog(): CommandLog[] {
    return this._commandLog;
  }

  get lastCommand(): CommandLog | undefined {
    return this._commandLog[this._commandLog.length - 1];
  }

  wasCommandCalled(command: string): boolean {
    return this._commandLog.some((log) => log.command === command);
  }

  reset(): void {
    this._commandLog = [];
  }

  private log(command: string, ...args: unknown[]): void {
    this._commandLog.push({
      command,
      args,
      timestamp: new Date(),
    });
  }

  private makeResult(override?: Partial<ShellResult>): ShellResult {
    return {
      code: 0,
      stdout: '',
      stderr: '',
      success: true,
      ...override,
    };
  }

  // ========================================
  // Server Operations
  // ========================================

  async createServer(
    name: ServerName,
    options: CreateServerOptions
  ): Promise<ShellResult> {
    this.log('createServer', name.value, options);
    return this.makeResult(this.config.createServerResult);
  }

  async deleteServer(name: ServerName, force?: boolean): Promise<ShellResult> {
    this.log('deleteServer', name.value, { force });
    return this.makeResult(this.config.deleteServerResult);
  }

  async startServer(name: ServerName): Promise<ShellResult> {
    this.log('startServer', name.value);
    return this.makeResult(this.config.startServerResult);
  }

  async stopServer(name: ServerName): Promise<ShellResult> {
    this.log('stopServer', name.value);
    return this.makeResult(this.config.stopServerResult);
  }

  async logs(name: ServerName, options?: LogsOptions): Promise<ShellResult> {
    this.log('logs', name.value, options);
    return this.makeResult();
  }

  async console(name: ServerName): Promise<ShellResult> {
    this.log('console', name.value);
    return this.makeResult();
  }

  // ========================================
  // Status Operations
  // ========================================

  async status(json?: boolean): Promise<ShellResult> {
    this.log('status', { json });
    return this.makeResult(this.config.statusResult);
  }

  // ========================================
  // World Operations
  // ========================================

  async worldList(json?: boolean): Promise<ShellResult> {
    this.log('worldList', { json });
    return this.makeResult();
  }

  async worldAssign(
    worldName: string,
    serverName: string,
    force?: boolean
  ): Promise<ShellResult> {
    this.log('worldAssign', worldName, serverName, { force });
    return this.makeResult(this.config.worldAssignResult);
  }

  async worldRelease(worldName: string): Promise<ShellResult> {
    this.log('worldRelease', worldName);
    return this.makeResult(this.config.worldReleaseResult);
  }

  // ========================================
  // Player Operations
  // ========================================

  async playerLookup(name: string): Promise<ShellResult> {
    this.log('playerLookup', name);
    return this.makeResult({
      stdout: JSON.stringify({
        name,
        uuid: '12345678-1234-1234-1234-123456789abc',
      }),
    });
  }

  async playerUuid(name: string, offline?: boolean): Promise<ShellResult> {
    this.log('playerUuid', name, { offline });
    return this.makeResult({
      stdout: '12345678-1234-1234-1234-123456789abc',
    });
  }

  // ========================================
  // Backup Operations
  // ========================================

  async backupPush(message?: string): Promise<ShellResult> {
    this.log('backupPush', { message });
    return this.makeResult({
      stdout: 'commit: abc1234',
      ...this.config.backupPushResult,
    });
  }

  async backupStatus(): Promise<ShellResult> {
    this.log('backupStatus');
    return this.makeResult({
      stdout: 'Repository: user/repo\nBranch: main\nLast backup: 2025-01-01\nAuto backup: enabled',
      ...this.config.backupStatusResult,
    });
  }

  async backupHistory(json?: boolean): Promise<ShellResult> {
    this.log('backupHistory', { json });
    const history = [
      { hash: 'abc1234', message: 'Backup 1', date: '2025-01-01', author: 'user' },
      { hash: 'def5678', message: 'Backup 2', date: '2025-01-02', author: 'user' },
    ];
    return this.makeResult({
      stdout: json ? JSON.stringify(history) : history.map(h => `${h.hash} ${h.message}`).join('\n'),
      ...this.config.backupHistoryResult,
    });
  }

  async backupRestore(commitHash: string): Promise<ShellResult> {
    this.log('backupRestore', commitHash);
    return this.makeResult(this.config.backupRestoreResult);
  }

  // ========================================
  // General Execution
  // ========================================

  async exec(script: string, args?: string[]): Promise<ShellResult> {
    this.log('exec', script, args);
    return this.makeResult();
  }

  async execInteractive(script: string, args?: string[]): Promise<number> {
    this.log('execInteractive', script, args);
    return 0;
  }
}
