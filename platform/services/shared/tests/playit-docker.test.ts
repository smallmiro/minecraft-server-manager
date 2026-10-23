import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
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
    });
  });

  describe('stopPlayitAgent', () => {
    test('should execute docker compose command to stop playit-agent', async () => {
      // This test validates the function exists and returns a boolean
      const result = await dockerHelpers.stopPlayitAgent();
      expect(typeof result).toBe('boolean');
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

  describe('setServerPlayitDomain', () => {
    const testServersDir = join(process.cwd(), 'tests', '.tmp-playit-domain');

    beforeEach(() => {
      if (existsSync(testServersDir)) {
        rmSync(testServersDir, { recursive: true, force: true });
      }
      mkdirSync(join(testServersDir, 'survival'), { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testServersDir)) {
        rmSync(testServersDir, { recursive: true, force: true });
      }
    });

    test('should add PLAYIT_DOMAIN to config.env when not present', () => {
      const configPath = join(testServersDir, 'survival', 'config.env');
      writeFileSync(configPath, 'TYPE=PAPER\nVERSION=1.21.1\nMEMORY=4G\n', 'utf-8');

      dockerHelpers.setServerPlayitDomain('survival', 'test.example.playit.gg', testServersDir);

      const content = readFileSync(configPath, 'utf-8');
      expect(content.includes('PLAYIT_DOMAIN=test.example.playit.gg')).toBeTruthy();
      // Original content preserved
      expect(content.includes('TYPE=PAPER')).toBeTruthy();
      expect(content.includes('VERSION=1.21.1')).toBeTruthy();
    });

    test('should update existing PLAYIT_DOMAIN in config.env', () => {
      const configPath = join(testServersDir, 'survival', 'config.env');
      writeFileSync(configPath, 'TYPE=PAPER\nPLAYIT_DOMAIN=old.domain.com\nMEMORY=4G\n', 'utf-8');

      dockerHelpers.setServerPlayitDomain('survival', 'new.domain.com', testServersDir);

      const content = readFileSync(configPath, 'utf-8');
      expect(content.includes('PLAYIT_DOMAIN=new.domain.com')).toBeTruthy();
      expect(!content.includes('old.domain.com')).toBeTruthy();
      // Only one PLAYIT_DOMAIN line
      const matches = content.match(/PLAYIT_DOMAIN/g);
      expect(matches?.length).toBe(1);
    });

    test('should remove PLAYIT_DOMAIN when domain is null', () => {
      const configPath = join(testServersDir, 'survival', 'config.env');
      writeFileSync(configPath, 'TYPE=PAPER\n\n# playit.gg External Domain\nPLAYIT_DOMAIN=test.domain.com\nMEMORY=4G\n', 'utf-8');

      dockerHelpers.setServerPlayitDomain('survival', null, testServersDir);

      const content = readFileSync(configPath, 'utf-8');
      expect(!content.includes('PLAYIT_DOMAIN')).toBeTruthy();
      expect(content.includes('TYPE=PAPER')).toBeTruthy();
      expect(content.includes('MEMORY=4G')).toBeTruthy();
    });

    // config.env is the container's env_file: a line break adds a setting (#726)
    test.each(['x.example.com\nMODS=http://evil/x.jar', 'x.example.com\r', 'x\u0000y'])(
      'should reject %j without writing config.env',
      (domain) => {
        const configPath = join(testServersDir, 'survival', 'config.env');
        writeFileSync(configPath, 'TYPE=PAPER\n', 'utf-8');

        expect(() => dockerHelpers.setServerPlayitDomain('survival', domain, testServersDir)).toThrow();
        expect(readFileSync(configPath, 'utf-8')).toBe('TYPE=PAPER\n');
      }
    );

    test('should throw when server config.env does not exist', () => {
      expect(() => {
        dockerHelpers.setServerPlayitDomain('nonexistent', 'test.domain.com', testServersDir);
      }).toThrow();
    });

    test('should be readable by getServerPlayitDomain after setting', () => {
      const configPath = join(testServersDir, 'survival', 'config.env');
      writeFileSync(configPath, 'TYPE=PAPER\n', 'utf-8');

      dockerHelpers.setServerPlayitDomain('survival', 'roundtrip.example.com', testServersDir);

      const domain = dockerHelpers.getServerPlayitDomain('survival', testServersDir);
      expect(domain).toBe('roundtrip.example.com');
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

  test('replaceRouterHosts rewrites only the label value', () => {
    const out = dockerHelpers.replaceRouterHosts(compose, ['a.local', 'b.playit.gg']);
    expect(out).toContain('mc-router.host: "a.local,b.playit.gg"');
    expect(out).toContain('mc-router.auto-scale-up: "true"');
  });

  test('replaceRouterHosts supports single quotes', () => {
    const out = dockerHelpers.replaceRouterHosts("      mc-router.host: 'x.local'\n", ['x.local', 'y.gg']);
    expect(out).toBe("      mc-router.host: 'x.local,y.gg'\n");
  });
});

describe('setServerPlayitDomain docker-compose label sync', () => {
  const dir = join(process.cwd(), 'tests', '.tmp-playit-label-sync');
  const configPath = join(dir, 'survival', 'config.env');
  const composePath = join(dir, 'survival', 'docker-compose.yml');
  const writeCompose = (hosts: string) =>
    writeFileSync(
      composePath,
      `services:\n  mc-survival:\n    labels:\n      mc-router.host: "${hosts}"\n      mc-router.auto-scale-up: "true"\n`,
      'utf-8'
    );
  const labelHosts = () => dockerHelpers.parseRouterHosts(readFileSync(composePath, 'utf-8'));

  beforeEach(() => {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, 'survival'), { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('replaces the old domain with the new one, keeping position', () => {
    writeFileSync(configPath, 'TYPE=PAPER\nPLAYIT_DOMAIN=old.craft.playit.gg\n', 'utf-8');
    writeCompose('survival.local,old.craft.playit.gg,custom.example.com');

    dockerHelpers.setServerPlayitDomain('survival', 'new.craft.playit.gg', dir);

    expect(labelHosts()).toEqual(['survival.local', 'new.craft.playit.gg', 'custom.example.com']);
    expect(dockerHelpers.getServerPlayitDomain('survival', dir)).toBe('new.craft.playit.gg');
  });

  test('appends the new domain when no previous domain was set', () => {
    writeFileSync(configPath, 'TYPE=PAPER\n', 'utf-8');
    writeCompose('survival.local,survival.192.168.1.10.nip.io');

    dockerHelpers.setServerPlayitDomain('survival', 'new.craft.playit.gg', dir);

    expect(labelHosts()).toEqual(['survival.local', 'survival.192.168.1.10.nip.io', 'new.craft.playit.gg']);
  });

  test('appends the new domain when the old one is not in the label', () => {
    writeFileSync(configPath, 'PLAYIT_DOMAIN=old.craft.playit.gg\n', 'utf-8');
    writeCompose('survival.local');

    dockerHelpers.setServerPlayitDomain('survival', 'new.craft.playit.gg', dir);

    expect(labelHosts()).toEqual(['survival.local', 'new.craft.playit.gg']);
  });

  test('removes the old domain from the label when domain is null', () => {
    writeFileSync(configPath, 'PLAYIT_DOMAIN=old.craft.playit.gg\n', 'utf-8');
    writeCompose('survival.local,old.craft.playit.gg,custom.example.com');

    dockerHelpers.setServerPlayitDomain('survival', null, dir);

    expect(labelHosts()).toEqual(['survival.local', 'custom.example.com']);
    expect(dockerHelpers.getServerPlayitDomain('survival', dir)).toBe(null);
  });

  test('does not duplicate when the new domain is already in the label', () => {
    writeFileSync(configPath, 'PLAYIT_DOMAIN=old.craft.playit.gg\n', 'utf-8');
    writeCompose('survival.local,old.craft.playit.gg,new.craft.playit.gg');

    dockerHelpers.setServerPlayitDomain('survival', 'new.craft.playit.gg', dir);

    expect(labelHosts()).toEqual(['survival.local', 'new.craft.playit.gg']);
  });

  test('setting the same domain again leaves the label unchanged', () => {
    writeFileSync(configPath, 'PLAYIT_DOMAIN=same.craft.playit.gg\n', 'utf-8');
    writeCompose('survival.local,same.craft.playit.gg');

    dockerHelpers.setServerPlayitDomain('survival', 'same.craft.playit.gg', dir);

    expect(labelHosts()).toEqual(['survival.local', 'same.craft.playit.gg']);
  });

  test('leaves other labels and hosts untouched', () => {
    writeFileSync(configPath, 'PLAYIT_DOMAIN=old.craft.playit.gg\n', 'utf-8');
    writeCompose('survival.local,survival.192.168.1.10.nip.io,old.craft.playit.gg');

    dockerHelpers.setServerPlayitDomain('survival', 'new.craft.playit.gg', dir);

    const content = readFileSync(composePath, 'utf-8');
    expect(content).toContain('mc-router.auto-scale-up: "true"');
    expect(labelHosts()).toEqual(['survival.local', 'survival.192.168.1.10.nip.io', 'new.craft.playit.gg']);
  });

  test('updates only config.env when docker-compose.yml is missing', () => {
    writeFileSync(configPath, 'TYPE=PAPER\n', 'utf-8');

    expect(() => dockerHelpers.setServerPlayitDomain('survival', 'new.craft.playit.gg', dir)).not.toThrow();

    expect(existsSync(composePath)).toBe(false);
    expect(dockerHelpers.getServerPlayitDomain('survival', dir)).toBe('new.craft.playit.gg');
  });

  test('updates only config.env when the label is missing', () => {
    writeFileSync(configPath, 'TYPE=PAPER\n', 'utf-8');
    const original = 'services:\n  mc-survival:\n    image: itzg/minecraft-server\n';
    writeFileSync(composePath, original, 'utf-8');

    dockerHelpers.setServerPlayitDomain('survival', 'new.craft.playit.gg', dir);

    expect(readFileSync(composePath, 'utf-8')).toBe(original);
    expect(dockerHelpers.getServerPlayitDomain('survival', dir)).toBe('new.craft.playit.gg');
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
