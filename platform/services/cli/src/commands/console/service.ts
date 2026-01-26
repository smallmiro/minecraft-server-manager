/**
 * Console Service Management Command
 *
 * Manages Console Service (mcctl-api + mcctl-console) lifecycle via PM2:
 * - start: Start API + Console processes
 * - stop: Stop services
 * - restart: Restart services
 * - status: Show status with health checks
 * - logs: View logs with follow mode
 */

import { Paths, colors, log, ProcessInfo, ServiceStatusEnum } from '@minecraft-docker/shared';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { Pm2ServiceManagerAdapter } from '../../infrastructure/adapters/Pm2ServiceManagerAdapter.js';
import {
  checkPm2Installation,
  getEcosystemConfigPath,
  ecosystemConfigExists,
  PM2_SERVICE_NAMES,
} from '../../lib/pm2-utils.js';

/**
 * Console service command options
 */
export interface ConsoleServiceOptions {
  root?: string;
  subCommand?: 'start' | 'stop' | 'restart' | 'status' | 'logs';
  apiOnly?: boolean;
  consoleOnly?: boolean;
  follow?: boolean;
  json?: boolean;
  apiPort?: number;
  consolePort?: number;
  build?: boolean;
  noBuild?: boolean;
}

// Backward compatibility alias
export type AdminServiceOptions = ConsoleServiceOptions;

interface ServiceInfo {
  name: string;
  status: ServiceStatusEnum;
  pid?: number;
  cpu?: number;
  memory?: string;
  uptime?: string;
  restarts?: number;
  url?: string;
}

interface ConsoleServiceStatus {
  api: ServiceInfo | null;
  console: ServiceInfo | null;
  healthy: boolean;
}

const API_PORT_DEFAULT = 3001;
const CONSOLE_PORT_DEFAULT = 3000;

/**
 * Check PM2 is installed
 */
function ensurePm2Installed(): boolean {
  const pm2Check = checkPm2Installation();

  if (!pm2Check.installed) {
    log.error('PM2 is not installed.');
    log.info('Install PM2 globally with: npm install -g pm2');
    return false;
  }

  return true;
}

/**
 * Get service names based on options
 */
function getServiceNames(options: ConsoleServiceOptions): string[] {
  if (options.apiOnly) {
    return [PM2_SERVICE_NAMES.API];
  }
  if (options.consoleOnly) {
    return [PM2_SERVICE_NAMES.CONSOLE];
  }
  return [PM2_SERVICE_NAMES.API, PM2_SERVICE_NAMES.CONSOLE];
}

/**
 * Convert ProcessInfo to ServiceInfo
 */
function toServiceInfo(process: ProcessInfo, port?: number): ServiceInfo {
  const info: ServiceInfo = {
    name: process.name,
    status: process.statusValue,
    pid: process.pid,
    cpu: process.cpu,
    memory: process.memoryFormatted,
    uptime: process.uptimeFormatted,
    restarts: process.restarts,
  };

  if (process.name === PM2_SERVICE_NAMES.CONSOLE && process.isOnline && port) {
    info.url = `http://localhost:${port}`;
  }

  return info;
}

/**
 * Get console service status via PM2
 */
async function getConsoleServiceStatus(
  pm2Adapter: Pm2ServiceManagerAdapter,
  apiPort?: number,
  consolePort?: number
): Promise<ConsoleServiceStatus> {
  try {
    const processes = await pm2Adapter.status();

    const apiProcess = processes.find((p) => p.name === PM2_SERVICE_NAMES.API);
    const consoleProcess = processes.find((p) => p.name === PM2_SERVICE_NAMES.CONSOLE);

    const api = apiProcess ? toServiceInfo(apiProcess, apiPort ?? API_PORT_DEFAULT) : null;
    const consoleInfo = consoleProcess
      ? toServiceInfo(consoleProcess, consolePort ?? CONSOLE_PORT_DEFAULT)
      : null;

    const healthy =
      api?.status === ServiceStatusEnum.ONLINE &&
      consoleInfo?.status === ServiceStatusEnum.ONLINE;

    return { api, console: consoleInfo, healthy };
  } catch {
    return { api: null, console: null, healthy: false };
  }
}

