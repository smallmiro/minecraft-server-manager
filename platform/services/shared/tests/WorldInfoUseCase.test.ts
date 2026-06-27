import { describe, it, expect } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldInfoUseCase } from '../src/application/use-cases/WorldInfoUseCase.js';
import { PrismarineWorldDataReader } from '../src/infrastructure/adapters/PrismarineWorldDataReader.js';
import { World, Dimension } from '../src/domain/index.js';
import type {
  IWorldRepository,
  IRconPort,
  EntityPosition,
} from '../src/application/ports/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FACTORY = join(__dirname, 'fixtures', 'world-info', 'factory');

function makeWorldRepo(): IWorldRepository {
  const world = new World('factory', FACTORY);
  world.setMetadata(123456, new Date('2026-02-24T22:21:00.000Z'));
  return {
    findByName: async (name: string) => (name === 'factory' ? world : null),
  } as unknown as IWorldRepository;
}

const rcon: IRconPort = {
  async getEntityPosition(_c: string, player: string): Promise<EntityPosition | null> {
    if (player === 'Steve') {
      return { x: 1, y: 2, z: 3, dimension: Dimension.Nether };
    }
    return null;
  },
};

describe('WorldInfoUseCase', () => {
  const useCase = new WorldInfoUseCase(
    makeWorldRepo(),
    new PrismarineWorldDataReader(),
    rcon
  );

  describe('getWorldInfo', () => {
    it('aggregates level data, dimensions, size and region count', async () => {
      const info = await useCase.getWorldInfo('factory');
      expect(info.name).toBe('factory');
      expect(info.level.seed).toBe('618742839476293847');
      expect(info.level.versionName).toBe('1.21.1');
      expect(info.dimensions).toEqual({ overworld: true, nether: true, end: true });
      expect(info.regionCount).toBe(1);
      expect(info.sizeBytes).toBe(123456);
      expect(info.lastModified).toBe('2026-02-24T22:21:00.000Z');
    });

    it('throws when the world does not exist', async () => {
      await expect(useCase.getWorldInfo('missing')).rejects.toThrow(/not found/i);
    });
  });

  describe('getPlayerLocations', () => {
    it('returns offline player locations', async () => {
      const players = await useCase.getPlayerLocations('factory');
      expect(players.length).toBe(2);
      expect(players.every((p) => p.online === false)).toBe(true);
    });
  });

  describe('getLivePlayerLocations', () => {
    it('resolves online players and omits unresolved ones', async () => {
      const live = await useCase.getLivePlayerLocations('mc-factory', [
        'Steve',
        'Ghost',
      ]);
      expect(live.length).toBe(1);
      expect(live[0]!.name).toBe('Steve');
      expect(live[0]!.online).toBe(true);
      expect(live[0]!.dimension).toBe(Dimension.Nether);
      expect(live[0]!.x).toBe(1);
    });
  });

  describe('getStructures', () => {
    it('returns an array of structures from region data', async () => {
      const structures = await useCase.getStructures('factory');
      expect(Array.isArray(structures)).toBe(true);
      // Every entry is well-formed (the parser is unit-tested separately).
      for (const s of structures) {
        expect(typeof s.id).toBe('string');
        expect(typeof s.x).toBe('number');
        expect(s.dimension).toBeDefined();
      }
    });

    it('throws when the world does not exist', async () => {
      await expect(useCase.getStructures('missing')).rejects.toThrow(/not found/i);
    });
  });
});
