/**
 * TDD tests for parsePlayerDat's gameMode/inventory extraction (#528, Phase 3).
 * Builds synthetic NBT buffers with prismarine-nbt's own tag builders +
 * writeUncompressed, rather than binary fixtures, since nbt.parse() accepts
 * both gzip and raw NBT.
 */
import { describe, it, expect } from 'vitest';
import nbt from 'prismarine-nbt';
import { Dimension } from '../src/domain/index.js';
import { parsePlayerDat } from '../src/infrastructure/adapters/playerDataNbt.js';

function inventoryStack(id: string, slot: number, count: number, useNewCountField: boolean) {
  return {
    id: nbt.string(id),
    Slot: nbt.byte(slot),
    ...(useNewCountField ? { count: nbt.int(count) } : { Count: nbt.byte(count) }),
  };
}

function buildPlayerDat(fields: Record<string, unknown>): Buffer {
  return nbt.writeUncompressed(nbt.comp(fields));
}

describe('parsePlayerDat', () => {
  it('parses position, dimension, health, food, xpLevel (#525 baseline)', async () => {
    const buf = buildPlayerDat({
      Pos: nbt.list(nbt.double([-85.25, 82, 121.46])),
      Dimension: nbt.string('minecraft:the_nether'),
      Health: nbt.float(15.5),
      foodLevel: nbt.int(18),
      XpLevel: nbt.int(7),
    });

    const data = await parsePlayerDat(buf);

    expect(data.x).toBeCloseTo(-85.25, 2);
    expect(data.y).toBe(82);
    expect(data.z).toBeCloseTo(121.46, 2);
    expect(data.dimension).toBe(Dimension.Nether);
    expect(data.health).toBe(15.5);
    expect(data.food).toBe(18);
    expect(data.xpLevel).toBe(7);
  });

  it('maps playerGameType to the GameMode enum', async () => {
    const creative = await parsePlayerDat(buildPlayerDat({ playerGameType: nbt.int(1) }));
    expect(creative.gameMode).toBe('creative');

    const spectator = await parsePlayerDat(buildPlayerDat({ playerGameType: nbt.int(3) }));
    expect(spectator.gameMode).toBe('spectator');
  });

  it('defaults to survival when playerGameType is absent', async () => {
    const data = await parsePlayerDat(buildPlayerDat({ Health: nbt.float(20) }));
    expect(data.gameMode).toBe('survival');
  });

  it('aggregates inventory stacks by item id, summing old Count and new count fields', async () => {
    const buf = buildPlayerDat({
      Inventory: nbt.list(
        nbt.comp([
          inventoryStack('minecraft:diamond', 0, 5, false), // legacy byte Count
          inventoryStack('minecraft:diamond', 1, 7, true), // 1.20.5+ int count
          inventoryStack('minecraft:oak_log', 2, 64, false),
        ])
      ),
    });

    const data = await parsePlayerDat(buf);

    expect(data.inventory.slotsUsed).toBe(3);
    expect(data.inventory.items).toEqual([
      { id: 'minecraft:oak_log', count: 64 },
      { id: 'minecraft:diamond', count: 12 },
    ]);
  });

  it('returns an empty inventory summary when Inventory is absent', async () => {
    const data = await parsePlayerDat(buildPlayerDat({ Health: nbt.float(20) }));
    expect(data.inventory).toEqual({ slotsUsed: 0, items: [] });
  });
});
