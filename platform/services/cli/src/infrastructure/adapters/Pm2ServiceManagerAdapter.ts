/**
 * PM2 Service Manager Adapter
 *
 * Implements IServiceManagerPort using PM2 for process management.
 * Manages mcctl-api and mcctl-console services via PM2.
 */

import pm2 from 'pm2';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  IServiceManagerPort,
  ServiceStartOptions,
  ServiceStopOptions,
  ServiceRestartOptions,
  ServiceLogsOptions,
} from '@minecraft-docker/shared';
import {
  ProcessInfo,
  ServiceStatusEnum,
  Paths,
} from '@minecraft-docker/shared';
import {
  getEcosystemConfigPath,
  getPm2LogPaths,
  readLogFile,
  normalizePm2Status,
  formatPm2Error,
  PM2_SERVICE_NAMES,
} from '../../lib/pm2-utils.js';

/**
 * Promisified PM2 functions
 */
function pm2Connect(noDaemonMode: boolean = false): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.connect(noDaemonMode, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function pm2List(): Promise<pm2.ProcessDescription[]> {
  return new Promise((resolve, reject) => {
    pm2.list((err, list) => {
      if (err) reject(err);
      else resolve(list);
    });
  });
}

function pm2Start(options: pm2.StartOptions): Promise<pm2.Proc> {
  return new Promise((resolve, reject) => {
    pm2.start(options, (err, proc) => {
      if (err) reject(err);
      else resolve(proc);
    });
  });
}

function pm2StartConfig(configPath: string): Promise<pm2.Proc> {
  return new Promise((resolve, reject) => {
    pm2.start(configPath, (err, proc) => {
      if (err) reject(err);
      else resolve(proc);
    });
  });
}

function pm2Stop(name: string | number): Promise<pm2.Proc> {
  return new Promise((resolve, reject) => {
    pm2.stop(name, (err, proc) => {
      if (err) reject(err);
      else resolve(proc);
    });
  });
}

function pm2Restart(name: string | number): Promise<pm2.Proc> {
  return new Promise((resolve, reject) => {
    pm2.restart(name, (err, proc) => {
      if (err) reject(err);
      else resolve(proc);
    });
  });
}

function pm2Delete(name: string | number): Promise<pm2.Proc> {
  return new Promise((resolve, reject) => {
    pm2.delete(name, (err, proc) => {
      if (err) reject(err);
      else resolve(proc);
    });
  });
}

function pm2Describe(name: string | number): Promise<pm2.ProcessDescription[]> {
  return new Promise((resolve, reject) => {
    pm2.describe(name, (err, desc) => {
      if (err) reject(err);
      else resolve(desc);
    });
  });
}

function pm2Flush(name: string | number): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.flush(name, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function pm2Dump(): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.dump((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * PM2 Service Manager Adapter
 * Implements IServiceManagerPort for managing services via PM2
 */
export class Pm2ServiceManagerAdapter implements IServiceManagerPort {
  private connected: boolean = false;
  private readonly paths: Paths;

  constructor(paths: Paths) {
    this.paths = paths;
  }

  /**
   * Ensure connected to PM2 daemon
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await pm2Connect(false);
      this.connected = true;
    }
  }

  /**
   * Disconnect from PM2 daemon
   */
  public disconnect(): void {
    if (this.connected) {
      pm2.disconnect();
      this.connected = false;
    }
  }

  /**
   * Start a service by name
   */
  async start(name: string, options?: ServiceStartOptions): Promise<void> {
    try {
      await this.ensureConnected();

      // Check if already running
      const processes = await pm2List();
      const existing = processes.find((p) => p.name === name);

      if (existing && existing.pm2_env?.status === 'online') {
        // Already running, no action needed
        return;
      }

      if (existing) {
        // Process exists but stopped, restart it
        await pm2Restart(name);
        return;
      }

      // Start from ecosystem config
      const configPath = getEcosystemConfigPath(this.paths);

      if (!existsSync(configPath)) {
        throw new Error(
          `Ecosystem config not found: ${configPath}. Run 'mcctl console init' first.`
        );
      }

      // Start the specific app from config
      await pm2StartConfig(configPath);

      // Wait for ready if requested
      if (options?.wait) {
        const timeout = options.waitTimeout || 30000;
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
          const procs = await pm2List();
          const proc = procs.find((p) => p.name === name);

          if (proc?.pm2_env?.status === 'online') {
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        throw new Error(`Timeout waiting for ${name} to be ready`);
      }
    } catch (error) {
      throw new Error(`Failed to start ${name}: ${formatPm2Error(error)}`);
    }
  }

  /**
   * Stop a service by name
   */
  async stop(name: string, options?: ServiceStopOptions): Promise<void> {
    try {
      await this.ensureConnected();

      // Check if process exists
      const exists = await this.exists(name);
      if (!exists) {
        // Not running, nothing to stop
        return;
      }

      if (options?.force) {
        // Force stop: delete the process
        await pm2Delete(name);
      } else {
        // Graceful stop
        await pm2Stop(name);
      }
    } catch (error) {
      throw new Error(`Failed to stop ${name}: ${formatPm2Error(error)}`);
    }
  }

  /**
   * Restart a service by name
   */
  async restart(name: string, options?: ServiceRestartOptions): Promise<void> {
    try {
      await this.ensureConnected();

      // Check if process exists
      const exists = await this.exists(name);

      if (!exists) {
        // Not running, start instead
        await this.start(name, options);
        return;
      }

      await pm2Restart(name);

      // Wait for ready if requested
      if (options?.wait) {
        const timeout = options.waitTimeout || 30000;
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
          const procs = await pm2List();
          const proc = procs.find((p) => p.name === name);

          if (proc?.pm2_env?.status === 'online') {
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        throw new Error(`Timeout waiting for ${name} to restart`);
      }
    } catch (error) {
      throw new Error(`Failed to restart ${name}: ${formatPm2Error(error)}`);
    }
  }

  /**
   * Get status of one or all services
   */
  async status(name?: string): Promise<ProcessInfo[]> {
    try {
      await this.ensureConnected();

      let processes: pm2.ProcessDescription[];

      if (name) {
        try {
          processes = await pm2Describe(name);
        } catch {
          // Process not found
          return [];
        }
      } else {
        processes = await pm2List();
        // Filter to only our services
        processes = processes.filter(
          (p) =>
            p.name === PM2_SERVICE_NAMES.API || p.name === PM2_SERVICE_NAMES.CONSOLE
        );
      }

      return processes.map((p) =>
        ProcessInfo.create({
          pmId: p.pm_id ?? 0,
          name: p.name ?? 'unknown',
          status: normalizePm2Status(p.pm2_env?.status ?? 'stopped') as ServiceStatusEnum,
          pid: p.pid,
          cpu: p.monit?.cpu,
          memory: p.monit?.memory,
          uptime: p.pm2_env?.pm_uptime,
          restarts: p.pm2_env?.restart_time,
          interpreter: p.pm2_env?.exec_interpreter,
          scriptPath: p.pm2_env?.pm_exec_path,
        })
      );
    } catch (error) {
      throw new Error(`Failed to get status: ${formatPm2Error(error)}`);
    }
  }

  /**
   * Get logs for a service
   */
  async logs(name: string, options?: ServiceLogsOptions): Promise<string> {
    const logPaths = getPm2LogPaths(this.paths, name);
    const lines = options?.lines ?? 100;

    if (options?.err) {
      return readLogFile(logPaths.error, lines);
    }

    // Return combined logs
    const outLogs = readLogFile(logPaths.output, lines);
    const errLogs = readLogFile(logPaths.error, lines);

    if (outLogs && errLogs) {
      return `=== stdout ===\n${outLogs}\n\n=== stderr ===\n${errLogs}`;
    }

    return outLogs || errLogs || 'No logs available';
  }

  /**
   * Delete a service from PM2
   */
  async delete(name: string): Promise<void> {
    try {
      await this.ensureConnected();

      const exists = await this.exists(name);
      if (!exists) {
        return;
      }

      await pm2Delete(name);
    } catch (error) {
      throw new Error(`Failed to delete ${name}: ${formatPm2Error(error)}`);
    }
  }

  /**
   * Reload ecosystem configuration
   */
  async reload(configPath: string): Promise<void> {
    try {
      await this.ensureConnected();

      if (!existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}`);
      }

      // Reload by restarting from config
      await pm2StartConfig(configPath);
    } catch (error) {
      throw new Error(`Failed to reload config: ${formatPm2Error(error)}`);
    }
  }

  /**
   * Check if a service exists in PM2
   */
  async exists(name: string): Promise<boolean> {
    try {
      await this.ensureConnected();

      const processes = await pm2List();
      return processes.some((p) => p.name === name);
    } catch {
      return false;
    }
  }

  /**
   * Flush logs for a service
   */
  async flush(name: string): Promise<void> {
    try {
      await this.ensureConnected();
      await pm2Flush(name);
    } catch (error) {
      throw new Error(`Failed to flush logs for ${name}: ${formatPm2Error(error)}`);
    }
  }

  /**
   * Save current process list
   */
  async save(): Promise<void> {
    try {
      await this.ensureConnected();
      await pm2Dump();
    } catch (error) {
      throw new Error(`Failed to save process list: ${formatPm2Error(error)}`);
    }
  }

  /**
   * Resurrect saved processes
   * Note: This is typically done via 'pm2 resurrect' command
   */
  async resurrect(): Promise<void> {
    // PM2 doesn't have a direct API for resurrect
    // It's typically done via CLI: pm2 resurrect
    throw new Error('Resurrect is not supported via API. Use: pm2 resurrect');
  }
}
