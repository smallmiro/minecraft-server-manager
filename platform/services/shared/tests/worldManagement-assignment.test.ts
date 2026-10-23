/**
 * WorldManagementUseCase goes through IWorldAssignmentPort and the runtime
 * port instead of ShellAdapter -> mcctl.sh world -> lock.sh (#670, ADR-0002).
 */
import { describe, test, expect, vi } from 'vitest';
import { WorldManagementUseCase } from '../src/application/use-cases/WorldManagementUseCase.js';
import { checkAssign, planRelease, WorldAssignmentError } from '../src/domain/services/worldAssignment.js';
import type {
  IContainerRuntimePort,
  IPromptPort,
  IShellPort,
  IWorldAssignmentPort,
  IWorldRepository,
  IServerRepository,
} from '../src/application/ports/index.js';
import type { ContainerStatus } from '../src/types/index.js';
import { ServerName } from '../src/domain/value-objects/ServerName.js';

interface Setup {
  /** server -> LEVEL */
  levels?: Record<string, string>;
  internal?: string[];
  undetermined?: string[];
  worlds?: string[];
  status?: ContainerStatus;
  noPort?: boolean;
  noRuntime?: boolean;
}

function setup(opts: Setup = {}) {
  const levels = new Map(Object.entries(opts.levels ?? { srv: 'srv', other: 'other' }));
  const internal = new Set(opts.internal ?? []);
  const undetermined = opts.undetermined ?? [];
  const worlds = new Set(opts.worlds ?? ['free', 'held']);

  const list = async () => ({
    assignments: [...levels]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([server, world]) => ({ server, world, internal: internal.has(server) })),
    undetermined: [...undetermined],
  });
  const port = {
    snapshot: vi.fn(list),
    assign: vi.fn(async (world: string, server: string) => {
      const error = checkAssign(await list(), world, server);
      if (error) throw error;
      levels.set(server, world);
    }),
    release: vi.fn(async (world: string) => {
      const plan = planRelease(await list(), world);
      if (plan instanceof WorldAssignmentError) throw plan;
      levels.set(plan.server, plan.fallback);
      return plan;
    }),
  } satisfies IWorldAssignmentPort;

  const runtime = {
    getStatus: vi.fn((): ContainerStatus => opts.status ?? 'exited'),
    start: vi.fn().mockResolvedValue({ success: true }),
  };

  const shell = {
    worldAssign: vi.fn(),
    worldRelease: vi.fn(),
    serverStatus: vi.fn(),
    stopServer: vi.fn(),
    startServer: vi.fn(),
    setServerConfig: vi.fn().mockResolvedValue({ success: true }),
  };

  const worldRepo = {
    findByName: vi.fn(async (name: string) =>
      worlds.has(name) ? { name, sizeFormatted: '1 MB', isLocked: false } : null
    ),
    exists: vi.fn(async (name: string) => worlds.has(name)),
    create: vi.fn(async (name: string) => {
      worlds.add(name);
    }),
    delete: vi.fn(async (name: string) => worlds.delete(name)),
  };

  const serverRepo = {
    exists: vi.fn(async (name: string) => levels.has(name)),
    findAll: vi.fn(async () => [...levels.keys()].map((name) => ({ name: { value: name } }))),
  };

  const spinner = { start: vi.fn(), stop: vi.fn(), message: vi.fn() };
  const prompt = {
    spinner: () => spinner,
    success: vi.fn(),
    error: vi.fn(),
    outro: vi.fn(),
    note: vi.fn(),
    warn: vi.fn(),
    isCancel: () => false,
  };

  const useCase = new WorldManagementUseCase(
    prompt as unknown as IPromptPort,
    shell as unknown as IShellPort,
    worldRepo as unknown as IWorldRepository,
    serverRepo as unknown as IServerRepository,
    opts.noPort ? undefined : port,
    opts.noRuntime ? undefined : (runtime as unknown as IContainerRuntimePort)
  );
  return { useCase, port, runtime, shell, worldRepo, levels, worlds };
}

