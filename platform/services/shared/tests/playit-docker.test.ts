import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, mkdtempSync, chmodSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type {
  PlayitAgentStatus,
  PlayitServerInfo,
} from '../src/types/index.js';
import * as dockerHelpers from '../src/docker/index.js';

// Mock data for spawnSync responses
const mockSpawnSync = vi.fn();

describe('PlayitAgentStatus interface', () => {
  test('should define PlayitAgentStatus with all required properties', () => {
    // TypeScript compile check - this validates the interface exists
    const status: PlayitAgentStatus = {
      enabled: true,
      agentRunning: true,
      secretKeyConfigured: true,
      containerStatus: 'running',
      uptime: '2h 30m',
      uptimeSeconds: 9000,
    };

    expect(status.enabled).toBe(true);
    expect(status.agentRunning).toBe(true);
    expect(status.secretKeyConfigured).toBe(true);
    expect(status.containerStatus).toBe('running');
    expect(status.uptime).toBe('2h 30m');
    expect(status.uptimeSeconds).toBe(9000);
  });

  test('should allow optional uptime fields', () => {
    const status: PlayitAgentStatus = {
      enabled: false,
      agentRunning: false,
      secretKeyConfigured: false,
      containerStatus: 'exited',
    };

    expect(status.uptime).toBe(undefined);
    expect(status.uptimeSeconds).toBe(undefined);
  });
});

describe('PlayitServerInfo interface', () => {
  test('should define PlayitServerInfo with all required properties', () => {
    const serverInfo: PlayitServerInfo = {
      serverName: 'survival',
      playitDomain: 'survival-abc123.playit.gg',
      lanHostname: 'survival.192.168.1.10.nip.io',
    };

    expect(serverInfo.serverName).toBe('survival');
    expect(serverInfo.playitDomain).toBe('survival-abc123.playit.gg');
    expect(serverInfo.lanHostname).toBe('survival.192.168.1.10.nip.io');
  });

  test('should allow null playitDomain', () => {
    const serverInfo: PlayitServerInfo = {
      serverName: 'creative',
      playitDomain: null,
      lanHostname: 'creative.local',
    };

    expect(serverInfo.serverName).toBe('creative');
    expect(serverInfo.playitDomain).toBe(null);
    expect(serverInfo.lanHostname).toBe('creative.local');
  });
});

describe('Docker helper functions for playit.gg', () => {
  // These helpers run docker against the platform root. Point both at a temp
  // root and a fake `docker` that only records its argv and cwd, so the tests
  // never start or stop the host's real playit-agent (#756).
  let root: string;
  let calls: string;
  const savedEnv = { root: process.env['MCCTL_ROOT'], path: process.env['PATH'] };
  const dockerCalls = (): string[] =>
    existsSync(calls) ? readFileSync(calls, 'utf8').split('\n').filter(Boolean) : [];

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'playit-root-')));
    const bin = join(root, 'bin');
    mkdirSync(bin);
    calls = join(root, 'docker-calls.log');
    writeFileSync(join(bin, 'docker'), `#!/bin/sh\necho "$PWD :: $*" >> "${calls}"\nexit 0\n`);
    chmodSync(join(bin, 'docker'), 0o755);
    process.env['MCCTL_ROOT'] = root;
    process.env['PATH'] = `${bin}:${savedEnv.path}`;
  });

  afterEach(() => {
    if (savedEnv.root === undefined) delete process.env['MCCTL_ROOT'];
    else process.env['MCCTL_ROOT'] = savedEnv.root;
    process.env['PATH'] = savedEnv.path;
    rmSync(root, { recursive: true, force: true });
  });

  describe('getPlayitAgentStatus', () => {
    test('should return status when playit-agent container is running', async () => {
      // This test will validate the function exists and returns the correct type
      // Implementation will use docker inspect to check container status
      const status = await dockerHelpers.getPlayitAgentStatus();

      expect('enabled' in status).toBeTruthy();
      expect('agentRunning' in status).toBeTruthy();
      expect('secretKeyConfigured' in status).toBeTruthy();
      expect('containerStatus' in status).toBeTruthy();
      expect(typeof status.enabled).toBe('boolean');
      expect(typeof status.agentRunning).toBe('boolean');
      expect(typeof status.secretKeyConfigured).toBe('boolean');
      expect(typeof status.containerStatus).toBe('string');
    });
  });

  describe('startPlayitAgent', () => {
    test('should execute docker compose command to start playit-agent', async () => {
      // This test validates the function exists and returns { success, error? }
      const result = await dockerHelpers.startPlayitAgent();
      expect(typeof result).toBe('object');
      expect('success' in result).toBeTruthy();
      expect(typeof result.success).toBe('boolean');
      expect(dockerCalls()).toContain(`${root} :: compose --profile playit up -d playit`);
    });
  });

  describe('stopPlayitAgent', () => {
    test('should execute docker compose command to stop playit-agent', async () => {
      // This test validates the function exists and returns a boolean
      const result = await dockerHelpers.stopPlayitAgent();
      expect(typeof result).toBe('boolean');
      expect(dockerCalls()).toContain(`${root} :: compose --profile playit stop playit`);
    });
  });

  describe('getServerPlayitDomain', () => {
    test('should read playit domain from server config.env', () => {
      // This test validates the function exists and returns correct type
      const domain = dockerHelpers.getServerPlayitDomain('test-server');
      expect(domain === null || typeof domain === 'string').toBeTruthy();
    });

    test('should return null if PLAYIT_DOMAIN is not set', () => {
      const domain = dockerHelpers.getServerPlayitDomain('nonexistent-server');
      expect(domain).toBe(null);
    });
  });
});

