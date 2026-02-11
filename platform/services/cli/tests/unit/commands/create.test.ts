import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCommand, type CreateCommandOptions } from '../../../src/commands/create.js';
import { Paths } from '@minecraft-docker/shared';
import * as container from '../../../src/infrastructure/di/container.js';

/**
 * Unit tests for create command with MODRINTH modpack support
 * Tests follow TDD approach: Red → Green → Refactor
 */
describe('create command - MODRINTH modpack support', () => {
  let mockContainer: ReturnType<typeof container.getContainer>;
  let mockCreateServerUseCase: {
    execute: ReturnType<typeof vi.fn>;
    executeWithConfig: ReturnType<typeof vi.fn>;
  };
  let mockPromptPort: {
    isCancel: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Mock container
    mockCreateServerUseCase = {
      execute: vi.fn(),
      executeWithConfig: vi.fn(),
    };
    mockPromptPort = {
      isCancel: vi.fn().mockReturnValue(false),
    };

    mockContainer = {
      createServerUseCase: mockCreateServerUseCase,
      promptPort: mockPromptPort,
    } as unknown as ReturnType<typeof container.getContainer>;

    vi.spyOn(container, 'getContainer').mockReturnValue(mockContainer);

    // Mock Paths
    vi.spyOn(Paths.prototype, 'isInitialized').mockReturnValue(true);

    // Mock sudo password prompt
    vi.mock('../../../src/lib/sudo-utils.js', () => ({
      promptSudoPasswordIfNeeded: vi.fn().mockResolvedValue(undefined),
    }));
  });

  describe('CLI argument mode with MODRINTH type', () => {
    it('should pass modpack options to executeWithConfig when --modpack is provided', async () => {
      // ARRANGE
      const options: CreateCommandOptions = {
        name: 'myserver',
        type: 'MODRINTH',
        modpack: 'cobblemon',
        modpackVersion: '1.3.2',
        modLoader: 'fabric',
        noStart: false,
      };

      const mockServer = {
        name: { value: 'myserver' },
        containerName: 'mc-myserver',
        type: { label: 'Modrinth Modpack', isModpack: true },
        version: { value: 'LATEST' },
        memory: { value: '6G' },
        modpackOptions: {
          slug: 'cobblemon',
          version: '1.3.2',
          loader: 'fabric',
        },
      };

      mockCreateServerUseCase.executeWithConfig.mockResolvedValue(mockServer);

      // ACT
      const exitCode = await createCommand(options);

      // ASSERT
      expect(exitCode).toBe(0);
      expect(mockCreateServerUseCase.executeWithConfig).toHaveBeenCalledWith({
        name: 'myserver',
        type: 'MODRINTH',
        version: undefined,
        seed: undefined,
        worldUrl: undefined,
        worldName: undefined,
        autoStart: true,
        modpackSlug: 'cobblemon',
        modpackVersion: '1.3.2',
        modLoader: 'fabric',
        enableWhitelist: true,
        whitelistPlayers: undefined,
      });
    });

    it('should pass only slug if version and loader are not provided', async () => {
      // ARRANGE
      const options: CreateCommandOptions = {
        name: 'myserver',
        type: 'MODRINTH',
        modpack: 'cobblemon',
        noStart: false,
      };

      const mockServer = {
        name: { value: 'myserver' },
        containerName: 'mc-myserver',
        type: { label: 'Modrinth Modpack', isModpack: true },
        version: { value: 'LATEST' },
        memory: { value: '6G' },
        modpackOptions: {
          slug: 'cobblemon',
        },
      };

      mockCreateServerUseCase.executeWithConfig.mockResolvedValue(mockServer);

      // ACT
      const exitCode = await createCommand(options);

      // ASSERT
      expect(exitCode).toBe(0);
      expect(mockCreateServerUseCase.executeWithConfig).toHaveBeenCalledWith({
        name: 'myserver',
        type: 'MODRINTH',
        version: undefined,
        seed: undefined,
        worldUrl: undefined,
        worldName: undefined,
        autoStart: true,
        modpackSlug: 'cobblemon',
        modpackVersion: undefined,
        modLoader: undefined,
        enableWhitelist: true,
        whitelistPlayers: undefined,
      });
    });

    it('should fail early when MODRINTH type is used without --modpack (validation)', async () => {
      // ARRANGE
      const options: CreateCommandOptions = {
        name: 'myserver',
        type: 'MODRINTH',
        // modpack is missing
        noStart: false,
      };

      // ACT
      const exitCode = await createCommand(options);

      // ASSERT
      expect(exitCode).toBe(1);
      // Should fail before calling use case (early validation)
      expect(mockCreateServerUseCase.executeWithConfig).not.toHaveBeenCalled();
    });

    it('should warn when --modpack is used with non-modpack type', async () => {
      // ARRANGE
      const options: CreateCommandOptions = {
        name: 'myserver',
        type: 'PAPER',
        modpack: 'cobblemon', // Should be ignored for PAPER
        noStart: false,
      };

      const mockServer = {
        name: { value: 'myserver' },
        containerName: 'mc-myserver',
        type: { label: 'Paper', isModpack: false },
        version: { value: '1.21.1' },
        memory: { value: '4G' },
      };

      mockCreateServerUseCase.executeWithConfig.mockResolvedValue(mockServer);

      // ACT
      const exitCode = await createCommand(options);

      // ASSERT
      expect(exitCode).toBe(0);
      // modpackSlug should still be passed, but use case should handle validation
      expect(mockCreateServerUseCase.executeWithConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PAPER',
          modpackSlug: 'cobblemon', // Passed but should be validated by use case
        })
      );
    });
  });

  describe('Output formatting for modpack servers', () => {
    it('should display modpack information in success output', async () => {
      // ARRANGE
      const options: CreateCommandOptions = {
        name: 'myserver',
        type: 'MODRINTH',
        modpack: 'cobblemon',
        modpackVersion: '1.3.2',
        modLoader: 'fabric',
        noStart: false,
      };

      const mockServer = {
        name: { value: 'myserver' },
        containerName: 'mc-myserver',
        type: { label: 'Modrinth Modpack', isModpack: true },
        version: { value: 'LATEST' },
        memory: { value: '6G' },
        modpackOptions: {
          slug: 'cobblemon',
          version: '1.3.2',
          loader: 'fabric',
        },
      };

      mockCreateServerUseCase.executeWithConfig.mockResolvedValue(mockServer);

      // Mock console.log to capture output
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // ACT
      const exitCode = await createCommand(options);

      // ASSERT
      expect(exitCode).toBe(0);

      // Verify modpack info is logged
      const loggedOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(loggedOutput).toContain('Modpack: cobblemon');
      expect(loggedOutput).toContain('Modpack Version: 1.3.2');
      expect(loggedOutput).toContain('Mod Loader: fabric');

      consoleLogSpy.mockRestore();
    });

    it('should display standard version for non-modpack servers', async () => {
      // ARRANGE
      const options: CreateCommandOptions = {
        name: 'myserver',
        type: 'PAPER',
        version: '1.21.1',
        noStart: false,
      };

      const mockServer = {
        name: { value: 'myserver' },
        containerName: 'mc-myserver',
        type: { label: 'Paper', isModpack: false },
        version: { value: '1.21.1' },
        memory: { value: '4G' },
      };

      mockCreateServerUseCase.executeWithConfig.mockResolvedValue(mockServer);

      // Mock console.log to capture output
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // ACT
      const exitCode = await createCommand(options);

      // ASSERT
      expect(exitCode).toBe(0);

      // Verify standard version is logged
      const loggedOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(loggedOutput).toContain('Version: 1.21.1');
      expect(loggedOutput).not.toContain('Modpack:');

      consoleLogSpy.mockRestore();
    });
  });

  describe('Whitelist default behavior (#282)', () => {
    it('should enable whitelist by default in CLI mode', async () => {
      // ARRANGE
      const options: CreateCommandOptions = {
        name: 'myserver',
        type: 'PAPER',
        noStart: false,
      };

      const mockServer = {
        name: { value: 'myserver', hostname: 'myserver.local' },
        containerName: 'mc-myserver',
        type: { label: 'Paper', isModpack: false },
        version: { value: '1.21.1' },
        memory: { value: '4G' },
      };

      mockCreateServerUseCase.executeWithConfig.mockResolvedValue(mockServer);

      // ACT
      const exitCode = await createCommand(options);

      // ASSERT
      expect(exitCode).toBe(0);
      expect(mockCreateServerUseCase.executeWithConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          enableWhitelist: true,
          whitelistPlayers: undefined,
        })
      );
    });

    it('should disable whitelist when --no-whitelist is provided', async () => {
      // ARRANGE
      const options: CreateCommandOptions = {
        name: 'myserver',
        type: 'PAPER',
        noWhitelist: true,
        noStart: false,
      };

      const mockServer = {
        name: { value: 'myserver', hostname: 'myserver.local' },
        containerName: 'mc-myserver',
        type: { label: 'Paper', isModpack: false },
        version: { value: '1.21.1' },
        memory: { value: '4G' },
      };

      mockCreateServerUseCase.executeWithConfig.mockResolvedValue(mockServer);

      // ACT
      const exitCode = await createCommand(options);

      // ASSERT
      expect(exitCode).toBe(0);
      expect(mockCreateServerUseCase.executeWithConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          enableWhitelist: false,
          whitelistPlayers: undefined,
        })
      );
    });

    it('should pass whitelist players when --whitelist is provided', async () => {
      // ARRANGE
      const options: CreateCommandOptions = {
        name: 'myserver',
        type: 'PAPER',
        whitelist: 'player1,player2',
        noStart: false,
      };

      const mockServer = {
        name: { value: 'myserver', hostname: 'myserver.local' },
        containerName: 'mc-myserver',
        type: { label: 'Paper', isModpack: false },
        version: { value: '1.21.1' },
        memory: { value: '4G' },
      };

      mockCreateServerUseCase.executeWithConfig.mockResolvedValue(mockServer);

      // ACT
      const exitCode = await createCommand(options);

      // ASSERT
      expect(exitCode).toBe(0);
      expect(mockCreateServerUseCase.executeWithConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          enableWhitelist: true,
          whitelistPlayers: ['player1', 'player2'],
        })
      );
    });

    it('should display whitelist enabled in success output', async () => {
      // ARRANGE
      const options: CreateCommandOptions = {
        name: 'myserver',
        type: 'PAPER',
        noStart: false,
      };

      const mockServer = {
        name: { value: 'myserver', hostname: 'myserver.local' },
        containerName: 'mc-myserver',
        type: { label: 'Paper', isModpack: false },
        version: { value: '1.21.1' },
        memory: { value: '4G' },
      };

      mockCreateServerUseCase.executeWithConfig.mockResolvedValue(mockServer);
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // ACT
      await createCommand(options);

      // ASSERT
      const loggedOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(loggedOutput).toContain('Whitelist:');
      expect(loggedOutput).toContain('enabled');

      consoleLogSpy.mockRestore();
    });
  });

  describe('Interactive mode with MODRINTH', () => {
    it('should use execute() for interactive mode when no name is provided', async () => {
      // ARRANGE
      const options: CreateCommandOptions = {
        // name is not provided → interactive mode
      };

      mockCreateServerUseCase.execute.mockResolvedValue({
        name: { value: 'myserver' },
        containerName: 'mc-myserver',
        type: { label: 'Modrinth Modpack', isModpack: true },
        version: { value: 'LATEST' },
        memory: { value: '6G' },
        modpackOptions: {
          slug: 'cobblemon',
        },
      });

      // ACT
      const exitCode = await createCommand(options);

      // ASSERT
      expect(exitCode).toBe(0);
      expect(mockCreateServerUseCase.execute).toHaveBeenCalled();
      expect(mockCreateServerUseCase.executeWithConfig).not.toHaveBeenCalled();
    });

    it('should handle user cancellation gracefully', async () => {
      // ARRANGE
      const options: CreateCommandOptions = {};

      mockPromptPort.isCancel.mockReturnValue(true);
      mockCreateServerUseCase.execute.mockRejectedValue(new Error('CANCELLED'));

      // ACT
      const exitCode = await createCommand(options);

      // ASSERT
      expect(exitCode).toBe(0); // User cancellation should return 0
      expect(mockCreateServerUseCase.execute).toHaveBeenCalled();
    });
  });

  describe('playit.gg domain registration (#272)', () => {
    it('should pass playit domain to executeWithConfig when --playit-domain is provided', async () => {
      // ARRANGE
      const options: CreateCommandOptions = {
        name: 'myserver',
        type: 'PAPER',
        playitDomain: 'aa.example.com',
        noStart: false,
      };

      const mockServer = {
        name: { value: 'myserver', hostname: 'myserver.local' },
        containerName: 'mc-myserver',
        type: { label: 'Paper', isModpack: false },
        version: { value: '1.21.1' },
        memory: { value: '4G' },
      };

      mockCreateServerUseCase.executeWithConfig.mockResolvedValue(mockServer);

      // ACT
      const exitCode = await createCommand(options);

      // ASSERT
      expect(exitCode).toBe(0);
      expect(mockCreateServerUseCase.executeWithConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'myserver',
          type: 'PAPER',
          playitDomain: 'aa.example.com',
        })
      );
    });

    it('should pass noPlayitDomain when --no-playit-domain is provided', async () => {
      // ARRANGE
      const options: CreateCommandOptions = {
        name: 'myserver',
        type: 'PAPER',
        noPlayitDomain: true,
        noStart: false,
      };

      const mockServer = {
        name: { value: 'myserver', hostname: 'myserver.local' },
        containerName: 'mc-myserver',
        type: { label: 'Paper', isModpack: false },
        version: { value: '1.21.1' },
        memory: { value: '4G' },
      };

      mockCreateServerUseCase.executeWithConfig.mockResolvedValue(mockServer);

      // ACT
      const exitCode = await createCommand(options);

      // ASSERT
      expect(exitCode).toBe(0);
      expect(mockCreateServerUseCase.executeWithConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'myserver',
          noPlayitDomain: true,
        })
      );
    });

    it('should not pass playit options when neither flag is provided', async () => {
      // ARRANGE
      const options: CreateCommandOptions = {
        name: 'myserver',
        type: 'PAPER',
        noStart: false,
      };

      const mockServer = {
        name: { value: 'myserver', hostname: 'myserver.local' },
        containerName: 'mc-myserver',
        type: { label: 'Paper', isModpack: false },
        version: { value: '1.21.1' },
        memory: { value: '4G' },
      };

      mockCreateServerUseCase.executeWithConfig.mockResolvedValue(mockServer);

      // ACT
      const exitCode = await createCommand(options);

      // ASSERT
      expect(exitCode).toBe(0);
      expect(mockCreateServerUseCase.executeWithConfig).toHaveBeenCalledWith(
        expect.not.objectContaining({
          playitDomain: expect.anything(),
          noPlayitDomain: expect.anything(),
        })
      );
    });
  });
});
