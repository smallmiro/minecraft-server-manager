/**
 * World Info value objects (DTOs)
 *
 * Data structures describing parsed world metadata (`level.dat`),
 * player locations (`playerdata/*.dat`), and aggregated world info.
 *
 * Used by the World Info feature (#525, Phase 1).
 */

/**
 * Minecraft dimension identifier (normalized).
 */
export enum Dimension {
  Overworld = 'overworld',
  Nether = 'nether',
  End = 'end',
}

/**
 * Player game mode (from `level.dat` Data.GameType).
 */
export type GameMode = 'survival' | 'creative' | 'adventure' | 'spectator';

/**
 * World difficulty (from `level.dat` Data.Difficulty).
 */
export type Difficulty = 'peaceful' | 'easy' | 'normal' | 'hard';

/**
 * World border descriptor.
 */
export interface WorldBorder {
  /** Border diameter in blocks. */
  size: number;
  /** Border center X coordinate. */
  centerX: number;
  /** Border center Z coordinate. */
  centerZ: number;
}

/**
 * Parsed metadata from a world's `level.dat`.
 */
export interface WorldLevelData {
  /** World name (Data.LevelName). */
  levelName: string;
  /** World seed as a string (long can exceed Number safe range). */
  seed: string;
  /** World spawn point. */
  spawn: { x: number; y: number; z: number };
  /** Player default game mode. */
  gameMode: GameMode;
  /** World difficulty. */
  difficulty: Difficulty;
  /** Whether the world is hardcore. */
  hardcore: boolean;
  /** Raw day time in ticks (Data.DayTime). */
  dayTime: number;
  /** Elapsed in-game days (floor(dayTime / 24000)). */
  dayCount: number;
  /** Whether it is currently raining. */
  raining: boolean;
  /** Whether it is currently thundering. */
  thundering: boolean;
  /** Minecraft version name (Data.Version.Name, e.g. "1.21.1"). */
  versionName: string;
  /** Data version number (Data.DataVersion). */
  dataVersion: number;
  /** World border descriptor. */
  worldBorder: WorldBorder;
  /** Enabled data packs (Data.DataPacks.Enabled). */
  dataPacks: string[];
  /** Selected game rules (Data.GameRules), if available. */
  gameRules?: Record<string, string>;
}

/**
 * Which dimensions exist on disk for a world.
 */
export interface DimensionPresence {
  overworld: boolean;
  nether: boolean;
  end: boolean;
}

/**
 * Aggregated world information (level metadata + on-disk structure).
 */
export interface WorldInfo {
  /** World name. */
  name: string;
  /** Parsed `level.dat` metadata. */
  level: WorldLevelData;
  /** Dimension presence on disk. */
  dimensions: DimensionPresence;
  /** Total world size in bytes. */
  sizeBytes: number;
  /** Number of overworld region (`.mca`) files (exploration estimate). */
  regionCount: number;
  /** Last modified time (ISO 8601), or null if unknown. */
  lastModified: string | null;
}

/**
 * A player's location, from offline `playerdata` or live RCON.
 */
export interface PlayerLocation {
  /** Player UUID (from playerdata filename, empty for live-only lookups). */
  uuid: string;
  /** Player username, when known. */
  name?: string;
  /** X coordinate. */
  x: number;
  /** Y coordinate. */
  y: number;
  /** Z coordinate. */
  z: number;
  /** Dimension the player is in. */
  dimension: Dimension;
  /** Health (0-20), when available. */
  health?: number;
  /** Food level (0-20), when available. */
  food?: number;
  /** Experience level, when available. */
  xpLevel?: number;
  /** Whether this is a live (online) position. */
  online: boolean;
}

/**
 * An entity position obtained from RCON (`data get entity <p> Pos`).
 */
export interface EntityPosition {
  x: number;
  y: number;
  z: number;
  /** Dimension, when resolved. */
  dimension?: Dimension;
}
