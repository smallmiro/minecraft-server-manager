import { Dimension, type GameMode } from './WorldInfo.js';

/** One aggregated inventory item id, summed across every stack of it. */
export interface InventoryItemSummary {
  id: string;
  count: number;
}

/** Inventory summary: how many slots are occupied and totals per item id. */
export interface PlayerInventorySummary {
  slotsUsed: number;
  /** Sorted by count desc. */
  items: InventoryItemSummary[];
}

/**
 * Player NBT data value object (#528, Phase 3).
 *
 * Immutable snapshot of a player's `playerdata/<uuid>.dat` — last known
 * position/dimension/vitals plus game mode and inventory summary. Parsing
 * is done by the shared `parsePlayerDat` (also used by #525's world player
 * locations); this VO just wraps the result for the player detail panel.
 */
export interface PlayerDataProps {
  x: number;
  y: number;
  z: number;
  dimension: Dimension;
  health?: number;
  food?: number;
  xpLevel?: number;
  gameMode: GameMode;
  inventory: PlayerInventorySummary;
}

export interface PlayerDataJson {
  x: number;
  y: number;
  z: number;
  /** The Dimension enum's string value (e.g. `'nether'`). */
  dimension: string;
  health?: number;
  food?: number;
  xpLevel?: number;
  gameMode: GameMode;
  inventory: PlayerInventorySummary;
}

export class PlayerData {
  private constructor(private readonly props: PlayerDataProps) {}

  static create(props: PlayerDataProps): PlayerData {
    return new PlayerData(props);
  }

  get x(): number {
    return this.props.x;
  }

  get y(): number {
    return this.props.y;
  }

  get z(): number {
    return this.props.z;
  }

  get dimension(): Dimension {
    return this.props.dimension;
  }

  get health(): number | undefined {
    return this.props.health;
  }

  get food(): number | undefined {
    return this.props.food;
  }

  get xpLevel(): number | undefined {
    return this.props.xpLevel;
  }

  get gameMode(): GameMode {
    return this.props.gameMode;
  }

  get inventory(): PlayerInventorySummary {
    return this.props.inventory;
  }

  toJSON(): PlayerDataJson {
    return {
      x: this.props.x,
      y: this.props.y,
      z: this.props.z,
      dimension: this.props.dimension,
      health: this.props.health,
      food: this.props.food,
      xpLevel: this.props.xpLevel,
      gameMode: this.props.gameMode,
      inventory: this.props.inventory,
    };
  }
}
