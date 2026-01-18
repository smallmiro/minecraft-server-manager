import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { WorldManagementUseCase } from '../../src/application/use-cases/WorldManagementUseCase.js';
import {
  MockPromptAdapter,
  MockShellAdapter,
  MockServerRepository,
  MockWorldRepository,
} from '../mocks/index.js';

describe('WorldManagementUseCase Integration', () => {
  let promptAdapter: MockPromptAdapter;
  let shellAdapter: MockShellAdapter;
  let serverRepo: MockServerRepository;
  let worldRepo: MockWorldRepository;
  let useCase: WorldManagementUseCase;

  beforeEach(() => {
    promptAdapter = new MockPromptAdapter({
      confirm: true,
      selectIndex: 0,
    });
    shellAdapter = new MockShellAdapter();
    serverRepo = new MockServerRepository([
      { name: 'server1' },
      { name: 'server2' },
    ]);
    worldRepo = new MockWorldRepository([
      { name: 'survival', isLocked: false },
      { name: 'creative', isLocked: true, lockedBy: 'mc-server1' },
      { name: 'hardcore', isLocked: false },
    ]);
    useCase = new WorldManagementUseCase(
      promptAdapter,
      shellAdapter,
      worldRepo,
      serverRepo
    );
  });

  describe('listWorlds', () => {
    it('should list all worlds with lock status', async () => {
      const worlds = await useCase.listWorlds();

      assert.strictEqual(worlds.length, 3);

      const survival = worlds.find((w) => w.name === 'survival');
      assert.ok(survival);
      assert.strictEqual(survival.isLocked, false);

      const creative = worlds.find((w) => w.name === 'creative');
      assert.ok(creative);
      assert.strictEqual(creative.isLocked, true);
      assert.strictEqual(creative.lockedBy, 'mc-server1');
    });

    it('should return empty array when no worlds', async () => {
      worldRepo.clear();
      const worlds = await useCase.listWorlds();
      assert.deepStrictEqual(worlds, []);
    });
  });

  describe('assignWorld (interactive)', () => {
    it('should assign world to selected server', async () => {
      const result = await useCase.assignWorld();

      assert.strictEqual(result.success, true);
      assert.ok(shellAdapter.wasCommandCalled('worldAssign'));
    });

    it('should show intro message', async () => {
      await useCase.assignWorld();
      assert.strictEqual(promptAdapter.introMessage, 'Assign World to Server');
    });

    it('should return error when no unlocked worlds', async () => {
      worldRepo = new MockWorldRepository([
        { name: 'locked1', isLocked: true, lockedBy: 'server1' },
        { name: 'locked2', isLocked: true, lockedBy: 'server2' },
      ]);
      useCase = new WorldManagementUseCase(
        promptAdapter,
        shellAdapter,
        worldRepo,
        serverRepo
      );

      const result = await useCase.assignWorld();

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('No unlocked worlds'));
    });

    it('should return error when no servers', async () => {
      serverRepo.clear();

      const result = await useCase.assignWorld();

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('No servers'));
    });
  });

  describe('assignWorldByName', () => {
    it('should assign world to server by name', async () => {
      const result = await useCase.assignWorldByName('survival', 'server1');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.worldName, 'survival');
      assert.strictEqual(result.serverName, 'server1');
    });

    it('should return error when world not found', async () => {
      const result = await useCase.assignWorldByName('nonexistent', 'server1');

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('not found'));
    });

    it('should return error when world is locked', async () => {
      const result = await useCase.assignWorldByName('creative', 'server2');

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('already locked'));
    });

    it('should return error when server not found', async () => {
      const result = await useCase.assignWorldByName('survival', 'nonexistent');

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('Server'));
    });
  });

  describe('releaseWorld (interactive)', () => {
    it('should release lock on selected world', async () => {
      const result = await useCase.releaseWorld();

      assert.strictEqual(result.success, true);
      assert.ok(shellAdapter.wasCommandCalled('worldRelease'));
    });

    it('should show intro message', async () => {
      await useCase.releaseWorld();
      assert.strictEqual(promptAdapter.introMessage, 'Release World Lock');
    });

    it('should return error when no locked worlds', async () => {
      worldRepo = new MockWorldRepository([
        { name: 'unlocked1', isLocked: false },
        { name: 'unlocked2', isLocked: false },
      ]);
      useCase = new WorldManagementUseCase(
        promptAdapter,
        shellAdapter,
        worldRepo,
        serverRepo
      );

      const result = await useCase.releaseWorld();

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('No locked worlds'));
    });

    it('should return error when user declines', async () => {
      promptAdapter = new MockPromptAdapter({ confirm: false });
      useCase = new WorldManagementUseCase(
        promptAdapter,
        shellAdapter,
        worldRepo,
        serverRepo
      );

      const result = await useCase.releaseWorld();

      assert.strictEqual(result.success, false);
      assert.ok(!shellAdapter.wasCommandCalled('worldRelease'));
    });
  });

  describe('releaseWorldByName', () => {
    it('should release world lock by name', async () => {
      const result = await useCase.releaseWorldByName('creative');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.worldName, 'creative');
      assert.strictEqual(result.previousServer, 'mc-server1');
    });

    it('should return error when world not found', async () => {
      const result = await useCase.releaseWorldByName('nonexistent');

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('not found'));
    });

    it('should return error when world is not locked', async () => {
      const result = await useCase.releaseWorldByName('survival');

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('not locked'));
    });
  });

  describe('cancellation handling', () => {
    it('should handle cancellation in assignWorld', async () => {
      promptAdapter.setCancelled(true);

      const result = await useCase.assignWorld();

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Cancelled');
    });

    it('should handle cancellation in releaseWorld', async () => {
      promptAdapter.setCancelled(true);

      const result = await useCase.releaseWorld();

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Cancelled');
    });
  });
});
