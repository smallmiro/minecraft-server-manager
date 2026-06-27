import type {
  IWorldInfoUseCase,
  IWorldDataReader,
  IRconPort,
  IWorldRepository,
} from '../ports/index.js';
import {
  Dimension,
  type WorldInfo,
  type PlayerLocation,
  type Structure,
} from '../../domain/index.js';

/**
 * World Info Use Case
 *
 * Aggregates world metadata (`level.dat`), offline player locations
 * (`playerdata`), and live RCON player positions. Read-only (#525, Phase 1).
 */
export class WorldInfoUseCase implements IWorldInfoUseCase {
  constructor(
    private readonly worldRepository: IWorldRepository,
    private readonly dataReader: IWorldDataReader,
    private readonly rcon: IRconPort
  ) {}

  async getWorldInfo(name: string): Promise<WorldInfo> {
    const world = await this.worldRepository.findByName(name);
    if (!world) {
      throw new Error(`World not found: ${name}`);
    }

    const [level, dimensions, regionCount] = await Promise.all([
      this.dataReader.readLevelData(world.path),
      this.dataReader.detectDimensions(world.path),
      this.dataReader.countRegions(world.path),
    ]);

    return {
      name: world.name,
      level,
      dimensions,
      sizeBytes: world.sizeBytes ?? 0,
      regionCount,
      lastModified: world.lastModified
        ? world.lastModified.toISOString()
        : null,
    };
  }

  async getPlayerLocations(name: string): Promise<PlayerLocation[]> {
    const world = await this.worldRepository.findByName(name);
    if (!world) {
      throw new Error(`World not found: ${name}`);
    }
    return this.dataReader.readPlayerData(world.path);
  }

  /**
   * Extract generated structures (villages, fortresses, temples, …) from the
   * world's Anvil region data across all present dimensions (#530, Phase 3).
   */
  async getStructures(name: string): Promise<Structure[]> {
    const world = await this.worldRepository.findByName(name);
    if (!world) {
      throw new Error(`World not found: ${name}`);
    }
    return this.dataReader.readStructures(world.path);
  }

  async getLivePlayerLocations(
    container: string,
    players: string[]
  ): Promise<PlayerLocation[]> {
    const results = await Promise.all(
      players.map(async (player) => {
        const pos = await this.rcon.getEntityPosition(container, player);
        if (!pos) return null;
        const location: PlayerLocation = {
          uuid: '',
          name: player,
          x: pos.x,
          y: pos.y,
          z: pos.z,
          dimension: pos.dimension ?? Dimension.Overworld,
          online: true,
        };
        return location;
      })
    );
    return results.filter((p): p is PlayerLocation => p !== null);
  }
}
