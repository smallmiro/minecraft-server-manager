import { describe, it, beforeEach, vi } from 'vitest';
import assert from 'node:assert';
import { DeleteServerUseCase, ServerStatus } from '@minecraft-docker/shared';
import type {
  HostnameChangeResult,
  IAuditLogPort,
  IContainerRuntimePort,
  IHostnameRegistrarPort,
  IServerConsolePort,
  IServerSpecRepository,
  ServerSpecDeleteResult,
} from '@minecraft-docker/shared';
import {
  MockPromptAdapter,
  MockShellAdapter,
  MockServerRepository,
} from '../mocks/index.js';

/** Fake deprovision ports (#735): records remove, delete and unregister calls. */
function fakeDeprovision() {
  const state = {
    removed: [] as string[],
    deletes: [] as Array<{ name: string; deleteWorld?: boolean; dryRun?: boolean }>,
    result: { level: 'server1', movedWorlds: [], deletedWorlds: [] } as ServerSpecDeleteResult,
    deleteError: undefined as Error | undefined,
    hostname: { status: 'changed' } as HostnameChangeResult,
  };
  const runtime = {
    remove: async (name: { value: string }) => {
      state.removed.push(name.value);
      return { success: true };
    },
  } as unknown as IContainerRuntimePort;
  const specRepo = {
    delete: async (name: string, options: { deleteWorld?: boolean; dryRun?: boolean } = {}) => {
      state.deletes.push({ name, ...options });
      if (!options.dryRun && state.deleteError) throw state.deleteError;
      return state.result;
    },
  } as unknown as IServerSpecRepository;
  const hostnames = { unregister: async () => state.hostname } as unknown as IHostnameRegistrarPort;
  return { state, runtime, deps: { specRepo, hostnames } };
}