/**
 * Format status output
 */
function formatStatus(status: ConsoleServiceStatus, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log('');
  console.log(colors.bold('  Console Service Status (PM2)'));
  console.log('');

  // API Status
  if (status.api) {
    const statusColor =
      status.api.status === ServiceStatusEnum.ONLINE ? colors.green : colors.red;
    console.log(`  ${colors.cyan('mcctl-api')}`);
    console.log(`    Status: ${statusColor(status.api.status)}`);
    if (status.api.pid) console.log(`    PID: ${status.api.pid}`);
    if (status.api.cpu !== undefined) console.log(`    CPU: ${status.api.cpu}%`);
    if (status.api.memory) console.log(`    Memory: ${status.api.memory}`);
    if (status.api.uptime) console.log(`    Uptime: ${status.api.uptime}`);
    if (status.api.restarts !== undefined) console.log(`    Restarts: ${status.api.restarts}`);
  } else {
    console.log(`  ${colors.cyan('mcctl-api')}`);
    console.log(`    Status: ${colors.yellow('not running')}`);
  }
  console.log('');

  // Console Status
  if (status.console) {
    const statusColor =
      status.console.status === ServiceStatusEnum.ONLINE ? colors.green : colors.red;
    console.log(`  ${colors.cyan('mcctl-console')}`);
    console.log(`    Status: ${statusColor(status.console.status)}`);
    if (status.console.pid) console.log(`    PID: ${status.console.pid}`);
    if (status.console.url && status.console.status === ServiceStatusEnum.ONLINE) {
      console.log(`    URL: ${colors.cyan(status.console.url)}`);
    }
    if (status.console.cpu !== undefined) console.log(`    CPU: ${status.console.cpu}%`);
    if (status.console.memory) console.log(`    Memory: ${status.console.memory}`);
    if (status.console.uptime) console.log(`    Uptime: ${status.console.uptime}`);
    if (status.console.restarts !== undefined)
      console.log(`    Restarts: ${status.console.restarts}`);
  } else {
    console.log(`  ${colors.cyan('mcctl-console')}`);
    console.log(`    Status: ${colors.yellow('not running')}`);
  }
  console.log('');

  // Summary
  if (status.healthy) {
    console.log(`  ${colors.green('All services healthy')}`);
  } else if (!status.api && !status.console) {
    console.log(`  ${colors.yellow('Services not running')}`);
  } else {
    console.log(`  ${colors.yellow('Some services need attention')}`);
  }
  console.log('');
}

/**
 * Start console services
 */
async function startServices(
  paths: Paths,
  pm2Adapter: Pm2ServiceManagerAdapter,
  options: ConsoleServiceOptions
): Promise<number> {
  if (!ecosystemConfigExists(paths)) {
    log.error('Ecosystem config not found.');
    log.info("Please run 'mcctl console init' to initialize console services");
    return 1;
  }

  const services = getServiceNames(options);
  const apiPort = options.apiPort ?? API_PORT_DEFAULT;
  const consolePort = options.consolePort ?? CONSOLE_PORT_DEFAULT;

  log.info('Starting console services via PM2...');
  if (options.apiPort || options.consolePort) {
    log.info(`  API port: ${apiPort}, Console port: ${consolePort}`);
  }

  try {
    for (const service of services) {
      await pm2Adapter.start(service, { wait: true, waitTimeout: 30000 });
      log.info(`  Started ${service}`);
    }

    // Save process list for resurrect on reboot
    await pm2Adapter.save();

    log.info('Console services started successfully');

    // Show status after starting
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const status = await getConsoleServiceStatus(pm2Adapter, apiPort, consolePort);
    formatStatus(status, false);

    return 0;
  } catch (error) {
    log.error(`Failed to start services: ${error instanceof Error ? error.message : error}`);
    return 1;
  }
}

/**
 * Stop console services
 */
async function stopServices(
  paths: Paths,
  pm2Adapter: Pm2ServiceManagerAdapter,
  options: ConsoleServiceOptions
): Promise<number> {
  const services = getServiceNames(options);

  log.info('Stopping console services...');

  try {
    for (const service of services) {
      await pm2Adapter.stop(service);
      log.info(`  Stopped ${service}`);
    }

    log.info('Console services stopped');
    return 0;
  } catch (error) {
    log.error(`Failed to stop services: ${error instanceof Error ? error.message : error}`);
    return 1;
  }
}

