import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import nbt from 'prismarine-nbt';
import { PrismarineWorldDataReader } from '../src/infrastructure/adapters/PrismarineWorldDataReader.js';
import { Dimension } from '../src/domain/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FACTORY = join(__dirname, 'fixtures', 'world-info', 'factory');

/** Write a gzip-compressed NBT file (the on-disk format of every *.dat). */
async function writeDat(file: string, root: nbt.NBT): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, gzipSync(nbt.writeUncompressed(root)));
}

/** 26.x data files wrap their payload in a `data` compound (#601). */
function dataFile(data: Record<string, unknown>): nbt.NBT {
  return nbt.comp({
    data: nbt.comp(data as Parameters<typeof nbt.comp>[0]),
    DataVersion: nbt.int(4903),
  });
}

/** Synthetic minimal player .dat (fake values only). */
function playerDat(pos: [number, number, number], dimension: string): nbt.NBT {
  return nbt.comp({
    Pos: nbt.list(nbt.double(pos)),
    Dimension: nbt.string(dimension),
    Health: nbt.float(18),
    foodLevel: nbt.int(17),
    XpLevel: nbt.int(4),
  });
}

/** Minimal 26.x level.dat: fields moved out to data/minecraft/*.dat. */
function level26x(): nbt.NBT {
  return nbt.comp({
    Data: nbt.comp({
      LevelName: nbt.string('modern'),
      GameType: nbt.int(1),
      DataVersion: nbt.int(4903),
      Version: nbt.comp({ Name: nbt.string('26.2'), Id: nbt.int(4903) }),
      difficulty_settings: nbt.comp({
        difficulty: nbt.string('hard'),
        hardcore: nbt.byte(1),
        locked: nbt.byte(0),
      }),
      spawn: nbt.comp({
        pos: nbt.intArray([100, 70, -50]),
        dimension: nbt.string('minecraft:overworld'),
        yaw: nbt.float(0),
        pitch: nbt.float(0),
      }),
    }),
  });
}

const FAKE_UUID_A = '00000000-0000-4000-8000-00000000000a';
const FAKE_UUID_B = '00000000-0000-4000-8000-00000000000b';

