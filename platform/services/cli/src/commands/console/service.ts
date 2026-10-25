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
import { followPm2Logs } from '../../infrastructure/pm2-cli.js';
import { existsSync } from 'node:fs';
import { select, isCancel } from '@clack/prompts';
import { Pm2ServiceManagerAdapter } from '../../infrastructure/adapters/Pm2ServiceManagerAdapter.js';
import {
  checkPm2Installation,
  getEcosystemConfigPath,
  ecosystemConfigExists,
  PM2_SERVICE_NAMES,
  getAvailableServices,
  checkServiceAvailability,
} from '../../lib/pm2-utils.js';
import { AdminConfigManager } from '../../lib/admin-config.js';

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
  force?: boolean;
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
  /** Why the HTTP health probe failed (e.g. 'HTTP 500', 'unreachable'); unset when healthy */
  health?: string;
}

interface ConsoleServiceStatus {
  api: ServiceInfo | null;
  console: ServiceInfo | null;
  healthy: boolean;
}

const API_PORT_DEFAULT = 5001;
const CONSOLE_PORT_DEFAULT = 5000;
const HEALTH_RETRY_MS = 15000;

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

type ServiceAction = 'start' | 'stop' | 'restart' | 'logs';

/** Returned by getServiceNames when a prompt is needed but there is no terminal */
const NO_TERMINAL = Symbol('no-terminal');

/**
 * Get service names based on options, action, and availability
 *
 * Start/Restart rules (console depends on API):
 * - --api flag: API only
 * - --console flag: API + Console
 * - No flags + both available: interactive prompt
 *
 * Stop rules (respect dependency):
 * - --api flag: API + Console (console can't run without API)
 * - --console flag: Console only
 * - No flags + both available: interactive prompt
 */