/**
 * Restart console services
 */
async function restartServices(
  paths: Paths,
  pm2Adapter: Pm2ServiceManagerAdapter,
  options: ConsoleServiceOptions
): Promise<number> {
  const services = getServiceNames(options);
  const apiPort = options.apiPort ?? API_PORT_DEFAULT;
  const consolePort = options.consolePort ?? CONSOLE_PORT_DEFAULT;

  log.info('Restarting console services...');
  if (options.apiPort || options.consolePort) {
    log.info(`  API port: ${apiPort}, Console port: ${consolePort}`);
  }

  try {
    for (const service of services) {
      await pm2Adapter.restart(service, { wait: true, waitTimeout: 30000 });
      log.info(`  Restarted ${service}`);
    }

    log.info('Console services restarted');

    // Show status after restarting
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const status = await getConsoleServiceStatus(pm2Adapter, apiPort, consolePort);
    formatStatus(status, false);

    return 0;
  } catch (error) {
    log.error(`Failed to restart services: ${error instanceof Error ? error.message : error}`);
    return 1;
  }
}

/**
 * Show console service logs via PM2
 */
async function showLogs(
  paths: Paths,
  pm2Adapter: Pm2ServiceManagerAdapter,
  options: ConsoleServiceOptions
): Promise<number> {
  const services = getServiceNames(options);

  if (options.follow) {
    // Use pm2 logs command for follow mode
    return new Promise((resolve) => {
      const args = ['logs', ...services];

      const proc = spawn('pm2', args, {
        stdio: 'inherit',
      });

      proc.on('close', (code) => {
        resolve(code ?? 0);
      });

      // Handle Ctrl+C gracefully
      process.on('SIGINT', () => {
        proc.kill('SIGINT');
      });
    });
  }

  // Non-follow mode: read from adapter
  try {
    for (const service of services) {
      console.log(colors.bold(`\n=== ${service} logs ===\n`));
      const logContent = await pm2Adapter.logs(service, { lines: 100 });
      console.log(logContent || 'No logs available');
    }
    return 0;
  } catch (error) {
    log.error(`Failed to get logs: ${error instanceof Error ? error.message : error}`);
    return 1;
  }
}

/**
 * Delete admin images (legacy, now removes PM2 processes)
 */
export function deleteAdminImages(): { success: boolean; deleted: string[]; errors: string[] } {
  // This function is kept for backward compatibility
  // In PM2 mode, we delete processes instead of images
  return {
    success: true,
    deleted: [],
    errors: [],
  };
}

/**
 * Console service command
 */
export async function consoleServiceCommand(options: ConsoleServiceOptions): Promise<number> {
  // Check PM2 is installed
  if (!ensurePm2Installed()) {
    return 1;
  }

  const paths = new Paths(options.root);

  // Check if platform is initialized
  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  const pm2Adapter = new Pm2ServiceManagerAdapter(paths);

  try {
    const apiPort = options.apiPort ?? API_PORT_DEFAULT;
    const consolePort = options.consolePort ?? CONSOLE_PORT_DEFAULT;

    switch (options.subCommand) {
      case 'start':
        return await startServices(paths, pm2Adapter, options);

      case 'stop':
        return await stopServices(paths, pm2Adapter, options);

      case 'restart':
        return await restartServices(paths, pm2Adapter, options);

      case 'status': {
        const status = await getConsoleServiceStatus(pm2Adapter, apiPort, consolePort);
        formatStatus(status, options.json ?? false);
        return status.healthy || (!status.api && !status.console) ? 0 : 1;
      }

      case 'logs':
        return await showLogs(paths, pm2Adapter, options);

      default:
        // Default: show status
        const status = await getConsoleServiceStatus(pm2Adapter, apiPort, consolePort);
        formatStatus(status, options.json ?? false);
        return 0;
    }
  } finally {
    pm2Adapter.disconnect();
  }
}

// Backward compatibility alias
export const adminServiceCommand = consoleServiceCommand;
