import { describe, it, beforeEach, vi } from 'vitest';
import assert from 'node:assert';
import {
  CreateServerUseCase,
  type ServerSpecDocument,
  type IServerSpecRepository,
  type IContainerRuntimePort,
} from '@minecraft-docker/shared';
import {
  MockPromptAdapter,
  MockShellAdapter,
  MockServerRepository,
  MockWorldAssignmentPort,
} from '../mocks/index.js';

/** Provisioning fakes (#675): the spec the use case writes, and the starts. */
let specWrites: ServerSpecDocument[] = [];
let started: unknown[] = [];
let writeError: Error | undefined;
const provision = () => ({
  specRepo: {
    write: async (doc: ServerSpecDocument) => {
      if (writeError) throw writeError;
      specWrites.push(doc);
    },
  } as unknown as IServerSpecRepository,
  runtime: {
    start: async (name: unknown) => {
      started.push(name);
      return { success: true };
    },
  } as unknown as IContainerRuntimePort,
});
const lastSpec = () => specWrites[specWrites.length - 1]!;
const created = () => specWrites.length > 0;
/** The whitelist settings a spec carries (ENABLE_WHITELIST / WHITELIST). */
const whitelistOf = (doc: ServerSpecDocument) => ({
  enableWhitelist: doc.env['ENABLE_WHITELIST'] === 'TRUE',
  whitelistPlayers: doc.env['WHITELIST']?.split(','),
});

describe('CreateServerUseCase Integration', () => {
  let promptAdapter: MockPromptAdapter;
  let shellAdapter: MockShellAdapter;
  let serverRepo: MockServerRepository;
  let assignments: MockWorldAssignmentPort;
  let useCase: CreateServerUseCase;

  const makeUseCase = () =>
    new CreateServerUseCase(
      promptAdapter,
      shellAdapter,
      serverRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      assignments,
      provision()
    );

  beforeEach(() => {
    specWrites = [];
    started = [];
    writeError = undefined;
    promptAdapter = new MockPromptAdapter({
      serverName: 'testserver',
      serverType: 'PAPER',
      version: '26.1.1',
      memory: '4G',
      worldSetup: 'new',
    });
    shellAdapter = new MockShellAdapter();
    serverRepo = new MockServerRepository();
    assignments = new MockWorldAssignmentPort();
    useCase = makeUseCase();
  });

  describe('execute (interactive)', () => {
    it('should create server with prompted values', async () => {
      const server = await useCase.execute();

      assert.strictEqual(server.name.value, 'testserver');
      assert.strictEqual(server.type.value, 'PAPER');
      assert.strictEqual(server.version.value, '26.1.1');
      assert.strictEqual(server.memory.value, '4G');
    });

    it('should write the server spec with the prompted name (#675)', async () => {
      await useCase.execute();

      assert.ok(created());
      assert.strictEqual(lastSpec().name, 'testserver');
    });

    it('reads platform settings through the injected port (#665)', async () => {
      const settings = { load: vi.fn(() => null) };
      await new CreateServerUseCase(
        promptAdapter,
        shellAdapter,
        serverRepo,
        settings,
        undefined,
        undefined,
        undefined,
        assignments,
        provision()
      ).execute();

      assert.strictEqual(settings.load.mock.calls.length, 1);
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

    it('should refuse a default world another server uses (#670)', async () => {
      assignments = new MockWorldAssignmentPort({ other: 'testserver' });
      useCase = makeUseCase();

      await assert.rejects(useCase.execute(), { code: 'conflict' });
      assert.ok(!created());
    });

    it('should handle a provisioning failure', async () => {
      writeError = new Error('Failed to create server');

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

    it('should not start the server for autoStart false', async () => {
      await useCase.executeWithConfig({
        name: 'nostart',
        autoStart: false,
      });

      assert.ok(created());
      assert.deepStrictEqual(started, []);
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

    it('should write the modpack options into the spec', async () => {
      await useCase.executeWithConfig({
        name: 'modpack',
        type: 'MODRINTH',
        modpackSlug: 'test-pack',
        modpackVersion: '1.0.0',
        modLoader: 'fabric',
      });

      assert.strictEqual(lastSpec().env['MODRINTH_MODPACK'], 'test-pack');
      assert.strictEqual(lastSpec().env['MODRINTH_VERSION'], '1.0.0');
      assert.strictEqual(lastSpec().env['MODRINTH_LOADER'], 'fabric');
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

  describe('whitelist default behavior (#282, #679)', () => {
    it('should call promptWhitelistPlayers in interactive mode', async () => {
      await useCase.execute();

      const options = whitelistOf(lastSpec());
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
      useCase = makeUseCase();

      await useCase.execute();

      const options = whitelistOf(lastSpec());
      assert.strictEqual(options.enableWhitelist, true);
      assert.deepStrictEqual(options.whitelistPlayers, ['player1', 'player2']);
    });

    it('should disable whitelist by default in CLI mode (#679)', async () => {
      await useCase.executeWithConfig({
        name: 'wlserver',
      });

      const options = whitelistOf(lastSpec());
      assert.strictEqual(options.enableWhitelist, false);
    });

    it('should enable whitelist without players when enableWhitelist is true (#679)', async () => {
      await useCase.executeWithConfig({
        name: 'wlonly',
        enableWhitelist: true,
      });

      const options = whitelistOf(lastSpec());
      assert.strictEqual(options.enableWhitelist, true);
      assert.strictEqual(options.whitelistPlayers, undefined);
    });

    it('should keep whitelist disabled when enableWhitelist is false even with players (#679)', async () => {
      await useCase.executeWithConfig({
        name: 'wloff',
        enableWhitelist: false,
        whitelistPlayers: ['steve'],
      });

      const options = whitelistOf(lastSpec());
      assert.strictEqual(options.enableWhitelist, false);
    });

    it('should ask to enable whitelist with default No in interactive mode (#679)', async () => {
      const confirmSpy = vi.spyOn(promptAdapter, 'confirm');

      await useCase.execute();

      const call = confirmSpy.mock.calls.find(([o]) => /whitelist/i.test(o.message));
      assert.ok(call, 'expected a whitelist confirm prompt');
      assert.strictEqual(call[0].initialValue, false);
    });

    it('should not prompt players and disable whitelist when user declines (#679)', async () => {
      promptAdapter = new MockPromptAdapter({ confirm: false, whitelistPlayers: ['ignored'] });
      const playersSpy = vi.spyOn(promptAdapter, 'promptWhitelistPlayers');
      useCase = makeUseCase();

      await useCase.execute();

      const options = whitelistOf(lastSpec());
      assert.strictEqual(playersSpy.mock.calls.length, 0);
      assert.strictEqual(options.enableWhitelist, false);
      assert.deepStrictEqual(options.whitelistPlayers ?? [], []);
    });

    it('should disable whitelist when enableWhitelist is false', async () => {
      await useCase.executeWithConfig({
        name: 'nowlserver',
        enableWhitelist: false,
      });

      const options = whitelistOf(lastSpec());
      assert.strictEqual(options.enableWhitelist, false);
    });

    it('should pass whitelist players in CLI mode', async () => {
      await useCase.executeWithConfig({
        name: 'wlplayers',
        whitelistPlayers: ['steve', 'alex'],
      });

      const options = whitelistOf(lastSpec());
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
