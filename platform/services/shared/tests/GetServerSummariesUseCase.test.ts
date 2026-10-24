import { describe, it, expect, vi, afterEach } from 'vitest';
import { GetServerSummariesUseCase } from '../src/application/use-cases/GetServerSummariesUseCase.js';
import type {
  IContainerRuntimePort,
  IServerConsolePort,
  IServerRepository,
  ServerConfigData,
} from '../src/application/ports/index.js';
import type { ContainerStats, ContainerStatus, PlayerListResult, ServerInfo } from '../src/types/index.js';
import type { ServerName } from '../src/domain/value-objects/ServerName.js';

/** A probe answer: a value, a rejection, or a promise that never settles. */
type Answer<T> = T | 'hang' | 'throw';

const nameOf = (name: ServerName | string): string => (typeof name === 'string' ? name : name.value);

function answer<T>(value: Answer<T> | undefined, fallback: T): Promise<T> {
  if (value === 'hang') return new Promise<T>(() => {});
  if (value === 'throw') return Promise.reject(new Error('probe failed'));
  return Promise.resolve(value === undefined ? fallback : value);
}

function fakeConsole(players: Record<string, Answer<PlayerListResult | null>>) {
  const listPlayers = vi.fn((name: ServerName | string) => answer(players[nameOf(name)], null));
  return { port: { listPlayers } as Pick<IServerConsolePort, 'listPlayers'>, listPlayers };
}

function fakeRuntime(stats: Record<string, Answer<ContainerStats | null>>) {
  const getStatsAsync = vi.fn((name: ServerName | string) => answer(stats[nameOf(name)], null));
  return { port: { getStatsAsync } as Pick<IContainerRuntimePort, 'getStatsAsync'>, getStatsAsync };
}

function fakeConfig(configs: Record<string, Partial<ServerConfigData> | null>) {
  const getConfig = vi.fn(async (name: string): Promise<ServerConfigData | null> => {
    const config = configs[name];
    return config ? { name, type: 'PAPER', version: 'LATEST', ...config } : null;
  });
  return { port: { getConfig } as Pick<IServerRepository, 'getConfig'>, getConfig };
}

/** A base list item as getServerInfoFromConfig() builds it. */
function info(name: string, status: ContainerStatus): ServerInfo {
  if (status === 'not_created') {
    return { name, container: `mc-${name}`, status, health: 'none', hostname: '-' };
  }
  return {
    name,
    container: `mc-${name}`,
    status,
    health: status === 'running' ? 'healthy' : 'none',
    hostname: `${name}.local`,
  };
}

const list = (online: number, max: number, players: string[] = []): PlayerListResult => ({ online, max, players });

const stats = (memoryUsage: number, memoryLimit: number): ContainerStats => ({
  memoryUsage,
  memoryLimit,
  memoryPercent: (memoryUsage / memoryLimit) * 100,
  cpuPercent: 12.5,
});

const GiB = 1024 ** 3;

afterEach(() => {
  vi.useRealTimers();
});