const ACTIVE: ContainerStatus[] = ['running', 'paused', 'restarting', 'created'];
const INACTIVE: ContainerStatus[] = ['exited', 'dead', 'not_found', 'not_created'];

function expectNoShellWorldCalls(shell: ReturnType<typeof setup>['shell']) {
  expect(shell.worldAssign).not.toHaveBeenCalled();
  expect(shell.worldRelease).not.toHaveBeenCalled();
  expect(shell.serverStatus).not.toHaveBeenCalled();
  expect(shell.setServerConfig).not.toHaveBeenCalledWith(expect.anything(), 'LEVEL', expect.anything());
}

describe('assignWorldByName', () => {
  test('writes the assignment through the port, never through the shell', async () => {
    const { useCase, port, runtime, shell, levels } = setup();

    const result = await useCase.assignWorldByName('free', 'srv');

    expect(result).toEqual({ success: true, worldName: 'free', serverName: 'srv' });
    expect(port.assign).toHaveBeenCalledWith('free', 'srv');
    expect(runtime.getStatus).toHaveBeenCalledWith(ServerName.fromExisting('srv'));
    expect(levels.get('srv')).toBe('free');
    expectNoShellWorldCalls(shell);
  });

  test.each(['../escape', 'my world', 'world.old', 'w_nether'])('rejects %s as invalid_world', async (name) => {
    const { useCase, port, worldRepo } = setup();

    const result = await useCase.assignWorldByName(name, 'srv');

    expect(result).toMatchObject({ success: false, errorCode: 'invalid_world' });
    expect(result.error).toMatch(/world name/i);
    expect(port.assign).not.toHaveBeenCalled();
    expect(worldRepo.findByName).not.toHaveBeenCalled();
  });

  test('requires the world to exist in worlds/ unless requireExisting is false', async () => {
    const { useCase, levels } = setup();

    const missing = await useCase.assignWorldByName('later', 'srv');
    expect(missing).toMatchObject({ success: false, error: "World 'later' not found" });
    expect(missing.errorCode).toBeUndefined();

    expect((await useCase.assignWorldByName('later', 'srv', { requireExisting: false })).success).toBe(true);
    expect(levels.get('srv')).toBe('later');
  });

  test('refuses a world assigned to another server (R1, R6) and names it', async () => {
    const { useCase, port, levels } = setup({ levels: { srv: 'srv', other: 'held' } });

    const result = await useCase.assignWorldByName('held', 'srv');

    expect(result).toMatchObject({ success: false, errorCode: 'conflict' });
    expect(result.error).toContain("'other'");
    expect(port.assign).not.toHaveBeenCalled();
    expect(levels.get('srv')).toBe('srv');
  });

  test.each(ACTIVE)('refuses a %s server before any write', async (status) => {
    const { useCase, port, levels } = setup({ status });

    const result = await useCase.assignWorldByName('free', 'srv');

    expect(result).toMatchObject({ success: false, errorCode: 'server_running' });
    expect(result.error).toContain(status);
    expect(port.assign).not.toHaveBeenCalled();
    expect(levels.get('srv')).toBe('srv');
  });

  test.each(INACTIVE)('allows a %s server', async (status) => {
    const { useCase } = setup({ status });
    expect((await useCase.assignWorldByName('free', 'srv')).success).toBe(true);
  });

  test('re-assigning the current world succeeds without a runtime check', async () => {
    const { useCase, runtime, port } = setup({ levels: { srv: 'held' }, status: 'running' });

    expect((await useCase.assignWorldByName('held', 'srv')).success).toBe(true);
    expect(runtime.getStatus).not.toHaveBeenCalled();
    expect(port.assign).not.toHaveBeenCalled();
  });

  test('refuses while another server is undetermined (R7)', async () => {
    const { useCase, port } = setup({ undetermined: ['broken'] });

    const result = await useCase.assignWorldByName('free', 'srv');

    expect(result).toMatchObject({ success: false, errorCode: 'undetermined' });
    expect(result.error).toContain('broken');
    expect(port.assign).not.toHaveBeenCalled();
  });

  test('refuses an internal-world server and an unknown server', async () => {
    const { useCase } = setup({ internal: ['srv'] });
    expect(await useCase.assignWorldByName('free', 'srv')).toMatchObject({ errorCode: 'internal_world' });
    expect(await useCase.assignWorldByName('free', 'ghost')).toMatchObject({ errorCode: 'server_not_found' });
  });

  test('fails closed without an assignment port or a runtime port', async () => {
    expect(await setup({ noPort: true }).useCase.assignWorldByName('free', 'srv')).toMatchObject({
      success: false,
      errorCode: 'undetermined',
    });
    const noRuntime = setup({ noRuntime: true });
    expect(await noRuntime.useCase.assignWorldByName('free', 'srv')).toMatchObject({
      success: false,
      errorCode: 'undetermined',
    });
    expect(noRuntime.port.assign).not.toHaveBeenCalled();
  });

  test('a rejection from the port (fresh snapshot) is reported with its code', async () => {
    const { useCase, port } = setup();
    port.assign.mockRejectedValueOnce(new WorldAssignmentError('conflict', 'taken meanwhile', ['x']));

    expect(await useCase.assignWorldByName('free', 'srv')).toMatchObject({
      success: false,
      errorCode: 'conflict',
      error: 'taken meanwhile',
    });
  });

  test('deleting the holder server makes the world assignable again (AC 3)', async () => {
    const { useCase, levels } = setup({ levels: { srv: 'srv', other: 'held' } });
    expect((await useCase.assignWorldByName('held', 'srv')).success).toBe(false);

    levels.delete('other');

    expect((await useCase.assignWorldByName('held', 'srv')).success).toBe(true);
  });
});

