import { ServiceStatus, ServiceStatusEnum } from './ServiceStatus.js';

/**
 * Process monitoring metrics
 */
export interface ProcessMetrics {
  memory: number;  // Memory usage in bytes
  cpu: number;     // CPU usage percentage
}

/**
 * Process information data interface
 */
export interface ProcessInfoData {
  pmId: number;
  name: string;
  status: ServiceStatusEnum;
  pid?: number;
  cpu?: number;
  memory?: number;
  uptime?: number;
  restarts?: number;
  createdAt?: Date;
  interpreter?: string;
  scriptPath?: string;
}

/**
 * ProcessInfo Value Object
 * Represents information about a managed service process
 */
export class ProcessInfo {
  private constructor(private readonly _data: ProcessInfoData) {
    Object.freeze(this);
  }

  get pmId(): number {
    return this._data.pmId;
  }

  get name(): string {
    return this._data.name;
  }

  get status(): ServiceStatus {
    return ServiceStatus.create(this._data.status);
  }

  get statusValue(): ServiceStatusEnum {
    return this._data.status;
  }

  get pid(): number | undefined {
    return this._data.pid;
  }

  get cpu(): number | undefined {
    return this._data.cpu;
  }

  get memory(): number | undefined {
    return this._data.memory;
  }

  get uptime(): number | undefined {
    return this._data.uptime;
  }

  get restarts(): number | undefined {
    return this._data.restarts;
  }

  get createdAt(): Date | undefined {
    return this._data.createdAt;
  }

  get interpreter(): string | undefined {
    return this._data.interpreter;
  }

  get scriptPath(): string | undefined {
    return this._data.scriptPath;
  }

  /**
   * Check if process is online
   */
  get isOnline(): boolean {
    return this._data.status === ServiceStatusEnum.ONLINE;
  }

  /**
   * Check if process is stopped
   */
  get isStopped(): boolean {
    return this._data.status === ServiceStatusEnum.STOPPED;
  }

  /**
   * Check if process has errored
   */
  get isErrored(): boolean {
    return this._data.status === ServiceStatusEnum.ERRORED;
  }

  /**
   * Get formatted memory usage string
   */
  get memoryFormatted(): string {
    if (this._data.memory === undefined) return 'N/A';
    return formatBytes(this._data.memory);
  }

  /**
   * Get formatted uptime string
   */
  get uptimeFormatted(): string {
    if (this._data.uptime === undefined) return 'N/A';
    return formatDuration(this._data.uptime);
  }

  /**
   * Get metrics object
   */
  get metrics(): ProcessMetrics | null {
    if (this._data.cpu === undefined || this._data.memory === undefined) {
      return null;
    }
    return {
      cpu: this._data.cpu,
      memory: this._data.memory,
    };
  }

  /**
   * Create a ProcessInfo from data
   */
  static create(data: ProcessInfoData): ProcessInfo {
    if (data.pmId < 0) {
      throw new Error('PM2 ID cannot be negative');
    }
    if (!data.name || data.name.trim() === '') {
      throw new Error('Process name is required');
    }
    return new ProcessInfo(data);
  }

  /**
   * Create from PM2 process description
   */
  static fromPm2(pm2Process: {
    pm_id?: number;
    name?: string;
    pm2_env?: {
      status?: string;
      pm_uptime?: number;
      restart_time?: number;
      created_at?: number;
      exec_interpreter?: string;
      pm_exec_path?: string;
    };
    pid?: number;
    monit?: {
      cpu?: number;
      memory?: number;
    };
  }): ProcessInfo {
    const env = pm2Process.pm2_env || {};
    const monit = pm2Process.monit || {};

    return ProcessInfo.create({
      pmId: pm2Process.pm_id ?? 0,
      name: pm2Process.name ?? 'unknown',
      status: (env.status as ServiceStatusEnum) ?? ServiceStatusEnum.STOPPED,
      pid: pm2Process.pid,
      cpu: monit.cpu,
      memory: monit.memory,
      uptime: env.pm_uptime,
      restarts: env.restart_time,
      createdAt: env.created_at ? new Date(env.created_at) : undefined,
      interpreter: env.exec_interpreter,
      scriptPath: env.pm_exec_path,
    });
  }

  /**
   * Convert to plain object
   */
  toJSON(): ProcessInfoData {
    return { ...this._data };
  }

  equals(other: ProcessInfo): boolean {
    return this._data.pmId === other._data.pmId && this._data.name === other._data.name;
  }

  toString(): string {
    return `${this._data.name} (PM2 ID: ${this._data.pmId}, Status: ${this._data.status})`;
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format duration in milliseconds to human readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