async function getServiceNames(
  options: ConsoleServiceOptions,
  rootDir: string,
  action: ServiceAction = 'start'
): Promise<string[] | null | typeof NO_TERMINAL> {
  const availableServices = getAvailableServices(rootDir);
  const hasApi = availableServices.includes(PM2_SERVICE_NAMES.API);
  const hasConsole = availableServices.includes(PM2_SERVICE_NAMES.CONSOLE);
  const isStop = action === 'stop';

  // Explicit --api flag
  if (options.apiOnly) {
    if (isStop && hasConsole) {
      // Stopping API must also stop Console (dependency)
      return availableServices;
    }
    return hasApi ? [PM2_SERVICE_NAMES.API] : [];
  }

  // Explicit --console flag
  if (options.consoleOnly) {
    if (isStop) {
      // Stop console only
      return hasConsole ? [PM2_SERVICE_NAMES.CONSOLE] : [];
    }
    // Start/restart: console needs API
    const services: string[] = [];
    if (hasApi) services.push(PM2_SERVICE_NAMES.API);
    if (hasConsole) services.push(PM2_SERVICE_NAMES.CONSOLE);
    return services;
  }

  // No explicit flag: interactive prompt if both services available
  if (hasApi && hasConsole) {
    // Never guess a target without a terminal (a wrong default could stop the wrong services)
    if (!process.stdin.isTTY) {
      log.error(
        `No terminal to ask which services to ${action}. Pass --console (API + Console) or --api.`
      );
      return NO_TERMINAL;
    }

    if (isStop) {
      const choice = await select({
        message: 'Which services to stop?',
        options: [
          { value: 'all', label: 'All services', hint: 'mcctl-api + mcctl-console' },
          { value: 'console', label: 'Console only', hint: 'mcctl-console' },
        ],
      });

      if (isCancel(choice)) return null;
      if (choice === 'console') return [PM2_SERVICE_NAMES.CONSOLE];
      return [PM2_SERVICE_NAMES.API, PM2_SERVICE_NAMES.CONSOLE];
    }

    // start / restart / logs
    const choice = await select({
      message: `Which services to ${action}?`,
      options: [
        { value: 'api', label: 'API only', hint: 'mcctl-api' },
        { value: 'all', label: 'API + Console', hint: 'mcctl-api + mcctl-console' },
      ],
    });

    if (isCancel(choice)) return null;
    if (choice === 'api') return [PM2_SERVICE_NAMES.API];
    return [PM2_SERVICE_NAMES.API, PM2_SERVICE_NAMES.CONSOLE];
  }

  // Only one service available
  return availableServices;
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
 * HTTP health probe. Returns null when healthy, otherwise a short reason.
 * API: /health must be 2xx. Console: /api/auth/get-session must not be 5xx.
 * IPv4 loopback, which both services listen on (mcctl-api may only listen there, #833).
 */
async function probeHealth(name: string, port: number, timeoutMs: number): Promise<string | null> {
  const isApi = name === PM2_SERVICE_NAMES.API;
  const path = isApi ? '/health' : '/api/auth/get-session';
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const ok = isApi ? res.ok : res.status < 500;
    return ok ? null : `HTTP ${res.status}`;
  } catch {
    return 'unreachable';
  }
}

/**
 * Probe a service, retrying every second until healthy or the deadline passes
 * (services need a moment to bind their port after PM2 reports online).
 */
async function probeWithRetry(
  name: string,
  port: number,
  deadline: number
): Promise<string | null> {
  let reason = await probeHealth(name, port, 2000);
  while (reason && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    reason = await probeHealth(name, port, 2000);
  }
  return reason;
}

/**
 * Get console service status via PM2 + HTTP health probe
 */
async function getConsoleServiceStatus(
  pm2Adapter: Pm2ServiceManagerAdapter,
  apiPort?: number,
  consolePort?: number,
  retryMs: number = 0,
  scope: string[] = [PM2_SERVICE_NAMES.API, PM2_SERVICE_NAMES.CONSOLE]
): Promise<ConsoleServiceStatus> {
  try {
    const processes = await pm2Adapter.status();

    const apiProcess = processes.find((p) => p.name === PM2_SERVICE_NAMES.API);
    const consoleProcess = processes.find((p) => p.name === PM2_SERVICE_NAMES.CONSOLE);

    const api = apiProcess ? toServiceInfo(apiProcess, apiPort ?? API_PORT_DEFAULT) : null;
    const consoleInfo = consoleProcess
      ? toServiceInfo(consoleProcess, consolePort ?? CONSOLE_PORT_DEFAULT)
      : null;

    const deadline = Date.now() + retryMs; // shared so total wait stays ~retryMs
    for (const [info, port] of [
      [api, apiPort ?? API_PORT_DEFAULT],
      [consoleInfo, consolePort ?? CONSOLE_PORT_DEFAULT],
    ] as const) {
      if (info?.status === ServiceStatusEnum.ONLINE) {
        const reason = await probeWithRetry(info.name, port, deadline);
        if (reason) info.health = reason;
      }
    }

    // Only services in scope (started/installed) must be online and pass the probe
    const healthy =
      scope.length > 0 &&
      scope.every((name) => {
        const info = name === PM2_SERVICE_NAMES.API ? api : consoleInfo;
        return info?.status === ServiceStatusEnum.ONLINE && !info.health;
      });

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
    if (status.api.health) console.log(`    Health: ${colors.red(status.api.health)}`);
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
    if (status.console.health) console.log(`    Health: ${colors.red(status.console.health)}`);
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
 * For unhealthy services, detect native-module ABI mismatch in the PM2 error log
 * and tell the user how to fix it.
 */
async function printUnhealthyHint(
  pm2Adapter: Pm2ServiceManagerAdapter,
  status: ConsoleServiceStatus
): Promise<void> {
  for (const svc of [status.api, status.console]) {
    if (!svc?.health) continue;
    try {
      const errLog = await pm2Adapter.logs(svc.name, { err: true, lines: 50 });
      if (errLog.includes('ERR_DLOPEN_FAILED') || errLog.includes('NODE_MODULE_VERSION')) {
        log.error(
          `${svc.name}: a native module (e.g. better-sqlite3) was built for a different Node.js version than the one the PM2 daemon runs on.`
        );
        log.info('Fix: pm2 kill, switch to the Node.js version used to install mcctl (e.g. nvm use 22), then run: mcctl console service start');
        return;
      }
    } catch {
      // log unavailable - skip hint
    }
  }
}

/**
 * Start console services
 */
async function startServices(
  paths: Paths,
  pm2Adapter: Pm2ServiceManagerAdapter,
  options: ConsoleServiceOptions,
  apiPort: number,
  consolePort: number
): Promise<number> {
  if (!ecosystemConfigExists(paths)) {
    log.error('Ecosystem config not found.');
    log.info("Please run 'mcctl console init' to initialize console services");
    return 1;
  }

  const services = await getServiceNames(options, paths.root, 'start');

  if (services === NO_TERMINAL) {
    return 1;
  }

  if (services === null) {
    return 0; // User cancelled
  }

  if (services.length === 0) {
    log.error('No console services are installed.');
    log.info("Please run 'mcctl console init' to install services");
    return 1;
  }

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
    const status = await getConsoleServiceStatus(
      pm2Adapter,
      apiPort,
      consolePort,
      HEALTH_RETRY_MS,
      services
    );
    formatStatus(status, false);

    if (!status.healthy && (status.api || status.console)) {
      await printUnhealthyHint(pm2Adapter, status);
      return 1;
    }
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
  const services = await getServiceNames(options, paths.root, 'stop');

  if (services === NO_TERMINAL) {
    return 1;
  }

  if (services === null) {
    return 0; // User cancelled
  }

  if (services.length === 0) {
    log.warn('No console services are installed.');
    return 0;
  }

  if (options.force) {
    log.info('Force stopping console services (killing PM2 daemon)...');
  } else {
    log.info('Stopping console services...');
  }

  try {
    for (const service of services) {
      if (options.force) {
        try {
          await pm2Adapter.delete(service);
        } catch {
          // Ignore errors - process may not exist
        }
        log.info(`  Deleted ${service}`);
      } else {
        await pm2Adapter.stop(service);
        log.info(`  Stopped ${service}`);
      }
    }

    if (options.force) {
      await pm2Adapter.killDaemon();
      log.info('PM2 daemon killed');
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
  options: ConsoleServiceOptions,
  apiPort: number,
  consolePort: number
): Promise<number> {
  const services = await getServiceNames(options, paths.root, 'restart');

  if (services === NO_TERMINAL) {
    return 1;
  }

  if (services === null) {
    return 0; // User cancelled
  }

  if (services.length === 0) {
    log.error('No console services are installed.');
    log.info("Please run 'mcctl console init' to install services");
    return 1;
  }

  if (options.force) {
    if (!ecosystemConfigExists(paths)) {
      log.error('Ecosystem config not found.');
      log.info("Please run 'mcctl console init' to initialize console services");
      return 1;
    }
    log.info('Force restarting console services (killing PM2 daemon)...');
  } else {
    log.info('Restarting console services...');
  }
  if (options.apiPort || options.consolePort) {
    log.info(`  API port: ${apiPort}, Console port: ${consolePort}`);
  }

  try {
    if (options.force) {
      // Force restart: delete all, kill daemon, start fresh
      for (const service of services) {
        try {
          await pm2Adapter.delete(service);
        } catch {
          // Ignore errors - process may not exist
        }
        log.info(`  Deleted ${service}`);
      }

      await pm2Adapter.killDaemon();
      log.info('  PM2 daemon killed');

      // Wait for daemon to fully terminate before reconnecting
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Start fresh (ensureConnected will reconnect to a new PM2 daemon)
      for (const service of services) {
        await pm2Adapter.start(service, { wait: true, waitTimeout: 30000 });
        log.info(`  Started ${service}`);
      }

      // Save process list for resurrect on reboot
      await pm2Adapter.save();
    } else {
      for (const service of services) {
        await pm2Adapter.restart(service, { wait: true, waitTimeout: 30000 });
        log.info(`  Restarted ${service}`);
      }
    }

    log.info('Console services restarted');

    // Show status after restarting
    const status = await getConsoleServiceStatus(
      pm2Adapter,
      apiPort,
      consolePort,
      HEALTH_RETRY_MS,
      services
    );
    formatStatus(status, false);

    if (!status.healthy && (status.api || status.console)) {
      await printUnhealthyHint(pm2Adapter, status);
      return 1;
    }
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
  const services = await getServiceNames(options, paths.root, 'logs');

  if (services === NO_TERMINAL) {
    return 1;
  }

  if (services === null) {
    return 0; // User cancelled
  }

  if (services.length === 0) {
    log.warn('No console services are installed.');
    return 0;
  }

  if (options.follow) {
    // Use pm2 logs command for follow mode
    return followPm2Logs(services);
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
    // Flags override the ports saved by `mcctl console init`
    const adminConfig = await new AdminConfigManager(options.root).load();
    const apiPort = options.apiPort ?? adminConfig?.api?.port ?? API_PORT_DEFAULT;
    const consolePort = options.consolePort ?? adminConfig?.console?.port ?? CONSOLE_PORT_DEFAULT;
    const installed = getAvailableServices(paths.root);

    switch (options.subCommand) {
      case 'start':
        return await startServices(paths, pm2Adapter, options, apiPort, consolePort);

      case 'stop':
        return await stopServices(paths, pm2Adapter, options);

      case 'restart':
        return await restartServices(paths, pm2Adapter, options, apiPort, consolePort);

      case 'status': {
        const status = await getConsoleServiceStatus(pm2Adapter, apiPort, consolePort, 0, installed);
        formatStatus(status, options.json ?? false);
        if (!status.healthy && !options.json) await printUnhealthyHint(pm2Adapter, status);
        return status.healthy || (!status.api && !status.console) ? 0 : 1;
      }

      case 'logs':
        return await showLogs(paths, pm2Adapter, options);

      default: {
        // Default: show status
        const status = await getConsoleServiceStatus(pm2Adapter, apiPort, consolePort, 0, installed);
        formatStatus(status, options.json ?? false);
        return 0;
      }
    }
  } finally {
    pm2Adapter.disconnect();
  }
}

// Backward compatibility alias
export const adminServiceCommand = consoleServiceCommand;
