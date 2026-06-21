/**
 * TDD tests for WorldManagementUseCase.listWorlds() satellite grouping.
 * Written BEFORE implementation (RED phase).
 *
 * Verifies:
 * - Satellite worlds (_nether / _the_end) are excluded from the returned list
 * - The primary world gains a `dimensions` field indicating satellite presence
 * - Aggregated size = primary sizeBytes + satellite sizeBytes, formatted
 * - Standalone worlds (no satellites) also get `dimensions` with both false
 *
 * Follows the stub style of worldManagement-servers.test.ts
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

function makeWorld(name: string, sizeBytes?: number): World {
  const w = new World(name, `/worlds/${name}`);
  if (sizeBytes !== undefined) {
    w.setMetadata(sizeBytes, new Date());
  }
  return w;
}

function makeMinimalServerRepo(): IServerRepository {
  return {
    listNames: async () => [],
    getConfig: async () => null,
  } as unknown as IServerRepository;
}

function makeUseCase(worlds: World[]): WorldManagementUseCase {
  const worldRepo = {
    findAll: async () => worlds,
  } as unknown as IWorldRepository;
  const prompt = {} as IPromptPort;
  const shell = {} as IShellPort;
  return new WorldManagementUseCase(prompt, shell, worldRepo, makeMinimalServerRepo());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorldManagementUseCase.listWorlds - satellite grouping', () => {
  test('excludes nether and the_end satellites from the returned list', async () => {
    const worlds = [
      makeWorld('survival', 1024),
      makeWorld('survival_nether', 512),
      makeWorld('survival_the_end', 256),
    ];
    const useCase = makeUseCase(worlds);
    const result = await useCase.listWorlds();

    const names = result.map((w) => w.name);
    expect(names).toEqual(['survival']);
    expect(names).not.toContain('survival_nether');
    expect(names).not.toContain('survival_the_end');
  });

  test('primary world has dimensions.nether=true and dimensions.end=true', async () => {
    const worlds = [
      makeWorld('survival', 1024),
      makeWorld('survival_nether', 512),
      makeWorld('survival_the_end', 256),
    ];
    const useCase = makeUseCase(worlds);
    const result = await useCase.listWorlds();

    const survivalEntry = result.find((w) => w.name === 'survival');
    expect(survivalEntry?.dimensions).toEqual({ nether: true, end: true });
  });

  test('primary world has dimensions.nether=true and dimensions.end=false when only nether exists', async () => {
    const worlds = [
      makeWorld('creative', 2048),
      makeWorld('creative_nether', 100),
    ];
    const useCase = makeUseCase(worlds);
    const result = await useCase.listWorlds();

    const entry = result.find((w) => w.name === 'creative');
    expect(entry?.dimensions).toEqual({ nether: true, end: false });
  });

  test('standalone world without satellites has dimensions both false', async () => {
    const worlds = [makeWorld('standalone', 500)];
    const useCase = makeUseCase(worlds);
    const result = await useCase.listWorlds();

    const entry = result.find((w) => w.name === 'standalone');
    expect(entry?.dimensions).toEqual({ nether: false, end: false });
  });

  test('aggregates size = primary + nether + end (in bytes, formatted)', async () => {
    // 1024 + 512 + 256 = 1792 bytes → "1.8KB" (approx)
    const worlds = [
      makeWorld('survival', 1024),
      makeWorld('survival_nether', 512),
      makeWorld('survival_the_end', 256),
    ];
    const useCase = makeUseCase(worlds);
    const result = await useCase.listWorlds();

    const entry = result.find((w) => w.name === 'survival');
    // Total = 1792 bytes = 1.75 KB → "1.8KB"
    expect(entry?.size).toBe('1.8KB');
  });

  test('returns Unknown size if primary sizeBytes is undefined', async () => {
    const worlds = [
      makeWorld('nosize'),   // no sizeBytes
      makeWorld('nosize_nether', 100),
    ];
    const useCase = makeUseCase(worlds);
    const result = await useCase.listWorlds();

    const entry = result.find((w) => w.name === 'nosize');
    expect(entry?.size).toBe('Unknown');
  });

  test('a satellite-like name with no matching base is treated as primary', async () => {
    // 'orphan_nether' has no 'orphan' primary world → should be listed as primary
    const worlds = [makeWorld('orphan_nether', 100)];
    const useCase = makeUseCase(worlds);
    const result = await useCase.listWorlds();

    const names = result.map((w) => w.name);
    expect(names).toContain('orphan_nether');
  });

  test('multiple worlds including mixed primaries and satellites', async () => {
    const worlds = [
      makeWorld('world1', 1000),
      makeWorld('world1_nether', 200),
      makeWorld('world2', 3000),
      makeWorld('world2_the_end', 500),
      makeWorld('standalone', 700),
    ];
    const useCase = makeUseCase(worlds);
    const result = await useCase.listWorlds();

    const names = result.map((w) => w.name).sort();
    expect(names).toEqual(['standalone', 'world1', 'world2']);

    const w1 = result.find((w) => w.name === 'world1')!;
    expect(w1.dimensions).toEqual({ nether: true, end: false });

    const w2 = result.find((w) => w.name === 'world2')!;
    expect(w2.dimensions).toEqual({ nether: false, end: true });

    const sw = result.find((w) => w.name === 'standalone')!;
    expect(sw.dimensions).toEqual({ nether: false, end: false });
  });

  test('both satellite suffixes without a matching base stay as two primaries', async () => {
    // No 'survey' parent → neither folds the other in.
    const worlds = [
      makeWorld('survey_nether', 200),
      makeWorld('survey_the_end', 300),
    ];
    const useCase = makeUseCase(worlds);
    const result = await useCase.listWorlds();

    const names = result.map((w) => w.name).sort();
    expect(names).toEqual(['survey_nether', 'survey_the_end']);
    for (const w of result) {
      expect(w.dimensions).toEqual({ nether: false, end: false });
    }
  });
});