describe('releaseWorldByName', () => {
  test("switches the holder back to its own world '<server>'", async () => {
    const { useCase, port, shell, levels } = setup({ levels: { alpha: 'held' }, worlds: ['held'] });

    const result = await useCase.releaseWorldByName('held');

    expect(result).toEqual({
      success: true,
      worldName: 'held',
      previousServer: 'alpha',
      fallbackWorld: 'alpha',
      fallbackExists: false,
    });
    expect(port.release).toHaveBeenCalledWith('held');
    expect(levels.get('alpha')).toBe('alpha');
    expectNoShellWorldCalls(shell);
  });

  test('says when the holder adopts an existing free worlds/<server>', async () => {
    const { useCase } = setup({ levels: { alpha: 'held' }, worlds: ['held', 'alpha'] });
    expect(await useCase.releaseWorldByName('held')).toMatchObject({ success: true, fallbackExists: true });
  });

  test('reports a world that neither exists nor is assigned as not found', async () => {
    const { useCase } = setup({ levels: { alpha: 'alpha' }, worlds: [] });
    const result = await useCase.releaseWorldByName('ghost');
    expect(result).toMatchObject({ success: false, error: "World 'ghost' not found" });
    expect(result.errorCode).toBeUndefined();
  });

  test('releases a world whose directory does not exist yet', async () => {
    const { useCase } = setup({ levels: { alpha: 'later' }, worlds: [] });
    expect((await useCase.releaseWorldByName('later')).success).toBe(true);
  });

  test.each(ACTIVE)('refuses when the holder is %s, even with force', async (status) => {
    const { useCase, port } = setup({ levels: { alpha: 'held' }, status });

    expect(await useCase.releaseWorldByName('held', true)).toMatchObject({
      success: false,
      errorCode: 'server_running',
      previousServer: 'alpha',
    });
    expect(port.release).not.toHaveBeenCalled();
  });

  test.each([
    ['not_assigned', { levels: { alpha: 'alpha' } }, 'held'],
    ['default_world', { levels: { alpha: 'alpha' } }, 'alpha'],
    ['conflict', { levels: { alpha: 'held', beta: 'held' } }, 'held'],
    ['internal_world', { levels: { alpha: 'held' }, internal: ['alpha'] }, 'held'],
    ['undetermined', { levels: { alpha: 'held' }, undetermined: ['x'] }, 'held'],
  ] as const)('refuses with %s', async (code, opts, world) => {
    const { useCase, port } = setup(opts as Setup);

    expect(await useCase.releaseWorldByName(world)).toMatchObject({ success: false, errorCode: code });
    expect(port.release).not.toHaveBeenCalled();
  });

  test('fails closed without an assignment port', async () => {
    expect(await setup({ noPort: true }).useCase.releaseWorldByName('held')).toMatchObject({
      success: false,
      errorCode: 'undetermined',
    });
  });
});

