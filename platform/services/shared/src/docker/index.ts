import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
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
import { resolveMcctlRoot, Paths } from '../utils/index.js';
import { resolveHostIps, resolveHostIpsAsync } from '../infrastructure/hostIps.js';
import { parseEnvDocument } from '../utils/env-file.js';
// Adapters are imported by file path, never via a barrel: the barrel loads ServerRepository, which imports this module (ADR-0001)
import {
  DockerComposeRuntimeAdapter,
  DockerServerConsoleAdapter,
  DockerRouterStatusAdapter,
  DockerPlayitAgentAdapter,
  DockerRuntimeEnvironmentAdapter,
} from '../infrastructure/adapters/DockerComposeRuntimeAdapter.js';
import { composeMap } from '../infrastructure/adapters/server-spec/importDockerServer.js';
import { AvahiHostnameRegistrarAdapter } from '../infrastructure/adapters/AvahiHostnameRegistrarAdapter.js';
import { McRouterApiAdapter } from '../infrastructure/adapters/McRouterApiAdapter.js';
import type { IMcRouterApiPort } from '../application/ports/outbound/IMcRouterApiPort.js';
import type { WorkloadState } from '../application/ports/outbound/IContainerRuntimePort.js';
import {
  parseRouterAutoScaleEnv,
  resolveRouteAutoScale,
  markDiscoveredRoutes,
  type RouterResolver,
} from '../domain/services/routerDetail.js';

export { execCommand, execCommandAsync } from '../infrastructure/process.js';
export { parseRconPlayerList } from '../infrastructure/adapters/DockerComposeRuntimeAdapter.js';

// Private default instances behind the legacy functions. Composition roots construct their own.
const runtime = new DockerComposeRuntimeAdapter();
const rconConsole = new DockerServerConsoleAdapter();
const router = new DockerRouterStatusAdapter();
const playit = new DockerPlayitAgentAdapter();
const environment = new DockerRuntimeEnvironmentAdapter();
const hostnameRegistrar = new AvahiHostnameRegistrarAdapter();
const routerApi = new McRouterApiAdapter();

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
  return hostnameRegistrar.getStatus();
}

/** getAvahiStatus without blocking the event loop, each probe bounded (#672). */
export async function getAvahiStatusAsync(): Promise<string> {
  return hostnameRegistrar.getStatusAsync();
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

  return withConfig(detailed, configEnv);
}

/** Adds type, version and memory from config.env when given. */
function withConfig(detailed: DetailedServerInfo, configEnv?: Record<string, string>): DetailedServerInfo {
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

  return withWorld(detailed, configEnv, worldsDir);
}

/** Adds the world name and its directory size. */
async function withWorld(
  detailed: DetailedServerInfo,
  configEnv: Record<string, string> | undefined,
  worldsDir: string | undefined
): Promise<DetailedServerInfo> {
  const worldName = resolveWorldName(configEnv ?? {});
  detailed.worldName = worldName;
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

  // Image and global auto-scale from the router container (#768)
  const routerConfig = basic.status === 'not_found' ? null : router.inspectRouter();
  if (routerConfig) {
    if (routerConfig.image) detailed.image = routerConfig.image;
    detailed.autoScale = parseRouterAutoScaleEnv(routerConfig.env);
  }

  detailed.resolver = readRouterResolver();

  // Get routes from all mc-* containers; one label inspect gives hostnames and auto-scale overrides
  const containers = getMcContainers();
  for (const container of containers) {
    const labels = router.getLabels(container);
    if (!labels['mc-router.host']?.trim()) continue;
    detailed.routes.push(...routesOf(container, labels, getContainerStatus(container), detailed.autoScale));
  }

  return detailed;
}

/**
 * The routes of one server container: a route per `mc-router.host` entry,
 * with the server's type and version from config.env and its effective auto-scale.
 */
function routesOf(
  container: string,
  labels: Record<string, string>,
  serverStatus: ContainerStatus,
  globalAutoScale: RouterDetailInfo['autoScale']
): RouteInfo[] {
  const hostname = labels['mc-router.host']?.trim();
  if (!hostname) return [];
  // hostname might be comma-separated (e.g., "server.local,server.192.168.1.10.nip.io")
  const hostnames = hostname.split(',').map((h) => h.trim());

  // Read config.env for server type/version
  const serverName = container.replace(/^mc-/, '');
  const configEnv = readServerConfigEnv(serverName);
  const serverType = configEnv['TYPE'] || undefined;
  const serverVersion = configEnv['VERSION'] || undefined;
  const autoScale = resolveRouteAutoScale(labels, globalAutoScale);

  return hostnames.map((h) => {
    const route: RouteInfo = {
      hostname: h,
      target: `${container}:25565`,
      serverStatus,
      serverType,
      serverVersion,
    };
    if (autoScale.up !== undefined) route.autoScaleUp = autoScale.up;
    if (autoScale.down !== undefined) route.autoScaleDown = autoScale.down;
    return route;
  });
}

