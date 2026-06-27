import { describe, it, expect } from 'vitest';
import { WorldStatsUseCase } from '../src/application/use-cases/WorldStatsUseCase.js';
import { AnalysisCancelledError } from '../src/application/ports/inbound/IWorldStatsUseCase.js';
import { World } from '../src/domain/index.js';
import type { IWorldRepository } from '../src/application/ports/index.js';
import type { IBlockScanner, BlockScanOutcome } from '../src/application/ports/outbound/IBlockScanner.js';

function makeWorldRepo(): IWorldRepository {
  const world = new World('factory', '/worlds/factory');
  return {
    findByName: async (name: string) => (name === 'factory' ? world : null),
  } as unknown as IWorldRepository;
}

function scanner(outcome: Partial<BlockScanOutcome>): IBlockScanner {
  return {
    async scanWorld() {
      return {
        counts: {},
        dimensions: [],
        regionsScanned: 0,
        cancelled: false,
        ...outcome,
      };
    },
  };
}

describe('WorldStatsUseCase', () => {
  it('aggregates scan counts into a BlockStatsResult', async () => {
    const useCase = new WorldStatsUseCase(
      makeWorldRepo(),
      scanner({
        counts: {
          'minecraft:air': 9000,
          'minecraft:stone': 800,
          'minecraft:diamond_ore': 7,
        },
        dimensions: ['overworld'],
        regionsScanned: 2,
      })
    );

    const result = await useCase.analyze('factory');

    expect(result.world).toBe('factory');
    expect(result.dimensions).toEqual(['overworld']);
    expect(result.regionsScanned).toBe(2);
    expect(result.totalBlocks).toBe(807); // air excluded
    expect(result.ores).toEqual({ 'minecraft:diamond_ore': 7 });
    expect(typeof result.analyzedAt).toBe('string');
    expect(typeof result.durationMs).toBe('number');
  });

  it('throws AnalysisCancelledError when the scan was cancelled', async () => {
    const useCase = new WorldStatsUseCase(makeWorldRepo(), scanner({ cancelled: true }));
    await expect(useCase.analyze('factory')).rejects.toBeInstanceOf(AnalysisCancelledError);
  });

  it('throws when the world does not exist', async () => {
    const useCase = new WorldStatsUseCase(makeWorldRepo(), scanner({}));
    await expect(useCase.analyze('missing')).rejects.toThrow(/not found/i);
  });
});
