import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FastifyBaseLogger } from 'fastify';
import type { ContainerStatus, IPlayerSessionUseCase } from '@minecraft-docker/shared';
import { getContainerName } from '../lib/rcon.js';

const execFileAsync = promisify(execFile);

/** Collection interval (#528, Phase 4). */
export const COLLECTOR_TICK_INTERVAL_MS = 30_000;
// ponytail: fixed 24h lookback on first run (no cursor) instead of resolving the
// container's actual start time via a second `docker inspect` call per server.
// Upgrade to container-start-time if 24h ever misses a session on a long-idle server.
const INITIAL_LOOKBACK = '24h';

/** Fetches `docker logs --timestamps` lines for a container. Injectable for tests. */
export type LogFetcher = (container: string, since: string) => Promise<string[]>;

const defaultLogFetcher: LogFetcher = async (container, since) => {
  const { stdout } = await execFileAsync(
    'docker',
    ['logs', '--timestamps', '--since', since, container],
    { timeout: 10_000, maxBuffer: 10 * 1024 * 1024 }
  );
  return stdout.split('\n').filter(Boolean);
};

/**
 * Background collector that feeds each defined server's log lines into
 * `IPlayerSessionUseCase.ingestLogLines` every 30s, and closes any open
 * sessions when a server isn't running (#528, Phase 4).
 *
 * All I/O is injected so `tick()` is unit-testable without Docker.
 */
export class PlayerSessionCollectorService {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly sessions: IPlayerSessionUseCase,
    private readonly listServerNames: () => string[],
    private readonly getStatus: (container: string) => ContainerStatus,
    private readonly getCursor: (serverName: string) => Promise<Date | null>,
    private readonly fetchLogs: LogFetcher = defaultLogFetcher,
    private readonly logger?: Pick<FastifyBaseLogger, 'warn'>
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, COLLECTOR_TICK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** One collection pass across every defined server. */
  async tick(): Promise<void> {
    for (const serverName of this.listServerNames()) {
      try {
        await this.collectServer(serverName);
      } catch (error) {
        this.logger?.warn(error, `Player session collection failed for server '${serverName}'`);
      }
    }
  }

  private async collectServer(serverName: string): Promise<void> {
    const container = getContainerName(serverName);

    if (this.getStatus(container) !== 'running') {
      await this.sessions.markServerStopped(serverName, new Date());
      return;
    }

    const cursor = await this.getCursor(serverName);
    const since = cursor ? cursor.toISOString() : INITIAL_LOOKBACK;
    const lines = await this.fetchLogs(container, since);
    await this.sessions.ingestLogLines(serverName, lines);
  }
}

export { defaultLogFetcher };
