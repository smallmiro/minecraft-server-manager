import { describe, test, expect } from 'vitest';
import { WorldManagementUseCase } from '../src/application/use-cases/WorldManagementUseCase.js';
import type {
  IPromptPort,
  IWorldRepository,
  IServerRepository,
  ServerConfigData,
} from '../src/application/ports/index.js';

// Minimal stub world objects matching the fields listWorlds() reads.
function world(name: string) {
  return {
    name,
    path: `/worlds/${name}`,
    isLocked: false,
    lockedBy: undefined,
    sizeFormatted: '1.0 MB',
    lastModified: undefined,
  };
}

function makeServerRepo(configs: Record<string, Record<string, string> | null>): IServerRepository {
  return {
    listNames: async () => Object.keys(configs),
    getConfig: async (name: string): Promise<ServerConfigData | null> => {
      const env = configs[name];
      if (!env) return null;
      return {
        name,
        type: env['TYPE'] ?? 'PAPER',
        version: env['VERSION'] ?? 'LATEST',
        customEnv: env,
      } as ServerConfigData;
    },
  } as unknown as IServerRepository;
}

function makeUseCase(worlds: string[], serverRepo: IServerRepository) {
  const worldRepo = {
    findAll: async () => worlds.map(world),
  } as unknown as IWorldRepository;
  const prompt = {} as IPromptPort;
  return new WorldManagementUseCase(prompt, worldRepo, serverRepo);
}

describe('WorldManagementUseCase.listWorlds - servers using each world', () => {
  test('maps a server to the world named by its LEVEL config', async () => {
    const serverRepo = makeServerRepo({
      survival: { LEVEL: 'shared-world' },
    });
    const useCase = makeUseCase(['shared-world'], serverRepo);

    const result = await useCase.listWorlds();
    const w = result.find((x) => x.name === 'shared-world');

    expect(w?.servers).toEqual(['survival']);
  });

  test('lists multiple servers that share the same world', async () => {
    const serverRepo = makeServerRepo({
      alpha: { LEVEL: 'shared-world' },
      beta: { LEVEL: 'shared-world' },
      gamma: { LEVEL: 'other' },
    });
    const useCase = makeUseCase(['shared-world', 'other'], serverRepo);

    const result = await useCase.listWorlds();

    expect(result.find((x) => x.name === 'shared-world')?.servers?.sort()).toEqual(['alpha', 'beta']);
    expect(result.find((x) => x.name === 'other')?.servers).toEqual(['gamma']);
  });

  test('falls back to WORLD_NAME when LEVEL is unset (matches docker world-name precedence)', async () => {
    const serverRepo = makeServerRepo({
      legacy: { WORLD_NAME: 'shared-world' }, // no LEVEL, uses WORLD_NAME alias
    });
    const useCase = makeUseCase(['shared-world'], serverRepo);

    const result = await useCase.listWorlds();

    expect(result.find((x) => x.name === 'shared-world')?.servers).toEqual(['legacy']);
  });

  test('prefers LEVEL over WORLD_NAME when both are set', async () => {
    const serverRepo = makeServerRepo({
      srv: { LEVEL: 'level-world', WORLD_NAME: 'name-world' },
    });
    const useCase = makeUseCase(['level-world', 'name-world'], serverRepo);

    const result = await useCase.listWorlds();

    expect(result.find((x) => x.name === 'level-world')?.servers).toEqual(['srv']);
    expect(result.find((x) => x.name === 'name-world')?.servers).toEqual([]);
  });

  test("defaults a server with no LEVEL to itzg's default world (#721)", async () => {
    const serverRepo = makeServerRepo({
      myserver: { TYPE: 'PAPER' }, // no LEVEL → itzg uses worlds/world
    });
    const useCase = makeUseCase(['world', 'myserver'], serverRepo);

    const result = await useCase.listWorlds();

    expect(result.find((x) => x.name === 'world')?.servers).toEqual(['myserver']);
    expect(result.find((x) => x.name === 'myserver')?.servers).toEqual([]);
  });

  test('returns an empty server list for a world that no server uses', async () => {
    const serverRepo = makeServerRepo({
      survival: { LEVEL: 'survival' },
    });
    const useCase = makeUseCase(['unused-world'], serverRepo);

    const result = await useCase.listWorlds();

    expect(result.find((x) => x.name === 'unused-world')?.servers).toEqual([]);
  });
});

describe('WorldManagementUseCase.listUnmappedWorlds', () => {
  test('returns only worlds no server maps to', async () => {
    const serverRepo = makeServerRepo({
      survival: { LEVEL: 'mapped-world' },
    });
    const useCase = makeUseCase(['mapped-world', 'free-world'], serverRepo);

    const result = await useCase.listUnmappedWorlds();
    const names = result.map((w) => w.name);

    expect(names).toContain('free-world');
    expect(names).not.toContain('mapped-world');
  });

  test("an unconfigured server maps the default 'world', not a world named after it (#721)", async () => {
    const serverRepo = makeServerRepo({ myserver: {} });
    const useCase = makeUseCase(['world', 'myserver', 'free-world'], serverRepo);

    const names = (await useCase.listUnmappedWorlds()).map((w) => w.name).sort();

    expect(names).toEqual(['free-world', 'myserver']);
  });

  test('all worlds are unmapped when there are no servers', async () => {
    const serverRepo = makeServerRepo({});
    const useCase = makeUseCase(['a', 'b'], serverRepo);

    const names = (await useCase.listUnmappedWorlds()).map((w) => w.name).sort();
    expect(names).toEqual(['a', 'b']);
  });
});
