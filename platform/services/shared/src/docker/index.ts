import { spawn, execSync } from 'node:child_process';
import type { ContainerStatus, HealthStatus, ServerInfo, RouterInfo, PlatformStatus } from '../types/index.js';

/**
 * Execute a command and return stdout
 */
function execCommand(command: string, args: string[]): string {
  try {
    const result = execSync(`${command} ${args.join(' ')}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch {
    return '';
  }
}

/**
 * Check if Docker is available
 */
export function checkDocker(): boolean {
  try {
    execSync('docker info', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Docker Compose is available
 */
export function checkDockerCompose(): boolean {
  try {
    execSync('docker compose version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get container status
 */
export function getContainerStatus(container: string): ContainerStatus {
  const result = execCommand('docker', [
    'inspect',
    '--format',
    '{{.State.Status}}',
    container,
  ]);

  if (!result) return 'not_found';
  return result as ContainerStatus;
}

/**
 * Get container health status
 */
export function getContainerHealth(container: string): HealthStatus {
  const result = execCommand('docker', [
    'inspect',
    '--format',
    '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}',
    container,
  ]);

  if (!result) return 'unknown';
  return result as HealthStatus;
}

/**
 * Check if container exists
 */
export function containerExists(container: string): boolean {
  try {
    execSync(`docker inspect ${container}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get container's hostname label (mc-router.host)
 */
export function getContainerHostname(container: string): string {
  const result = execCommand('docker', [
    'inspect',
    '--format',
    '{{index .Config.Labels "mc-router.host"}}',
    container,
  ]);

  return result || '-';
}

/**
 * Get all minecraft server containers (mc-* except mc-router)
 */
export function getMcContainers(): string[] {
  const result = execCommand('docker', [
    'ps',
    '-a',
    '--filter',
    'name=mc-',
    '--format',
    '{{.Names}}',
  ]);

  if (!result) return [];

  return result
    .split('\n')
    .filter(name => name && name !== 'mc-router')
    .sort();
}

/**
 * Get running minecraft server containers
 */
export function getRunningMcContainers(): string[] {
  const result = execCommand('docker', [
    'ps',
    '--filter',
    'name=mc-',
    '--filter',
    'status=running',
    '--format',
    '{{.Names}}',
  ]);

  if (!result) return [];

  return result
    .split('\n')
    .filter(name => name && name !== 'mc-router')
    .sort();
}

/**
 * Get server info for a container
 */
export function getServerInfo(container: string): ServerInfo {
  const serverName = container.replace(/^mc-/, '');

  return {
    name: serverName,
    container,
    status: getContainerStatus(container),
    health: getContainerHealth(container),
    hostname: getContainerHostname(container),
  };
}

/**
 * Get router info
 */
export function getRouterInfo(): RouterInfo {
  return {
    name: 'mc-router',
    status: getContainerStatus('mc-router'),
    health: getContainerHealth('mc-router'),
    port: 25565,
  };
}

/**
 * Get avahi-daemon status
 */
export function getAvahiStatus(): string {
  // Try systemctl first
  try {
    execSync('systemctl is-active --quiet avahi-daemon', { stdio: 'pipe' });
    return 'running';
  } catch {
    // Not running via systemctl
  }

  // Try OpenRC
  try {
    execSync('rc-service avahi-daemon status', { stdio: 'pipe' });
    return 'running';
  } catch {
    // Not running via OpenRC
  }

  // Check if installed
  try {
    execSync('which avahi-daemon', { stdio: 'pipe' });
    return 'installed (not running)';
  } catch {
    return 'not installed';
  }
}

/**
 * Get full platform status
 */
export function getPlatformStatus(): PlatformStatus {
  const containers = getMcContainers();

  return {
    router: getRouterInfo(),
    avahi_daemon: {
      name: 'avahi-daemon',
      status: getAvahiStatus(),
      type: 'system',
    },
    servers: containers.map(getServerInfo),
  };
}

/**
 * Start a container
 */
export function startContainer(container: string): boolean {
  try {
    execSync(`docker start ${container}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop a container
 */
export function stopContainer(container: string): boolean {
  try {
    execSync(`docker stop ${container}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get container logs
 */
export function getContainerLogs(container: string, lines: number = 50): string {
  return execCommand('docker', ['logs', '--tail', String(lines), container]);
}

/**
 * Execute shell script with environment variables
 */
export function execScript(
  scriptPath: string,
  args: string[],
  env: Record<string, string> = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('bash', [scriptPath, ...args], {
      env: { ...process.env, ...env },
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });

    child.on('error', () => {
      resolve({ code: 1, stdout, stderr: 'Failed to execute script' });
    });
  });
}

/**
 * Execute shell script with inherited stdio (interactive)
 */
export function execScriptInteractive(
  scriptPath: string,
  args: string[],
  env: Record<string, string> = {}
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('bash', [scriptPath, ...args], {
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      resolve(code ?? 1);
    });

    child.on('error', () => {
      resolve(1);
    });
  });
}
