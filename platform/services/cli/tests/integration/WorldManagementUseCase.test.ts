import { describe, it, beforeEach } from 'vitest';
import assert from 'node:assert';
import { WorldManagementUseCase } from '@minecraft-docker/shared';
import {
  MockPromptAdapter,
  MockShellAdapter,
  MockServerRepository,
  MockWorldRepository,
  MockWorldAssignmentPort,
  createMockContainerRuntime,
} from '../mocks/index.js';

describe('WorldManagementUseCase Integration', () => {
  let promptAdapter: MockPromptAdapter;
  let shellAdapter: MockShellAdapter;
  let serverRepo: MockServerRepository;
  let worldRepo: MockWorldRepository;
  let assignments: MockWorldAssignmentPort;
  let runtime: ReturnType<typeof createMockContainerRuntime>;
  let useCase: WorldManagementUseCase;

  const makeUseCase = () =>
    new WorldManagementUseCase(
      promptAdapter,
      shellAdapter,
      worldRepo,
      serverRepo,
      assignments,
      runtime.runtime
    );

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
      { name: 'creative', isLocked: true, lockedBy: 'server1' },
      { name: 'hardcore', isLocked: false },
    ]);
    // A server's world is its LEVEL (#670): server1 uses 'creative'
    assignments = new MockWorldAssignmentPort({ server1: 'creative', server2: 'server2' });
    runtime = createMockContainerRuntime();
    useCase = makeUseCase();
  });

  describe('createWorld (CLI mode)', () => {
    it('should create world with name only', async () => {
      const result = await useCase.createWorld({ name: 'newworld' });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.worldName, 'newworld');
    });

    it('should create world with seed', async () => {
      const result = await useCase.createWorld({
        name: 'seededworld',
        seed: '12345',
        serverName: 'server1',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.worldName, 'seededworld');
      assert.strictEqual(result.seed, '12345');
      // SEED goes with LEVEL through the assignment port; mcctl.sh config is gone (#734)
      assert.strictEqual(assignments.seeds.get('server1'), '12345');
      assert.ok(!shellAdapter.wasCommandCalled('setServerConfig'));
    });

    it('should return error when world already exists', async () => {
      const result = await useCase.createWorld({ name: 'survival' });

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('already exists'));
    });

    it('should return error when server not found', async () => {
      const result = await useCase.createWorld({
        name: 'newworld',
        serverName: 'nonexistent',
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('not found'));
    });

    it('should refuse a running server without stopping it (#670)', async () => {
      runtime = createMockContainerRuntime('running');
      useCase = makeUseCase();

      const result = await useCase.createWorld({
        name: 'newworld',
        serverName: 'server1',
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errorCode, 'server_running');
      assert.ok(!shellAdapter.wasCommandCalled('stopServer'));
      assert.ok(!assignments.wasCalled('assign'));
      assert.strictEqual(await worldRepo.exists('newworld'), false);
    });

    it('should start server when autoStart is true', async () => {
      const result = await useCase.createWorld({
        name: 'newworld',
        serverName: 'server1',
        autoStart: true,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.started, true);
      assert.deepStrictEqual(runtime.started, ['mc-server1']);
    });

    it('should not start server when autoStart is false', async () => {
      const result = await useCase.createWorld({
        name: 'newworld',
        serverName: 'server1',
        autoStart: false,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.started, false);
      assert.deepStrictEqual(runtime.started, []);
    });

    it('should return error when no servers available', async () => {
      serverRepo.clear();

      const result = await useCase.createWorld({ name: 'newworld' });

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('No servers'));
    });

    it('should handle a LEVEL write failure', async () => {
      assignments.failNext = new Error('Config error');

      const result = await useCase.createWorld({
        name: 'newworld',
        serverName: 'server1',
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('Config error'));
      assert.ok(!shellAdapter.wasCommandCalled('setServerConfig'));
    });
  });

  describe('createWorld (interactive mode)', () => {
    it('should prompt for world name when not provided', async () => {
      promptAdapter.textValues = ['interactiveworld', ''];  // world name, seed (empty)

      const result = await useCase.createWorld();

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.worldName, 'interactiveworld');
      assert.strictEqual(promptAdapter.introMessage, 'Create New World');
    });

    it('should prompt for seed in interactive mode', async () => {
      promptAdapter.textValues = ['seedworld', '98765'];
      promptAdapter = new MockPromptAdapter({
        confirm: true,
        selectIndex: 0,
      });
      promptAdapter.textValues = ['seedworld', '98765'];

      useCase = makeUseCase();

      const result = await useCase.createWorld();

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.worldName, 'seedworld');
    });

    it('should handle cancellation', async () => {
      promptAdapter.setCancelled(true);

      const result = await useCase.createWorld();

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Cancelled');
    });
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
      assert.strictEqual(creative.lockedBy, 'server1');
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
      assert.deepStrictEqual(assignments.calls[0], { method: 'assign', args: ['survival', 'server1'] });
      assert.ok(!shellAdapter.wasCommandCalled('worldAssign'));
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
      useCase = makeUseCase();

      const result = await useCase.assignWorld();

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('No unassigned worlds'));
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

    it('should return error when world is assigned to another server', async () => {
      const result = await useCase.assignWorldByName('creative', 'server2');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errorCode, 'conflict');
      assert.ok(result.error?.includes("'server1'"));
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
      assert.ok(assignments.wasCalled('release'));
      assert.ok(!shellAdapter.wasCommandCalled('worldRelease'));
    });

    it('should show intro message', async () => {
      await useCase.releaseWorld();
      assert.strictEqual(promptAdapter.introMessage, 'Release World');
    });

    it('should return error when no locked worlds', async () => {
      worldRepo = new MockWorldRepository([
        { name: 'unlocked1', isLocked: false },
        { name: 'unlocked2', isLocked: false },
      ]);
      useCase = makeUseCase();

      const result = await useCase.releaseWorld();

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('No assigned worlds'));
    });

    it('should return error when user declines', async () => {
      promptAdapter = new MockPromptAdapter({ confirm: false });
      useCase = makeUseCase();

      const result = await useCase.releaseWorld();

      assert.strictEqual(result.success, false);
      assert.ok(!assignments.wasCalled('release'));
    });
  });

  describe('releaseWorldByName', () => {
    it('should switch the holder back to its own world', async () => {
      const result = await useCase.releaseWorldByName('creative');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.worldName, 'creative');
      assert.strictEqual(result.previousServer, 'server1');
      assert.strictEqual(result.fallbackWorld, 'server1');
      assert.strictEqual(assignments.levels.get('server1'), 'server1');
    });

    it('should return error when no server uses the world', async () => {
      const result = await useCase.releaseWorldByName('survival');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errorCode, 'not_assigned');
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
