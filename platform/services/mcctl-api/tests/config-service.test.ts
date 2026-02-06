import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '../src/services/ConfigService.js';

// Mock fs module
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
  };
});

import { readFileSync, writeFileSync, existsSync } from 'fs';

const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);
const mockedExistsSync = vi.mocked(existsSync);

describe('ConfigService', () => {
  let configService: ConfigService;
  const platformPath = '/test/platform';

  beforeEach(() => {
    vi.clearAllMocks();
    configService = new ConfigService(platformPath);
  });

  describe('configExists', () => {
    it('should return true when config file exists', () => {
      mockedExistsSync.mockReturnValue(true);

      const result = configService.configExists('testserver');

      expect(result).toBe(true);
      expect(mockedExistsSync).toHaveBeenCalledWith('/test/platform/servers/testserver/config.env');
    });

    it('should return false when config file does not exist', () => {
      mockedExistsSync.mockReturnValue(false);

      const result = configService.configExists('nonexistent');

      expect(result).toBe(false);
      expect(mockedExistsSync).toHaveBeenCalledWith('/test/platform/servers/nonexistent/config.env');
    });
  });

  describe('getConfig', () => {
    it('should read config.env and return typed ServerConfig', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`# Server configuration
MOTD=Welcome to my server
MAX_PLAYERS=20
DIFFICULTY=normal
GAMEMODE=survival
PVP=true
VIEW_DISTANCE=10
SPAWN_PROTECTION=16
MEMORY=4G
USE_AIKAR_FLAGS=true
`);

      const config = configService.getConfig('testserver');

      expect(config).toEqual({
        motd: 'Welcome to my server',
        maxPlayers: 20,
        difficulty: 'normal',
        gameMode: 'survival',
        pvp: true,
        viewDistance: 10,
        spawnProtection: 16,
        memory: '4G',
        useAikarFlags: true,
      });
    });

    it('should handle missing values gracefully', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`# Minimal configuration
MOTD=Test Server
MAX_PLAYERS=10
`);

      const config = configService.getConfig('testserver');

      expect(config).toEqual({
        motd: 'Test Server',
        maxPlayers: 10,
      });
      expect(config.difficulty).toBeUndefined();
      expect(config.pvp).toBeUndefined();
    });

    it('should parse boolean values (PVP=true/false)', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`PVP=true
USE_AIKAR_FLAGS=false
`);

      const config = configService.getConfig('testserver');

      expect(config.pvp).toBe(true);
      expect(config.useAikarFlags).toBe(false);
    });

    it('should parse numeric values (MAX_PLAYERS, VIEW_DISTANCE, SPAWN_PROTECTION)', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`MAX_PLAYERS=100
VIEW_DISTANCE=16
SPAWN_PROTECTION=32
`);

      const config = configService.getConfig('testserver');

      expect(config.maxPlayers).toBe(100);
      expect(config.viewDistance).toBe(16);
      expect(config.spawnProtection).toBe(32);
    });

    it('should parse difficulty and gameMode enums', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`DIFFICULTY=hard
GAMEMODE=creative
`);

      const config = configService.getConfig('testserver');

      expect(config.difficulty).toBe('hard');
      expect(config.gameMode).toBe('creative');
    });

    it('should handle invalid numeric values gracefully', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`MAX_PLAYERS=invalid
VIEW_DISTANCE=abc
`);

      const config = configService.getConfig('testserver');

      expect(config.maxPlayers).toBeUndefined();
      expect(config.viewDistance).toBeUndefined();
    });

    it('should handle invalid enum values gracefully', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`DIFFICULTY=impossible
GAMEMODE=creative-survival
`);

      const config = configService.getConfig('testserver');

      expect(config.difficulty).toBeUndefined();
      expect(config.gameMode).toBeUndefined();
    });

    it('should skip comments and blank lines', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`# This is a comment
MOTD=Test

# Another comment
MAX_PLAYERS=20

`);

      const config = configService.getConfig('testserver');

      expect(config.motd).toBe('Test');
      expect(config.maxPlayers).toBe(20);
    });

    it('should throw when config file does not exist', () => {
      mockedExistsSync.mockReturnValue(false);

      expect(() => configService.getConfig('nonexistent')).toThrow(
        'Server configuration not found: nonexistent'
      );
    });

    it('should parse case-insensitive boolean values', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`PVP=TRUE
USE_AIKAR_FLAGS=FALSE
`);

      const config = configService.getConfig('testserver');

      expect(config.pvp).toBe(true);
      expect(config.useAikarFlags).toBe(false);
    });

    it('should parse case-insensitive enum values', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`DIFFICULTY=HARD
GAMEMODE=CREATIVE
`);

      const config = configService.getConfig('testserver');

      expect(config.difficulty).toBe('hard');
      expect(config.gameMode).toBe('creative');
    });
  });

  describe('updateConfig', () => {
    const initialConfigContent = `# Server configuration
MOTD=Original Server
MAX_PLAYERS=20
DIFFICULTY=normal
PVP=true
MEMORY=4G
USE_AIKAR_FLAGS=false
`;

    beforeEach(() => {
      mockedExistsSync.mockReturnValue(true);
    });

    const setupUpdateTest = (updates: Record<string, any>) => {
      let writtenContent = '';

      // First two reads return initial content, third read returns written content
      let callCount = 0;
      mockedReadFileSync.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return initialConfigContent;
        }
        return writtenContent;
      });

      mockedWriteFileSync.mockImplementation((path, content) => {
        writtenContent = content as string;
      });
    };

    it('should update values and detect changed fields', () => {
      setupUpdateTest({});

      const result = configService.updateConfig('testserver', {
        motd: 'Updated Server',
        maxPlayers: 30,
      });

      expect(result.changedFields).toEqual(['motd', 'maxPlayers']);
      expect(result.config.motd).toBe('Updated Server');
      expect(result.config.maxPlayers).toBe(30);
      expect(mockedWriteFileSync).toHaveBeenCalled();
    });

    it('should set restartRequired=true for memory changes', () => {
      setupUpdateTest({});

      const result = configService.updateConfig('testserver', {
        memory: '8G',
      });

      expect(result.restartRequired).toBe(true);
      expect(result.changedFields).toContain('memory');
    });

    it('should set restartRequired=true for useAikarFlags changes', () => {
      setupUpdateTest({});

      const result = configService.updateConfig('testserver', {
        useAikarFlags: true,
      });

      expect(result.restartRequired).toBe(true);
      expect(result.changedFields).toContain('useAikarFlags');
    });

    it('should set restartRequired=false for non-restart fields', () => {
      setupUpdateTest({});

      const result = configService.updateConfig('testserver', {
        motd: 'New MOTD',
        maxPlayers: 25,
        difficulty: 'hard',
      });

      expect(result.restartRequired).toBe(false);
      expect(result.changedFields).toEqual(['motd', 'maxPlayers', 'difficulty']);
    });

    it('should preserve comments and structure in config.env', () => {
      const commentedContent = `# Important comment
MOTD=Test
# Another comment
MAX_PLAYERS=20
`;
      let writtenContent = '';
      let callCount = 0;
      mockedReadFileSync.mockImplementation(() => {
        callCount++;
        return callCount <= 2 ? commentedContent : writtenContent;
      });
      mockedWriteFileSync.mockImplementation((path, content) => {
        writtenContent = content as string;
      });

      configService.updateConfig('testserver', {
        motd: 'Updated',
      });

      expect(writtenContent).toContain('# Important comment');
      expect(writtenContent).toContain('# Another comment');
      expect(writtenContent).toContain('MOTD=Updated');
    });

    it('should add new keys not in original file', () => {
      const minimalContent = `MOTD=Test
MAX_PLAYERS=20
`;
      let writtenContent = '';
      let callCount = 0;
      mockedReadFileSync.mockImplementation(() => {
        callCount++;
        return callCount <= 2 ? minimalContent : writtenContent;
      });
      mockedWriteFileSync.mockImplementation((path, content) => {
        writtenContent = content as string;
      });

      configService.updateConfig('testserver', {
        viewDistance: 12,
      });

      expect(writtenContent).toContain('VIEW_DISTANCE=12');
    });

    it('should skip unchanged values', () => {
      setupUpdateTest({});

      const result = configService.updateConfig('testserver', {
        motd: 'Original Server', // Same as current
        maxPlayers: 20, // Same as current
      });

      expect(result.changedFields).toEqual([]);
      expect(mockedWriteFileSync).not.toHaveBeenCalled();
    });

    it('should format boolean values correctly', () => {
      setupUpdateTest({});

      configService.updateConfig('testserver', {
        pvp: false,
        useAikarFlags: true,
      });

      const writtenContent = mockedWriteFileSync.mock.calls[0][1] as string;
      expect(writtenContent).toContain('PVP=false');
      expect(writtenContent).toContain('USE_AIKAR_FLAGS=true');
    });

    it('should format enum values correctly', () => {
      setupUpdateTest({});

      configService.updateConfig('testserver', {
        difficulty: 'hard',
        gameMode: 'creative',
      });

      const writtenContent = mockedWriteFileSync.mock.calls[0][1] as string;
      expect(writtenContent).toContain('DIFFICULTY=hard');
      expect(writtenContent).toContain('GAMEMODE=creative');
    });

    it('should throw when config file does not exist', () => {
      mockedExistsSync.mockReturnValue(false);

      expect(() => configService.updateConfig('nonexistent', { motd: 'Test' })).toThrow(
        'Server configuration not found: nonexistent'
      );
    });

    it('should handle undefined values in updates', () => {
      setupUpdateTest({});

      const result = configService.updateConfig('testserver', {
        motd: undefined,
        maxPlayers: 25,
      });

      expect(result.changedFields).toEqual(['maxPlayers']);
    });

    it('should detect multiple restart-required changes', () => {
      setupUpdateTest({});

      const result = configService.updateConfig('testserver', {
        memory: '8G',
        useAikarFlags: true,
        motd: 'Updated',
      });

      expect(result.restartRequired).toBe(true);
      expect(result.changedFields).toContain('memory');
      expect(result.changedFields).toContain('useAikarFlags');
      expect(result.changedFields).toContain('motd');
    });
  });

  describe('getWorldName', () => {
    it('should read LEVEL value from config.env', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`LEVEL=custom_world
TYPE=PAPER
`);

      const worldName = configService.getWorldName('testserver');

      expect(worldName).toBe('custom_world');
    });

    it('should return "world" as default when LEVEL is not set', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`TYPE=PAPER
VERSION=1.20.4
`);

      const worldName = configService.getWorldName('testserver');

      expect(worldName).toBe('world');
    });

    it('should return "world" when config does not exist', () => {
      mockedExistsSync.mockReturnValue(false);

      const worldName = configService.getWorldName('nonexistent');

      expect(worldName).toBe('world');
    });

    it('should handle empty LEVEL value', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`LEVEL=
TYPE=PAPER
`);

      const worldName = configService.getWorldName('testserver');

      expect(worldName).toBe('world');
    });

    it('should handle LEVEL value with spaces', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`LEVEL=  my_world
TYPE=PAPER
`);

      const worldName = configService.getWorldName('testserver');

      expect(worldName).toBe('my_world');
    });
  });

  describe('Edge Cases', () => {
    it('should handle config file with no equals signs', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`INVALID LINE
ANOTHER INVALID
MOTD=Valid
`);

      const config = configService.getConfig('testserver');

      expect(config.motd).toBe('Valid');
    });

    it('should handle empty config file', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('');

      const config = configService.getConfig('testserver');

      expect(config).toEqual({});
    });

    it('should handle config with only comments', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`# Comment 1
# Comment 2
# Comment 3
`);

      const config = configService.getConfig('testserver');

      expect(config).toEqual({});
    });

    it('should handle values with equals signs in them', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`MOTD=Server with = sign in message
MAX_PLAYERS=20
`);

      const config = configService.getConfig('testserver');

      expect(config.motd).toBe('Server with = sign in message');
    });

    it('should preserve line structure when no changes are made', () => {
      mockedReadFileSync.mockReturnValue(`# Header
MOTD=Test
MAX_PLAYERS=20
`);

      configService.updateConfig('testserver', {});

      expect(mockedWriteFileSync).not.toHaveBeenCalled();
    });

    it('should handle multiple consecutive blank lines', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`MOTD=Test


MAX_PLAYERS=20
`);

      const config = configService.getConfig('testserver');

      expect(config.motd).toBe('Test');
      expect(config.maxPlayers).toBe(20);
    });
  });
});
