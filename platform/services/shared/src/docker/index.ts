import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
import { resolveWorldName } from '../domain/value-objects/WorldName.js';
import { resolveMcctlRoot } from '../utils/index.js';
// Adapters are imported by file path, never via a barrel: the barrel loads ServerRepository, which imports this module (ADR-0001)
import {
  DockerComposeRuntimeAdapter,
  DockerServerConsoleAdapter,
  DockerRouterStatusAdapter,
  DockerPlayitAgentAdapter,
  DockerRuntimeEnvironmentAdapter,
} from '../infrastructure/adapters/DockerComposeRuntimeAdapter.js';

export { execCommand, execCommandAsync, execScript, execScriptInteractive } from '../infrastructure/process.js';
export { parseRconPlayerList } from '../infrastructure/adapters/DockerComposeRuntimeAdapter.js';

// Private default instances behind the legacy functions. Composition roots construct their own.
const runtime = new DockerComposeRuntimeAdapter();
const rconConsole = new DockerServerConsoleAdapter();
const router = new DockerRouterStatusAdapter();
const playit = new DockerPlayitAgentAdapter();
const environment = new DockerRuntimeEnvironmentAdapter();

/**
 * Check if Docker is available
 */
export function checkDocker(): boolean {
  return environment.isAvailable();
}

/**
 * Check if Docker Compose is available
 */
export function checkDockerCompose(): boolean {
  return environment.isComposeAvailable();
}

/**
 * Get Docker version
 */
export function getDockerVersion(): { installed: boolean; version?: string } {
  return environment.getEngineVersion();
}

/**
 * Get Docker Compose version
 */
export function getDockerComposeVersion(): { installed: boolean; version?: string } {
  return environment.getComposeVersion();
}

/**
 * Get container status
 */
export function getContainerStatus(container: string): ContainerStatus {
  return runtime.getStatus(container);
}

/**
 * Get container health status
 */
export function getContainerHealth(container: string): HealthStatus {
  return runtime.getHealth(container);
}

/**
 * Check mc-router health via management API
 * mc-router uses distroless image, so Docker healthcheck doesn't work
 * Instead, we check the management API on localhost:25580
 */
export function getRouterHealthViaApi(): HealthStatus {
  return router.getHealth();
}

/**
 * Check if container exists
 */
export function containerExists(container: string): boolean {
  return runtime.exists(container);
}

/**
 * Get container's hostname label (mc-router.host)
 */
export function getContainerHostname(container: string): string {
  return router.getHostnames(container);
}

/**
 * Get all minecraft server containers (mc-* except mc-router)
 */
export function getMcContainers(): string[] {
  return runtime.list();
}

/**
 * Get running minecraft server containers
 */
export function getRunningMcContainers(): string[] {
  return runtime.list({ running: true });
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
  return runtime.startContainer(container);
}

/**
 * Stop a container
 */
export function stopContainer(container: string): boolean {
  return runtime.stopContainer(container);
}

/**
 * Get container logs
 */
export function getContainerLogs(container: string, lines: number = 50): string {
  return runtime.getLogs(container, lines);
}

/**
 * Get container resource stats (memory, CPU)
 */
export function getContainerStats(container: string): ContainerStats | null {
  return runtime.getStats(container);
}

/**
 * Get container uptime (time since start)
 */
export function getContainerUptime(container: string): { uptime: string; seconds: number } | null {
  return runtime.getUptime(container);
}

/**
 * Get online players via RCON
 */
export async function getOnlinePlayers(container: string): Promise<PlayerListResult | null> {
  return rconConsole.listPlayers(container);
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
  const worldName = resolveWorldName(configEnv ?? {});
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

      // Read config.env for server type/version
      const serverName = container.replace(/^mc-/, '');
      const configEnv = readServerConfigEnv(serverName);
      const serverType = configEnv['TYPE'] || undefined;
      const serverVersion = configEnv['VERSION'] || undefined;

      for (const h of hostnames) {
        detailed.routes.push({
          hostname: h,
          target: `${container}:25565`,
          serverStatus,
          serverType,
          serverVersion,
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
  return join(resolveMcctlRoot(), 'worlds');
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
  const dir = serversDir ?? getServersDir();

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
  return join(resolveMcctlRoot(), 'servers');
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
  const worldName = resolveWorldName(configEnv);
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

/**
 * Get playit-agent container status
 * Returns status information about the playit.gg agent container
 */
export async function getPlayitAgentStatus(): Promise<import('../types/index.js').PlayitAgentStatus> {
  const containerName = 'playit-agent';

  // Check if container exists
  const status = getContainerStatus(containerName);
  const agentRunning = status === 'running';

  // Check if PLAYIT_SECRET_KEY is configured in platform .env
  const platformRoot = resolveMcctlRoot();
  const envPath = join(platformRoot, '.env');
  let secretKeyConfigured = false;

  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, 'utf-8');
      // Check if PLAYIT_SECRET_KEY is set and not empty
      const secretMatch = envContent.match(/^PLAYIT_SECRET_KEY=(.+)$/m);
      secretKeyConfigured = !!(secretMatch && secretMatch[1] && secretMatch[1].trim());
    } catch {
      // Ignore read errors
    }
  }

  // Check if playit is enabled in .mcctl.json config
  const configPath = join(platformRoot, '.mcctl.json');
  let playitEnabled = false;
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      playitEnabled = config.playitEnabled === true;
    } catch {
      // Ignore parse errors
    }
  }

  // Get uptime if running
  let uptime: string | undefined;
  let uptimeSeconds: number | undefined;

  if (agentRunning) {
    const uptimeInfo = getContainerUptime(containerName);
    if (uptimeInfo) {
      uptime = uptimeInfo.uptime;
      uptimeSeconds = uptimeInfo.seconds;
    }
  }

  return {
    enabled: playitEnabled || secretKeyConfigured,
    agentRunning,
    secretKeyConfigured,
    containerStatus: status,
    uptime,
    uptimeSeconds,
  };
}