describe('GetServerSummariesUseCase', () => {
  it('adds config to every server and players/stats to running servers only', async () => {
    const config = fakeConfig({
      survival: { type: 'PAPER', version: '1.21.1', memory: '4G' },
      creative: { type: 'FABRIC', version: '1.20.4', memory: '2G' },
    });
    const console_ = fakeConsole({ survival: list(2, 20, ['Steve', 'Alex']) });
    const runtime = fakeRuntime({ survival: stats(2 * GiB, 4 * GiB) });
    const useCase = new GetServerSummariesUseCase(config.port, runtime.port, console_.port);

    const result = await useCase.execute([info('creative', 'exited'), info('survival', 'running')]);

    expect(result.servers).toEqual([
      {
        name: 'creative',
        container: 'mc-creative',
        status: 'exited',
        health: 'none',
        hostname: 'creative.local',
        type: 'FABRIC',
        version: '1.20.4',
        memory: '2G',
      },
      {
        name: 'survival',
        container: 'mc-survival',
        status: 'running',
        health: 'healthy',
        hostname: 'survival.local',
        type: 'PAPER',
        version: '1.21.1',
        memory: '4G',
        players: { online: 2, max: 20, players: ['Steve', 'Alex'] },
        stats: { memoryUsage: 2 * GiB, memoryLimit: 4 * GiB },
      },
    ]);
    expect(result.servers[0]).not.toHaveProperty('players');
    expect(result.servers[0]).not.toHaveProperty('stats');
    expect(console_.listPlayers).toHaveBeenCalledTimes(1);
    expect(runtime.getStatsAsync).toHaveBeenCalledTimes(1);
    // Probes take the server, which the adapter maps to its workload
    expect(nameOf(console_.listPlayers.mock.calls[0]![0])).toBe('survival');
    expect(typeof console_.listPlayers.mock.calls[0]![0]).not.toBe('string');
    expect(nameOf(runtime.getStatsAsync.mock.calls[0]![0])).toBe('survival');
  });

  it('keeps the base fields of the list as given, including a not_created server', async () => {
    const config = fakeConfig({ fresh: { type: 'VANILLA', version: '1.21.4' } });
    const console_ = fakeConsole({});
    const runtime = fakeRuntime({});
    const useCase = new GetServerSummariesUseCase(config.port, runtime.port, console_.port);

    const result = await useCase.execute([info('fresh', 'not_created')]);

    expect(result.servers).toEqual([
      {
        name: 'fresh',
        container: 'mc-fresh',
        status: 'not_created',
        health: 'none',
        hostname: '-',
        type: 'VANILLA',
        version: '1.21.4',
      },
    ]);
    expect(result.servers[0]).not.toHaveProperty('memory');
    expect(console_.listPlayers).not.toHaveBeenCalled();
    expect(runtime.getStatsAsync).not.toHaveBeenCalled();
  });

  it('leaves out config fields for a server without config.env', async () => {
    const useCase = new GetServerSummariesUseCase(
      fakeConfig({}).port,
      fakeRuntime({ orphan: stats(GiB, 2 * GiB) }).port,
      fakeConsole({ orphan: list(0, 10) }).port
    );

    const { servers } = await useCase.execute([info('orphan', 'running')]);

    expect(servers[0]).not.toHaveProperty('type');
    expect(servers[0]).not.toHaveProperty('version');
    expect(servers[0]).not.toHaveProperty('memory');
    expect(servers[0]!.players).toEqual(list(0, 10));
  });

  it.each<ContainerStatus>(['exited', 'paused', 'restarting', 'created', 'dead', 'not_found', 'not_created'])(
    'does not probe a %s server',
    async (status) => {
      const console_ = fakeConsole({ alpha: list(1, 20, ['Steve']) });
      const runtime = fakeRuntime({ alpha: stats(GiB, 2 * GiB) });
      const useCase = new GetServerSummariesUseCase(fakeConfig({}).port, runtime.port, console_.port);

      const { servers, totals } = await useCase.execute([info('alpha', status)]);

      expect(servers[0]).not.toHaveProperty('players');
      expect(servers[0]).not.toHaveProperty('stats');
      expect(console_.listPlayers).not.toHaveBeenCalled();
      expect(runtime.getStatsAsync).not.toHaveBeenCalled();
      expect(totals).toEqual({ playersOnline: 0, playersMax: 0, running: 0 });
    }
  );

  it.each(['null', 'throw'] as const)('isolates an RCON failure (%s) to its server', async (failure) => {
    const console_ = fakeConsole({
      alpha: failure === 'null' ? null : 'throw',
      beta: list(3, 10, ['a', 'b', 'c']),
    });
    const runtime = fakeRuntime({ alpha: stats(GiB, 2 * GiB), beta: stats(GiB, 4 * GiB) });
    const useCase = new GetServerSummariesUseCase(fakeConfig({}).port, runtime.port, console_.port);

    const { servers, totals } = await useCase.execute([info('alpha', 'running'), info('beta', 'running')]);

    expect(servers[0]!.players).toBeNull();
    expect(servers[0]!.stats).toEqual({ memoryUsage: GiB, memoryLimit: 2 * GiB });
    expect(servers[1]!.players).toEqual(list(3, 10, ['a', 'b', 'c']));
    expect(totals).toEqual({ playersOnline: 3, playersMax: 10, running: 2 });
  });

  it('gives a hung RCON server players: null after the default 2000 ms, without delaying the others', async () => {
    vi.useFakeTimers();
    const console_ = fakeConsole({ alpha: 'hang', beta: list(1, 20, ['Steve']) });
    const runtime = fakeRuntime({ alpha: stats(GiB, 2 * GiB), beta: stats(GiB, 2 * GiB) });
    const useCase = new GetServerSummariesUseCase(fakeConfig({}).port, runtime.port, console_.port);

    let settled = false;
    const pending = useCase.execute([info('alpha', 'running'), info('beta', 'running')]).finally(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(1999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);

    const { servers, totals } = await pending;
    expect(servers[0]!.players).toBeNull();
    expect(servers[0]!.stats).toEqual({ memoryUsage: GiB, memoryLimit: 2 * GiB });
    expect(servers[1]!.players).toEqual(list(1, 20, ['Steve']));
    expect(totals).toEqual({ playersOnline: 1, playersMax: 20, running: 2 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('takes the RCON timeout from the options', async () => {
    vi.useFakeTimers();
    const useCase = new GetServerSummariesUseCase(
      fakeConfig({}).port,
      fakeRuntime({ alpha: stats(GiB, 2 * GiB) }).port,
      fakeConsole({ alpha: 'hang' }).port,
      { timeoutMs: 50 }
    );

    const pending = useCase.execute([info('alpha', 'running')]);
    await vi.advanceTimersByTimeAsync(50);

    expect((await pending).servers[0]!.players).toBeNull();
  });

  it('runs the probes of all running servers in parallel', async () => {
    vi.useFakeTimers();
    const names = ['alpha', 'beta', 'gamma', 'delta'];
    const useCase = new GetServerSummariesUseCase(
      fakeConfig({}).port,
      fakeRuntime(Object.fromEntries(names.map((n) => [n, 'hang' as const]))).port,
      fakeConsole(Object.fromEntries(names.map((n) => [n, 'hang' as const]))).port,
      { timeoutMs: 100, statsTimeoutMs: 100 }
    );

    let settled = false;
    const pending = useCase.execute(names.map((n) => info(n, 'running'))).finally(() => {
      settled = true;
    });
    // Sequential probes would need 4 x 100 ms
    await vi.advanceTimersByTimeAsync(100);

    expect(settled).toBe(true);
    const { servers } = await pending;
    expect(servers.map((s) => s.players)).toEqual([null, null, null, null]);
  });

  it('leaves out stats that fail or time out, keeping the players', async () => {
    vi.useFakeTimers();
    const useCase = new GetServerSummariesUseCase(
      fakeConfig({}).port,
      fakeRuntime({ alpha: null, beta: 'throw', gamma: 'hang' }).port,
      fakeConsole({ alpha: list(1, 5), beta: list(2, 5), gamma: list(3, 5) }).port
    );

    let settled = false;
    const pending = useCase
      .execute([info('alpha', 'running'), info('beta', 'running'), info('gamma', 'running')])
      .finally(() => {
        settled = true;
      });
    await vi.advanceTimersByTimeAsync(2999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    const { servers, totals } = await pending;
    for (const server of servers) expect(server).not.toHaveProperty('stats');
    expect(servers.map((s) => s.players?.online)).toEqual([1, 2, 3]);
    expect(totals).toEqual({ playersOnline: 6, playersMax: 15, running: 3 });
  });

  it('sums players over the servers whose players are known and counts running servers', async () => {
    const useCase = new GetServerSummariesUseCase(
      fakeConfig({}).port,
      fakeRuntime({}).port,
      fakeConsole({ alpha: list(4, 20), beta: list(1, 10), gamma: null }).port
    );

    const { totals } = await useCase.execute([
      info('alpha', 'running'),
      info('beta', 'running'),
      info('gamma', 'running'),
      info('delta', 'exited'),
      info('epsilon', 'not_created'),
    ]);

    expect(totals).toEqual({ playersOnline: 5, playersMax: 30, running: 3 });
  });

  it('returns empty totals for an empty list', async () => {
    const useCase = new GetServerSummariesUseCase(fakeConfig({}).port, fakeRuntime({}).port, fakeConsole({}).port);

    expect(await useCase.execute([])).toEqual({
      servers: [],
      totals: { playersOnline: 0, playersMax: 0, running: 0 },
    });
  });

  describe('TTL cache', () => {
    function setup(options: { ttlMs?: number } = {}) {
      let now = 1_000_000;
      const console_ = fakeConsole({ alpha: list(1, 20, ['Steve']) });
      const runtime = fakeRuntime({ alpha: stats(GiB, 2 * GiB) });
      const config = fakeConfig({ alpha: { memory: '4G' } });
      const useCase = new GetServerSummariesUseCase(config.port, runtime.port, console_.port, {
        ...options,
        now: () => now,
      });
      return {
        useCase,
        console_,
        runtime,
        config,
        advance: (ms: number) => {
          now += ms;
        },
      };
    }

    it('reuses the probes of a running server for 10 s by default, then probes again', async () => {
      const { useCase, console_, runtime, advance } = setup();
      await useCase.execute([info('alpha', 'running')]);

      advance(9_999);
      console_.listPlayers.mockResolvedValue(list(2, 20, ['Steve', 'Alex']));
      const cached = await useCase.execute([info('alpha', 'running')]);
      expect(cached.servers[0]!.players).toEqual(list(1, 20, ['Steve']));
      expect(console_.listPlayers).toHaveBeenCalledTimes(1);
      expect(runtime.getStatsAsync).toHaveBeenCalledTimes(1);

      advance(1);
      const fresh = await useCase.execute([info('alpha', 'running')]);
      expect(fresh.servers[0]!.players).toEqual(list(2, 20, ['Steve', 'Alex']));
      expect(console_.listPlayers).toHaveBeenCalledTimes(2);
      expect(runtime.getStatsAsync).toHaveBeenCalledTimes(2);
    });

    it('takes the TTL from the options', async () => {
      const { useCase, console_, advance } = setup({ ttlMs: 500 });
      await useCase.execute([info('alpha', 'running')]);
      advance(500);
      await useCase.execute([info('alpha', 'running')]);

      expect(console_.listPlayers).toHaveBeenCalledTimes(2);
    });

    it('caches a failed probe too, so a hung server is not hit on every poll', async () => {
      const { useCase, console_, advance } = setup();
      console_.listPlayers.mockResolvedValueOnce(null);
      await useCase.execute([info('alpha', 'running')]);
      advance(1_000);

      const { servers } = await useCase.execute([info('alpha', 'running')]);
      expect(servers[0]!.players).toBeNull();
      expect(console_.listPlayers).toHaveBeenCalledTimes(1);
    });

    it('shares one in-flight probe between concurrent calls', async () => {
      const { useCase, console_, runtime } = setup();
      const [a, b] = await Promise.all([
        useCase.execute([info('alpha', 'running')]),
        useCase.execute([info('alpha', 'running')]),
      ]);

      expect(a.servers[0]!.players).toEqual(b.servers[0]!.players);
      expect(console_.listPlayers).toHaveBeenCalledTimes(1);
      expect(runtime.getStatsAsync).toHaveBeenCalledTimes(1);
    });

    it('drops the cached probes of a server that stopped, and probes it again once it runs', async () => {
      const { useCase, console_, advance } = setup();
      await useCase.execute([info('alpha', 'running')]);
      advance(1_000);

      const stopped = await useCase.execute([info('alpha', 'exited')]);
      expect(stopped.servers[0]).not.toHaveProperty('players');
      expect(stopped.totals).toEqual({ playersOnline: 0, playersMax: 0, running: 0 });

      advance(1_000);
      await useCase.execute([info('alpha', 'running')]);
      expect(console_.listPlayers).toHaveBeenCalledTimes(2);
    });

    it('reads config.env on every call', async () => {
      const { useCase, config, advance } = setup();
      await useCase.execute([info('alpha', 'running')]);
      advance(1_000);
      config.getConfig.mockResolvedValueOnce({ name: 'alpha', type: 'PAPER', version: 'LATEST', memory: '8G' });

      const { servers } = await useCase.execute([info('alpha', 'running')]);
      expect(servers[0]!.memory).toBe('8G');
      expect(config.getConfig).toHaveBeenCalledTimes(2);
    });
  });

  it('treats a config read failure as a server without config', async () => {
    const config = fakeConfig({});
    config.getConfig.mockRejectedValueOnce(new Error('EACCES'));
    const useCase = new GetServerSummariesUseCase(config.port, fakeRuntime({}).port, fakeConsole({}).port);

    const { servers } = await useCase.execute([info('alpha', 'exited')]);

    expect(servers[0]).toEqual(info('alpha', 'exited'));
  });

  it('gives players: null without probing when the name is not a usable server name', async () => {
    const console_ = fakeConsole({});
    const runtime = fakeRuntime({});
    const useCase = new GetServerSummariesUseCase(fakeConfig({}).port, runtime.port, console_.port);

    const { servers, totals } = await useCase.execute([info('../etc', 'running')]);

    expect(servers[0]!.players).toBeNull();
    expect(servers[0]).not.toHaveProperty('stats');
    expect(console_.listPlayers).not.toHaveBeenCalled();
    expect(runtime.getStatsAsync).not.toHaveBeenCalled();
    expect(totals.running).toBe(1);
  });
});

describe('GetServerSummariesUseCase package export', () => {
  it('is exported from the package root', async () => {
    const shared = await import('../src/index.js');
    expect(shared.GetServerSummariesUseCase).toBe(GetServerSummariesUseCase);
  });
});
