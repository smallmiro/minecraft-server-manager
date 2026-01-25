import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ApiPromptAdapter, type ApiPromptOptions } from '../src/infrastructure/adapters/ApiPromptAdapter.js';
import { ServerName } from '../src/domain/value-objects/ServerName.js';
import { ServerType, ServerTypeEnum } from '../src/domain/value-objects/ServerType.js';
import { McVersion } from '../src/domain/value-objects/McVersion.js';
import { Memory } from '../src/domain/value-objects/Memory.js';
import { WorldOptions } from '../src/domain/value-objects/WorldOptions.js';
import { Server, ServerStatus } from '../src/domain/entities/Server.js';
import { World } from '../src/domain/entities/World.js';

describe('ApiPromptAdapter', () => {
  describe('constructor and options', () => {
    test('should create adapter with empty options', () => {
      const adapter = new ApiPromptAdapter({});
      assert.ok(adapter);
    });

    test('should create adapter with full options', () => {
      const options: ApiPromptOptions = {
        serverName: 'myserver',
        serverType: 'PAPER',
        mcVersion: '1.21.1',
        memory: '4G',
        worldSetup: 'new',
      };
      const adapter = new ApiPromptAdapter(options);
      assert.ok(adapter);
    });
  });

  describe('basic prompts', () => {
    test('intro should not throw', () => {
      const adapter = new ApiPromptAdapter({});
      assert.doesNotThrow(() => adapter.intro('Test message'));
    });

    test('outro should not throw', () => {
      const adapter = new ApiPromptAdapter({});
      assert.doesNotThrow(() => adapter.outro('Test message'));
    });

    test('text should return pre-configured value when matching key exists', async () => {
      const adapter = new ApiPromptAdapter({ serverName: 'myserver' });
      const result = await adapter.text({ message: 'Server name:' });
      assert.strictEqual(result, 'myserver');
    });

    test('text should throw when no matching value', async () => {
      const adapter = new ApiPromptAdapter({});
      await assert.rejects(
        () => adapter.text({ message: 'Unknown prompt:' }),
        { message: /required in API mode/ }
      );
    });

    test('select should return pre-configured value', async () => {
      const adapter = new ApiPromptAdapter({ serverType: 'FORGE' });
      const result = await adapter.select({
        message: 'Server type:',
        options: [
          { value: 'PAPER', label: 'Paper' },
          { value: 'FORGE', label: 'Forge' },
        ],
      });
      assert.strictEqual(result, 'FORGE');
    });

    test('confirm should return pre-configured value', async () => {
      const adapter = new ApiPromptAdapter({ confirmValue: true });
      const result = await adapter.confirm({ message: 'Continue?' });
      assert.strictEqual(result, true);
    });

    test('confirm should default to true when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      const result = await adapter.confirm({ message: 'Continue?' });
      assert.strictEqual(result, true);
    });

    test('password should return pre-configured value', async () => {
      const adapter = new ApiPromptAdapter({ password: 'secret123' });
      const result = await adapter.password({ message: 'Password:' });
      assert.strictEqual(result, 'secret123');
    });

    test('password should throw when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      await assert.rejects(
        () => adapter.password({ message: 'Password:' }),
        { message: /required in API mode/ }
      );
    });
  });

  describe('domain-specific prompts', () => {
    test('promptServerName should return ServerName from options', async () => {
      const adapter = new ApiPromptAdapter({ serverName: 'myserver' });
      const result = await adapter.promptServerName();
      assert.ok(result instanceof ServerName);
      assert.strictEqual(result.value, 'myserver');
    });

    test('promptServerName should throw when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      await assert.rejects(
        () => adapter.promptServerName(),
        { message: /serverName is required in API mode/ }
      );
    });

    test('promptServerType should return ServerType from options', async () => {
      const adapter = new ApiPromptAdapter({ serverType: 'FORGE' });
      const result = await adapter.promptServerType();
      assert.ok(result instanceof ServerType);
      assert.strictEqual(result.value, ServerTypeEnum.FORGE);
    });

    test('promptServerType should throw when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      await assert.rejects(
        () => adapter.promptServerType(),
        { message: /serverType is required in API mode/ }
      );
    });

    test('promptMcVersion should return McVersion from options', async () => {
      const adapter = new ApiPromptAdapter({ mcVersion: '1.21.1' });
      const result = await adapter.promptMcVersion(ServerType.create('PAPER'));
      assert.ok(result instanceof McVersion);
      assert.strictEqual(result.value, '1.21.1');
    });

    test('promptMcVersion should throw when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      await assert.rejects(
        () => adapter.promptMcVersion(ServerType.create('PAPER')),
        { message: /mcVersion is required in API mode/ }
      );
    });

    test('promptMemory should return Memory from options', async () => {
      const adapter = new ApiPromptAdapter({ memory: '8G' });
      const result = await adapter.promptMemory();
      assert.ok(result instanceof Memory);
      assert.strictEqual(result.value, '8G');
    });

    test('promptMemory should throw when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      await assert.rejects(
        () => adapter.promptMemory(),
        { message: /memory is required in API mode/ }
      );
    });

    test('promptWorldOptions should return new world options', async () => {
      const adapter = new ApiPromptAdapter({ worldSetup: 'new' });
      const result = await adapter.promptWorldOptions();
      assert.ok(result instanceof WorldOptions);
      assert.strictEqual(result.isNewWorld, true);
    });

    test('promptWorldOptions should return new world with seed', async () => {
      const adapter = new ApiPromptAdapter({ worldSetup: 'new', worldSeed: '12345' });
      const result = await adapter.promptWorldOptions();
      assert.strictEqual(result.isNewWorld, true);
      assert.strictEqual(result.seed, '12345');
    });

    test('promptWorldOptions should return existing world options', async () => {
      const adapter = new ApiPromptAdapter({ worldSetup: 'existing', worldName: 'survival' });
      const result = await adapter.promptWorldOptions();
      assert.strictEqual(result.isExistingWorld, true);
      assert.strictEqual(result.worldName, 'survival');
    });

    test('promptWorldOptions should return download world options', async () => {
      const adapter = new ApiPromptAdapter({
        worldSetup: 'download',
        worldDownloadUrl: 'https://example.com/world.zip',
      });
      const result = await adapter.promptWorldOptions();
      assert.strictEqual(result.isDownloadWorld, true);
      assert.strictEqual(result.downloadUrl, 'https://example.com/world.zip');
    });

    test('promptWorldOptions should throw when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      await assert.rejects(
        () => adapter.promptWorldOptions(),
        { message: /worldSetup is required in API mode/ }
      );
    });

    test('promptServerSelection should return server by name', async () => {
      const adapter = new ApiPromptAdapter({ serverName: 'myserver' });
      const servers = [
        Server.fromStatus('myserver', 'PAPER', '1.21.1', ServerStatus.RUNNING, 0),
        Server.fromStatus('other', 'FORGE', '1.20.4', ServerStatus.STOPPED, 0),
      ];
      const result = await adapter.promptServerSelection(servers);
      assert.strictEqual(result.name.value, 'myserver');
    });

    test('promptServerSelection should throw when server not found', async () => {
      const adapter = new ApiPromptAdapter({ serverName: 'nonexistent' });
      const servers = [
        Server.fromStatus('myserver', 'PAPER', '1.21.1', ServerStatus.RUNNING, 0),
      ];
      await assert.rejects(
        () => adapter.promptServerSelection(servers),
        { message: /Server 'nonexistent' not found/ }
      );
    });

    test('promptServerSelection should throw when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      const servers = [
        Server.fromStatus('myserver', 'PAPER', '1.21.1', ServerStatus.RUNNING, 0),
      ];
      await assert.rejects(
        () => adapter.promptServerSelection(servers),
        { message: /serverName is required in API mode/ }
      );
    });

    test('promptWorldSelection should return world by name', async () => {
      const adapter = new ApiPromptAdapter({ worldName: 'survival' });
      const worlds = [
        World.fromDirectory('survival', '/worlds'),
        World.fromDirectory('creative', '/worlds'),
      ];
      const result = await adapter.promptWorldSelection(worlds);
      assert.strictEqual(result.name, 'survival');
    });

    test('promptWorldSelection should throw when world not found', async () => {
      const adapter = new ApiPromptAdapter({ worldName: 'nonexistent' });
      const worlds = [World.fromDirectory('survival', '/worlds')];
      await assert.rejects(
        () => adapter.promptWorldSelection(worlds),
        { message: /World 'nonexistent' not found/ }
      );
    });

    test('promptExistingWorldSelection should return world by name', async () => {
      const adapter = new ApiPromptAdapter({ worldName: 'survival' });
      const worlds = [
        { world: World.fromDirectory('survival', '/worlds'), category: 'available' as const, assignedServer: null },
        { world: World.fromDirectory('creative', '/worlds'), category: 'stopped' as const, assignedServer: 'mc-other' },
      ];
      const result = await adapter.promptExistingWorldSelection(worlds);
      assert.ok(result);
      assert.strictEqual(result.name, 'survival');
    });

    test('promptExistingWorldSelection should return null when no worldName configured', async () => {
      const adapter = new ApiPromptAdapter({});
      const worlds = [
        { world: World.fromDirectory('survival', '/worlds'), category: 'available' as const, assignedServer: null },
      ];
      const result = await adapter.promptExistingWorldSelection(worlds);
      assert.strictEqual(result, null);
    });
  });

  describe('status display methods', () => {
    test('spinner should return no-op implementation', () => {
      const adapter = new ApiPromptAdapter({});
      const spinner = adapter.spinner();
      assert.ok(spinner);
      assert.doesNotThrow(() => spinner.start('Loading...'));
      assert.doesNotThrow(() => spinner.message('Processing...'));
      assert.doesNotThrow(() => spinner.stop('Done'));
    });

    test('success should not throw', () => {
      const adapter = new ApiPromptAdapter({});
      assert.doesNotThrow(() => adapter.success('Operation completed'));
    });

    test('error should not throw', () => {
      const adapter = new ApiPromptAdapter({});
      assert.doesNotThrow(() => adapter.error('Something went wrong'));
    });

    test('warn should not throw', () => {
      const adapter = new ApiPromptAdapter({});
      assert.doesNotThrow(() => adapter.warn('Warning message'));
    });

    test('info should not throw', () => {
      const adapter = new ApiPromptAdapter({});
      assert.doesNotThrow(() => adapter.info('Info message'));
    });

    test('note should not throw', () => {
      const adapter = new ApiPromptAdapter({});
      assert.doesNotThrow(() => adapter.note('Note message', 'Title'));
    });
  });

  describe('utility methods', () => {
    test('isCancel should always return false in API mode', () => {
      const adapter = new ApiPromptAdapter({});
      assert.strictEqual(adapter.isCancel(undefined), false);
      assert.strictEqual(adapter.isCancel(null), false);
      assert.strictEqual(adapter.isCancel('value'), false);
      assert.strictEqual(adapter.isCancel(Symbol.for('cancel')), false);
    });

    test('handleCancel should throw ApiModeError', () => {
      const adapter = new ApiPromptAdapter({});
      assert.throws(
        () => adapter.handleCancel(),
        { name: 'ApiModeError', message: /Cancel not supported in API mode/ }
      );
    });
  });

  describe('message collector', () => {
    test('getMessages should return collected messages', () => {
      const adapter = new ApiPromptAdapter({});
      adapter.intro('Intro');
      adapter.success('Success');
      adapter.error('Error');
      adapter.warn('Warning');
      adapter.info('Info');
      adapter.outro('Outro');

      const messages = adapter.getMessages();
      assert.strictEqual(messages.length, 6);
      assert.deepStrictEqual(messages[0], { type: 'intro', message: 'Intro' });
      assert.deepStrictEqual(messages[1], { type: 'success', message: 'Success' });
      assert.deepStrictEqual(messages[2], { type: 'error', message: 'Error' });
      assert.deepStrictEqual(messages[3], { type: 'warn', message: 'Warning' });
      assert.deepStrictEqual(messages[4], { type: 'info', message: 'Info' });
      assert.deepStrictEqual(messages[5], { type: 'outro', message: 'Outro' });
    });

    test('clearMessages should reset collected messages', () => {
      const adapter = new ApiPromptAdapter({});
      adapter.success('Message 1');
      adapter.success('Message 2');
      assert.strictEqual(adapter.getMessages().length, 2);

      adapter.clearMessages();
      assert.strictEqual(adapter.getMessages().length, 0);
    });
  });
});
