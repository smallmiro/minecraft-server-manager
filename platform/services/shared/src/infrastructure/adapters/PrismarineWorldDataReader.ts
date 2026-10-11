import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import nbt from 'prismarine-nbt';
import type { IWorldDataReader } from '../../application/ports/outbound/IWorldDataReader.js';
import { parseStructuresFromRegion } from './AnvilStructureReader.js';
import { resolveRegionDirs } from './dimensionRegions.js';
import { GAME_MODES, PLAYER_DATA_DIRS, toNumber, parsePlayerDat } from './playerDataNbt.js';
import {
  Dimension,
  type Structure,
  type WorldLevelData,
  type PlayerLocation,
  type DimensionPresence,
  type Difficulty,
} from '../../domain/index.js';

const DIFFICULTIES: Difficulty[] = ['peaceful', 'easy', 'normal', 'hard'];

type NbtRecord = Record<string, unknown>;

/** NBT byte booleans come through as 0/1. */
function toBool(value: unknown): boolean {
  return toNumber(value) !== 0;
}

/** 26.x stores the difficulty name; <= 1.21 stores its 0-3 index. */
function toDifficulty(value: unknown): Difficulty {
  if (typeof value === 'string') {
    return DIFFICULTIES.includes(value as Difficulty) ? (value as Difficulty) : 'normal';
  }
  return DIFFICULTIES[toNumber(value, 2)] ?? 'normal';
}

/**
 * Read a 26.x `data/minecraft/*.dat` file and return its `data` compound.
 * Missing or unreadable files yield `undefined` so callers fall back to the
 * <= 1.21 `level.dat` keys (#601) — detection is by presence, not version.
 */
async function readDataCompound(file: string): Promise<nbt.Compound | undefined> {
  try {
    const { parsed } = await nbt.parse(await readFile(file));
    const data = parsed.value.data;
    return data?.type === 'compound' ? data : undefined;
  } catch {
    return undefined;
  }
}

function simplifyCompound(compound: nbt.Compound | undefined): NbtRecord | undefined {
  return compound ? (nbt.simplify(compound) as NbtRecord) : undefined;
}

/**
 * 26.x `game_rules.dat`: strip the `minecraft:` key prefix and render byte
 * booleans as "true"/"false", matching the <= 1.21 `GameRules` strings.
 */
function toGameRules(compound: nbt.Compound): Record<string, string> {
  const rules: Record<string, string> = {};
  for (const [key, tag] of Object.entries(compound.value)) {
    if (!tag) continue;
    rules[key.replace(/^minecraft:/, '')] =
      tag.type === 'byte' ? String(tag.value !== 0) : String(nbt.simplify(tag));
  }
  return rules;
}

/**
 * Prismarine-NBT based implementation of {@link IWorldDataReader}.
 *
 * Parses gzip-compressed `level.dat` / player `.dat` files (Minecraft NBT)
 * and inspects the world directory for dimension folders and region files.
 * 26.x worlds move many `level.dat` fields to `data/minecraft/*.dat`; each
 * field reads the new location first and falls back to the old one (#601).
 */
export class PrismarineWorldDataReader implements IWorldDataReader {
  async readLevelData(worldPath: string): Promise<WorldLevelData> {
    const buf = await readFile(join(worldPath, 'level.dat'));
    const { parsed } = await nbt.parse(buf);
    const root = nbt.simplify(parsed) as NbtRecord;
    const data = (root.Data ?? root) as NbtRecord;

    const dataDir = join(worldPath, 'data', 'minecraft');
    const [genSettings, clocks, rulesCompound, weather, border] = await Promise.all([
      readDataCompound(join(dataDir, 'world_gen_settings.dat')).then(simplifyCompound),
      readDataCompound(join(dataDir, 'world_clocks.dat')).then(simplifyCompound),
      readDataCompound(join(dataDir, 'game_rules.dat')),
      readDataCompound(join(dataDir, 'weather.dat')).then(simplifyCompound),
      readDataCompound(
        join(worldPath, 'dimensions', 'minecraft', 'overworld', 'data', 'minecraft', 'world_border.dat')
      ).then(simplifyCompound),
    ]);

    const seedRaw =
      genSettings?.seed ??
      (data.WorldGenSettings as NbtRecord | undefined)?.seed ??
      data.RandomSeed ??
      0;
    const version = (data.Version ?? {}) as NbtRecord;
    const overworldClock = clocks?.['minecraft:overworld'] as NbtRecord | undefined;
    const dayTime = toNumber(overworldClock?.total_ticks ?? data.DayTime);

    const spawnPos = (data.spawn as NbtRecord | undefined)?.pos as unknown[] | undefined;
    const spawn = spawnPos
      ? { x: toNumber(spawnPos[0]), y: toNumber(spawnPos[1]), z: toNumber(spawnPos[2]) }
      : { x: toNumber(data.SpawnX), y: toNumber(data.SpawnY), z: toNumber(data.SpawnZ) };

    const difficultySettings = data.difficulty_settings as NbtRecord | undefined;

    const gameRulesRaw = data.GameRules as NbtRecord | undefined;
    const gameRules = rulesCompound
      ? toGameRules(rulesCompound)
      : gameRulesRaw
        ? Object.fromEntries(
            Object.entries(gameRulesRaw).map(([k, v]) => [k, String(v)])
          )
        : undefined;

    const dataPacks =
      ((data.DataPacks as NbtRecord | undefined)
        ?.Enabled as string[] | undefined) ?? [];

    return {
      levelName: String(data.LevelName ?? basename(worldPath)),
      seed: String(seedRaw),
      spawn,
      gameMode: GAME_MODES[toNumber(data.GameType)] ?? 'survival',
      difficulty: toDifficulty(difficultySettings?.difficulty ?? data.Difficulty),
      hardcore: toBool(difficultySettings?.hardcore ?? data.hardcore),
      dayTime,
      dayCount: Math.floor(dayTime / 24000),
      raining: toBool(weather?.raining ?? data.raining),
      thundering: toBool(weather?.thundering ?? data.thundering),
      versionName: String(version.Name ?? 'unknown'),
      dataVersion: toNumber(data.DataVersion),
      worldBorder: {
        // Vanilla default (59,999,968) is not persisted unless customized.
        size: toNumber(border?.size ?? data.BorderSize, 59999968),
        centerX: toNumber(border?.center_x ?? data.BorderCenterX),
        centerZ: toNumber(border?.center_z ?? data.BorderCenterZ),
      },
      dataPacks,
      gameRules,
    };
  }

  async readPlayerData(worldPath: string): Promise<PlayerLocation[]> {
    const names = await this.loadUserCache(worldPath);

    const result: PlayerLocation[] = [];
    const seen = new Set<string>();
    for (const sub of PLAYER_DATA_DIRS) {
      const dir = join(worldPath, sub);
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.endsWith('.dat')) continue;
        const uuid = entry.replace(/\.dat$/, '');
        if (seen.has(uuid.toLowerCase())) continue;
        try {
          const buf = await readFile(join(dir, entry));
          const data = await parsePlayerDat(buf);
          seen.add(uuid.toLowerCase());
          result.push({
            uuid,
            name: names.get(uuid.toLowerCase()),
            x: data.x,
            y: data.y,
            z: data.z,
            dimension: data.dimension,
            health: data.health,
            food: data.food,
            xpLevel: data.xpLevel,
            online: false,
          });
        } catch {
          // Skip corrupt player .dat files
        }
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
