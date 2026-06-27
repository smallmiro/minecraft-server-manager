import { describe, it, expect } from 'vitest';
import { deflateSync } from 'node:zlib';
import nbt from 'prismarine-nbt';
import { parseStructuresFromRegion } from '../src/infrastructure/adapters/AnvilStructureReader.js';
import { Dimension, StructureCategory } from '../src/domain/index.js';

// --- Minimal NBT tag builders (prismarine-nbt tagged format) ---
const comp = (value: Record<string, unknown>) => ({ type: 'compound', value });
const str = (value: string) => ({ type: 'string', value });
const int = (value: number) => ({ type: 'int', value });
const intArray = (value: number[]) => ({ type: 'intArray', value });
/**
 * A list of compound entries. Each entry is a RAW field map (not wrapped in a
 * compound tag) — this matches prismarine-nbt's list-of-compound shape.
 */
const listComp = (items: Record<string, unknown>[]) => ({
  type: 'list',
  value: { type: 'compound', value: items },
});

/** Build a chunk root NBT (1.18+ layout) with the given structure starts. */
function chunkNbt(starts: Record<string, unknown>): Buffer {
  const root = {
    type: 'compound' as const,
    name: '',
    value: {
      structures: comp({
        starts: comp(starts),
        References: comp({}),
      }),
    },
  };
  // prismarine-nbt writeUncompressed returns a Buffer for the given root.
  return nbt.writeUncompressed(root as unknown as nbt.NBT, 'big');
}

/** Wrap a single chunk into a minimal one-chunk Anvil region buffer. */
function buildRegion(chunk: Buffer): Buffer {
  const compressed = deflateSync(chunk); // compression type 2 (zlib)
  const header = Buffer.alloc(8192); // 4KB locations + 4KB timestamps
  // Place the chunk at sector 2 (first 2 sectors are the header).
  header.writeUInt32BE((2 << 8) | 1, 0); // entry 0: offset=2 sectors, count=1
  const body = Buffer.alloc(4096);
  body.writeUInt32BE(compressed.length + 1, 0); // length prefix
  body.writeUInt8(2, 4); // compression: zlib
  compressed.copy(body, 5);
  return Buffer.concat([header, body]);
}

describe('parseStructuresFromRegion', () => {
  it('extracts a structure start with position from children BB', async () => {
    const chunk = chunkNbt({
      'minecraft:village_plains': comp({
        id: str('minecraft:village_plains'),
        ChunkX: int(8),
        ChunkZ: int(2),
        Children: listComp([{ BB: intArray([100, 60, 30, 140, 80, 70]) }]),
      }),
    });
    const region = buildRegion(chunk);

    const structures = await parseStructuresFromRegion(region, Dimension.Overworld);

    expect(structures).toHaveLength(1);
    expect(structures[0]).toMatchObject({
      id: 'minecraft:village_plains',
      category: StructureCategory.Village,
      label: 'Village',
      x: 120, // (100 + 140) / 2
      y: 60, // min BB Y
      z: 50, // (30 + 70) / 2
      dimension: Dimension.Overworld,
    });
  });

  it('skips INVALID starts (structure references, not origins)', async () => {
    const chunk = chunkNbt({
      'minecraft:fortress': comp({ id: str('INVALID') }),
      'minecraft:end_city': comp({
        id: str('minecraft:end_city'),
        ChunkX: int(0),
        ChunkZ: int(0),
        Children: listComp([{ BB: intArray([0, 64, 0, 16, 80, 16]) }]),
      }),
    });
    const structures = await parseStructuresFromRegion(buildRegion(chunk), Dimension.End);
    expect(structures).toHaveLength(1);
    expect(structures[0]!.category).toBe(StructureCategory.EndCity);
  });

  it('falls back to start-chunk centre when no children BB', async () => {
    const chunk = chunkNbt({
      'minecraft:pillager_outpost': comp({
        id: str('minecraft:pillager_outpost'),
        ChunkX: int(10),
        ChunkZ: int(-3),
      }),
    });
    const structures = await parseStructuresFromRegion(buildRegion(chunk), Dimension.Overworld);
    expect(structures[0]).toMatchObject({
      category: StructureCategory.Outpost,
      x: 168, // 10*16 + 8
      z: -40, // -3*16 + 8
    });
  });

  it('returns empty for a too-small / empty buffer', async () => {
    expect(await parseStructuresFromRegion(Buffer.alloc(10), Dimension.Overworld)).toEqual([]);
    expect(await parseStructuresFromRegion(Buffer.alloc(8192), Dimension.Overworld)).toEqual([]);
  });
});
