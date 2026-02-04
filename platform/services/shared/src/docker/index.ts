import { spawn, execSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {
  ContainerStatus,
  HealthStatus,
  ServerInfo,
  RouterInfo,
  PlatformStatus,
  ContainerStats,
  PlayerListResult,
  DetailedServerInfo,
  RouterDetailInfo,
  RouteInfo,
} from '../types/index.js';

/**
 * Execute a command and return stdout
 * Uses spawnSync to properly handle arguments with special characters
 */
export function execCommand(command: string, args: string[]): string {
  try {
    const result = spawnSync(command, args, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.error || result.status !== 0) {
      return '';
    }
    return (result.stdout ?? '').trim();
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
 * Check mc-router health via management API
 * mc-router uses distroless image, so Docker healthcheck doesn't work
 * Instead, we check the management API on localhost:25580
 */
export function getRouterHealthViaApi(): HealthStatus {
  try {
    // Check if mc-router is running first
    const status = getContainerStatus('mc-router');
    if (status !== 'running') {
      return 'unknown';
    }

    // Try to connect to management API
    const result = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://127.0.0.1:25580/routes'], {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (result.error || result.status !== 0) {
      // curl failed, try wget
      const wgetResult = spawnSync('wget', ['-q', '-O', '/dev/null', 'http://127.0.0.1:25580/routes'], {
        encoding: 'utf-8',
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      if (wgetResult.error || wgetResult.status !== 0) {
        return 'unhealthy';
      }
      return 'healthy';
    }

    const httpCode = (result.stdout ?? '').trim();
    if (httpCode === '200') {
      return 'healthy';
    }
    return 'unhealthy';
  } catch {
    return 'unknown';
  }
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
    health: getRouterHealthViaApi(),
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
 * Includes both running containers and configured-but-not-running servers
 */
export function getPlatformStatus(serversDir?: string): PlatformStatus {
  // Get all servers (configured + running containers)
  const allServerNames = getAllServers(serversDir);

  return {
    router: getRouterInfo(),
    avahi_daemon: {
      name: 'avahi-daemon',
      status: getAvahiStatus(),
      type: 'system',
    },
    servers: allServerNames.map(serverName => getServerInfoFromConfig(serverName)),
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
 * Execute a command asynchronously and return result
 * For docker commands that need async/await pattern
 */
export function execCommandAsync(
  command: string,
  args: string[]
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() });
    });

    child.on('error', () => {
      resolve({ code: 1, stdout: '', stderr: 'Failed to execute command' });
    });
  });
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

/**
 * Get container resource stats (memory, CPU)
 */
export function getContainerStats(container: string): ContainerStats | null {
  // docker stats --no-stream --format "{{.MemUsage}},{{.CPUPerc}}"
  // Example output: "2.1GiB / 4GiB,15.23%"
  const result = execCommand('docker', [
    'stats',
    '--no-stream',
    '--format',
    '{{.MemUsage}},{{.CPUPerc}}',
    container,
  ]);

  if (!result) return null;

  try {
    const [memUsage, cpuPerc] = result.split(',');
    if (!memUsage || !cpuPerc) return null;

    // Parse memory: "2.1GiB / 4GiB" or "512MiB / 4GiB"
    const memParts = memUsage.split('/').map((s) => s.trim());
    if (memParts.length !== 2) return null;

    const parseMemory = (mem: string): number => {
      const match = mem.match(/^([\d.]+)\s*(B|KiB|MiB|GiB|TiB|KB|MB|GB|TB)?$/i);
      if (!match || !match[1]) return 0;
      const value = parseFloat(match[1]);
      const unit = (match[2] ?? 'B').toUpperCase();
      const multipliers: Record<string, number> = {
        B: 1,
        KIB: 1024,
        MIB: 1024 ** 2,
        GIB: 1024 ** 3,
        TIB: 1024 ** 4,
        KB: 1000,
        MB: 1000 ** 2,
        GB: 1000 ** 3,
        TB: 1000 ** 4,
      };
      return value * (multipliers[unit] || 1);
    };

    const memoryUsage = parseMemory(memParts[0]!);
    const memoryLimit = parseMemory(memParts[1]!);
    const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

    // Parse CPU: "15.23%" or "0.00%"
    const cpuPercent = parseFloat(cpuPerc.replace('%', '')) || 0;

    return {
      memoryUsage,
      memoryLimit,
      memoryPercent,
      cpuPercent,
    };
  } catch {
    return null;
  }
}

/**
 * Get container uptime (time since start)
 */
export function getContainerUptime(container: string): { uptime: string; seconds: number } | null {
  // docker inspect --format '{{.State.StartedAt}}'
  const result = execCommand('docker', [
    'inspect',
    '--format',
    '{{.State.StartedAt}}',
    container,
  ]);

  if (!result || result === '0001-01-01T00:00:00Z') return null;

  try {
    const startedAt = new Date(result);
    const now = new Date();
    const diffMs = now.getTime() - startedAt.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    // Format uptime
    const days = Math.floor(diffSeconds / 86400);
    const hours = Math.floor((diffSeconds % 86400) / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);

    let uptime = '';
    if (days > 0) uptime += `${days}d `;
    if (hours > 0 || days > 0) uptime += `${hours}h `;
    uptime += `${minutes}m`;

    return { uptime: uptime.trim(), seconds: diffSeconds };
  } catch {
    return null;
  }
}

/**
 * Get online players via RCON
 */
export async function getOnlinePlayers(container: string): Promise<PlayerListResult | null> {
  try {
    const rawResult = execSync(`docker exec ${container} rcon-cli list`, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Strip ANSI escape codes and get first line only
    const result = rawResult
      .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI codes
      .replace(/\[\d*m/g, '')         // Remove partial ANSI codes like [0m
      .split('\n')[0]                  // Get first line only
      ?.trim() ?? '';

    // Parse: "There are 3 of a max of 20 players online: Notch, Steve, Alex"
    // Or: "There are 0 of a max of 20 players online:"
    const countMatch = result.match(/There are (\d+)(?:\s+of a max of\s+|\/)(\d+) players? online/i);
    if (!countMatch || !countMatch[1] || !countMatch[2]) return null;

    const online = parseInt(countMatch[1], 10);
    const max = parseInt(countMatch[2], 10);

    // Extract player names after the colon
    const playersMatch = result.match(/:\s*(.*)$/);
    let players: string[] = [];
    if (playersMatch && playersMatch[1]) {
      players = playersMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return { online, max, players };
  } catch {
    return null;
  }
}

/**
 * Get detailed server info
 */
export function getDetailedServerInfo(container: string, configEnv?: Record<string, string>): DetailedServerInfo {
  const basic = getServerInfo(container);
  const detailed: DetailedServerInfo = { ...basic };

  // Only get extended info if container is running
  if (basic.status === 'running') {
    // Get stats
    const stats = getContainerStats(container);
    if (stats) {
      detailed.stats = stats;
    }

    // Get uptime
    const uptimeInfo = getContainerUptime(container);
    if (uptimeInfo) {
      detailed.uptime = uptimeInfo.uptime;
      detailed.uptimeSeconds = uptimeInfo.seconds;
    }
  }

  // Get config info if provided
  if (configEnv) {
    detailed.type = configEnv['TYPE'];
    detailed.version = configEnv['VERSION'];
    detailed.memory = configEnv['MEMORY'];
  }

  return detailed;
}

/**
 * Get detailed server info with players (async)
 */
export async function getDetailedServerInfoWithPlayers(
  container: string,
  configEnv?: Record<string, string>,
  worldsDir?: string
): Promise<DetailedServerInfo> {
  const detailed = getDetailedServerInfo(container, configEnv);

  // Get players if running
  if (detailed.status === 'running') {
    const players = await getOnlinePlayers(container);
    if (players) {
      detailed.players = players;
    }
  }

  // Get world name and size
  // World name priority: config LEVEL > WORLD_NAME > server name
  const serverName = container.replace(/^mc-/, '');
  const worldName = configEnv?.['LEVEL'] || configEnv?.['WORLD_NAME'] || serverName;
  detailed.worldName = worldName;

  // Calculate world size
  const worldSize = await getWorldDirectorySize(worldName, worldsDir);
  detailed.worldSize = formatBytes(worldSize);

  return detailed;
}

/**
 * Get router detailed info
 */
export function getRouterDetailInfo(): RouterDetailInfo {
  const basic = getRouterInfo();
  const detailed: RouterDetailInfo = {
    ...basic,
    routes: [],
    mode: '--in-docker (auto-discovery)',
  };

  // Get uptime
  if (basic.status === 'running') {
    const uptimeInfo = getContainerUptime('mc-router');
    if (uptimeInfo) {
      detailed.uptime = uptimeInfo.uptime;
      detailed.uptimeSeconds = uptimeInfo.seconds;
    }
  }

  // Get routes from all mc-* containers
  const containers = getMcContainers();
  for (const container of containers) {
    const hostname = getContainerHostname(container);
    if (hostname && hostname !== '-') {
      // hostname might be comma-separated (e.g., "server.local,server.192.168.1.10.nip.io")
      const hostnames = hostname.split(',').map((h) => h.trim());
      const serverStatus = getContainerStatus(container);

      for (const h of hostnames) {
        detailed.routes.push({
          hostname: h,
          target: `${container}:25565`,
          serverStatus,
        });
      }
    }
  }

  return detailed;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Get the worlds directory path
 */
export function getWorldsDir(): string {
  return join(
    process.env['MCCTL_ROOT'] ?? join(homedir(), 'minecraft-servers'),
    'worlds'
  );
}

/**
 * Calculate the total size of a world directory recursively
 * @param worldName The name of the world
 * @param worldsDir Optional custom worlds directory path
 * @returns Total size in bytes
 */
export async function getWorldDirectorySize(worldName: string, worldsDir?: string): Promise<number> {
  const dir = worldsDir ?? getWorldsDir();
  const worldPath = join(dir, worldName);

  if (!existsSync(worldPath)) {
    return 0;
  }

  return calculateDirectorySize(worldPath);
}

/**
 * Calculate directory size recursively
 */
async function calculateDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const entryPath = join(dirPath, entry);
      try {
        const stats = statSync(entryPath);
        if (stats.isDirectory()) {
          totalSize += await calculateDirectorySize(entryPath);
        } else if (stats.isFile()) {
          totalSize += stats.size;
        }
      } catch {
        // Skip entries that can't be accessed
      }
    }
  } catch {
    // Return 0 if directory can't be read
  }

  return totalSize;
}

/**
 * Get configured servers from filesystem (servers/ directory)
 * Returns server names (not container names)
 */
export function getConfiguredServers(serversDir?: string): string[] {
  const dir = serversDir ?? join(
    process.env['MCCTL_ROOT'] ?? join(homedir(), 'minecraft-servers'),
    'servers'
  );

  if (!existsSync(dir)) return [];

  try {
    return readdirSync(dir)
      .filter(name => {
        // Skip _template and hidden directories
        if (name === '_template' || name.startsWith('.')) return false;
        // Check if it's a directory with config.env
        const serverPath = join(dir, name);
        return statSync(serverPath).isDirectory() &&
               existsSync(join(serverPath, 'config.env'));
      })
      .sort();
  } catch {
    return [];
  }
}

/**
 * Get server info for a configured server (may or may not have a container)
 */
export function getServerInfoFromConfig(serverName: string): ServerInfo {
  const container = `mc-${serverName}`;
  const status = getContainerStatus(container);

  // If container doesn't exist, mark as not_created
  if (status === 'not_found') {
    return {
      name: serverName,
      container,
      status: 'not_created',
      health: 'none',
      hostname: '-',
    };
  }

  return getServerInfo(container);
}

/**
 * Get all servers (both configured and running containers)
 * Merges filesystem-configured servers with Docker container status
 */
export function getAllServers(serversDir?: string): string[] {
  // Get configured servers from filesystem
  const configuredServers = getConfiguredServers(serversDir);

  // Get running/stopped containers
  const containerServers = getMcContainers()
    .map(c => c.replace(/^mc-/, ''));

  // Merge and dedupe
  const allServers = new Set([...configuredServers, ...containerServers]);
  return Array.from(allServers).sort();
}

/**
 * Get the servers directory path
 */
export function getServersDir(): string {
  return join(
    process.env['MCCTL_ROOT'] ?? join(homedir(), 'minecraft-servers'),
    'servers'
  );
}

/**
 * Read config.env file for a server
 * Returns key-value pairs of environment variables
 */
export function readServerConfigEnv(serverName: string, serversDir?: string): Record<string, string> {
  const dir = serversDir ?? getServersDir();
  const configPath = join(dir, serverName, 'config.env');

  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config: Record<string, string> = {};

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      config[key] = value;
    }

    return config;
  } catch {
    return {};
  }
}

/**
 * Check if a server exists (either as container or as configuration)
 */
export function serverExists(serverName: string, serversDir?: string): boolean {
  const container = `mc-${serverName}`;

  // Check if container exists
  if (containerExists(container)) {
    return true;
  }

  // Check if configured
  const dir = serversDir ?? getServersDir();
  const serverPath = join(dir, serverName);
  return existsSync(join(serverPath, 'config.env'));
}

/**
 * Get detailed server info from config.env (for servers without containers)
 */
export async function getDetailedServerInfoFromConfig(
  serverName: string,
  serversDir?: string,
  worldsDir?: string
): Promise<DetailedServerInfo> {
  const container = `mc-${serverName}`;
  const configEnv = readServerConfigEnv(serverName, serversDir);
  const dir = serversDir ?? getServersDir();

  // Read docker-compose.yml to get hostname
  let hostname = '-';
  const composePath = join(dir, serverName, 'docker-compose.yml');
  if (existsSync(composePath)) {
    try {
      const composeContent = readFileSync(composePath, 'utf-8');
      // Look for mc-router.host label
      const hostMatch = composeContent.match(/mc-router\.host['":\s]+([^\s'"]+)/);
      if (hostMatch && hostMatch[1]) {
        hostname = hostMatch[1];
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Get world name and size
  const worldName = configEnv['WORLD_NAME'] || serverName;
  const worldSize = await getWorldDirectorySize(worldName, worldsDir);

  return {
    name: serverName,
    container,
    status: 'not_created',
    health: 'none',
    hostname,
    type: configEnv['TYPE'] || 'PAPER',
    version: configEnv['VERSION'] || 'LATEST',
    memory: configEnv['MEMORY'] || '2G',
    worldName,
    worldSize: formatBytes(worldSize),
  };
}

/**
 * Get detailed server info (works for both running containers and config-only servers)
 */
export async function getServerDetailedInfo(
  serverName: string,
  serversDir?: string,
  worldsDir?: string
): Promise<DetailedServerInfo> {
  const container = `mc-${serverName}`;
  const configEnv = readServerConfigEnv(serverName, serversDir);

  // If container exists, get info from Docker
  if (containerExists(container)) {
    return getDetailedServerInfoWithPlayers(container, configEnv, worldsDir);
  }

  // Otherwise, get info from config only
  return getDetailedServerInfoFromConfig(serverName, serversDir, worldsDir);
}
