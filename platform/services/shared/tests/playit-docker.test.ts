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