describe('createWorld with a server', () => {
  test('creates the directory, assigns through the port, sets SEED, starts through the runtime', async () => {
    const { useCase, port, runtime, shell, worldRepo, levels } = setup();

    const result = await useCase.createWorld({ name: 'fresh', seed: '42', serverName: 'srv', autoStart: true });

    expect(result).toMatchObject({ success: true, worldName: 'fresh', serverName: 'srv', started: true });
    expect(worldRepo.create).toHaveBeenCalledWith('fresh', '42');
    expect(port.assign).toHaveBeenCalledWith('fresh', 'srv');
    expect(levels.get('srv')).toBe('fresh');
    expect(shell.setServerConfig).toHaveBeenCalledWith('srv', 'SEED', '42');
    expect(runtime.start).toHaveBeenCalledWith(ServerName.fromExisting('srv'));
    expect(shell.startServer).not.toHaveBeenCalled();
    expect(shell.stopServer).not.toHaveBeenCalled();
    expectNoShellWorldCalls(shell);
  });

  test.each(ACTIVE)('refuses a %s server before creating the directory (no auto-stop)', async (status) => {
    const { useCase, worldRepo, shell, runtime } = setup({ status });

    const result = await useCase.createWorld({ name: 'fresh', serverName: 'srv' });

    expect(result).toMatchObject({ success: false, errorCode: 'server_running' });
    expect(worldRepo.create).not.toHaveBeenCalled();
    expect(shell.stopServer).not.toHaveBeenCalled();
    expect(runtime.start).not.toHaveBeenCalled();
  });

  test('refuses a name another server already uses as LEVEL before creating the directory', async () => {
    const { useCase, worldRepo } = setup({ levels: { srv: 'srv', other: 'fresh' } });

    expect(await useCase.createWorld({ name: 'fresh', serverName: 'srv' })).toMatchObject({
      success: false,
      errorCode: 'conflict',
    });
    expect(worldRepo.create).not.toHaveBeenCalled();
  });

  test('refuses while anything is undetermined', async () => {
    const { useCase, worldRepo } = setup({ undetermined: ['broken'] });
    expect(await useCase.createWorld({ name: 'fresh', serverName: 'srv' })).toMatchObject({
      errorCode: 'undetermined',
    });
    expect(worldRepo.create).not.toHaveBeenCalled();
  });

  test('without a server needs no assignment port', async () => {
    const { useCase, worldRepo } = setup({ noPort: true, noRuntime: true });
    expect((await useCase.createWorld({ name: 'fresh' })).success).toBe(true);
    expect(worldRepo.create).toHaveBeenCalled();
  });
});

