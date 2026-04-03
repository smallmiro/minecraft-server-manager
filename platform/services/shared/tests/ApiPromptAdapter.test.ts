import { describe, test, expect } from 'vitest';
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
      expect(adapter).toBeTruthy();
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
      expect(adapter).toBeTruthy();
    });
  });

  describe('basic prompts', () => {
    test('intro should not throw', () => {
      const adapter = new ApiPromptAdapter({});
      expect(() => adapter.intro('Test message')).not.toThrow();
    });

    test('outro should not throw', () => {
      const adapter = new ApiPromptAdapter({});
      expect(() => adapter.outro('Test message')).not.toThrow();
    });

    test('text should return pre-configured value when matching key exists', async () => {
      const adapter = new ApiPromptAdapter({ serverName: 'myserver' });
      const result = await adapter.text({ message: 'Server name:' });
      expect(result).toBe('myserver');
    });

    test('text should throw when no matching value', async () => {
      const adapter = new ApiPromptAdapter({});
      await expect(adapter.text({ message: 'Unknown prompt:' })).rejects.toThrow(/required in API mode/);
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
      expect(result).toBe('FORGE');
    });

    test('confirm should return pre-configured value', async () => {
      const adapter = new ApiPromptAdapter({ confirmValue: true });
      const result = await adapter.confirm({ message: 'Continue?' });
      expect(result).toBe(true);
    });

    test('confirm should default to true when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      const result = await adapter.confirm({ message: 'Continue?' });
      expect(result).toBe(true);
    });

    test('password should return pre-configured value', async () => {
      const adapter = new ApiPromptAdapter({ password: 'secret123' });
      const result = await adapter.password({ message: 'Password:' });
      expect(result).toBe('secret123');
    });

    test('password should throw when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      await expect(adapter.password({ message: 'Password:' })).rejects.toThrow(/required in API mode/);
    });
  });

  describe('domain-specific prompts', () => {
    test('promptServerName should return ServerName from options', async () => {
      const adapter = new ApiPromptAdapter({ serverName: 'myserver' });
      const result = await adapter.promptServerName();
      expect(result instanceof ServerName).toBeTruthy();
      expect(result.value).toBe('myserver');
    });

    test('promptServerName should throw when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      await expect(adapter.promptServerName()).rejects.toThrow(/serverName is required in API mode/);
    });

    test('promptServerType should return ServerType from options', async () => {
      const adapter = new ApiPromptAdapter({ serverType: 'FORGE' });
      const result = await adapter.promptServerType();
      expect(result instanceof ServerType).toBeTruthy();
      expect(result.value).toBe(ServerTypeEnum.FORGE);
    });

    test('promptServerType should throw when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      await expect(adapter.promptServerType()).rejects.toThrow(/serverType is required in API mode/);
    });

    test('promptMcVersion should return McVersion from options', async () => {
      const adapter = new ApiPromptAdapter({ mcVersion: '1.21.1' });
      const result = await adapter.promptMcVersion(ServerType.create('PAPER'));
      expect(result instanceof McVersion).toBeTruthy();
      expect(result.value).toBe('1.21.1');
    });

    test('promptMcVersion should throw when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      await expect(adapter.promptMcVersion(ServerType.create('PAPER'))).rejects.toThrow(/mcVersion is required in API mode/);
    });

    test('promptMemory should return Memory from options', async () => {
      const adapter = new ApiPromptAdapter({ memory: '8G' });
      const result = await adapter.promptMemory();
      expect(result instanceof Memory).toBeTruthy();
      expect(result.value).toBe('8G');
    });

    test('promptMemory should throw when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      await expect(adapter.promptMemory()).rejects.toThrow(/memory is required in API mode/);
    });

    test('promptWorldOptions should return new world options', async () => {
      const adapter = new ApiPromptAdapter({ worldSetup: 'new' });
      const result = await adapter.promptWorldOptions();
      expect(result instanceof WorldOptions).toBeTruthy();
      expect(result.isNewWorld).toBe(true);
    });

    test('promptWorldOptions should return new world with seed', async () => {
      const adapter = new ApiPromptAdapter({ worldSetup: 'new', worldSeed: '12345' });
      const result = await adapter.promptWorldOptions();
      expect(result.isNewWorld).toBe(true);
      expect(result.seed).toBe('12345');
    });

    test('promptWorldOptions should return existing world options', async () => {
      const adapter = new ApiPromptAdapter({ worldSetup: 'existing', worldName: 'survival' });
      const result = await adapter.promptWorldOptions();
      expect(result.isExistingWorld).toBe(true);
      expect(result.worldName).toBe('survival');
    });

    test('promptWorldOptions should return download world options', async () => {
      const adapter = new ApiPromptAdapter({
        worldSetup: 'download',
        worldDownloadUrl: 'https://example.com/world.zip',
      });
      const result = await adapter.promptWorldOptions();
      expect(result.isDownloadWorld).toBe(true);
      expect(result.downloadUrl).toBe('https://example.com/world.zip');
    });

    test('promptWorldOptions should throw when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      await expect(adapter.promptWorldOptions()).rejects.toThrow(/worldSetup is required in API mode/);
    });

    test('promptServerSelection should return server by name', async () => {
      const adapter = new ApiPromptAdapter({ serverName: 'myserver' });
      const servers = [
        Server.fromStatus('myserver', 'PAPER', '1.21.1', ServerStatus.RUNNING, 0),
        Server.fromStatus('other', 'FORGE', '1.20.4', ServerStatus.STOPPED, 0),
      ];
      const result = await adapter.promptServerSelection(servers);
      expect(result.name.value).toBe('myserver');
    });

    test('promptServerSelection should throw when server not found', async () => {
      const adapter = new ApiPromptAdapter({ serverName: 'nonexistent' });
      const servers = [
        Server.fromStatus('myserver', 'PAPER', '1.21.1', ServerStatus.RUNNING, 0),
      ];
      await expect(adapter.promptServerSelection(servers)).rejects.toThrow(/Server 'nonexistent' not found/);
    });

    test('promptServerSelection should throw when not configured', async () => {
      const adapter = new ApiPromptAdapter({});
      const servers = [
        Server.fromStatus('myserver', 'PAPER', '1.21.1', ServerStatus.RUNNING, 0),
      ];
      await expect(adapter.promptServerSelection(servers)).rejects.toThrow(/serverName is required in API mode/);
    });

    test('promptWorldSelection should return world by name', async () => {
      const adapter = new ApiPromptAdapter({ worldName: 'survival' });
      const worlds = [
        World.fromDirectory('survival', '/worlds'),
        World.fromDirectory('creative', '/worlds'),
      ];
      const result = await adapter.promptWorldSelection(worlds);
      expect(result.name).toBe('survival');
    });

    test('promptWorldSelection should throw when world not found', async () => {
      const adapter = new ApiPromptAdapter({ worldName: 'nonexistent' });
      const worlds = [World.fromDirectory('survival', '/worlds')];
      await expect(adapter.promptWorldSelection(worlds)).rejects.toThrow(/World 'nonexistent' not found/);
    });

    test('promptExistingWorldSelection should return world by name', async () => {
      const adapter = new ApiPromptAdapter({ worldName: 'survival' });
      const worlds = [
        { world: World.fromDirectory('survival', '/worlds'), category: 'available' as const, assignedServer: null },
        { world: World.fromDirectory('creative', '/worlds'), category: 'stopped' as const, assignedServer: 'mc-other' },
      ];
      const result = await adapter.promptExistingWorldSelection(worlds);
      expect(result).toBeTruthy();
      expect(result.name).toBe('survival');
    });

    test('promptExistingWorldSelection should return null when no worldName configured', async () => {
      const adapter = new ApiPromptAdapter({});
      const worlds = [
        { world: World.fromDirectory('survival', '/worlds'), category: 'available' as const, assignedServer: null },
      ];
      const result = await adapter.promptExistingWorldSelection(worlds);
      expect(result).toBe(null);
    });
  });

  describe('status display methods', () => {
    test('spinner should return no-op implementation', () => {
      const adapter = new ApiPromptAdapter({});
      const spinner = adapter.spinner();
      expect(spinner).toBeTruthy();
      expect(() => spinner.start('Loading...')).not.toThrow();
      expect(() => spinner.message('Processing...')).not.toThrow();
      expect(() => spinner.stop('Done')).not.toThrow();
    });

    test('success should not throw', () => {
      const adapter = new ApiPromptAdapter({});
      expect(() => adapter.success('Operation completed')).not.toThrow();
    });

    test('error should not throw', () => {
      const adapter = new ApiPromptAdapter({});
      expect(() => adapter.error('Something went wrong')).not.toThrow();
    });

    test('warn should not throw', () => {
      const adapter = new ApiPromptAdapter({});
      expect(() => adapter.warn('Warning message')).not.toThrow();
    });

    test('info should not throw', () => {
      const adapter = new ApiPromptAdapter({});
      expect(() => adapter.info('Info message')).not.toThrow();
    });

    test('note should not throw', () => {
      const adapter = new ApiPromptAdapter({});
      expect(() => adapter.note('Note message', 'Title')).not.toThrow();
    });
  });

  describe('utility methods', () => {
    test('isCancel should always return false in API mode', () => {
      const adapter = new ApiPromptAdapter({});
      expect(adapter.isCancel(undefined)).toBe(false);
      expect(adapter.isCancel(null)).toBe(false);
      expect(adapter.isCancel('value')).toBe(false);
      expect(adapter.isCancel(Symbol.for('cancel'))).toBe(false);
    });

    test('handleCancel should throw ApiModeError', () => {
      const adapter = new ApiPromptAdapter({});
      expect(() => adapter.handleCancel()).toThrow(/Cancel not supported in API mode/);
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
      expect(messages.length).toBe(6);
      expect(messages[0]).toEqual({ type: 'intro', message: 'Intro' });
      expect(messages[1]).toEqual({ type: 'success', message: 'Success' });
      expect(messages[2]).toEqual({ type: 'error', message: 'Error' });
      expect(messages[3]).toEqual({ type: 'warn', message: 'Warning' });
      expect(messages[4]).toEqual({ type: 'info', message: 'Info' });
      expect(messages[5]).toEqual({ type: 'outro', message: 'Outro' });
    });

    test('clearMessages should reset collected messages', () => {
      const adapter = new ApiPromptAdapter({});
      adapter.success('Message 1');
      adapter.success('Message 2');
      expect(adapter.getMessages().length).toBe(2);

      adapter.clearMessages();
      expect(adapter.getMessages().length).toBe(0);
    });
  });
});
