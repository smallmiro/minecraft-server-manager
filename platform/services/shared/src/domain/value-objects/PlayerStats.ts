/**
 * Player statistics value object (#528, Phase 2).
 *
 * Immutable summary derived from a player's `stats/<uuid>.json` and
 * `advancements/<uuid>.json` files. Parsing is pure (plain objects in, no
 * fs) so it stays in the domain layer — the repository adapter does the I/O
 * and hands the parsed JSON to `fromMinecraftJson`.
 */
export interface PlayerStatsProps {
  playTimeSeconds: number;
  deaths: number;
  mobKills: number;
  playerKills: number;
  distanceMeters: number;
  blocksMined: number;
  itemsCrafted: number;
  advancementsCompleted: number;
}

export type PlayerStatsJson = PlayerStatsProps;

export class PlayerStats {
  private constructor(private readonly props: PlayerStatsProps) {
    for (const [key, value] of Object.entries(props)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new Error(`PlayerStats.${key} must be a non-negative number`);
      }
    }
  }

  static create(props: PlayerStatsProps): PlayerStats {
    return new PlayerStats(props);
  }

  get playTimeSeconds(): number {
    return this.props.playTimeSeconds;
  }

  get deaths(): number {
    return this.props.deaths;
  }

  get mobKills(): number {
    return this.props.mobKills;
  }

  get playerKills(): number {
    return this.props.playerKills;
  }

  get distanceMeters(): number {
    return this.props.distanceMeters;
  }

  get blocksMined(): number {
    return this.props.blocksMined;
  }

  get itemsCrafted(): number {
    return this.props.itemsCrafted;
  }

  get advancementsCompleted(): number {
    return this.props.advancementsCompleted;
  }

  toJSON(): PlayerStatsJson {
    return { ...this.props };
  }

  /**
   * Parse the vanilla 1.13+ `stats/<uuid>.json` (`statsJson`) and, optionally,
   * `advancements/<uuid>.json` (`advancementsJson`) shapes into a
   * `PlayerStats`. Missing sections/files default to 0.
   */
  static fromMinecraftJson(statsJson: unknown, advancementsJson?: unknown): PlayerStats {
    const custom = record(statsJson, 'stats', 'minecraft:custom');
    const mined = record(statsJson, 'stats', 'minecraft:mined');
    const crafted = record(statsJson, 'stats', 'minecraft:crafted');

    const playTimeTicks = numberOf(custom['minecraft:play_time']) ?? numberOf(custom['minecraft:play_one_minute']) ?? 0;
    const distanceCm = sumBySuffix(custom, '_one_cm');

    return PlayerStats.create({
      playTimeSeconds: Math.round(playTimeTicks / 20),
      deaths: numberOf(custom['minecraft:deaths']) ?? 0,
      mobKills: numberOf(custom['minecraft:mob_kills']) ?? 0,
      playerKills: numberOf(custom['minecraft:player_kills']) ?? 0,
      distanceMeters: Math.round(distanceCm / 100),
      blocksMined: sumValues(mined),
      itemsCrafted: sumValues(crafted),
      advancementsCompleted: countCompletedAdvancements(advancementsJson),
    });
  }
}

/** Safely walk a nested plain-object path; `{}` when any step is missing/not an object. */
function record(value: unknown, ...path: string[]): Record<string, unknown> {
  let current = value;
  for (const key of path) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return {};
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'object' && current !== null && !Array.isArray(current)
    ? (current as Record<string, unknown>)
    : {};
}

/**
 * Vanilla stats counters are signed 32-bit ints; long-running servers overflow
 * them to negative values (e.g. `*_one_cm` distances past ~21,474 km, or play
 * ticks). Reinterpret a negative integer as unsigned 32-bit — the real count
 * the overflow lost. A negative non-integer isn't a plausible overflow, so it
 * is treated as 0 rather than propagated.
 */
function numberOf(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value >= 0) return value;
  return Number.isInteger(value) ? value + 2 ** 32 : 0;
}

function sumValues(obj: Record<string, unknown>): number {
  return Object.values(obj).reduce<number>((sum, v) => sum + (numberOf(v) ?? 0), 0);
}

function sumBySuffix(obj: Record<string, unknown>, suffix: string): number {
  return Object.entries(obj).reduce<number>(
    (sum, [key, v]) => (key.endsWith(suffix) ? sum + (numberOf(v) ?? 0) : sum),
    0
  );
}

/** Count `done: true` entries, excluding `minecraft:recipes/*` and `DataVersion`. */
function countCompletedAdvancements(advancementsJson: unknown): number {
  if (typeof advancementsJson !== 'object' || advancementsJson === null || Array.isArray(advancementsJson)) {
    return 0;
  }
  let count = 0;
  for (const [key, value] of Object.entries(advancementsJson as Record<string, unknown>)) {
    if (key === 'DataVersion' || key.startsWith('minecraft:recipes/')) continue;
    if (typeof value === 'object' && value !== null && (value as Record<string, unknown>).done === true) {
      count += 1;
    }
  }
  return count;
}
