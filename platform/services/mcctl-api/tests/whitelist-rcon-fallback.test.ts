import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-whitelist-rcon-fallback-test');

// Set env vars BEFORE any imports
process.env.PLATFORM_PATH = TEST_PLATFORM_PATH;
process.env.AUTH_ACCESS_MODE = 'open';
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

// Track RCON calls
let rconCommands: Array<{ server: string; command: string }> = [];
let rconMockImpl: (server: string, command: string) => Promise<string>;

// Mock rcon module
vi.mock('../src/lib/rcon.js', () => ({
  execRconCommand: vi.fn(async (server: string, command: string) => {
    rconCommands.push({ server, command });
    return rconMockImpl(server, command);
  }),
  parsePlayerList: vi.fn(() => ({ online: 0, max: 20, players: [] })),
}));

// Mock audit-log-service
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock Mojang API (lookupUuid)
vi.mock('node:fetch', () => ({}));
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock Docker functions
vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual('@minecraft-docker/shared');
  return {
    ...actual,
    containerExists: vi.fn((containerName: string) => {
      const serverName = containerName.replace('mc-', '');
      const serverPath = join(TEST_PLATFORM_PATH, 'servers', serverName, 'docker-compose.yml');
      return existsSync(serverPath);
    }),
    getContainerStatus: vi.fn(() => 'running'),
  };
});

function setupServer(serverName: string, opts: { whitelist?: Array<{ uuid: string; name: string }> } = {}) {
  const serverDir = join(TEST_PLATFORM_PATH, 'servers', serverName);
  const dataDir = join(serverDir, 'data');
  mkdirSync(dataDir, { recursive: true });

  writeFileSync(
    join(serverDir, 'docker-compose.yml'),
    'services:\n  minecraft:\n    image: itzg/minecraft-server',
    'utf-8'
  );

  writeFileSync(
    join(serverDir, 'config.env'),
    'TYPE=PAPER\nENABLE_WHITELIST=TRUE\n',
    'utf-8'
  );

  const whitelist = opts.whitelist || [];
  writeFileSync(join(dataDir, 'whitelist.json'), JSON.stringify(whitelist, null, 2), 'utf-8');
}

