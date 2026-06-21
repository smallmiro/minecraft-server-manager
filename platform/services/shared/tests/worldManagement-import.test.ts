/**
 * TDD tests for WorldManagementUseCase.importWorldFromZip().
 * Written BEFORE implementation (RED phase).
 *
 * Verifies:
 * - success path: delegates to worldRepo.importFromZip, returns {success:true}
 * - duplicate world: findByName returns a world → {success:false, error}
 * - error propagation: importFromZip throws → {success:false, error}
 */
import { describe, test, expect } from 'vitest';
import { WorldManagementUseCase } from '../src/application/use-cases/WorldManagementUseCase.js';
import type {
  IPromptPort,
  IShellPort,
  IWorldRepository,
  IServerRepository,
} from '../src/application/ports/index.js';
import { World } from '../src/domain/entities/World.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUseCase(
  worldRepoOverrides: Partial<IWorldRepository>,
): WorldManagementUseCase {
  const worldRepo = {
    findAll: async () => [],
    findByName: async (_name: string) => null,
    importFromZip: async (_name: string, _zip: string): Promise<World> => {
      throw new Error('not implemented');
    },
    ...worldRepoOverrides,
  } as unknown as IWorldRepository;

  const serverRepo = {
    listNames: async () => [],
    getConfig: async () => null,
  } as unknown as IServerRepository;

  const prompt = {} as IPromptPort;
  const shell = {} as IShellPort;

  return new WorldManagementUseCase(prompt, shell, worldRepo, serverRepo);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorldManagementUseCase.importWorldFromZip', () => {
  test('returns success:true when import succeeds', async () => {
    const importedWorld = new World('newworld', '/worlds/newworld');

    const useCase = makeUseCase({
      findByName: async () => null,
      importFromZip: async (_name: string, _zip: string) => importedWorld,
    });

    const result = await useCase.importWorldFromZip({
      worldName: 'newworld',
      zipPath: '/tmp/world.zip',
    });

    expect(result.success).toBe(true);
    expect(result.worldName).toBe('newworld');
    expect(result.error).toBeUndefined();
  });

  test('returns success:false with error when world already exists', async () => {
    const existingWorld = new World('existing', '/worlds/existing');

    const useCase = makeUseCase({
      findByName: async () => existingWorld,
    });

    const result = await useCase.importWorldFromZip({
      worldName: 'existing',
      zipPath: '/tmp/world.zip',
    });

    expect(result.success).toBe(false);
    expect(result.worldName).toBe('existing');
    expect(result.error).toContain("'existing'");
    expect(result.error).toContain('already exists');
  });

  test('propagates errors from importFromZip as success:false', async () => {
    const useCase = makeUseCase({
      findByName: async () => null,
      importFromZip: async () => {
        throw new Error('No valid Minecraft world found (level.dat missing)');
      },
    });

    const result = await useCase.importWorldFromZip({
      worldName: 'bad',
      zipPath: '/tmp/bad.zip',
    });

    expect(result.success).toBe(false);
    expect(result.worldName).toBe('bad');
    expect(result.error).toContain('level.dat missing');
  });

  test('propagates non-Error throws as string', async () => {
    const useCase = makeUseCase({
      findByName: async () => null,
      importFromZip: async () => {
        throw 'something weird';
      },
    });

    const result = await useCase.importWorldFromZip({
      worldName: 'weird',
      zipPath: '/tmp/weird.zip',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('something weird');
  });
});