describe('PrismarineWorldDataReader', () => {
  const reader = new PrismarineWorldDataReader();

  describe('readLevelData', () => {
    it('parses metadata from a real level.dat', async () => {
      const data = await reader.readLevelData(FACTORY);

      expect(data.levelName).toBe('factory');
      // long seed kept as string (exceeds Number safe range in general)
      expect(data.seed).toBe('618742839476293847');
      expect(data.spawn).toEqual({ x: 0, y: 64, z: 0 });
      expect(data.gameMode).toBe('survival'); // GameType 0
      expect(data.difficulty).toBe('normal'); // Difficulty 2
      expect(data.hardcore).toBe(false);
      expect(data.dayTime).toBe(428003);
      expect(data.dayCount).toBe(Math.floor(428003 / 24000));
      expect(data.raining).toBe(true);
      expect(data.thundering).toBe(false);
      expect(data.versionName).toBe('1.21.1');
      expect(data.dataVersion).toBe(3955);
      expect(data.worldBorder.size).toBe(59999968);
      expect(data.worldBorder.centerX).toBe(0);
      expect(data.worldBorder.centerZ).toBe(0);
      expect(data.dataPacks).toContain('vanilla');
      expect(data.gameRules).toBeDefined();
    });
  });

  describe('readPlayerData', () => {
    it('parses offline player locations', async () => {
      const players = await reader.readPlayerData(FACTORY);

      expect(players.length).toBe(2);
      const p = players.find((x) =>
        x.uuid.startsWith('91091459')
      );
      expect(p).toBeDefined();
      expect(p!.x).toBeCloseTo(-85.2576, 3);
      expect(p!.y).toBe(82);
      expect(p!.z).toBeCloseTo(121.4629, 3);
      expect(p!.dimension).toBe(Dimension.Overworld);
      expect(p!.health).toBe(20);
      expect(p!.food).toBe(20);
      expect(p!.xpLevel).toBe(0);
      expect(p!.online).toBe(false);
      // name resolved from usercache.json
      expect(p!.name).toBe('Seatree1229');
    });

    it('returns empty array when playerdata is absent', async () => {
      const players = await reader.readPlayerData(join(FACTORY, 'region'));
      expect(players).toEqual([]);
    });
  });

  describe('detectDimensions', () => {
    it('detects internal split-dimension folders (DIM-1/DIM1)', async () => {
      const dims = await reader.detectDimensions(FACTORY);
      expect(dims.overworld).toBe(true);
      expect(dims.nether).toBe(true);
      expect(dims.end).toBe(true);
    });
  });

  describe('countRegions', () => {
    it('counts .mca region files', async () => {
      const count = await reader.countRegions(FACTORY);
      expect(count).toBe(1);
    });

    it('returns 0 when region dir is absent', async () => {
      const count = await reader.countRegions(join(FACTORY, 'playerdata'));
      expect(count).toBe(0);
    });
  });

  describe('26.x save format (#601)', () => {
    let world: string;

    beforeEach(async () => {
      world = join(tmpdir(), `mc-world-26x-${randomUUID()}`);
      await mkdir(world, { recursive: true });
    });

    afterEach(async () => {
      await rm(world, { recursive: true, force: true });
    });

    async function writeModernWorld(): Promise<void> {
      const dm = join(world, 'data', 'minecraft');
      await writeDat(join(world, 'level.dat'), level26x());
      await writeDat(
        join(dm, 'world_gen_settings.dat'),
        dataFile({ seed: nbt.long(1234567890123456789n), bonus_chest: nbt.byte(0) })
      );
      await writeDat(
        join(dm, 'world_clocks.dat'),
        dataFile({
          'minecraft:overworld': nbt.comp({ total_ticks: nbt.long(5615754n) }),
          'minecraft:the_end': nbt.comp({ total_ticks: nbt.long(100n) }),
        })
      );
      await writeDat(
        join(dm, 'game_rules.dat'),
        dataFile({
          'minecraft:keep_inventory': nbt.byte(1),
          'minecraft:mob_griefing': nbt.byte(0),
          'minecraft:random_tick_speed': nbt.int(3),
        })
      );
      await writeDat(
        join(dm, 'weather.dat'),
        dataFile({ raining: nbt.byte(1), thundering: nbt.byte(1), rain_time: nbt.int(10) })
      );
      await writeDat(
        join(world, 'dimensions', 'minecraft', 'overworld', 'data', 'minecraft', 'world_border.dat'),
        dataFile({
          size: nbt.double(1000),
          center_x: nbt.double(10.5),
          center_z: nbt.double(-20),
        })
      );
    }

    it('reads fields from data/minecraft/*.dat and the new level.dat keys', async () => {
      await writeModernWorld();

      const data = await reader.readLevelData(world);

      expect(data.levelName).toBe('modern');
      expect(data.seed).toBe('1234567890123456789');
      expect(data.dayTime).toBe(5615754);
      expect(data.dayCount).toBe(Math.floor(5615754 / 24000));
      expect(data.spawn).toEqual({ x: 100, y: 70, z: -50 });
      expect(data.gameMode).toBe('creative');
      expect(data.difficulty).toBe('hard');
      expect(data.hardcore).toBe(true);
      expect(data.raining).toBe(true);
      expect(data.thundering).toBe(true);
      expect(data.gameRules).toEqual({
        keep_inventory: 'true',
        mob_griefing: 'false',
        random_tick_speed: '3',
      });
      expect(data.worldBorder).toEqual({ size: 1000, centerX: 10.5, centerZ: -20 });
      expect(data.versionName).toBe('26.2');
      expect(data.dataVersion).toBe(4903);
    });

    it('falls back to defaults without throwing when data files are missing or corrupt', async () => {
      await writeDat(join(world, 'level.dat'), level26x());
      const dm = join(world, 'data', 'minecraft');
      await mkdir(dm, { recursive: true });
      await writeFile(join(dm, 'world_gen_settings.dat'), 'not nbt');
      await writeFile(join(dm, 'weather.dat'), Buffer.from([0x1f, 0x8b, 0x00]));

      const data = await reader.readLevelData(world);

      expect(data.seed).toBe('0');
      expect(data.dayTime).toBe(0);
      expect(data.dayCount).toBe(0);
      expect(data.raining).toBe(false);
      expect(data.thundering).toBe(false);
      expect(data.gameRules).toBeUndefined();
      expect(data.worldBorder).toEqual({ size: 59999968, centerX: 0, centerZ: 0 });
      // level.dat-resident 26.x keys still apply
      expect(data.difficulty).toBe('hard');
      expect(data.spawn).toEqual({ x: 100, y: 70, z: -50 });
    });

    it('reads player locations from players/data/', async () => {
      await writeDat(
        join(world, 'players', 'data', `${FAKE_UUID_A}.dat`),
        playerDat([1.5, 64, -2.5], 'minecraft:the_nether')
      );
      // Backup copies kept beside the live file are ignored.
      await writeFile(join(world, 'players', 'data', `${FAKE_UUID_A}.dat_old`), 'old');

      const players = await reader.readPlayerData(world);

      expect(players).toEqual([
        expect.objectContaining({
          uuid: FAKE_UUID_A,
          x: 1.5,
          y: 64,
          z: -2.5,
          dimension: Dimension.Nether,
          health: 18,
          food: 17,
          xpLevel: 4,
          online: false,
        }),
      ]);
    });

    it('merges playerdata/ and players/data/, preferring players/data/ per uuid', async () => {
      await writeDat(
        join(world, 'players', 'data', `${FAKE_UUID_A}.dat`),
        playerDat([10, 70, 10], 'minecraft:overworld')
      );
      await writeDat(
        join(world, 'playerdata', `${FAKE_UUID_A}.dat`),
        playerDat([-1, -1, -1], 'minecraft:overworld')
      );
      await writeDat(
        join(world, 'playerdata', `${FAKE_UUID_B}.dat`),
        playerDat([5, 60, 5], 'minecraft:the_end')
      );

      const players = await reader.readPlayerData(world);
      const byUuid = new Map(players.map((p) => [p.uuid, p]));

      expect(players).toHaveLength(2);
      expect(byUuid.get(FAKE_UUID_A)!.x).toBe(10);
      expect(byUuid.get(FAKE_UUID_B)!.dimension).toBe(Dimension.End);
    });
  });
});