describe('DeleteServerUseCase Integration', () => {
  let promptAdapter: MockPromptAdapter;
  let shellAdapter: MockShellAdapter;
  let serverRepo: MockServerRepository;
  let fake: ReturnType<typeof fakeDeprovision>;
  let useCase: DeleteServerUseCase;

  const build = (opts: { console?: IServerConsolePort; audit?: IAuditLogPort } = {}) =>
    new DeleteServerUseCase(promptAdapter, shellAdapter, serverRepo, opts.audit, opts.console, fake.runtime, fake.deps);
  /** Servers whose files were deleted (the real, not the dry-run, delete). */
  const deleted = () => fake.state.deletes.filter((d) => !d.dryRun).map((d) => d.name);

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
    fake = fakeDeprovision();
    useCase = build();
  });

  describe('execute (interactive)', () => {
    it('should delete selected server', async () => {
      const result = await useCase.execute();

      assert.strictEqual(result, true);
      assert.deepStrictEqual(deleted(), ['server1']);
    });

    it('should show intro message', async () => {
      await useCase.execute();

      assert.strictEqual(promptAdapter.introMessage, 'Delete Minecraft Server');
    });

    it('plans, then removes the container, then deletes the files (#735)', async () => {
      await useCase.execute();

      assert.deepStrictEqual(fake.state.removed, ['server1']);
      assert.deepStrictEqual(
        fake.state.deletes.map((d) => d.dryRun === true),
        [true, false]
      );
      assert.ok(!shellAdapter.wasCommandCalled('stopServer'));
      assert.ok(!shellAdapter.wasCommandCalled('deleteServer'));
    });

    it('removes the container of a stopped server too (an absent one is fine)', async () => {
      serverRepo = new MockServerRepository([
        { name: 'stopped', status: ServerStatus.STOPPED },
      ]);
      useCase = build();

      await useCase.execute();

      assert.deepStrictEqual(fake.state.removed, ['stopped']);
      assert.deepStrictEqual(deleted(), ['stopped']);
    });

    it('should return false when no servers found', async () => {
      serverRepo.clear();

      const result = await useCase.execute();

      assert.strictEqual(result, false);
      assert.ok(promptAdapter.messages.some((m) => m.includes('warn:')));
    });

    it('should return false when user cancels', async () => {
      promptAdapter = new MockPromptAdapter({ confirm: false });
      useCase = build();

      const result = await useCase.execute();

      assert.strictEqual(result, false);
      assert.deepStrictEqual(fake.state.deletes, []);
      assert.deepStrictEqual(fake.state.removed, []);
    });
  });

  describe('executeWithName (CLI mode)', () => {
    it('should delete server by name', async () => {
      const result = await useCase.executeWithName('server1');

      assert.strictEqual(result, true);
      assert.deepStrictEqual(deleted(), ['server1']);
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
      useCase = build();

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
      useCase = build();

      const result = await useCase.executeWithName('busy', { force: true });

      assert.strictEqual(result, true);
    });

    // v2.x keeps the boolean form as deprecated (#715 release policy)
    it('still accepts the deprecated boolean force without asking', async () => {
      serverRepo = new MockServerRepository([
        { name: 'busy', status: ServerStatus.RUNNING, playerCount: 5 },
      ]);
      promptAdapter = new MockPromptAdapter({ confirm: false });
      useCase = build();

      assert.strictEqual(await useCase.executeWithName('busy', true), true);
    });

    it('keeps the players guard for the deprecated boolean false', async () => {
      serverRepo = new MockServerRepository([
        { name: 'busy', status: ServerStatus.RUNNING, playerCount: 5 },
      ]);
      useCase = build();

      await assert.rejects(useCase.executeWithName('busy', false), /5 player\(s\) online/);
    });
  });

  // #652: the guard, confirmation and world option
  describe('players online guard (#652)', () => {
    const consoleWith = (online: number | null): IServerConsolePort => ({
      listPlayers: async () => (online === null ? null : { online, max: 20, players: [] }),
      command: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
      getEndpoint: async () => null,
    });

    it('reads the player count over RCON and refuses without force', async () => {
      useCase = build({ console: consoleWith(3) });

      await assert.rejects(useCase.executeWithName('server1', { yes: true }), /3 player\(s\) online/);
      assert.deepStrictEqual(deleted(), []);
    });

    it('deletes when nobody is online', async () => {
      useCase = build({ console: consoleWith(0) });

      assert.strictEqual(await useCase.executeWithName('server1', { yes: true }), true);
    });

    it('refuses an unknown player count (RCON failed) even with yes (#652 review)', async () => {
      useCase = build({ console: consoleWith(null) });

      await assert.rejects(useCase.executeWithName('server1', { yes: true }), /RCON/);
      assert.deepStrictEqual(deleted(), []);
    });

    it('deletes with an unknown player count when forced (#652 review)', async () => {
      useCase = build({ console: consoleWith(null) });

      assert.strictEqual(await useCase.executeWithName('server1', { force: true, yes: true }), true);
    });

    it('does not query RCON for a stopped server', async () => {
      useCase = build({ console: consoleWith(3) });

      assert.strictEqual(await useCase.executeWithName('server2', { yes: true }), true);
    });
  });

  // v2.x: only an explicit options object opts into the new confirmation (#715)
  describe('second-argument compatibility (#652 review)', () => {
    beforeEach(() => {
      promptAdapter = new MockPromptAdapter({ confirm: false });
      useCase = build();
    });

    it.each([
      ['omitted', [] as unknown[]],
      ['undefined', [undefined]],
      ['false', [false]],
      ['true', [true]],
    ])('%s deletes without asking, as before', async (_label, rest) => {
      const call = useCase.executeWithName as (name: string, ...rest: unknown[]) => Promise<boolean>;
      assert.strictEqual(await call.call(useCase, 'server2', ...rest), true);
      assert.deepStrictEqual(deleted(), ['server2']);
    });

    it('{} asks (declined here) and keeps the server', async () => {
      assert.strictEqual(await useCase.executeWithName('server2', {}), false);
      assert.deepStrictEqual(deleted(), []);
    });

    it('omitted still applies the players guard', async () => {
      serverRepo = new MockServerRepository([
        { name: 'busy', status: ServerStatus.RUNNING, playerCount: 5 },
      ]);
      useCase = build();

      await assert.rejects(useCase.executeWithName('busy'), /5 player\(s\) online/);
    });
  });

  describe('confirmation (#652)', () => {
    it('asks before deleting and keeps the server when declined', async () => {
      promptAdapter = new MockPromptAdapter({ confirm: false });
      useCase = build();

      assert.strictEqual(await useCase.executeWithName('server2', {}), false);
      assert.deepStrictEqual(deleted(), []);
    });

    it('skips the question with yes', async () => {
      promptAdapter = new MockPromptAdapter({ confirm: false });
      useCase = build();

      assert.strictEqual(await useCase.executeWithName('server2', { yes: true }), true);
    });
  });

  describe('world option (#652)', () => {
    const deleteWorldOf = () => fake.state.deletes.find((d) => !d.dryRun)!.deleteWorld;

    it('keeps the world by default', async () => {
      await useCase.executeWithName('server2', { yes: true });
      assert.strictEqual(deleteWorldOf(), false);
    });

    it('passes deleteWorld to the deprovision (by name)', async () => {
      await useCase.executeWithName('server2', { yes: true, deleteWorld: true });
      assert.strictEqual(deleteWorldOf(), true);
    });

    it('passes deleteWorld to the deprovision (interactive)', async () => {
      await useCase.execute({ deleteWorld: true });
      assert.strictEqual(deleteWorldOf(), true);
    });
  });

  // #652: the completion message says what actually happened
  describe('completion message (#652)', () => {
    const info = () => promptAdapter.messages.filter((m) => m.startsWith('info:'));

    it('a moved world', async () => {
      fake.state.result = { level: 'server2', movedWorlds: ['server2', 'server2_nether'], deletedWorlds: [] };
      await useCase.executeWithName('server2', { yes: true });
      assert.deepStrictEqual(info(), ['info: World moved to worlds/server2; it can be assigned to another server.']);
    });

    it('a world in worlds/ that stays', async () => {
      fake.state.result = { level: 'server2', movedWorlds: [], deletedWorlds: [], keptWorld: 'server2' };
      await useCase.executeWithName('server2', { yes: true });
      assert.deepStrictEqual(info(), ['info: World worlds/server2 was kept; it is no longer assigned to this server.']);
    });

    it('no world at all', async () => {
      fake.state.result = { level: 'server2', movedWorlds: [], deletedWorlds: [] };
      await useCase.executeWithName('server2', { yes: true });
      assert.deepStrictEqual(info(), ["info: No world data found for LEVEL 'server2'."]);
      assert.ok(!promptAdapter.messages.some((m) => m.includes('preserved')));
    });

    it('deleteWorld, with a world in worlds/ that stays', async () => {
      fake.state.result = { level: 'server2', movedWorlds: [], deletedWorlds: ['server2'], keptWorld: 'server2' };
      await useCase.executeWithName('server2', { yes: true, deleteWorld: true });
      assert.deepStrictEqual(info(), [
        'info: World data inside the server was deleted with it (--delete-world).',
        'info: World worlds/server2 was kept; it is no longer assigned to this server.',
      ]);
    });

    it('warns when the mDNS hostname could not be removed', async () => {
      fake.state.hostname = { status: 'skipped', reason: 'sudo authentication failed; check the sudo password' };
      assert.strictEqual(await useCase.executeWithName('server2', { yes: true }), true);
      assert.ok(promptAdapter.messages.includes('warn: mDNS hostname server2.local was not removed: sudo authentication failed; check the sudo password'));
    });

    it('warns about a server directory left behind, still deletes and removes the hostname (#735 review)', async () => {
      const leftover = "servers/server2/ was removed from servers/compose.yml but could not be fully deleted (EACCES); remove what is left with: sudo rm -rf '/srv/servers/server2'";
      fake.state.result = { level: 'server2', movedWorlds: ['server2'], deletedWorlds: [], warning: leftover };
      fake.state.hostname = { status: 'skipped', reason: 'sudo authentication failed' };
      const audit = { log: vi.fn(async () => undefined) } as unknown as IAuditLogPort;
      useCase = build({ audit });

      assert.strictEqual(await useCase.executeWithName('server2', { yes: true }), true);
      assert.ok(promptAdapter.messages.includes(`warn: ${leftover}`));
      assert.ok(promptAdapter.messages.includes('warn: mDNS hostname server2.local was not removed: sudo authentication failed'));
      assert.deepStrictEqual(vi.mocked(audit.log).mock.calls.map((c) => (c[0] as { status: string }).status), ['success']);
    });
  });

  describe('deprovision failure handling', () => {
    it('returns false, shows the error and audits the failure', async () => {
      const audit = { log: vi.fn(async () => undefined) } as unknown as IAuditLogPort;
      fake.state.deleteError = new Error('worlds/server1 appeared before data/server1 could be moved');
      useCase = build({ audit });

      const result = await useCase.execute();

      assert.strictEqual(result, false);
      assert.ok(promptAdapter.messages.some((m) => m.startsWith('error:') && m.includes('worlds/server1 appeared')));
      assert.deepStrictEqual(vi.mocked(audit.log).mock.calls.map((c) => (c[0] as { status: string }).status), ['failure']);
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
