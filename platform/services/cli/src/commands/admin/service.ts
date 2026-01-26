/**
 * Admin Service Management Command
 *
 * Manages Admin Service (mcctl-api + mcctl-console) lifecycle:
 * - start: Start API + Console containers
 * - stop: Stop services
 * - restart: Restart services
 * - status: Show status with health checks
 * - logs: View logs with follow mode
 */

import { Paths, colors, log } from '@minecraft-docker/shared';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

export interface AdminServiceOptions {
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

interface ServiceInfo {
  name: string;
  container: string;
  status: 'running' | 'exited' | 'stopped' | 'not_found';
  health: 'healthy' | 'unhealthy' | 'starting' | 'none';
  port: number;
  uptime?: string;
  url?: string;
}

interface AdminServiceStatus {
  api: ServiceInfo;
  console: ServiceInfo;
  healthy: boolean;
}

const ADMIN_COMPOSE_FILE = 'docker-compose.admin.yml';
const API_CONTAINER = 'mcctl-api';
const CONSOLE_CONTAINER = 'mcctl-console';
const API_PORT = 3001;
const CONSOLE_PORT = 3000;
const API_IMAGE = 'minecraft-docker/mcctl-api:latest';
const CONSOLE_IMAGE = 'minecraft-docker/mcctl-console:latest';

/**
 * Check if Docker image exists locally
 */
function imageExists(imageName: string): boolean {
  const result = spawnSync('docker', ['image', 'inspect', imageName], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return result.status === 0;
}

/**
 * Check if admin service images exist
 */
function checkImagesExist(): { api: boolean; console: boolean } {
  return {
    api: imageExists(API_IMAGE),
    console: imageExists(CONSOLE_IMAGE),
  };
}

/**
 * Get the admin compose file path
 */
function getAdminComposePath(paths: Paths): string {
  return join(paths.platform, ADMIN_COMPOSE_FILE);
}

/**
 * Check if admin compose file exists
 */
function ensureAdminComposeExists(paths: Paths): boolean {
  const composePath = getAdminComposePath(paths);

  if (existsSync(composePath)) {
    return true;
  }

  // Copy from templates if not exists
  const templatePath = join(paths.templates, ADMIN_COMPOSE_FILE);
  if (existsSync(templatePath)) {
    try {
      copyFileSync(templatePath, composePath);
      log.info(`Created ${ADMIN_COMPOSE_FILE} from template`);
      return true;
    } catch (err) {
      log.error(`Failed to copy admin compose template: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  log.error(`Admin compose file not found: ${composePath}`);
  log.info(`Please run 'mcctl admin init' to initialize admin services`);
  return false;
}

/**
 * Get container info using docker inspect
 */
function getContainerInfo(containerName: string, port?: number): ServiceInfo {
  const defaultPort = containerName === API_CONTAINER ? API_PORT : CONSOLE_PORT;
  const actualPort = port ?? defaultPort;

  const info: ServiceInfo = {
    name: containerName.replace('mcctl-', ''),
    container: containerName,
    status: 'not_found',
    health: 'none',
    port: actualPort,
  };

  try {
    const result = spawnSync('docker', [
      'inspect',
      '--format',
      '{{.State.Status}}|{{.State.Health.Status}}|{{.State.StartedAt}}',
      containerName,
    ], { encoding: 'utf-8' });

    if (result.status === 0 && result.stdout) {
      const parts = result.stdout.trim().split('|');
      const status = parts[0] ?? 'stopped';
      const healthStatus = parts[1] ?? 'none';
      const startedAt = parts[2];

      info.status = status as ServiceInfo['status'];
      info.health = healthStatus === '' ? 'none' : (healthStatus as ServiceInfo['health']);

      if (startedAt && info.status === 'running') {
        info.uptime = calculateUptime(startedAt);
      }

      if (containerName === CONSOLE_CONTAINER && info.status === 'running') {
        info.url = `http://localhost:${actualPort}`;
      }
    }
  } catch {
    // Container not found
  }

  return info;
}

/**
 * Calculate uptime from start time
 */
function calculateUptime(startedAt: string): string {
  const started = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - started.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Get admin service status
 */
function getAdminServiceStatus(apiPort?: number, consolePort?: number): AdminServiceStatus {
  const api = getContainerInfo(API_CONTAINER, apiPort);
  const consoleInfo = getContainerInfo(CONSOLE_CONTAINER, consolePort);

  return {
    api,
    console: consoleInfo,
    healthy: api.status === 'running' && api.health === 'healthy' &&
             consoleInfo.status === 'running' && consoleInfo.health === 'healthy',
  };
}

/**
 * Run docker compose command
 */
function runDockerCompose(
  paths: Paths,
  args: string[],
  options: { stream?: boolean; env?: Record<string, string> } = {}
): number {
  const composePath = getAdminComposePath(paths);
  const composeArgs = [
    'compose',
    '-f', composePath,
    ...args,
  ];

  // Merge custom environment variables with process.env
  const env = { ...process.env, ...options.env };

  if (options.stream) {
    const proc = spawnSync('docker', composeArgs, {
      stdio: 'inherit',
      cwd: paths.platform,
      env,
    });
    return proc.status ?? 1;
  }

  const result = spawnSync('docker', composeArgs, {
    encoding: 'utf-8',
    cwd: paths.platform,
    env,
  });

  if (result.stdout) {
    console.log(result.stdout);
  }
  if (result.stderr && result.status !== 0) {
    console.error(result.stderr);
  }

  return result.status ?? 1;
}

/**
 * Stream docker compose logs
 */
function streamLogs(paths: Paths, services: string[], follow: boolean): Promise<number> {
  return new Promise((resolve) => {
    const composePath = getAdminComposePath(paths);
    const args = [
      'compose',
      '-f', composePath,
      'logs',
      ...(follow ? ['-f'] : []),
      '--tail', '100',
      ...services,
    ];

    const proc = spawn('docker', args, {
      stdio: 'inherit',
      cwd: paths.platform,
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

/**
 * Format status output
 */
function formatStatus(status: AdminServiceStatus, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log('');
  console.log(colors.bold('  Admin Service Status'));
  console.log('');

  // API Status
  const apiStatusColor = status.api.status === 'running' ? colors.green : colors.red;
  const apiHealthColor = status.api.health === 'healthy' ? colors.green :
                        status.api.health === 'starting' ? colors.yellow : colors.red;

  console.log(`  ${colors.cyan('mcctl-api')}`);
  console.log(`    Status: ${apiStatusColor(status.api.status)}`);
  console.log(`    Port: ${status.api.port}`);
  if (status.api.health !== 'none') {
    console.log(`    Health: ${apiHealthColor(status.api.health)}`);
  }
  if (status.api.uptime) {
    console.log(`    Uptime: ${status.api.uptime}`);
  }
  console.log('');

  // Console Status
  const consoleStatusColor = status.console.status === 'running' ? colors.green : colors.red;
  const consoleHealthColor = status.console.health === 'healthy' ? colors.green :
                            status.console.health === 'starting' ? colors.yellow : colors.red;

  console.log(`  ${colors.cyan('mcctl-console')}`);
  console.log(`    Status: ${consoleStatusColor(status.console.status)}`);
  console.log(`    Port: ${status.console.port}`);
  if (status.console.url && status.console.status === 'running') {
    console.log(`    URL: ${colors.cyan(status.console.url)}`);
  }
  if (status.console.health !== 'none') {
    console.log(`    Health: ${consoleHealthColor(status.console.health)}`);
  }
  if (status.console.uptime) {
    console.log(`    Uptime: ${status.console.uptime}`);
  }
  console.log('');

  // Summary
  if (status.healthy) {
    console.log(`  ${colors.green('All services healthy')}`);
  } else if (status.api.status === 'not_found' && status.console.status === 'not_found') {
    console.log(`  ${colors.yellow('Services not running')}`);
  } else {
    console.log(`  ${colors.yellow('Some services need attention')}`);
  }
  console.log('');
}

/**
 * Build environment variables for port configuration
 */
function buildPortEnv(options: AdminServiceOptions): Record<string, string> {
  const env: Record<string, string> = {};
  if (options.apiPort) {
    env['MCCTL_API_PORT'] = String(options.apiPort);
  }
  if (options.consolePort) {
    env['MCCTL_CONSOLE_PORT'] = String(options.consolePort);
  }
  return env;
}

/**
 * Start admin services
 */
async function startServices(paths: Paths, options: AdminServiceOptions): Promise<number> {
  if (!ensureAdminComposeExists(paths)) {
    return 1;
  }

  const services: string[] = [];
  if (options.apiOnly) {
    services.push('mcctl-api');
  } else if (options.consoleOnly) {
    services.push('mcctl-console');
  }

  const apiPort = options.apiPort ?? API_PORT;
  const consolePort = options.consolePort ?? CONSOLE_PORT;

  // Check if images exist and decide whether to build
  const images = checkImagesExist();
  const needsBuild = options.build || (!options.noBuild && (!images.api || !images.console));

  if (needsBuild && !options.noBuild) {
    if (!images.api || !images.console) {
      log.info('Docker images not found. Building images first...');
    } else if (options.build) {
      log.info('Building images with --build flag...');
    }
  }

  log.info('Starting admin services...');
  if (options.apiPort || options.consolePort) {
    log.info(`  API port: ${apiPort}, Console port: ${consolePort}`);
  }

  const args = ['up', '-d'];
  if (needsBuild) {
    args.push('--build');
  }
  args.push(...services);

  const env = buildPortEnv(options);
  const exitCode = runDockerCompose(paths, args, { stream: true, env });

  if (exitCode === 0) {
    log.info('Admin services started successfully');

    // Show status after starting
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for health checks
    const status = getAdminServiceStatus(apiPort, consolePort);
    formatStatus(status, false);
  }

  return exitCode;
}

/**
 * Stop admin services
 */
function stopServices(paths: Paths): number {
  if (!existsSync(getAdminComposePath(paths))) {
    log.warn('Admin compose file not found, nothing to stop');
    return 0;
  }

  log.info('Stopping admin services...');

  const exitCode = runDockerCompose(paths, ['down'], { stream: true });

  if (exitCode === 0) {
    log.info('Admin services stopped');
  }

  return exitCode;
}

/**
 * Restart admin services
 */
async function restartServices(paths: Paths, options: AdminServiceOptions): Promise<number> {
  if (!ensureAdminComposeExists(paths)) {
    return 1;
  }

  const services: string[] = [];
  if (options.apiOnly) {
    services.push('mcctl-api');
  } else if (options.consoleOnly) {
    services.push('mcctl-console');
  }

  const apiPort = options.apiPort ?? API_PORT;
  const consolePort = options.consolePort ?? CONSOLE_PORT;

  log.info('Restarting admin services...');
  if (options.apiPort || options.consolePort) {
    log.info(`  API port: ${apiPort}, Console port: ${consolePort}`);
  }

  const args = ['restart', ...services];
  const env = buildPortEnv(options);
  const exitCode = runDockerCompose(paths, args, { stream: true, env });

  if (exitCode === 0) {
    log.info('Admin services restarted');

    // Show status after restarting
    await new Promise(resolve => setTimeout(resolve, 2000));
    const status = getAdminServiceStatus(apiPort, consolePort);
    formatStatus(status, false);
  }

  return exitCode;
}

/**
 * Show admin service logs
 */
async function showLogs(paths: Paths, options: AdminServiceOptions): Promise<number> {
  if (!existsSync(getAdminComposePath(paths))) {
    log.error('Admin compose file not found');
    return 1;
  }

  const services: string[] = [];
  if (options.apiOnly) {
    services.push('mcctl-api');
  } else if (options.consoleOnly) {
    services.push('mcctl-console');
  }

  return streamLogs(paths, services, options.follow ?? false);
}

/**
 * Admin service command
 */
export async function adminServiceCommand(options: AdminServiceOptions): Promise<number> {
  const paths = new Paths(options.root);

  // Check if platform is initialized
  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  const apiPort = options.apiPort ?? API_PORT;
  const consolePort = options.consolePort ?? CONSOLE_PORT;

  switch (options.subCommand) {
    case 'start':
      return startServices(paths, options);

    case 'stop':
      return stopServices(paths);

    case 'restart':
      return restartServices(paths, options);

    case 'status': {
      const status = getAdminServiceStatus(apiPort, consolePort);
      formatStatus(status, options.json ?? false);
      return status.healthy || status.api.status === 'not_found' ? 0 : 1;
    }

    case 'logs':
      return showLogs(paths, options);

    default:
      // Default: show status
      const status = getAdminServiceStatus(apiPort, consolePort);
      formatStatus(status, options.json ?? false);
      return 0;
  }
}
