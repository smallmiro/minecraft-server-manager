import { test, describe, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import type {
  PlayitAgentStatus,
  PlayitServerInfo,
} from '../src/types/index.js';
import * as dockerHelpers from '../src/docker/index.js';

// Mock data for spawnSync responses
const mockSpawnSync = mock.fn();

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

    assert.strictEqual(status.enabled, true);
    assert.strictEqual(status.agentRunning, true);
    assert.strictEqual(status.secretKeyConfigured, true);
    assert.strictEqual(status.containerStatus, 'running');
    assert.strictEqual(status.uptime, '2h 30m');
    assert.strictEqual(status.uptimeSeconds, 9000);
  });

  test('should allow optional uptime fields', () => {
    const status: PlayitAgentStatus = {
      enabled: false,
      agentRunning: false,
      secretKeyConfigured: false,
      containerStatus: 'exited',
    };

    assert.strictEqual(status.uptime, undefined);
    assert.strictEqual(status.uptimeSeconds, undefined);
  });
});

describe('PlayitServerInfo interface', () => {
  test('should define PlayitServerInfo with all required properties', () => {
    const serverInfo: PlayitServerInfo = {
      serverName: 'survival',
      playitDomain: 'survival-abc123.playit.gg',
      lanHostname: 'survival.192.168.1.10.nip.io',
    };

    assert.strictEqual(serverInfo.serverName, 'survival');
    assert.strictEqual(serverInfo.playitDomain, 'survival-abc123.playit.gg');
    assert.strictEqual(serverInfo.lanHostname, 'survival.192.168.1.10.nip.io');
  });

  test('should allow null playitDomain', () => {
    const serverInfo: PlayitServerInfo = {
      serverName: 'creative',
      playitDomain: null,
      lanHostname: 'creative.local',
    };

    assert.strictEqual(serverInfo.serverName, 'creative');
    assert.strictEqual(serverInfo.playitDomain, null);
    assert.strictEqual(serverInfo.lanHostname, 'creative.local');
  });
});

describe('Docker helper functions for playit.gg', () => {
  describe('getPlayitAgentStatus', () => {
    test('should return status when playit-agent container is running', async () => {
      // This test will validate the function exists and returns the correct type
      // Implementation will use docker inspect to check container status
      const status = await dockerHelpers.getPlayitAgentStatus();

      assert.ok('enabled' in status);
      assert.ok('agentRunning' in status);
      assert.ok('secretKeyConfigured' in status);
      assert.ok('containerStatus' in status);
      assert.strictEqual(typeof status.enabled, 'boolean');
      assert.strictEqual(typeof status.agentRunning, 'boolean');
      assert.strictEqual(typeof status.secretKeyConfigured, 'boolean');
      assert.strictEqual(typeof status.containerStatus, 'string');
    });
  });

  describe('startPlayitAgent', () => {
    test('should execute docker compose command to start playit-agent', async () => {
      // This test validates the function exists and returns a boolean
      const result = await dockerHelpers.startPlayitAgent();
      assert.strictEqual(typeof result, 'boolean');
    });
  });

  describe('stopPlayitAgent', () => {
    test('should execute docker compose command to stop playit-agent', async () => {
      // This test validates the function exists and returns a boolean
      const result = await dockerHelpers.stopPlayitAgent();
      assert.strictEqual(typeof result, 'boolean');
    });
  });

  describe('getServerPlayitDomain', () => {
    test('should read playit domain from server config.env', () => {
      // This test validates the function exists and returns correct type
      const domain = dockerHelpers.getServerPlayitDomain('test-server');
      assert.ok(domain === null || typeof domain === 'string');
    });

    test('should return null if PLAYIT_DOMAIN is not set', () => {
      const domain = dockerHelpers.getServerPlayitDomain('nonexistent-server');
      assert.strictEqual(domain, null);
    });
  });
});
