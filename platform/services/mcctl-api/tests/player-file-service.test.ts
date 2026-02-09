import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { PlayerFileService } from '../src/services/PlayerFileService.js';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-player-file-test');

function setupServer(serverName: string, files: Record<string, unknown>) {
  const dataDir = join(TEST_PLATFORM_PATH, 'servers', serverName, 'data');
  mkdirSync(dataDir, { recursive: true });

  for (const [filename, content] of Object.entries(files)) {
    writeFileSync(join(dataDir, filename), JSON.stringify(content, null, 2), 'utf-8');
  }
}

function setupConfigEnv(serverName: string, envContent: string) {
  const serverDir = join(TEST_PLATFORM_PATH, 'servers', serverName);
  mkdirSync(serverDir, { recursive: true });
  writeFileSync(join(serverDir, 'config.env'), envContent, 'utf-8');
}

describe('PlayerFileService', () => {
  let service: PlayerFileService;

  beforeEach(() => {
    mkdirSync(TEST_PLATFORM_PATH, { recursive: true });
    service = new PlayerFileService(TEST_PLATFORM_PATH);
  });

  afterEach(() => {
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
  });

  // ==================== getServerDataPath ====================

  describe('getServerDataPath', () => {
    it('should return correct data path for server', () => {
      const dataPath = service.getServerDataPath('test-server');
      expect(dataPath).toBe(join(TEST_PLATFORM_PATH, 'servers', 'test-server', 'data'));
    });
  });

  // ==================== readWhitelist ====================

  describe('readWhitelist', () => {
    it('should read whitelist.json and return player names', () => {
      setupServer('myserver', {
        'whitelist.json': [
          { uuid: '550e8400-e29b-41d4-a716-446655440000', name: 'Player1' },
          { uuid: '550e8400-e29b-41d4-a716-446655440001', name: 'Player2' },
        ],
      });

      const result = service.readWhitelist('myserver');
      expect(result.players).toEqual([
        { name: 'Player1', uuid: '550e8400-e29b-41d4-a716-446655440000' },
        { name: 'Player2', uuid: '550e8400-e29b-41d4-a716-446655440001' },
      ]);
      expect(result.total).toBe(2);
      expect(result.source).toBe('file');
    });

    it('should return empty list when whitelist.json does not exist', () => {
      setupServer('emptyserver', {});

      const result = service.readWhitelist('emptyserver');
      expect(result.players).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.source).toBe('file');
    });

    it('should return empty list when server data dir does not exist', () => {
      const result = service.readWhitelist('noserver');
      expect(result.players).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle malformed JSON gracefully', () => {
      const dataDir = join(TEST_PLATFORM_PATH, 'servers', 'badserver', 'data');
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(join(dataDir, 'whitelist.json'), 'not valid json', 'utf-8');

      const result = service.readWhitelist('badserver');
      expect(result.players).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==================== readOps ====================

  describe('readOps', () => {
    it('should read ops.json and return player names', () => {
      setupServer('myserver', {
        'ops.json': [
          { uuid: 'uuid1', name: 'Admin1', level: 4, bypassesPlayerLimit: false },
          { uuid: 'uuid2', name: 'Admin2', level: 4, bypassesPlayerLimit: false },
        ],
      });

      const result = service.readOps('myserver');
      expect(result.players).toEqual(['Admin1', 'Admin2']);
      expect(result.total).toBe(2);
      expect(result.source).toBe('file');
    });

    it('should return empty list when ops.json does not exist', () => {
      setupServer('emptyserver', {});

      const result = service.readOps('emptyserver');
      expect(result.players).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle malformed JSON gracefully', () => {
      const dataDir = join(TEST_PLATFORM_PATH, 'servers', 'badserver', 'data');
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(join(dataDir, 'ops.json'), '{broken}', 'utf-8');

      const result = service.readOps('badserver');
      expect(result.players).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==================== readBannedPlayers ====================

  describe('readBannedPlayers', () => {
    it('should read banned-players.json and return player names', () => {
      setupServer('myserver', {
        'banned-players.json': [
          { uuid: 'uuid1', name: 'Griefer1', created: '2025-01-01', source: 'Server', expires: 'forever', reason: 'Griefing' },
          { uuid: 'uuid2', name: 'Griefer2', created: '2025-01-02', source: 'Server', expires: 'forever', reason: 'Spam' },
        ],
      });

      const result = service.readBannedPlayers('myserver');
      expect(result.players).toEqual([
        { name: 'Griefer1', uuid: 'uuid1', reason: 'Griefing', created: '2025-01-01', source: 'Server', expires: 'forever' },
        { name: 'Griefer2', uuid: 'uuid2', reason: 'Spam', created: '2025-01-02', source: 'Server', expires: 'forever' },
      ]);
      expect(result.total).toBe(2);
      expect(result.source).toBe('file');
    });

    it('should return empty list when banned-players.json does not exist', () => {
      setupServer('emptyserver', {});

      const result = service.readBannedPlayers('emptyserver');
      expect(result.players).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==================== writeWhitelist ====================

  describe('writeWhitelist', () => {
    it('should add a player to whitelist.json', () => {
      setupServer('myserver', {
        'whitelist.json': [
          { uuid: 'uuid1', name: 'Player1' },
        ],
      });

      service.addToWhitelist('myserver', 'Player2', 'uuid2');

      const result = service.readWhitelist('myserver');
      expect(result.players).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Player2', uuid: 'uuid2' })])
      );
      expect(result.total).toBe(2);
    });

    it('should not duplicate player in whitelist', () => {
      setupServer('myserver', {
        'whitelist.json': [
          { uuid: 'uuid1', name: 'Player1' },
        ],
      });

      service.addToWhitelist('myserver', 'Player1', 'uuid1');

      const result = service.readWhitelist('myserver');
      expect(result.total).toBe(1);
    });

    it('should remove a player from whitelist.json', () => {
      setupServer('myserver', {
        'whitelist.json': [
          { uuid: 'uuid1', name: 'Player1' },
          { uuid: 'uuid2', name: 'Player2' },
        ],
      });

      service.removeFromWhitelist('myserver', 'Player1');

      const result = service.readWhitelist('myserver');
      expect(result.players).toEqual([{ name: 'Player2', uuid: 'uuid2' }]);
      expect(result.total).toBe(1);
    });

    it('should create whitelist.json if it does not exist', () => {
      setupServer('myserver', {});

      service.addToWhitelist('myserver', 'NewPlayer', 'uuid-new');

      const result = service.readWhitelist('myserver');
      expect(result.players).toEqual([{ name: 'NewPlayer', uuid: 'uuid-new' }]);
    });
  });

  // ==================== writeOps ====================

  describe('writeOps', () => {
    it('should add a player to ops.json', () => {
      setupServer('myserver', {
        'ops.json': [
          { uuid: 'uuid1', name: 'Admin1', level: 4, bypassesPlayerLimit: false },
        ],
      });

      service.addToOps('myserver', 'Admin2', 'uuid2');

      const result = service.readOps('myserver');
      expect(result.players).toContain('Admin2');
      expect(result.total).toBe(2);
    });

    it('should remove a player from ops.json', () => {
      setupServer('myserver', {
        'ops.json': [
          { uuid: 'uuid1', name: 'Admin1', level: 4, bypassesPlayerLimit: false },
          { uuid: 'uuid2', name: 'Admin2', level: 4, bypassesPlayerLimit: false },
        ],
      });

      service.removeFromOps('myserver', 'Admin1');

      const result = service.readOps('myserver');
      expect(result.players).toEqual(['Admin2']);
    });
  });

  // ==================== writeBannedPlayers ====================

  describe('writeBannedPlayers', () => {
    it('should add a player to banned-players.json', () => {
      setupServer('myserver', {
        'banned-players.json': [],
      });

      service.addToBannedPlayers('myserver', 'Griefer', 'uuid-griefer', 'Griefing');

      const result = service.readBannedPlayers('myserver');
      expect(result.players).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Griefer', uuid: 'uuid-griefer' })])
      );
      expect(result.total).toBe(1);
    });

    it('should remove a player from banned-players.json', () => {
      setupServer('myserver', {
        'banned-players.json': [
          { uuid: 'uuid1', name: 'Griefer1', created: '2025-01-01', source: 'Server', expires: 'forever', reason: 'Griefing' },
        ],
      });

      service.removeFromBannedPlayers('myserver', 'Griefer1');

      const result = service.readBannedPlayers('myserver');
      expect(result.players).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should ban with reason', () => {
      setupServer('myserver', { 'banned-players.json': [] });

      service.addToBannedPlayers('myserver', 'BadPlayer', 'uuid-bad', 'Cheating');

      const dataDir = join(TEST_PLATFORM_PATH, 'servers', 'myserver', 'data');
      const raw = JSON.parse(
        require('fs').readFileSync(join(dataDir, 'banned-players.json'), 'utf-8')
      );
      expect(raw[0].reason).toBe('Cheating');
      expect(raw[0].source).toBe('mcctl-api');
    });
  });

  // ==================== config.env fallback ====================

  describe('readWhitelistFromConfig', () => {
    it('should read WHITELIST from config.env when whitelist.json missing', () => {
      setupConfigEnv('configserver', 'WHITELIST=Player1,Player2,Player3\nENABLE_WHITELIST=true\n');
      // No data directory

      const result = service.readWhitelist('configserver');
      expect(result.players).toEqual([
        { name: 'Player1', uuid: '' },
        { name: 'Player2', uuid: '' },
        { name: 'Player3', uuid: '' },
      ]);
      expect(result.source).toBe('config');
    });

    it('should prefer whitelist.json over config.env', () => {
      setupConfigEnv('bothserver', 'WHITELIST=ConfigPlayer\n');
      setupServer('bothserver', {
        'whitelist.json': [
          { uuid: 'uuid1', name: 'JsonPlayer' },
        ],
      });

      const result = service.readWhitelist('bothserver');
      expect(result.players).toEqual([{ name: 'JsonPlayer', uuid: 'uuid1' }]);
      expect(result.source).toBe('file');
    });
  });

  describe('readOpsFromConfig', () => {
    it('should read OPS from config.env when ops.json missing', () => {
      setupConfigEnv('configserver', 'OPS=Admin1,Admin2\n');

      const result = service.readOps('configserver');
      expect(result.players).toEqual(['Admin1', 'Admin2']);
      expect(result.source).toBe('config');
    });
  });
});