describe('deleteWorldByName', () => {
  test('refuses a world assigned to a server, even with force (behaviour change)', async () => {
    const { useCase, worldRepo } = setup({ levels: { alpha: 'held' } });

    const result = await useCase.deleteWorldByName('held', true);

    expect(result).toMatchObject({ success: false, errorCode: 'conflict' });
    expect(result.error).toContain("'alpha'");
    expect(worldRepo.delete).not.toHaveBeenCalled();
  });

  test('refuses when a server uses one of its dimension folders', async () => {
    const { useCase, worldRepo } = setup({ levels: { alpha: 'held_nether' } });
    expect(await useCase.deleteWorldByName('held')).toMatchObject({ errorCode: 'conflict' });
    expect(worldRepo.delete).not.toHaveBeenCalled();
  });

  test('ignores an internal holder (its files are in servers/<n>/data)', async () => {
    const { useCase, worldRepo } = setup({ levels: { alpha: 'held' }, internal: ['alpha'] });
    expect((await useCase.deleteWorldByName('held')).success).toBe(true);
    expect(worldRepo.delete).toHaveBeenCalledWith('held');
  });

  test('refuses while anything is undetermined', async () => {
    const { useCase, worldRepo } = setup({ levels: { alpha: 'alpha' }, undetermined: ['broken'] });
    expect(await useCase.deleteWorldByName('held', true)).toMatchObject({ errorCode: 'undetermined' });
    expect(worldRepo.delete).not.toHaveBeenCalled();
  });

  test('deletes an unassigned world', async () => {
    const { useCase, worldRepo } = setup({ levels: { alpha: 'alpha' } });
    expect((await useCase.deleteWorldByName('held')).success).toBe(true);
    expect(worldRepo.delete).toHaveBeenCalledWith('held');
  });

  test('fails closed without an assignment port', async () => {
    const { useCase, worldRepo } = setup({ noPort: true });
    expect(await useCase.deleteWorldByName('held')).toMatchObject({ errorCode: 'undetermined' });
    expect(worldRepo.delete).not.toHaveBeenCalled();
  });
});

describe('planWorldReset', () => {
  test('returns the world of the sole holder, as the assignment port resolved it', async () => {
    expect(await setup({ levels: { alpha: 'My World' } }).useCase.planWorldReset('alpha')).toEqual({
      world: 'My World',
    });
  });

  test('ignores another internal holder of the same name', async () => {
    const { useCase } = setup({ levels: { alpha: 'held', old: 'held' }, internal: ['old'] });
    expect(await useCase.planWorldReset('alpha')).toEqual({ world: 'held' });
  });

  test.each([
    ['internal_world', { levels: { alpha: 'held' }, internal: ['alpha'] }, 'alpha'],
    ['conflict', { levels: { alpha: 'held', beta: 'held' } }, 'alpha'],
    ['undetermined', { levels: { alpha: 'held' }, undetermined: ['x'] }, 'alpha'],
    ['server_not_found', { levels: { alpha: 'held' } }, 'ghost'],
    ['undetermined', { noPort: true }, 'alpha'],
  ] as const)('refuses with %s', async (code, opts, server) => {
    const error = await setup(opts as Setup).useCase.planWorldReset(server);
    expect(error).toBeInstanceOf(WorldAssignmentError);
    expect(error?.code).toBe(code);
  });
});

describe('getAssignmentReport', () => {
  test('reports duplicates and undetermined servers', async () => {
    const { useCase } = setup({ levels: { a: 'world', b: 'world', c: 'c' }, undetermined: ['broken'] });
    expect(await useCase.getAssignmentReport()).toEqual({
      duplicates: [{ world: 'world', servers: ['a', 'b'] }],
      undetermined: ['broken'],
    });
  });
});

describe('listWorlds servers[] (same resolution as the assignment port)', () => {
  test('groups servers by world family from the port snapshot', async () => {
    const { useCase, worldRepo } = setup({ levels: { a: 'held', b: 'held_nether', c: 'c' } });
    (worldRepo as unknown as { findAll: () => Promise<unknown[]> }).findAll = async () => [
      { name: 'held', path: '/w/held', isLocked: true, lockedBy: 'a', sizeBytes: 1 },
      { name: 'free', path: '/w/free', isLocked: false, sizeBytes: 1 },
    ];

    const worlds = await useCase.listWorlds();

    expect(worlds.map((w) => [w.name, w.servers])).toEqual([
      ['held', ['a', 'b']],
      ['free', []],
    ]);
  });
});
