import type {
  IGetServerSummariesUseCase,
  ServerSummariesResult,
  ServerSummaryItem,
  ServerSummaryTotals,
} from '../ports/inbound/IGetServerSummariesUseCase.js';
import type { IServerRepository, ServerConfigData } from '../ports/outbound/IServerRepository.js';
import type { IContainerRuntimePort } from '../ports/outbound/IContainerRuntimePort.js';
import type { IServerConsolePort } from '../ports/outbound/IServerConsolePort.js';
import type { PlayerListResult, ServerInfo } from '../../types/index.js';
import { ServerName } from '../../domain/value-objects/ServerName.js';

export interface GetServerSummariesOptions {
  /** Per-server wait for RCON `list`. Default 2000 ms. */
  timeoutMs?: number;
  /**
   * Per-server wait for container stats. Default 3000 ms: `docker stats
   * --no-stream` samples twice, so it often needs more than the RCON timeout.
   */
  statsTimeoutMs?: number;
  /** How long the players and stats of a running server are reused. Default 10000 ms. */
  ttlMs?: number;
  /** Clock for the TTL, in ms. Default Date.now. */
  now?: () => number;
}

const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_STATS_TIMEOUT_MS = 3000;
const DEFAULT_TTL_MS = 10_000;

/** Live data of one running server. */
interface Probe {
  players: PlayerListResult | null;
  stats?: ServerSummaryItem['stats'];
}

interface CacheEntry {
  startedAt: number;
  probe: Promise<Probe>;
}

/**
 * Server list summary (#764).
 *
 * Adds config.env fields (`IServerRepository.getConfig`) to every server, and
 * players (`IServerConsolePort.listPlayers`) and memory stats
 * (`IContainerRuntimePort.getStatsAsync`) to running servers. The probes of all
 * running servers run in parallel, each under its own timeout, so one hung
 * server costs at most the timeout and affects only itself.
 *
 * Probes are cached per server for `ttlMs` (failures too, so a hung server is
 * not hit on every poll) and shared by concurrent calls. A server seen not
 * running loses its cache entry. config.env is read on every call. Keep one
 * instance per process for the cache to apply.
 */
export class GetServerSummariesUseCase implements IGetServerSummariesUseCase {
  private readonly timeoutMs: number;
  private readonly statsTimeoutMs: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly serverRepository: Pick<IServerRepository, 'getConfig'>,
    private readonly runtime: Pick<IContainerRuntimePort, 'getStatsAsync'>,
    private readonly console: Pick<IServerConsolePort, 'listPlayers'>,
    options: GetServerSummariesOptions = {}
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.statsTimeoutMs = options.statsTimeoutMs ?? DEFAULT_STATS_TIMEOUT_MS;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.now = options.now ?? Date.now;
  }

  async execute(servers: ServerInfo[]): Promise<ServerSummariesResult> {
    const now = this.now();
    const running = new Set(servers.filter(isRunning).map((s) => s.name));
    for (const name of this.cache.keys()) {
      if (!running.has(name)) this.cache.delete(name);
    }

    const items = await Promise.all(servers.map((server) => this.summarize(server, now)));
    return { servers: items, totals: totalsOf(items) };
  }

  private async summarize(server: ServerInfo, now: number): Promise<ServerSummaryItem> {
    const [config, probe] = await Promise.all([
      this.readConfig(server.name),
      isRunning(server) ? this.probe(server.name, now) : undefined,
    ]);

    const item: ServerSummaryItem = { ...server };
    if (config) {
      item.type = config.type;
      item.version = config.version;
      if (config.memory !== undefined) item.memory = config.memory;
    }
    if (probe) {
      item.players = probe.players;
      if (probe.stats) item.stats = probe.stats;
    }
    return item;
  }

  private async readConfig(name: string): Promise<ServerConfigData | null> {
    try {
      return await this.serverRepository.getConfig(name);
    } catch {
      return null;
    }
  }

  private probe(name: string, now: number): Promise<Probe> {
    const cached = this.cache.get(name);
    if (cached && now - cached.startedAt < this.ttlMs) return cached.probe;

    const probe = this.runProbe(name);
    this.cache.set(name, { startedAt: now, probe });
    return probe;
  }

  /** Never rejects. */
  private async runProbe(name: string): Promise<Probe> {
    let server: ServerName;
    try {
      server = ServerName.fromExisting(name);
    } catch {
      return { players: null };
    }

    const [players, stats] = await Promise.all([
      settle(() => this.console.listPlayers(server), this.timeoutMs),
      settle(() => this.runtime.getStatsAsync(server), this.statsTimeoutMs),
    ]);

    const probe: Probe = { players: players ?? null };
    if (stats) probe.stats = { memoryUsage: stats.memoryUsage, memoryLimit: stats.memoryLimit };
    return probe;
  }
}

function isRunning(server: ServerInfo): boolean {
  return server.status === 'running';
}

/** The result of `start()`, or undefined when it throws, rejects or takes longer than `ms`. */
async function settle<T>(start: () => Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
  });
  try {
    return await Promise.race([start(), timeout]);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

function totalsOf(items: ServerSummaryItem[]): ServerSummaryTotals {
  const totals: ServerSummaryTotals = { playersOnline: 0, playersMax: 0, running: 0 };
  for (const item of items) {
    if (item.status === 'running') totals.running += 1;
    if (item.players) {
      totals.playersOnline += item.players.online;
      totals.playersMax += item.players.max;
    }
  }
  return totals;
}
