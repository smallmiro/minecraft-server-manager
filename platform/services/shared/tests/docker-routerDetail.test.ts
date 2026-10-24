/**
 * getRouterDetailInfo / getRouterDetailInfoAsync (#768): router image,
 * auto-scale settings, resolver addresses and per-route auto-scale and
 * discovery, on top of the existing route list.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
  execFileSync: vi.fn(),
  execSync: vi.fn(),
  spawn: vi.fn(),
  execFile: vi.fn(),
}));

import { spawnSync } from 'node:child_process';
import { getRouterDetailInfo, getRouterDetailInfoAsync } from '../src/docker/index.js';
import type { IMcRouterApiPort, McRouterRoute } from '../src/application/ports/outbound/IMcRouterApiPort.js';

const exited = (status: number, stdout = '') => ({ status, stdout, stderr: '', error: undefined }) as never;

interface FakeDocker {
  routerStatus?: string;
  routerConfig?: object | null;
  containers?: Record<string, { status?: string; labels: Record<string, string> | null }>;
}

/** spawnSync fake answering the docker/curl argv the router composite issues. */
function fakeDocker(fake: FakeDocker) {
  const containers = fake.containers ?? {};
  vi.mocked(spawnSync).mockImplementation(((cmd: string, args: string[]) => {
    if (cmd === 'curl') return exited(0, '200');
    if (cmd !== 'docker') return exited(1);
    if (args[0] === 'ps') return exited(0, ['mc-router', ...Object.keys(containers)].join('\n'));
    const format = args[2];
    const name = args[args.length - 1];
    if (name === 'mc-router') {
      if (fake.routerStatus === undefined) return exited(1);
      if (format === '{{.State.Status}}') return exited(0, fake.routerStatus);
      if (format === '{{.State.StartedAt}}') return exited(0, new Date(Date.now() - 65_000).toISOString());
      if (format === '{{json .Config}}') {
        return fake.routerConfig === null ? exited(1) : exited(0, JSON.stringify(fake.routerConfig ?? {}));
      }
      return exited(1);
    }
    const container = containers[name];
    if (!container) return exited(1);
    if (format === '{{.State.Status}}') return exited(0, container.status ?? 'running');
    if (format === '{{json .Config.Labels}}') return exited(0, JSON.stringify(container.labels));
    if (format === '{{index .Config.Labels "mc-router.host"}}') return exited(0, container.labels?.['mc-router.host'] ?? '');
    return exited(1);
  }) as never);
}

const ROUTER_CONFIG = {
  Image: 'itzg/mc-router:1.47.1',
  Env: [
    'IN_DOCKER=true',
    'AUTO_SCALE_UP=true',
    'AUTO_SCALE_DOWN=false',
    'AUTO_SCALE_DOWN_AFTER=10m',
    'AUTO_SCALE_ASLEEP_MOTD=§eAsleep\\n§7Join to wake',
  ],
};

const CONTAINERS = {
  'mc-alpha': {
    labels: {
      'mc-router.host': 'alpha.local,Alpha.192.168.1.10.nip.io',
      'mc-router.auto-scale-down': 'true',
    },
  },
  'mc-beta': { status: 'exited', labels: { 'mc-router.host': 'beta.local', 'mc-router.auto-scale-up': 'bogus' } },
  'mc-nohost': { labels: { other: 'x' } },
  'mc-null': { labels: null },
};

let root: string;

