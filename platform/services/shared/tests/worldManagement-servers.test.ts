import { describe, test, expect } from 'vitest';
import { WorldManagementUseCase } from '../src/application/use-cases/WorldManagementUseCase.js';
import type {
  IPromptPort,
  IShellPort,
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
  const shell = {} as IShellPort;
  return new WorldManagementUseCase(prompt, shell, worldRepo, serverRepo);
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

  test('defaults a server with no LEVEL to a world named after the server', async () => {
    const serverRepo = makeServerRepo({
      myserver: { TYPE: 'PAPER' }, // no LEVEL → owns worlds/myserver
    });
    const useCase = makeUseCase(['myserver'], serverRepo);

    const result = await useCase.listWorlds();

    expect(result.find((x) => x.name === 'myserver')?.servers).toEqual(['myserver']);
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
