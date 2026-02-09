import { describe, it, expect, beforeEach, vi } from 'vitest';
import { opCommand, type OpCommandOptions } from '../../src/commands/op.js';
import * as rcon from '../../src/lib/rcon.js';
import { ShellExecutor } from '../../src/lib/shell.js';
import { getContainer } from '../../src/infrastructure/di/container.js';
import { OpLevel, Paths, Operator } from '@minecraft-docker/shared';
import { OpsJsonAdapter } from '../../src/infrastructure/adapters/OpsJsonAdapter.js';

vi.mock('../../src/lib/rcon.js');
vi.mock('../../src/lib/shell.js');
vi.mock('../../src/infrastructure/di/container.js');
vi.mock('../../src/infrastructure/adapters/OpsJsonAdapter.js');
vi.mock('../../src/lib/prompts/level-select.js');
vi.mock('../../src/lib/mojang-api.js');
vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual('@minecraft-docker/shared');
  return {
    ...actual,
    Paths: vi.fn().mockImplementation(() => ({
      isInitialized: vi.fn().mockReturnValue(true),
      servers: '/tmp/test/servers',
    })),
  };
});

describe('op command', () => {
  const mockConfig = {
    TYPE: 'PAPER',
    VERSION: '1.21.1',
    OPS: 'player1,player2',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rcon.isContainerRunning).mockResolvedValue(false);
    vi.mocked(ShellExecutor.prototype.readConfig).mockReturnValue(mockConfig);
    vi.mocked(ShellExecutor.prototype.writeConfigValue).mockReturnValue(true);
    vi.mocked(getContainer).mockReturnValue({
      auditLogPort: {
        log: vi.fn().mockResolvedValue(undefined),
      },
    } as any);

    // Mock OpsJsonAdapter
    vi.mocked(OpsJsonAdapter.prototype.read).mockResolvedValue([]);
    vi.mocked(OpsJsonAdapter.prototype.write).mockResolvedValue(undefined);
    vi.mocked(OpsJsonAdapter.prototype.find).mockResolvedValue(null);
    vi.mocked(OpsJsonAdapter.prototype.add).mockResolvedValue(undefined);
    vi.mocked(OpsJsonAdapter.prototype.remove).mockResolvedValue(undefined);
    vi.mocked(OpsJsonAdapter.prototype.updateLevel).mockResolvedValue(undefined);
  });

  describe('list', () => {
    it('should list operators from ops.json', async () => {
      // Mock operators from ops.json
      const mockOperators = [
        Operator.create({
          uuid: 'uuid1',
          name: 'player1',
          level: OpLevel.OWNER,
          bypassesPlayerLimit: false,
        }),
        Operator.create({
          uuid: 'uuid2',
          name: 'player2',
          level: OpLevel.ADMIN,
          bypassesPlayerLimit: false,
        }),
      ];
      vi.mocked(OpsJsonAdapter.prototype.read).mockResolvedValue(mockOperators);

      const options: OpCommandOptions = {
        root: '/tmp/test',
        serverName: 'test-server',
        subCommand: 'list',
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const exitCode = await opCommand(options);

      expect(exitCode).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('player1'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('player2'));

      consoleSpy.mockRestore();
    });

    it('should handle empty operators list', async () => {
      vi.mocked(ShellExecutor.prototype.readConfig).mockReturnValue({
        ...mockConfig,
        OPS: '',
      });

      const options: OpCommandOptions = {
        root: '/tmp/test',
        serverName: 'test-server',
        subCommand: 'list',
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const exitCode = await opCommand(options);

      expect(exitCode).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('(none)'));

      consoleSpy.mockRestore();
    });
  });

  describe('add', () => {
    it('should add operator with explicit level flag', async () => {
      vi.mocked(ShellExecutor.prototype.readConfig).mockReturnValue({
        ...mockConfig,
        OPS: '',
      });

      const options: OpCommandOptions = {
        root: '/tmp/test',
        serverName: 'test-server',
        subCommand: 'add',
        playerName: 'newplayer',
        level: 4, // Explicit level
      };

      const exitCode = await opCommand(options);

      expect(exitCode).toBe(0);
      expect(ShellExecutor.prototype.writeConfigValue).toHaveBeenCalledWith(
        'test-server',
        'OPS',
        'newplayer'
      );
    });

    it('should add operator with explicit level 2', async () => {
      vi.mocked(ShellExecutor.prototype.readConfig).mockReturnValue({
        ...mockConfig,
        OPS: '',
      });

      const options: OpCommandOptions = {
        root: '/tmp/test',
        serverName: 'test-server',
        subCommand: 'add',
        playerName: 'newplayer',
        level: 2, // Gamemaster
      };

      const exitCode = await opCommand(options);

      expect(exitCode).toBe(0);
      expect(ShellExecutor.prototype.writeConfigValue).toHaveBeenCalled();
    });

    it('should reject already an operator', async () => {
      const options: OpCommandOptions = {
        root: '/tmp/test',
        serverName: 'test-server',
        subCommand: 'add',
        playerName: 'player1',
      };

      const exitCode = await opCommand(options);

      expect(exitCode).toBe(0);
      expect(ShellExecutor.prototype.writeConfigValue).not.toHaveBeenCalled();
    });

    it('should require player name', async () => {
      const options: OpCommandOptions = {
        root: '/tmp/test',
        serverName: 'test-server',
        subCommand: 'add',
      };

      const exitCode = await opCommand(options);

      expect(exitCode).toBe(1);
    });
  });

  describe('remove', () => {
    it('should remove operator', async () => {
      const options: OpCommandOptions = {
        root: '/tmp/test',
        serverName: 'test-server',
        subCommand: 'remove',
        playerName: 'player1',
      };

      const exitCode = await opCommand(options);

      expect(exitCode).toBe(0);
      expect(ShellExecutor.prototype.writeConfigValue).toHaveBeenCalledWith(
        'test-server',
        'OPS',
        'player2'
      );
    });

    it('should handle not an operator', async () => {
      const options: OpCommandOptions = {
        root: '/tmp/test',
        serverName: 'test-server',
        subCommand: 'remove',
        playerName: 'nonexistent',
      };

      const exitCode = await opCommand(options);

      expect(exitCode).toBe(0);
      expect(ShellExecutor.prototype.writeConfigValue).not.toHaveBeenCalled();
    });

    it('should require player name', async () => {
      const options: OpCommandOptions = {
        root: '/tmp/test',
        serverName: 'test-server',
        subCommand: 'remove',
      };

      const exitCode = await opCommand(options);

      expect(exitCode).toBe(1);
    });
  });

  describe('set-level', () => {
    it('should update operator level', async () => {
      // Server must be running
      vi.mocked(rcon.isContainerRunning).mockResolvedValue(true);

      // Mock existing operator
      const existingOp = Operator.create({
        uuid: 'uuid1',
        name: 'player1',
        level: OpLevel.OWNER,
        bypassesPlayerLimit: false,
      });
      vi.mocked(OpsJsonAdapter.prototype.find).mockResolvedValue(existingOp);

      const options: OpCommandOptions = {
        root: '/tmp/test',
        serverName: 'test-server',
        subCommand: 'set-level',
        playerName: 'player1',
        level: 3, // Admin
      };

      const exitCode = await opCommand(options);

      expect(exitCode).toBe(0);
      expect(OpsJsonAdapter.prototype.updateLevel).toHaveBeenCalledWith('player1', OpLevel.ADMIN);
    });

    it('should reject invalid level', async () => {
      const options: OpCommandOptions = {
        root: '/tmp/test',
        serverName: 'test-server',
        subCommand: 'set-level',
        playerName: 'player1',
        level: 5, // Invalid
      };

      const exitCode = await opCommand(options);

      expect(exitCode).toBe(1);
    });

    it('should require player name and level', async () => {
      const options: OpCommandOptions = {
        root: '/tmp/test',
        serverName: 'test-server',
        subCommand: 'set-level',
        playerName: 'player1',
      };

      const exitCode = await opCommand(options);

      expect(exitCode).toBe(1);
    });
  });

  describe('validation', () => {
    it('should require server name', async () => {
      const options: OpCommandOptions = {
        root: '/tmp/test',
        subCommand: 'list',
      };

      const exitCode = await opCommand(options);

      expect(exitCode).toBe(1);
    });

    it('should require sub command', async () => {
      const options: OpCommandOptions = {
        root: '/tmp/test',
        serverName: 'test-server',
      };

      const exitCode = await opCommand(options);

      expect(exitCode).toBe(1);
    });

    it('should reject unknown action', async () => {
      const options: OpCommandOptions = {
        root: '/tmp/test',
        serverName: 'test-server',
        subCommand: 'unknown' as any,
      };

      const exitCode = await opCommand(options);

      expect(exitCode).toBe(1);
    });
  });
});
