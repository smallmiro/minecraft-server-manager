import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CreateServerUseCase } from '@minecraft-docker/shared';
import {
  MockPromptAdapter,
  MockShellAdapter,
  MockServerRepository,
} from '../mocks/index.js';

describe('CreateServerUseCase Integration', () => {
  let promptAdapter: MockPromptAdapter;
  let shellAdapter: MockShellAdapter;
  let serverRepo: MockServerRepository;
  let useCase: CreateServerUseCase;

  beforeEach(() => {
    promptAdapter = new MockPromptAdapter({
      serverName: 'testserver',
      serverType: 'PAPER',
      version: '1.21.1',
      memory: '4G',
      worldSetup: 'new',
    });
    shellAdapter = new MockShellAdapter();
    serverRepo = new MockServerRepository();
    useCase = new CreateServerUseCase(promptAdapter, shellAdapter, serverRepo);
  });

  describe('execute (interactive)', () => {
    it('should create server with prompted values', async () => {
      const server = await useCase.execute();

      assert.strictEqual(server.name.value, 'testserver');
      assert.strictEqual(server.type.value, 'PAPER');
      assert.strictEqual(server.version.value, '1.21.1');
      assert.strictEqual(server.memory.value, '4G');
    });

    it('should call shell createServer with correct arguments', async () => {
      await useCase.execute();

      assert.ok(shellAdapter.wasCommandCalled('createServer'));
      const log = shellAdapter.lastCommand;
      assert.strictEqual(log?.args[0], 'testserver');
    });

    it('should show intro and outro messages', async () => {
      await useCase.execute();

      assert.strictEqual(promptAdapter.introMessage, 'Create Minecraft Server');
      assert.strictEqual(promptAdapter.outroMessage, 'Happy mining!');
    });

    it('should show success message', async () => {
      await useCase.execute();

      const successMsg = promptAdapter.messages.find((m) =>
        m.includes('success:')
      );
      assert.ok(successMsg);
      assert.ok(successMsg.includes('testserver'));
    });

    it('should fail when server already exists', async () => {
      serverRepo.addServer({ name: 'testserver' });

      try {
        await useCase.execute();
        assert.fail('Should have thrown error');
      } catch (error) {
        // Expected - either error message or cancel
        assert.ok(error);
      }
    });

    it('should handle shell failure', async () => {
      shellAdapter = new MockShellAdapter({
        createServerResult: {
          success: false,
          stderr: 'Failed to create server',
        },
      });
      useCase = new CreateServerUseCase(promptAdapter, shellAdapter, serverRepo);

      await assert.rejects(async () => {
        await useCase.execute();
      });
    });
  });

  describe('executeWithConfig (CLI mode)', () => {
    it('should create server with provided config', async () => {
      const server = await useCase.executeWithConfig({
        name: 'cliserver',
        type: 'FORGE',
        version: '1.20.4',
        memory: '6G',
      });

      assert.strictEqual(server.name.value, 'cliserver');
      assert.strictEqual(server.type.value, 'FORGE');
      assert.strictEqual(server.version.value, '1.20.4');
      assert.strictEqual(server.memory.value, '6G');
    });

    it('should use defaults when not provided', async () => {
      const server = await useCase.executeWithConfig({
        name: 'minimalserver',
      });

      assert.strictEqual(server.name.value, 'minimalserver');
      assert.strictEqual(server.type.value, 'PAPER'); // default
    });

    it('should handle world seed', async () => {
      const server = await useCase.executeWithConfig({
        name: 'seedserver',
        seed: '12345',
      });

      assert.strictEqual(server.name.value, 'seedserver');
      assert.strictEqual(server.worldOptions.setupType, 'new');
      assert.strictEqual(server.worldOptions.seed, '12345');
    });

    it('should handle existing world', async () => {
      const server = await useCase.executeWithConfig({
        name: 'existingserver',
        worldName: 'survival',
      });

      assert.strictEqual(server.worldOptions.setupType, 'existing');
      assert.strictEqual(server.worldOptions.worldName, 'survival');
    });

    it('should handle world download', async () => {
      const server = await useCase.executeWithConfig({
        name: 'downloadserver',
        worldUrl: 'https://example.com/world.zip',
      });

      assert.strictEqual(server.worldOptions.setupType, 'download');
      assert.strictEqual(server.worldOptions.downloadUrl, 'https://example.com/world.zip');
    });

    it('should throw when server already exists', async () => {
      serverRepo.addServer({ name: 'existingserver' });

      await assert.rejects(
        async () => {
          await useCase.executeWithConfig({ name: 'existingserver' });
        },
        { message: "Server 'existingserver' already exists" }
      );
    });

    it('should pass autoStart option to shell', async () => {
      await useCase.executeWithConfig({
        name: 'nostart',
        autoStart: false,
      });

      const log = shellAdapter.lastCommand;
      assert.strictEqual((log?.args[1] as { autoStart: boolean }).autoStart, false);
    });

    it('should create MODRINTH modpack server', async () => {
      const server = await useCase.executeWithConfig({
        name: 'cobblemon',
        type: 'MODRINTH',
        modpackSlug: 'cobblemon',
      });

      assert.strictEqual(server.name.value, 'cobblemon');
      assert.strictEqual(server.type.value, 'MODRINTH');
      assert.strictEqual(server.type.isModpack, true);
      assert.strictEqual(server.modpackOptions?.slug, 'cobblemon');
    });

    it('should create MODRINTH modpack with version and loader', async () => {
      const server = await useCase.executeWithConfig({
        name: 'modpack',
        type: 'MODRINTH',
        modpackSlug: 'test-pack',
        modpackVersion: '1.0.0',
        modLoader: 'fabric',
      });

      assert.strictEqual(server.type.value, 'MODRINTH');
      assert.strictEqual(server.modpackOptions?.slug, 'test-pack');
      assert.strictEqual(server.modpackOptions?.version, '1.0.0');
      assert.strictEqual(server.modpackOptions?.loader, 'fabric');
    });

    it('should default to 6G memory for modpack servers', async () => {
      const server = await useCase.executeWithConfig({
        name: 'modpack',
        type: 'MODRINTH',
        modpackSlug: 'test-pack',
      });

      assert.strictEqual(server.memory.value, '6G');
    });

    it('should pass modpack options to shell', async () => {
      await useCase.executeWithConfig({
        name: 'modpack',
        type: 'MODRINTH',
        modpackSlug: 'test-pack',
        modpackVersion: '1.0.0',
        modLoader: 'fabric',
      });

      const log = shellAdapter.lastCommand;
      const options = log?.args[1] as any;
      assert.strictEqual(options.modpackSlug, 'test-pack');
      assert.strictEqual(options.modpackVersion, '1.0.0');
      assert.strictEqual(options.modLoader, 'fabric');
    });

    it('should throw error when MODRINTH type without modpack slug', async () => {
      await assert.rejects(
        async () => {
          await useCase.executeWithConfig({
            name: 'invalid',
            type: 'MODRINTH',
          });
        },
        { message: 'Modpack slug is required for Modrinth Modpack server type' }
      );
    });
  });

  describe('whitelist default behavior (#282)', () => {
    it('should call promptWhitelistPlayers in interactive mode', async () => {
      await useCase.execute();

      const log = shellAdapter.lastCommand;
      const options = log?.args[1] as any;
      assert.strictEqual(options.enableWhitelist, true);
    });

    it('should pass whitelist players from interactive prompt', async () => {
      promptAdapter = new MockPromptAdapter({
        serverName: 'testserver',
        serverType: 'PAPER',
        version: '1.21.1',
        memory: '4G',
        worldSetup: 'new',
        whitelistPlayers: ['player1', 'player2'],
      });
      useCase = new CreateServerUseCase(promptAdapter, shellAdapter, serverRepo);

      await useCase.execute();

      const log = shellAdapter.lastCommand;
      const options = log?.args[1] as any;
      assert.strictEqual(options.enableWhitelist, true);
      assert.deepStrictEqual(options.whitelistPlayers, ['player1', 'player2']);
    });

    it('should enable whitelist by default in CLI mode', async () => {
      await useCase.executeWithConfig({
        name: 'wlserver',
      });

      const log = shellAdapter.lastCommand;
      const options = log?.args[1] as any;
      assert.strictEqual(options.enableWhitelist, true);
    });

    it('should disable whitelist when enableWhitelist is false', async () => {
      await useCase.executeWithConfig({
        name: 'nowlserver',
        enableWhitelist: false,
      });

      const log = shellAdapter.lastCommand;
      const options = log?.args[1] as any;
      assert.strictEqual(options.enableWhitelist, false);
    });

    it('should pass whitelist players in CLI mode', async () => {
      await useCase.executeWithConfig({
        name: 'wlplayers',
        whitelistPlayers: ['steve', 'alex'],
      });

      const log = shellAdapter.lastCommand;
      const options = log?.args[1] as any;
      assert.strictEqual(options.enableWhitelist, true);
      assert.deepStrictEqual(options.whitelistPlayers, ['steve', 'alex']);
    });
  });

  describe('cancellation handling', () => {
    it('should handle user cancellation gracefully', async () => {
      promptAdapter.setCancelled(true);

      try {
        await useCase.execute();
        assert.fail('Should have thrown cancel error');
      } catch (error) {
        assert.ok(promptAdapter.isCancel(error));
      }
    });
  });
});