beforeEach(() => {
  vi.resetAllMocks();
  root = mkdtempSync(join(tmpdir(), 'router-detail-'));
  vi.stubEnv('MCCTL_ROOT', root);
  mkdirSync(join(root, 'servers', 'alpha'), { recursive: true });
  writeFileSync(join(root, 'servers', 'alpha', 'config.env'), 'TYPE=PAPER\nVERSION=1.21.1\n');
  writeFileSync(join(root, '.env'), 'HOST_IP=192.168.1.10\nHOST_IPS=192.168.1.10,100.64.0.5\n');
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe('getRouterDetailInfo (#768)', () => {
  it('adds the router image, auto-scale settings and resolver addresses', () => {
    fakeDocker({ routerStatus: 'running', routerConfig: ROUTER_CONFIG, containers: CONTAINERS });
    const info = getRouterDetailInfo();
    expect(info).toMatchObject({
      name: 'mc-router',
      status: 'running',
      mode: '--in-docker (auto-discovery)',
      image: 'itzg/mc-router:1.47.1',
      autoScale: { up: true, down: false, downAfter: '10m', asleepMotd: '§eAsleep\\n§7Join to wake' },
      resolver: { hostIp: '192.168.1.10', hostIps: ['192.168.1.10', '100.64.0.5'] },
    });
    expect(info.uptimeSeconds).toBeGreaterThanOrEqual(60);
  });

  it('builds routes from one label inspect per container with effective auto-scale', () => {
    fakeDocker({ routerStatus: 'running', routerConfig: ROUTER_CONFIG, containers: CONTAINERS });
    expect(getRouterDetailInfo().routes).toEqual([
      {
        hostname: 'alpha.local',
        target: 'mc-alpha:25565',
        serverStatus: 'running',
        serverType: 'PAPER',
        serverVersion: '1.21.1',
        autoScaleUp: true,
        autoScaleDown: true,
      },
      {
        hostname: 'Alpha.192.168.1.10.nip.io',
        target: 'mc-alpha:25565',
        serverStatus: 'running',
        serverType: 'PAPER',
        serverVersion: '1.21.1',
        autoScaleUp: true,
        autoScaleDown: true,
      },
      {
        hostname: 'beta.local',
        target: 'mc-beta:25565',
        serverStatus: 'exited',
        serverType: undefined,
        serverVersion: undefined,
        autoScaleUp: true,
        autoScaleDown: false,
      },
    ]);
    const labelCalls = vi
      .mocked(spawnSync)
      .mock.calls.filter(([, args]) => (args as string[])[2] === '{{json .Config.Labels}}');
    expect(labelCalls).toHaveLength(4);
  });

  it('leaves router fields and route auto-scale out when the router is missing, unless a label is valid', () => {
    fakeDocker({ containers: CONTAINERS });
    const info = getRouterDetailInfo();
    expect(info.status).toBe('not_found');
    expect(info.image).toBeUndefined();
    expect(info.autoScale).toBeUndefined();
    const alpha = info.routes.find((r) => r.hostname === 'alpha.local')!;
    expect('autoScaleUp' in alpha).toBe(false);
    expect(alpha.autoScaleDown).toBe(true);
    const beta = info.routes.find((r) => r.hostname === 'beta.local')!;
    expect('autoScaleUp' in beta).toBe(false);
    expect('autoScaleDown' in beta).toBe(false);
  });

  it('reads auto-scale from a stopped router too', () => {
    fakeDocker({ routerStatus: 'exited', routerConfig: { Image: 'itzg/mc-router', Env: [] }, containers: {} });
    const info = getRouterDetailInfo();
    expect(info.image).toBe('itzg/mc-router');
    expect(info.autoScale).toEqual({ up: false, down: false });
    expect(info.uptime).toBeUndefined();
  });

  it('omits resolver when the platform .env is unreadable', () => {
    rmSync(join(root, '.env'));
    fakeDocker({ routerStatus: 'running', routerConfig: ROUTER_CONFIG, containers: {} });
    expect(getRouterDetailInfo().resolver).toBeUndefined();
  });
});

describe('getRouterDetailInfoAsync (#768)', () => {
  const api = (routes: Record<string, McRouterRoute> | null): IMcRouterApiPort & { calls: number } => {
    const fake = {
      calls: 0,
      async listRoutes() {
        fake.calls++;
        return routes === null ? null : new Map(Object.entries(routes));
      },
    };
    return fake;
  };

  it('marks routes mc-router lists (case-insensitive)', async () => {
    fakeDocker({ routerStatus: 'running', routerConfig: ROUTER_CONFIG, containers: CONTAINERS });
    const info = await getRouterDetailInfoAsync({
      routerApi: api({ 'alpha.local': { backend: 'mc-alpha:25565' }, 'alpha.192.168.1.10.nip.io': { backend: 'mc-alpha:25565' } }),
    });
    expect(info.routes.map((r) => [r.hostname, r.discoveredByRouter])).toEqual([
      ['alpha.local', true],
      ['Alpha.192.168.1.10.nip.io', true],
      ['beta.local', false],
    ]);
    expect(info.image).toBe('itzg/mc-router:1.47.1');
  });

  it('leaves discoveredByRouter undefined when the API answer is unknown', async () => {
    fakeDocker({ routerStatus: 'running', routerConfig: ROUTER_CONFIG, containers: CONTAINERS });
    const info = await getRouterDetailInfoAsync({ routerApi: api(null) });
    expect(info.routes).toHaveLength(3);
    expect(info.routes.every((r) => !('discoveredByRouter' in r))).toBe(true);
  });

  it('does not call the API when the router is not running', async () => {
    fakeDocker({ routerStatus: 'exited', routerConfig: ROUTER_CONFIG, containers: CONTAINERS });
    const routerApi = api({ 'alpha.local': { backend: 'mc-alpha:25565' } });
    const info = await getRouterDetailInfoAsync({ routerApi });
    expect(routerApi.calls).toBe(0);
    expect(info.routes.every((r) => !('discoveredByRouter' in r))).toBe(true);
  });
});

describe('package exports (#768)', () => {
  it('exports the router detail functions and adapter from the package root', async () => {
    const shared = await import('../src/index.js');
    expect(shared.getRouterDetailInfoAsync).toBe(getRouterDetailInfoAsync);
    expect(typeof shared.getRouterDetailInfo).toBe('function');
    expect(typeof shared.McRouterApiAdapter).toBe('function');
    expect(typeof shared.parseRouterAutoScaleEnv).toBe('function');
  });
});
