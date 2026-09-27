import nbt from 'prismarine-nbt';
import {
  Dimension,
  type GameMode,
  type PlayerInventorySummary,
} from '../../domain/index.js';

/** `level.dat` GameType / playerdata `playerGameType` share this 0-3 mapping. */
export const GAME_MODES: GameMode[] = ['survival', 'creative', 'adventure', 'spectator'];

/**
 * Convert a numeric NBT value to Number.
 *
 * prismarine-nbt's `simplify` represents 64-bit longs (DayTime, seed, ...)
 * as a special object whose `toString()` yields the decimal value, so we
 * route through String() for non-number/bigint inputs.
 */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (value !== null && value !== undefined) {
    const n = Number(String(value));
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

/** Map a dimension id string to the normalized Dimension enum. */
export function mapDimension(id: unknown): Dimension {
  switch (id) {
    case 'minecraft:the_nether':
    case -1:
      return Dimension.Nether;
    case 'minecraft:the_end':
    case 1:
      return Dimension.End;
    default:
      return Dimension.Overworld;
  }
}

/** Everything extracted from a `playerdata/<uuid>.dat` file (#525, #528). */
export interface ParsedPlayerDat {
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

/**
 * Parse a gzip-compressed (or raw) `playerdata/<uuid>.dat` NBT buffer.
 * Pure — no file I/O — so it can be shared by #525 (world player locations)
 * and #528 (player detail panel) without either reading the file twice.
 */
export async function parsePlayerDat(buf: Buffer): Promise<ParsedPlayerDat> {
  const { parsed } = await nbt.parse(buf);
  const p = nbt.simplify(parsed) as Record<string, unknown>;
  const pos = (p.Pos as number[] | undefined) ?? [0, 0, 0];

  return {
    x: toNumber(pos[0]),
    y: toNumber(pos[1]),
    z: toNumber(pos[2]),
    dimension: mapDimension(p.Dimension),
    health: p.Health !== undefined ? toNumber(p.Health) : undefined,
    food: p.foodLevel !== undefined ? toNumber(p.foodLevel) : undefined,
    xpLevel: p.XpLevel !== undefined ? toNumber(p.XpLevel) : undefined,
    gameMode: GAME_MODES[toNumber(p.playerGameType)] ?? 'survival',
    inventory: summarizeInventory(p.Inventory),
  };
}

/**
 * Aggregate `Inventory` stacks by item id. Handles both the legacy `Count`
 * (signed byte, pre-1.20.5) and the current `count` (int, 1.20.5+) fields.
 */
function summarizeInventory(raw: unknown): PlayerInventorySummary {
  const stacks = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];

  const totals = new Map<string, number>();
  for (const stack of stacks) {
    if (typeof stack.id !== 'string') continue;
    const count = toNumber(stack.count ?? stack.Count, 0);
    totals.set(stack.id, (totals.get(stack.id) ?? 0) + count);
  }

  const items = [...totals.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);

  return { slotsUsed: stacks.length, items };
}