/**
 * getRouterDetailInfo plus `discoveredByRouter` per route from the mc-router
 * management API (#768). The field stays absent when the router is not
 * running or the API cannot be read.
 *
 * Request paths call this, so every docker query is awaited and bounded (#672):
 * one `docker ps` gives every state and host label, labels are inspected only
 * for hosted containers, and health comes from the same API answer. A docker
 * timeout rejects with RuntimeQueryTimeoutError; a failed docker reads as no
 * containers, as on the sync path (fail-closed is #669's decision).
 */
export async function getRouterDetailInfoAsync(
  options: { routerApi?: IMcRouterApiPort } = {}
): Promise<RouterDetailInfo> {
  const states = await runtime.listStates();
  const status = states.get('mc-router')?.status ?? 'not_found';
  const running = status === 'running';
  const [uptimeInfo, routerConfig, resolver, listed] = await Promise.all([
    running ? runtime.getUptimeAsync('mc-router') : null,
    status === 'not_found' ? null : router.inspectRouterAsync(),
    readRouterResolverAsync(),
    running ? (options.routerApi ?? routerApi).listRoutes() : null,
  ]);

  const detailed: RouterDetailInfo = {
    name: 'mc-router',
    status,
    health: !running ? 'unknown' : listed ? 'healthy' : 'unhealthy',
    port: 25565,
    routes: [],
    mode: '--in-docker (auto-discovery)',
    resolver,
  };
  if (uptimeInfo) {
    detailed.uptime = uptimeInfo.uptime;
    detailed.uptimeSeconds = uptimeInfo.seconds;
  }
  if (routerConfig) {
    if (routerConfig.image) detailed.image = routerConfig.image;
    detailed.autoScale = parseRouterAutoScaleEnv(routerConfig.env);
  }

  const hosted = [...states].filter(([name, state]) => name !== 'mc-router' && state.hostname !== '-');
  const routes = await Promise.all(
    hosted.map(async ([name, state]) =>
      routesOf(name, await router.getLabelsAsync(name), state.status, detailed.autoScale)
    )
  );
  detailed.routes = routes.flat();

  if (!running) return detailed;
  detailed.routes = markDiscoveredRoutes(detailed.routes, listed ? listed.keys() : null, {
    stoppedRoutesListed: detailed.autoScale?.up !== false,
  });
  return detailed;
}

/**
 * Resolver addresses (#768), resolved the way create-server.sh picks nip.io
 * hosts: `.env` HOST_IPS / HOST_IP comma lists, else the probed host address.
 * The first one is the primary, as for avahi.
 */
function readRouterResolver(): RouterResolver {
  return resolverOf(resolveHostIps(new Paths()));
}

async function readRouterResolverAsync(): Promise<RouterResolver> {
  return resolverOf(await resolveHostIpsAsync(new Paths()));
}

