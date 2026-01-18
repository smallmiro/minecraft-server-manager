import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DeleteServerUseCase } from '../../src/application/use-cases/DeleteServerUseCase.js';
import { ServerStatus } from '../../src/domain/index.js';
import {
  MockPromptAdapter,
  MockShellAdapter,
  MockServerRepository,
} from '../mocks/index.js';

describe('DeleteServerUseCase Integration', () => {
  let promptAdapter: MockPromptAdapter;
  let shellAdapter: MockShellAdapter;
  let serverRepo: MockServerRepository;
  let useCase: DeleteServerUseCase;

  beforeEach(() => {
    promptAdapter = new MockPromptAdapter({
      confirm: true,
      selectIndex: 0,
    });
    shellAdapter = new MockShellAdapter();
    serverRepo = new MockServerRepository([
      { name: 'server1', status: ServerStatus.RUNNING, playerCount: 0 },
      { name: 'server2', status: ServerStatus.STOPPED },
    ]);
    useCase = new DeleteServerUseCase(promptAdapter, shellAdapter, serverRepo);
  });

  describe('execute (interactive)', () => {
    it('should delete selected server', async () => {
      const result = await useCase.execute();

      assert.strictEqual(result, true);
      assert.ok(shellAdapter.wasCommandCalled('deleteServer'));
    });

    it('should show intro message', async () => {
      await useCase.execute();

      assert.strictEqual(promptAdapter.introMessage, 'Delete Minecraft Server');
    });

    it('should stop running server before deletion', async () => {
      await useCase.execute();

      assert.ok(shellAdapter.wasCommandCalled('stopServer'));
      assert.ok(shellAdapter.wasCommandCalled('deleteServer'));
    });

    it('should not stop already stopped server', async () => {
      serverRepo = new MockServerRepository([
        { name: 'stopped', status: ServerStatus.STOPPED },
      ]);
      useCase = new DeleteServerUseCase(promptAdapter, shellAdapter, serverRepo);

      await useCase.execute();

      assert.ok(!shellAdapter.wasCommandCalled('stopServer'));
      assert.ok(shellAdapter.wasCommandCalled('deleteServer'));
    });

    it('should return false when no servers found', async () => {
      serverRepo.clear();

      const result = await useCase.execute();

      assert.strictEqual(result, false);
      assert.ok(promptAdapter.messages.some((m) => m.includes('warn:')));
    });

    it('should return false when user cancels', async () => {
      promptAdapter = new MockPromptAdapter({ confirm: false });
      useCase = new DeleteServerUseCase(promptAdapter, shellAdapter, serverRepo);

      const result = await useCase.execute();

      assert.strictEqual(result, false);
      assert.ok(!shellAdapter.wasCommandCalled('deleteServer'));
    });
  });

  describe('executeWithName (CLI mode)', () => {
    it('should delete server by name', async () => {
      const result = await useCase.executeWithName('server1');

      assert.strictEqual(result, true);
      assert.ok(shellAdapter.wasCommandCalled('deleteServer'));
    });

    it('should throw when server not found', async () => {
      await assert.rejects(
        async () => {
          await useCase.executeWithName('nonexistent');
        },
        { message: "Server 'nonexistent' not found" }
      );
    });

    it('should throw when server has players and not force', async () => {
      serverRepo = new MockServerRepository([
        { name: 'busy', status: ServerStatus.RUNNING, playerCount: 5 },
      ]);
      useCase = new DeleteServerUseCase(promptAdapter, shellAdapter, serverRepo);

      await assert.rejects(
        async () => {
          await useCase.executeWithName('busy');
        },
        /5 player\(s\) online/
      );
    });

    it('should delete server with players when force=true', async () => {
      serverRepo = new MockServerRepository([
        { name: 'busy', status: ServerStatus.RUNNING, playerCount: 5 },
      ]);
      useCase = new DeleteServerUseCase(promptAdapter, shellAdapter, serverRepo);

      const result = await useCase.executeWithName('busy', true);

      assert.strictEqual(result, true);
    });
  });

  describe('shell failure handling', () => {
    it('should return false when shell fails', async () => {
      shellAdapter = new MockShellAdapter({
        deleteServerResult: {
          success: false,
          stderr: 'Deletion failed',
        },
      });
      useCase = new DeleteServerUseCase(promptAdapter, shellAdapter, serverRepo);

      const result = await useCase.execute();

      assert.strictEqual(result, false);
      assert.ok(promptAdapter.messages.some((m) => m.includes('error:')));
    });
  });

  describe('cancellation handling', () => {
    it('should handle user cancellation gracefully', async () => {
      promptAdapter.setCancelled(true);

      const result = await useCase.execute();

      assert.strictEqual(result, false);
    });
  });
});
