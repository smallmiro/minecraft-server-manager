import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { PrismarineWorldDataReader } from '../src/infrastructure/adapters/PrismarineWorldDataReader.js';
import { Dimension } from '../src/domain/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FACTORY = join(__dirname, 'fixtures', 'world-info', 'factory');

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
});