function resolverOf(hostIps: string[]): RouterResolver {
  return hostIps.length > 0 ? { hostIp: hostIps[0], hostIps } : { hostIps };
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
    return Object.fromEntries(parseEnvDocument(readFileSync(configPath, 'utf-8')).values);
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

// ---------------------------------------------------------------------------
// Async status queries for API request paths (#672). One `docker ps` answers
// every status, health and existence check; concurrent callers share it and a
// success is reused for STATES_TTL_MS. A failed docker reads as no containers,
// as on the sync path; a timeout rejects and is not cached.
// ---------------------------------------------------------------------------

const STATES_TTL_MS = 2_000;
let statesCache: { at: number; states: Promise<Map<string, WorkloadState>> } | undefined;

/** Drop the cached snapshot, e.g. after a start, stop, create or delete. */
export function invalidateContainerStates(): void {
  statesCache = undefined;
}

function containerStates(): Promise<Map<string, WorkloadState>> {
  if (statesCache && Date.now() - statesCache.at < STATES_TTL_MS) return statesCache.states;
  const entry = { at: Date.now(), states: runtime.listStates() };
  statesCache = entry;
  entry.states.catch(() => {
    if (statesCache === entry) statesCache = undefined;
  });
  return entry.states;
}

export async function getContainerStatusAsync(container: string): Promise<ContainerStatus> {
  return (await containerStates()).get(container)?.status ?? 'not_found';
}

export async function getContainerHealthAsync(container: string): Promise<HealthStatus> {
  return (await containerStates()).get(container)?.health ?? 'unknown';
}

export async function containerExistsAsync(container: string): Promise<boolean> {
  return (await containerStates()).has(container);
}

export async function getServerInfoFromConfigAsync(serverName: string): Promise<ServerInfo> {
  const container = `mc-${serverName}`;
  const state = (await containerStates()).get(container);
  if (!state) return { name: serverName, container, status: 'not_created', health: 'none', hostname: '-' };
  return { name: serverName, container, ...state };
}

export async function getAllServersAsync(serversDir?: string): Promise<string[]> {
  const containers = [...(await containerStates()).keys()]
    .filter(name => name !== 'mc-router')
    .map(name => name.replace(/^mc-/, ''));
  return Array.from(new Set([...getConfiguredServers(serversDir), ...containers])).sort();
}

/** A configured server answers without docker. */
export async function serverExistsAsync(serverName: string, serversDir?: string): Promise<boolean> {
  const dir = serversDir ?? getServersDir();
  if (existsSync(join(dir, serverName, 'config.env'))) return true;
  return containerExistsAsync(`mc-${serverName}`);
}

export async function getContainerLogsAsync(container: string, lines: number = 50): Promise<string> {
  return runtime.getLogsAsync(container, lines);
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
 * Get detailed server info (works for both running containers and config-only servers).
 * API request path: awaited, bounded docker queries only (#672); a docker
 * timeout rejects with RuntimeQueryTimeoutError, a failed docker falls back to
 * config as on the sync path (#669 decides fail-closed).
 */
export async function getServerDetailedInfo(
  serverName: string,
  serversDir?: string,
  worldsDir?: string
): Promise<DetailedServerInfo> {
  const container = `mc-${serverName}`;
  const state = (await runtime.listStates()).get(container);
  if (!state) return getDetailedServerInfoFromConfig(serverName, serversDir, worldsDir);

  const configEnv = readServerConfigEnv(serverName, serversDir);
  const detailed: DetailedServerInfo = { name: serverName, container, ...state };
  if (state.status === 'running') {
    const [stats, uptimeInfo, players] = await Promise.all([
      runtime.getStatsAsync(container),
      runtime.getUptimeAsync(container),
      getOnlinePlayers(container),
    ]);
    if (stats) detailed.stats = stats;
    if (uptimeInfo) {
      detailed.uptime = uptimeInfo.uptime;
      detailed.uptimeSeconds = uptimeInfo.seconds;
    }
    if (players) detailed.players = players;
  }
  return withWorld(withConfig(detailed, configEnv), configEnv, worldsDir);
}

/**
 * Get playit-agent container status
 * Returns status information about the playit.gg agent container
 */
export async function getPlayitAgentStatus(): Promise<import('../types/index.js').PlayitAgentStatus> {
  const containerName = 'playit-agent';

  // Awaited and bounded: the API calls this per request (#672)
  const status = await runtime.getStatusAsync(containerName);
  const agentRunning = status === 'running';

  const { secretKeyConfigured, playitEnabled } = readPlayitSettings();

  // Get uptime if running
  let uptime: string | undefined;
  let uptimeSeconds: number | undefined;

  if (agentRunning) {
    const uptimeInfo = await runtime.getUptimeAsync(containerName);
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

/** PLAYIT_SECRET_KEY set in the platform .env; playitEnabled in .mcctl.json. */
function readPlayitSettings(): { secretKeyConfigured: boolean; playitEnabled: boolean } {
  // Check if PLAYIT_SECRET_KEY is configured in platform .env
  const platformRoot = resolveMcctlRoot();
  const envPath = join(platformRoot, '.env');
  let secretKeyConfigured = false;

  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, 'utf-8');
      // Check if PLAYIT_SECRET_KEY is set and not empty
      secretKeyConfigured = !!parseEnvDocument(envContent).values.get('PLAYIT_SECRET_KEY');
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

  return { secretKeyConfigured, playitEnabled };
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

const sameHost = (a: string, b: string | null): boolean => b !== null && a.toLowerCase() === b.toLowerCase();

/**
 * Parse the mc-router.host label of a docker-compose.yml into a host list
 * ([] if absent, empty or unparseable). Read as YAML (#671): comments,
 * indentation and the `- key=value` label form do not matter.
 */
export function parseRouterHosts(composeContent: string): string[] {
  let services: unknown;
  try {
    services = (yaml.load(composeContent) as { services?: unknown } | null)?.services;
  } catch {
    return [];
  }
  for (const service of Object.values(services && typeof services === 'object' ? services : {})) {
    const value = composeMap((service as { labels?: unknown } | null)?.labels).get('mc-router.host');
    if (value) return value.split(',').map((h) => h.trim()).filter(Boolean);
  }
  return [];
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