function readWhitelistFile(serverName: string): Array<{ uuid: string; name: string }> {
  const filePath = join(TEST_PLATFORM_PATH, 'servers', serverName, 'data', 'whitelist.json');
  if (!existsSync(filePath)) return [];
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

describe('Whitelist RCON Error Detection and File Fallback', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
    mkdirSync(TEST_PLATFORM_PATH, { recursive: true });

    rconCommands = [];
    rconMockImpl = async () => '';
    mockFetch.mockReset();

    const { config } = await import('../src/config/index.js');
    (config as any).platformPath = TEST_PLATFORM_PATH;

    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
  });

  // ==================== POST /api/servers/:name/whitelist ====================

  describe('POST /api/servers/:name/whitelist - RCON error detection', () => {
    it('should succeed via RCON when no error in response', async () => {
      setupServer('test-server');
      rconMockImpl = async () => 'Added Player1 to the whitelist';

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/test-server/whitelist',
        payload: { player: 'Player1' },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.source).toBe('rcon');
    });

    it('should detect "already whitelisted" RCON response and fall back to file', async () => {
      setupServer('test-server');
      rconMockImpl = async () => 'Player is already whitelisted';
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: '550e8400e29b41d4a716446655440000', name: 'Player1' }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/test-server/whitelist',
        payload: { player: 'Player1' },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      // Should fall back to file-based add
      expect(json.source).toMatch(/file/);
    });

    it('should call whitelist reload after file-based add when server is running', async () => {
      setupServer('test-server');
      rconMockImpl = async (_server: string, command: string) => {
        if (command.startsWith('whitelist add')) return 'Player is already whitelisted';
        if (command === 'whitelist reload') return 'Whitelist reloaded';
        return '';
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: '550e8400e29b41d4a716446655440000', name: 'Player1' }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/test-server/whitelist',
        payload: { player: 'Player1' },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.source).toBe('file+reload');

      // Verify whitelist reload was called
      const reloadCalls = rconCommands.filter(c => c.command === 'whitelist reload');
      expect(reloadCalls.length).toBe(1);
    });

    it('should return correct message when server is running and falls back to file', async () => {
      setupServer('test-server');
      rconMockImpl = async (_server: string, command: string) => {
        if (command.startsWith('whitelist add')) return 'Player is already whitelisted';
        return '';
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: '550e8400e29b41d4a716446655440000', name: 'NewPlayer' }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/test-server/whitelist',
        payload: { player: 'NewPlayer' },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      // Should NOT say "will apply on next server start" when server is running
      expect(json.message).not.toContain('next server start');
    });

    it('should fall back to file when RCON throws exception', async () => {
      setupServer('test-server');
      rconMockImpl = async () => { throw new Error('RCON connection refused'); };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: '550e8400e29b41d4a716446655440000', name: 'Player1' }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/test-server/whitelist',
        payload: { player: 'Player1' },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      // Should still work via file fallback
      expect(json.source).toMatch(/file/);
    });
  });

  // ==================== DELETE /api/servers/:name/whitelist/:player ====================

  describe('DELETE /api/servers/:name/whitelist/:player - RCON error detection', () => {
    it('should succeed via RCON when no error in response', async () => {
      setupServer('test-server', {
        whitelist: [{ uuid: 'uuid-1', name: 'Player1' }],
      });
      rconMockImpl = async () => 'Removed Player1 from the whitelist';

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/servers/test-server/whitelist/Player1',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.source).toBe('rcon');
    });

    it('should detect "not whitelisted" RCON response and fall back to file removal', async () => {
      setupServer('test-server', {
        whitelist: [{ uuid: 'uuid-1', name: 'Player1' }],
      });
      rconMockImpl = async (_server: string, command: string) => {
        if (command.startsWith('whitelist remove')) return 'Player is not whitelisted';
        if (command === 'whitelist reload') return 'Whitelist reloaded';
        return '';
      };

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/servers/test-server/whitelist/player1', // lowercase - case mismatch
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);

      // Verify player was removed from file (case-insensitive)
      const whitelist = readWhitelistFile('test-server');
      const remaining = whitelist.find(p => p.name.toLowerCase() === 'player1');
      expect(remaining).toBeUndefined();
    });

    it('should call whitelist reload after file-based removal when server is running', async () => {
      setupServer('test-server', {
        whitelist: [{ uuid: 'uuid-1', name: 'Player1' }],
      });
      rconMockImpl = async (_server: string, command: string) => {
        if (command.startsWith('whitelist remove')) return 'Player is not whitelisted';
        if (command === 'whitelist reload') return 'Whitelist reloaded';
        return '';
      };

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/servers/test-server/whitelist/player1',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.source).toBe('file+reload');

      // Verify whitelist reload was called
      const reloadCalls = rconCommands.filter(c => c.command === 'whitelist reload');
      expect(reloadCalls.length).toBe(1);
    });

    it('should return correct message when server is running and falls back to file', async () => {
      setupServer('test-server', {
        whitelist: [{ uuid: 'uuid-1', name: 'Player1' }],
      });
      rconMockImpl = async (_server: string, command: string) => {
        if (command.startsWith('whitelist remove')) return 'Player is not whitelisted';
        return '';
      };

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/servers/test-server/whitelist/player1',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      // Should NOT say "will apply on next server start" when server is running
      expect(json.message).not.toContain('next server start');
    });

    it('should fall back to file when RCON throws exception', async () => {
      setupServer('test-server', {
        whitelist: [{ uuid: 'uuid-1', name: 'Player1' }],
      });
      rconMockImpl = async () => { throw new Error('RCON connection refused'); };

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/servers/test-server/whitelist/Player1',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);

      // Verify player was removed from file
      const whitelist = readWhitelistFile('test-server');
      expect(whitelist.find(p => p.name === 'Player1')).toBeUndefined();
    });

    it('should handle case-insensitive removal via file fallback', async () => {
      setupServer('test-server', {
        whitelist: [
          { uuid: 'uuid-1', name: 'Steve' },
          { uuid: 'uuid-2', name: 'Alex' },
        ],
      });
      rconMockImpl = async (_server: string, command: string) => {
        if (command.startsWith('whitelist remove')) return 'Player is not whitelisted';
        if (command === 'whitelist reload') return 'Whitelist reloaded';
        return '';
      };

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/servers/test-server/whitelist/steve', // lowercase
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);

      // Verify "Steve" was removed but "Alex" remains
      const whitelist = readWhitelistFile('test-server');
      expect(whitelist).toHaveLength(1);
      expect(whitelist[0].name).toBe('Alex');
    });
  });
});
