import type {
  WorldLevelData,
  PlayerLocation,
  DimensionPresence,
} from '../../../domain/index.js';

/**
 * World Data Reader - Outbound Port
 *
 * Abstraction over reading world data files (`level.dat`, `playerdata/*.dat`)
 * and detecting on-disk dimension structure. Implemented by an NBT-parsing
 * adapter (e.g. PrismarineWorldDataReader).
 */
export interface IWorldDataReader {
  /**
   * Parse a world's `level.dat` into structured metadata.
   * @param worldPath Absolute path to the world directory (containing level.dat).
   */
  readLevelData(worldPath: string): Promise<WorldLevelData>;

  /**
   * Parse all `playerdata/*.dat` files into offline player locations.
   * Corrupt files are skipped. Returns an empty array when no playerdata exists.
   * @param worldPath Absolute path to the world directory.
   */
  readPlayerData(worldPath: string): Promise<PlayerLocation[]>;

  /**
   * Detect which dimensions exist on disk for a world.
   * Handles both single-folder (DIM-1/DIM1) and split-folder
   * (`<name>_nether` / `<name>_the_end`) layouts.
   * @param worldPath Absolute path to the world directory.
   */
  detectDimensions(worldPath: string): Promise<DimensionPresence>;

  /**
   * Count overworld region (`.mca`) files (exploration estimate).
   * Returns 0 when no region directory exists.
   * @param worldPath Absolute path to the world directory.
   */
  countRegions(worldPath: string): Promise<number>;
}
