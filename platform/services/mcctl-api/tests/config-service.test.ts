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

  describe('getConfig - new fields (#365)', () => {
    it('should parse UPPERCASE boolean fields (TRUE/FALSE)', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`ONLINE_MODE=TRUE
ENABLE_WHITELIST=FALSE
ENFORCE_WHITELIST=TRUE
ENFORCE_SECURE_PROFILE=FALSE
`);

      const config = configService.getConfig('testserver');

      expect(config.onlineMode).toBe(true);
      expect(config.enableWhitelist).toBe(false);
      expect(config.enforceWhitelist).toBe(true);
      expect(config.enforceSecureProfile).toBe(false);
    });

    it('should parse UPPERCASE boolean fields case-insensitively', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`ONLINE_MODE=true
ENABLE_WHITELIST=True
`);

      const config = configService.getConfig('testserver');

      expect(config.onlineMode).toBe(true);
      expect(config.enableWhitelist).toBe(true);
    });

    it('should parse new lowercase boolean fields', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`FORCE_GAMEMODE=true
HARDCORE=false
ALLOW_FLIGHT=true
ALLOW_NETHER=false
ENABLE_COMMAND_BLOCK=true
SPAWN_ANIMALS=true
SPAWN_MONSTERS=false
SPAWN_NPCS=true
GENERATE_STRUCTURES=true
ENABLE_AUTOPAUSE=true
ENABLE_AUTOSTOP=false
ENABLE_RCON=true
RESOURCE_PACK_ENFORCE=false
`);

      const config = configService.getConfig('testserver');

      expect(config.forceGamemode).toBe(true);
      expect(config.hardcore).toBe(false);
      expect(config.allowFlight).toBe(true);
      expect(config.allowNether).toBe(false);
      expect(config.enableCommandBlock).toBe(true);
      expect(config.spawnAnimals).toBe(true);
      expect(config.spawnMonsters).toBe(false);
      expect(config.spawnNpcs).toBe(true);
      expect(config.generateStructures).toBe(true);
      expect(config.enableAutopause).toBe(true);
      expect(config.enableAutostop).toBe(false);
      expect(config.enableRcon).toBe(true);
      expect(config.resourcePackEnforce).toBe(false);
    });

    it('should parse levelType enum with camelCase mapping', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`LEVEL_TYPE=LARGEBIOMES
`);

      const config = configService.getConfig('testserver');

      expect(config.levelType).toBe('largeBiomes');
    });

    it('should parse all levelType values correctly', () => {
      const testCases: [string, string][] = [
        ['DEFAULT', 'default'],
        ['FLAT', 'flat'],
        ['LARGEBIOMES', 'largeBiomes'],
        ['AMPLIFIED', 'amplified'],
        ['BUFFET', 'buffet'],
        ['default', 'default'],
        ['flat', 'flat'],
        ['largebiomes', 'largeBiomes'],
      ];

      for (const [envValue, expected] of testCases) {
        mockedExistsSync.mockReturnValue(true);
        mockedReadFileSync.mockReturnValue(`LEVEL_TYPE=${envValue}\n`);

        const config = configService.getConfig('testserver');
        expect(config.levelType).toBe(expected);
      }
    });

    it('should return undefined for invalid levelType', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`LEVEL_TYPE=invalidtype\n`);

      const config = configService.getConfig('testserver');

      expect(config.levelType).toBeUndefined();
    });

    it('should parse new number fields', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`SIMULATION_DISTANCE=12
MAX_TICK_TIME=60000
MAX_WORLD_SIZE=29999984
AUTOPAUSE_TIMEOUT_EST=3600
AUTOPAUSE_TIMEOUT_INIT=600
AUTOPAUSE_PERIOD=10
AUTOSTOP_TIMEOUT_EST=7200
RCON_PORT=25575
STOP_DURATION=60
UID=1000
GID=1000
`);

      const config = configService.getConfig('testserver');

      expect(config.simulationDistance).toBe(12);
      expect(config.maxTickTime).toBe(60000);
      expect(config.maxWorldSize).toBe(29999984);
      expect(config.autopauseTimeoutEst).toBe(3600);
      expect(config.autopauseTimeoutInit).toBe(600);
      expect(config.autopausePeriod).toBe(10);
      expect(config.autostopTimeoutEst).toBe(7200);
      expect(config.rconPort).toBe(25575);
      expect(config.stopDuration).toBe(60);
      expect(config.uid).toBe(1000);
      expect(config.gid).toBe(1000);
    });

    it('should parse maxTickTime with -1 (disable watchdog)', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`MAX_TICK_TIME=-1\n`);

      const config = configService.getConfig('testserver');

      expect(config.maxTickTime).toBe(-1);
    });

    it('should parse new string fields', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`LEVEL=custom_world
SEED=12345
ICON=https://example.com/icon.png
TZ=Asia/Seoul
RESOURCE_PACK=https://example.com/pack.zip
RESOURCE_PACK_SHA1=abc123def456
RESOURCE_PACK_PROMPT=Please accept!
RCON_PASSWORD=s3cret
INIT_MEMORY=2G
MAX_MEMORY=8G
JVM_XX_OPTS=-XX:+UseG1GC
`);

      const config = configService.getConfig('testserver');

      expect(config.level).toBe('custom_world');
      expect(config.seed).toBe('12345');
      expect(config.icon).toBe('https://example.com/icon.png');
      expect(config.tz).toBe('Asia/Seoul');
      expect(config.resourcePack).toBe('https://example.com/pack.zip');
      expect(config.resourcePackSha1).toBe('abc123def456');
      expect(config.resourcePackPrompt).toBe('Please accept!');
      expect(config.rconPassword).toBe('s3cret');
      expect(config.initMemory).toBe('2G');
      expect(config.maxMemory).toBe('8G');
      expect(config.jvmXxOpts).toBe('-XX:+UseG1GC');
    });

    it('should parse a comprehensive config with all field types', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(`# Full server configuration
DIFFICULTY=hard
GAMEMODE=survival
MAX_PLAYERS=50
PVP=true
FORCE_GAMEMODE=false
HARDCORE=false
ALLOW_FLIGHT=true
MOTD=Welcome to the server
LEVEL=myworld
LEVEL_TYPE=AMPLIFIED
SEED=myseed
ONLINE_MODE=TRUE
ENABLE_WHITELIST=TRUE
ENFORCE_WHITELIST=FALSE
MEMORY=4G
USE_AIKAR_FLAGS=true
VIEW_DISTANCE=12
SIMULATION_DISTANCE=10
MAX_TICK_TIME=-1
ENABLE_AUTOPAUSE=true
AUTOPAUSE_TIMEOUT_EST=300
TZ=America/New_York
ENABLE_RCON=true
RCON_PORT=25575
UID=1000
GID=1000
`);

      const config = configService.getConfig('testserver');

      expect(config.difficulty).toBe('hard');
      expect(config.gameMode).toBe('survival');
      expect(config.maxPlayers).toBe(50);
      expect(config.pvp).toBe(true);
      expect(config.forceGamemode).toBe(false);
      expect(config.hardcore).toBe(false);
      expect(config.allowFlight).toBe(true);
      expect(config.motd).toBe('Welcome to the server');
      expect(config.level).toBe('myworld');
      expect(config.levelType).toBe('amplified');
      expect(config.seed).toBe('myseed');
      expect(config.onlineMode).toBe(true);
      expect(config.enableWhitelist).toBe(true);
      expect(config.enforceWhitelist).toBe(false);
      expect(config.memory).toBe('4G');
      expect(config.useAikarFlags).toBe(true);
      expect(config.viewDistance).toBe(12);
      expect(config.simulationDistance).toBe(10);
      expect(config.maxTickTime).toBe(-1);
      expect(config.enableAutopause).toBe(true);
      expect(config.autopauseTimeoutEst).toBe(300);
      expect(config.tz).toBe('America/New_York');
      expect(config.enableRcon).toBe(true);
      expect(config.rconPort).toBe(25575);
      expect(config.uid).toBe(1000);
      expect(config.gid).toBe(1000);
    });
  });

  describe('updateConfig - new fields (#365)', () => {
    beforeEach(() => {
      mockedExistsSync.mockReturnValue(true);
    });

    const setupUpdateTestWith = (content: string) => {
      let writtenContent = '';
      let callCount = 0;
      mockedReadFileSync.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return content;
        }
        return writtenContent;
      });
      mockedWriteFileSync.mockImplementation((path, c) => {
        writtenContent = c as string;
      });
      return () => writtenContent;
    };

    it('should format UPPERCASE booleans as TRUE/FALSE', () => {
      const getWritten = setupUpdateTestWith(`ONLINE_MODE=FALSE\nENABLE_WHITELIST=FALSE\n`);

      configService.updateConfig('testserver', {
        onlineMode: true,
        enableWhitelist: true,
      });

      const written = getWritten();
      expect(written).toContain('ONLINE_MODE=TRUE');
      expect(written).toContain('ENABLE_WHITELIST=TRUE');
    });

    it('should format lowercase booleans as true/false', () => {
      const getWritten = setupUpdateTestWith(`FORCE_GAMEMODE=false\nHARDCORE=false\nALLOW_FLIGHT=false\n`);

      configService.updateConfig('testserver', {
        forceGamemode: true,
        hardcore: true,
        allowFlight: true,
      });

      const written = getWritten();
      expect(written).toContain('FORCE_GAMEMODE=true');
      expect(written).toContain('HARDCORE=true');
      expect(written).toContain('ALLOW_FLIGHT=true');
    });

    it('should format levelType as UPPERCASE env values', () => {
      const getWritten = setupUpdateTestWith(`LEVEL_TYPE=DEFAULT\n`);

      configService.updateConfig('testserver', {
        levelType: 'largeBiomes',
      });

      const written = getWritten();
      expect(written).toContain('LEVEL_TYPE=LARGEBIOMES');
    });

    it('should format all levelType values correctly', () => {
      const testCases: [string, string, string][] = [
        ['default', 'DEFAULT', 'FLAT'],       // current=FLAT, update to default→DEFAULT
        ['flat', 'FLAT', 'DEFAULT'],           // current=DEFAULT, update to flat→FLAT
        ['largeBiomes', 'LARGEBIOMES', 'DEFAULT'],
        ['amplified', 'AMPLIFIED', 'DEFAULT'],
        ['buffet', 'BUFFET', 'DEFAULT'],
      ];

      for (const [apiValue, expectedEnv, currentEnv] of testCases) {
        const getWritten = setupUpdateTestWith(`LEVEL_TYPE=${currentEnv}\n`);

        configService.updateConfig('testserver', {
          levelType: apiValue as any,
        });

        expect(getWritten()).toContain(`LEVEL_TYPE=${expectedEnv}`);
      }
    });

    it('should set restartRequired=true for all restart-required fields', () => {
      const restartFields: [string, unknown][] = [
        ['onlineMode', true],
        ['enableWhitelist', true],
        ['enforceWhitelist', true],
        ['enforceSecureProfile', true],
        ['level', 'newworld'],
        ['seed', '12345'],
        ['levelType', 'flat'],
        ['enableAutopause', true],
        ['enableAutostop', true],
        ['enableRcon', true],
        ['rconPassword', 'newpass'],
        ['rconPort', 25576],
        ['tz', 'UTC'],
        ['uid', 1001],
        ['gid', 1001],
        ['stopDuration', 120],
        ['initMemory', '2G'],
        ['maxMemory', '8G'],
        ['jvmXxOpts', '-XX:+UseG1GC'],
      ];

      for (const [field, value] of restartFields) {
        const getWritten = setupUpdateTestWith('');
        const result = configService.updateConfig('testserver', {
          [field]: value,
        });

        expect(result.restartRequired).toBe(true);
        expect(result.changedFields).toContain(field);
      }
    });

    it('should set restartRequired=false for non-restart fields', () => {
      const nonRestartFields: [string, unknown][] = [
        ['pvp', false],
        ['forceGamemode', true],
        ['hardcore', true],
        ['allowFlight', true],
        ['allowNether', false],
        ['enableCommandBlock', true],
        ['spawnAnimals', false],
        ['spawnMonsters', false],
        ['spawnNpcs', false],
        ['viewDistance', 16],
        ['simulationDistance', 10],
        ['maxTickTime', 60000],
        ['maxWorldSize', 1000],
        ['generateStructures', false],
        ['icon', 'https://example.com/icon.png'],
        ['resourcePack', 'https://example.com/pack.zip'],
        ['resourcePackSha1', 'abc'],
        ['resourcePackEnforce', true],
        ['resourcePackPrompt', 'Accept?'],
        ['autopauseTimeoutEst', 300],
        ['autopauseTimeoutInit', 600],
        ['autopausePeriod', 10],
        ['autostopTimeoutEst', 7200],
      ];

      for (const [field, value] of nonRestartFields) {
        const getWritten = setupUpdateTestWith('');
        const result = configService.updateConfig('testserver', {
          [field]: value,
        });

        expect(result.restartRequired).toBe(false);
        expect(result.changedFields).toContain(field);
      }
    });

    it('should write number fields as plain numbers', () => {
      const getWritten = setupUpdateTestWith('');

      configService.updateConfig('testserver', {
        simulationDistance: 10,
        maxTickTime: -1,
        rconPort: 25575,
        uid: 1000,
        gid: 1000,
      });

      const written = getWritten();
      expect(written).toContain('SIMULATION_DISTANCE=10');
      expect(written).toContain('MAX_TICK_TIME=-1');
      expect(written).toContain('RCON_PORT=25575');
      expect(written).toContain('UID=1000');
      expect(written).toContain('GID=1000');
    });

    it('should write string fields as-is', () => {
      const getWritten = setupUpdateTestWith('');

      configService.updateConfig('testserver', {
        level: 'myworld',
        seed: 'abc123',
        tz: 'Asia/Seoul',
        rconPassword: 's3cret!',
        initMemory: '2G',
        maxMemory: '8G',
        jvmXxOpts: '-XX:+UseG1GC -XX:MaxGCPauseMillis=50',
      });

      const written = getWritten();
      expect(written).toContain('LEVEL=myworld');
      expect(written).toContain('SEED=abc123');
      expect(written).toContain('TZ=Asia/Seoul');
      expect(written).toContain('RCON_PASSWORD=s3cret!');
      expect(written).toContain('INIT_MEMORY=2G');
      expect(written).toContain('MAX_MEMORY=8G');
      expect(written).toContain('JVM_XX_OPTS=-XX:+UseG1GC -XX:MaxGCPauseMillis=50');
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
