import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import nbt from 'prismarine-nbt';
import type { IWorldDataReader } from '../../application/ports/outbound/IWorldDataReader.js';
import { parseStructuresFromRegion } from './AnvilStructureReader.js';
import { resolveRegionDirs } from './dimensionRegions.js';
import {
  Dimension,
  type Structure,
  type WorldLevelData,
  type PlayerLocation,
  type DimensionPresence,
  type GameMode,
  type Difficulty,
} from '../../domain/index.js';

const GAME_MODES: GameMode[] = ['survival', 'creative', 'adventure', 'spectator'];
const DIFFICULTIES: Difficulty[] = ['peaceful', 'easy', 'normal', 'hard'];

/**
 * Convert a numeric NBT value to Number.
 *
 * prismarine-nbt's `simplify` represents 64-bit longs (DayTime, seed, ...)
 * as a special object whose `toString()` yields the decimal value, so we
 * route through String() for non-number/bigint inputs.
 */
function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (value !== null && value !== undefined) {
    const n = Number(String(value));
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

/** NBT byte booleans come through as 0/1. */
function toBool(value: unknown): boolean {
  return toNumber(value) !== 0;
}

/** Map a dimension id string to the normalized Dimension enum. */
function mapDimension(id: unknown): Dimension {
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

/**
 * Prismarine-NBT based implementation of {@link IWorldDataReader}.
 *
 * Parses gzip-compressed `level.dat` / `playerdata/*.dat` (Minecraft NBT)
 * and inspects the world directory for dimension folders and region files.
 */
export class PrismarineWorldDataReader implements IWorldDataReader {
  async readLevelData(worldPath: string): Promise<WorldLevelData> {
    const buf = await readFile(join(worldPath, 'level.dat'));
    const { parsed } = await nbt.parse(buf);
    const root = nbt.simplify(parsed) as Record<string, unknown>;
    const data = (root.Data ?? root) as Record<string, unknown>;

    const seedRaw =
      (data.WorldGenSettings as Record<string, unknown> | undefined)?.seed ??
      data.RandomSeed ??
      0;
    const version = (data.Version ?? {}) as Record<string, unknown>;
    const dayTime = toNumber(data.DayTime);

    const gameRulesRaw = data.GameRules as Record<string, unknown> | undefined;
    const gameRules = gameRulesRaw
      ? Object.fromEntries(
          Object.entries(gameRulesRaw).map(([k, v]) => [k, String(v)])
        )
      : undefined;

    const dataPacks =
      ((data.DataPacks as Record<string, unknown> | undefined)
        ?.Enabled as string[] | undefined) ?? [];

    return {
      levelName: String(data.LevelName ?? basename(worldPath)),
      seed: String(seedRaw),
      spawn: {
        x: toNumber(data.SpawnX),
        y: toNumber(data.SpawnY),
        z: toNumber(data.SpawnZ),
      },
      gameMode: GAME_MODES[toNumber(data.GameType)] ?? 'survival',
      difficulty: DIFFICULTIES[toNumber(data.Difficulty, 2)] ?? 'normal',
      hardcore: toBool(data.hardcore),
      dayTime,
      dayCount: Math.floor(dayTime / 24000),
      raining: toBool(data.raining),
      thundering: toBool(data.thundering),
      versionName: String(version.Name ?? 'unknown'),
      dataVersion: toNumber(data.DataVersion),
      worldBorder: {
        // Vanilla default (59,999,968) is not persisted unless customized.
        size: toNumber(data.BorderSize, 59999968),
        centerX: toNumber(data.BorderCenterX),
        centerZ: toNumber(data.BorderCenterZ),
      },
      dataPacks,
      gameRules,
    };
  }

  async readPlayerData(worldPath: string): Promise<PlayerLocation[]> {
    const dir = join(worldPath, 'playerdata');
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }

    const names = await this.loadUserCache(worldPath);

    const result: PlayerLocation[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.dat')) continue;
      try {
        const buf = await readFile(join(dir, entry));
        const { parsed } = await nbt.parse(buf);
        const p = nbt.simplify(parsed) as Record<string, unknown>;
        const pos = (p.Pos as number[] | undefined) ?? [0, 0, 0];
        const uuid = entry.replace(/\.dat$/, '');
        result.push({
          uuid,
          name: names.get(uuid.toLowerCase()),
          x: toNumber(pos[0]),
          y: toNumber(pos[1]),
          z: toNumber(pos[2]),
          dimension: mapDimension(p.Dimension),
          health: p.Health !== undefined ? toNumber(p.Health) : undefined,
          food: p.foodLevel !== undefined ? toNumber(p.foodLevel) : undefined,
          xpLevel: p.XpLevel !== undefined ? toNumber(p.XpLevel) : undefined,
          online: false,
        });
      } catch {
        // Skip corrupt playerdata files
      }
    }
    return result;
  }

  /**
   * Build a uuid -> username map from `usercache.json` (found beside the
   * world or in the worlds root). Returns an empty map when unavailable,
   * so player names are best-effort and never block parsing.
   */
  private async loadUserCache(worldPath: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const candidates = [
      join(worldPath, 'usercache.json'),
      join(dirname(worldPath), 'usercache.json'),
    ];
    for (const file of candidates) {
      try {
        const raw = await readFile(file, 'utf-8');
        const entries = JSON.parse(raw) as Array<{ name?: string; uuid?: string }>;
        for (const e of entries) {
          if (e.uuid && e.name) map.set(e.uuid.toLowerCase(), e.name);
        }
        if (map.size > 0) break;
      } catch {
        // Try next candidate
      }
    }
    return map;
  }

  async detectDimensions(worldPath: string): Promise<DimensionPresence> {
    const parent = dirname(worldPath);
    const name = basename(worldPath);
    const has = (p: string): boolean => existsSync(p);

    // Latest Minecraft stores every dimension under dimensions/minecraft/<dim>
    // (overworld included), alongside the older root/DIM-1/DIM1 and Paper split
    // layouts (#546).
    const dims = join(worldPath, 'dimensions', 'minecraft');
    return {
      overworld:
        has(join(worldPath, 'level.dat')) ||
        has(join(worldPath, 'region')) ||
        has(join(dims, 'overworld', 'region')),
      nether:
        has(join(worldPath, 'DIM-1')) ||
        has(join(parent, `${name}_nether`)) ||
        has(join(dims, 'the_nether')),
      end:
        has(join(worldPath, 'DIM1')) ||
        has(join(parent, `${name}_the_end`)) ||
        has(join(dims, 'the_end')),
    };
  }

  async countRegions(worldPath: string): Promise<number> {
    // Use the same active-layout resolution as the scanners so the count never
    // reflects a stale layout (#546): resolveRegionDirs picks the overworld
    // region dir across root/dimensions layouts by newest mtime.
    const dir = resolveRegionDirs(worldPath).find(
      (r) => r.dimension === Dimension.Overworld,
    )?.dir;
    if (!dir) return 0;
    try {
      const entries = await readdir(dir);
      return entries.filter((e) => e.endsWith('.mca')).length;
    } catch {
      return 0;
    }
  }

  async readStructures(worldPath: string): Promise<Structure[]> {
    const all: Structure[] = [];

    for (const { dimension, dir } of resolveRegionDirs(worldPath)) {
      let files: string[];
      try {
        files = (await readdir(dir)).filter((f) => f.endsWith('.mca'));
      } catch {
        continue;
      }

      for (const file of files) {
        let buf: Buffer;
        try {
          buf = await readFile(join(dir, file));
        } catch {
          continue;
        }
        const structures = await parseStructuresFromRegion(buf, dimension);
        all.push(...structures);
      }
    }

    return all;
  }
}