describe('mc-router.host label helpers', () => {
  const compose = `services:
  mc-survival:
    labels:
      mc-router.host: "survival.local, survival.192.168.1.10.nip.io,old.craft.playit.gg"
      mc-router.auto-scale-up: "true"
`;

  test('parseRouterHosts returns trimmed host list', () => {
    expect(dockerHelpers.parseRouterHosts(compose)).toEqual([
      'survival.local',
      'survival.192.168.1.10.nip.io',
      'old.craft.playit.gg',
    ]);
  });

  test('parseRouterHosts returns [] when label is missing', () => {
    expect(dockerHelpers.parseRouterHosts('services:\n  mc-x:\n    image: foo\n')).toEqual([]);
  });
});

describe('resolvePlayitDomain', () => {
  const { resolvePlayitDomain } = dockerHelpers;

  test('keeps current domain when it is still in the list', () => {
    expect(resolvePlayitDomain('a.playit.gg', ['a.playit.gg'], ['a.playit.gg', 'x.example.com'])).toBe('a.playit.gg');
  });

  test('matches current domain case-insensitively', () => {
    expect(resolvePlayitDomain('A.Playit.gg', ['a.playit.gg'], ['a.playit.gg'])).toBe('A.Playit.gg');
  });

  test('adopts the single newly added host when current was replaced', () => {
    expect(resolvePlayitDomain('a.playit.gg', ['a.playit.gg', 'x.example.com'], ['x.example.com', 'b.playit.gg'])).toBe(
      'b.playit.gg'
    );
  });

  test('returns null when current was removed and nothing was added', () => {
    expect(resolvePlayitDomain('a.playit.gg', ['a.playit.gg', 'x.example.com'], ['x.example.com'])).toBe(null);
  });

  test('returns null when current was removed and 2+ hosts were added', () => {
    expect(resolvePlayitDomain('a.playit.gg', ['a.playit.gg'], ['b.playit.gg', 'c.playit.gg'])).toBe(null);
  });

  test('keeps current domain that was never in the label (set before label sync)', () => {
    // one unrelated host added
    expect(resolvePlayitDomain('a.playit.gg', [], ['x.example.com'])).toBe('a.playit.gg');
    // no-op save / removals only
    expect(resolvePlayitDomain('a.playit.gg', ['x.example.com'], [])).toBe('a.playit.gg');
  });

  test('returns null when no domain was set (does not promote new custom hosts)', () => {
    expect(resolvePlayitDomain(null, [], ['x.example.com'])).toBe(null);
  });
});