/**
 * Start playit-agent container
 * Uses docker compose with playit profile
 */
export async function startPlayitAgent(): Promise<{ success: boolean; error?: string }> {
  return playit.start();
}

/**
 * Stop playit-agent container
 * Uses docker compose with playit profile
 */
export async function stopPlayitAgent(): Promise<boolean> {
  return playit.stop();
}

/**
 * Get server's playit.gg domain from config.env
 * Returns the PLAYIT_DOMAIN value if set, otherwise null
 */
export function getServerPlayitDomain(serverName: string, serversDir?: string): string | null {
  const configEnv = readServerConfigEnv(serverName, serversDir);
  const domain = configEnv['PLAYIT_DOMAIN'];

  // Return null if not set or empty
  return domain && domain.trim() ? domain.trim() : null;
}

/** mc-router.host label in a server docker-compose.yml (same regex as mcctl-api HostnameService) */
const ROUTER_HOST_LABEL_REGEX = /(mc-router\.host:\s*["'])([^"']+)(["'])/;

const sameHost = (a: string, b: string | null): boolean => b !== null && a.toLowerCase() === b.toLowerCase();

/**
 * Parse the mc-router.host label of a docker-compose.yml into a host list ([] if absent)
 */
export function parseRouterHosts(composeContent: string): string[] {
  const value = composeContent.match(ROUTER_HOST_LABEL_REGEX)?.[2];
  return value ? value.split(',').map((h) => h.trim()).filter(Boolean) : [];
}

/**
 * Replace the mc-router.host label value with the given hosts (content unchanged if label absent)
 */
export function replaceRouterHosts(composeContent: string, hosts: string[]): string {
  return composeContent.replace(ROUTER_HOST_LABEL_REGEX, (_m, open: string, _v: string, close: string) => `${open}${hosts.join(',')}${close}`);
}

/**
 * Swap oldHost for newHost in a host list: keeps position, never duplicates,
 * appends when oldHost is absent, removes oldHost when newHost is null.
 */
function swapRouterHost(hosts: string[], oldHost: string | null, newHost: string | null): string[] {
  const kept = hosts.filter((h) => !sameHost(h, oldHost) || sameHost(h, newHost));
  if (newHost === null || kept.some((h) => sameHost(h, newHost))) return kept;
  const i = hosts.findIndex((h) => sameHost(h, oldHost));
  return i === -1 ? [...kept, newHost] : [...kept.slice(0, i), newHost, ...kept.slice(i)];
}

/**
 * Decide the PLAYIT_DOMAIN after the custom hostname list was edited (pure, no I/O).
 * Current domain still listed → unchanged; otherwise exactly one newly added host
 * becomes the domain; zero or 2+ added → null (remove). No current domain → null.
 * Current domain absent from the previous list (set before label sync) → unchanged,
 * since the edit could not have removed it.
 */
export function resolvePlayitDomain(
  currentDomain: string | null,
  previousCustom: string[],
  nextCustom: string[]
): string | null {
  if (!currentDomain) return null;
  if (!previousCustom.some((h) => sameHost(h, currentDomain))) return currentDomain;
  if (nextCustom.some((h) => sameHost(h, currentDomain))) return currentDomain;
  const added = nextCustom.filter((h) => !previousCustom.some((p) => sameHost(h, p)));
  return added.length === 1 ? added[0]! : null;
}

/**
 * Set or remove a server's playit.gg domain in config.env, and keep the
 * mc-router.host label in docker-compose.yml in sync (skipped if file/label absent)
 * @param domain - Domain string to set, or null to remove
 * @throws Error if config.env does not exist
 */
export function setServerPlayitDomain(serverName: string, domain: string | null, serversDir?: string): void {
  const dir = serversDir ?? getServersDir();
  const configPath = join(dir, serverName, 'config.env');

  if (!existsSync(configPath)) {
    throw new Error(`config.env not found for server '${serverName}': ${configPath}`);
  }

  const previousDomain = getServerPlayitDomain(serverName, dir);
  let content = readFileSync(configPath, 'utf-8');

  if (domain === null) {
    // Remove PLAYIT_DOMAIN line and its comment header
    content = content.replace(/\n?# playit\.gg External Domain\n/g, '\n');
    content = content.replace(/^PLAYIT_DOMAIN=.*\n?/m, '');
  } else if (content.match(/^PLAYIT_DOMAIN=/m)) {
    // Update existing
    content = content.replace(/^PLAYIT_DOMAIN=.*$/m, `PLAYIT_DOMAIN=${domain}`);
  } else {
    // Append new
    const suffix = content.endsWith('\n') ? '' : '\n';
    content += `${suffix}\n# playit.gg External Domain\nPLAYIT_DOMAIN=${domain}\n`;
  }

  writeFileSync(configPath, content, 'utf-8');

  const composePath = join(dir, serverName, 'docker-compose.yml');
  if (!existsSync(composePath)) return;
  const compose = readFileSync(composePath, 'utf-8');
  const hosts = parseRouterHosts(compose);
  if (hosts.length === 0) return;
  const nextHosts = swapRouterHost(hosts, previousDomain, domain);
  if (nextHosts.join(',') !== hosts.join(',')) {
    writeFileSync(composePath, replaceRouterHosts(compose, nextHosts), 'utf-8');
  }
}
