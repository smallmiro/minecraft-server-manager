import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  IBlockScanner,
  BlockScanOptions,
  BlockScanOutcome,
} from '../../application/ports/outbound/IBlockScanner.js';
import { iterateRegionChunks } from './anvilRegion.js';
import { resolveRegionDirs } from './dimensionRegions.js';

const BLOCKS_PER_SECTION = 4096; // 16 × 16 × 16

/** Read an NBT property's unwrapped value. */
function prop(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object') {
    const v = (obj as Record<string, { value?: unknown }>)[key];
    if (v && typeof v === 'object' && 'value' in v) return (v as { value: unknown }).value;
  }
  return undefined;
}

/** Combine a prismarine-nbt long (either `[hi, lo]` words or a bigint) to BigInt. */
function toBigInt(v: unknown): bigint {
  if (typeof v === 'bigint') return v;
  if (Array.isArray(v) && v.length === 2) {
    return (BigInt((v[0] as number) >>> 0) << 32n) | BigInt((v[1] as number) >>> 0);
  }
  return 0n;
}

/**
 * Decode a single chunk section's packed block-state palette into per-block
 * counts (1.16+ non-spanning long packing). A single-entry palette has no data
 * array and means the whole section is that block.
 */
export function decodeSection(
  paletteNames: string[],
  data?: unknown[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  if (paletteNames.length === 0) return counts;

  if (!data || data.length === 0 || paletteNames.length === 1) {
    counts[paletteNames[0]!] = BLOCKS_PER_SECTION;
    return counts;
  }

  const bits = Math.max(4, 32 - Math.clz32(paletteNames.length - 1));
  const perLong = Math.floor(64 / bits);
  const mask = (1n << BigInt(bits)) - 1n;

  let idx = 0;
  for (const word of data) {
    let v = toBigInt(word);
    for (let i = 0; i < perLong && idx < BLOCKS_PER_SECTION; i++, idx++) {
      const name = paletteNames[Number(v & mask)];
      if (name) counts[name] = (counts[name] ?? 0) + 1;
      v >>= BigInt(bits);
    }
  }
  return counts;
}

/** Count all blocks in a parsed chunk root value into `counts`. */
function countChunk(rootValue: unknown, counts: Record<string, number>): void {
  const sections = prop(rootValue, 'sections') as { value?: unknown[] } | undefined;
  const list = sections?.value;
  if (!Array.isArray(list)) return;

  for (const section of list) {
    const blockStates = prop(section, 'block_states');
    if (!blockStates) continue;
    const paletteTag = prop(blockStates, 'palette') as { value?: unknown[] } | undefined;
    const palette = paletteTag?.value;
    if (!Array.isArray(palette)) continue;
    const names = palette.map((p) => (prop(p, 'Name') as string) ?? 'minecraft:air');
    const data = prop(blockStates, 'data') as unknown[] | undefined;
    const sectionCounts = decodeSection(names, data);
    for (const [name, n] of Object.entries(sectionCounts)) {
      counts[name] = (counts[name] ?? 0) + n;
    }
  }
}

/**
 * {@link IBlockScanner} backed by direct Anvil region/section decoding. Reuses
 * the shared region iterator and dimension-dir resolver.
 */
export class AnvilBlockScanner implements IBlockScanner {
  async scanWorld(worldPath: string, options?: BlockScanOptions): Promise<BlockScanOutcome> {
    const onProgress = options?.onProgress;
    const signal = options?.signal;

    const regionDirs = resolveRegionDirs(worldPath);

    // Pre-list region files per dimension to compute an accurate total.
    const work: { dimension: string; dir: string; files: string[] }[] = [];
    for (const { dimension, dir } of regionDirs) {
      let files: string[] = [];
      try {
        files = (await readdir(dir)).filter((f) => f.endsWith('.mca'));
      } catch {
        files = [];
      }
      if (files.length > 0) work.push({ dimension, dir, files });
    }

    const regionsTotal = work.reduce((sum, w) => sum + w.files.length, 0);
    const counts: Record<string, number> = {};
    const dimensions: string[] = [];
    let regionsDone = 0;
    let cancelled = false;

    for (const { dimension, dir, files } of work) {
      if (signal?.aborted) {
        cancelled = true;
        break;
      }
      dimensions.push(dimension);

      for (const file of files) {
        if (signal?.aborted) {
          cancelled = true;
          break;
        }

        let buf: Buffer;
        try {
          buf = await readFile(join(dir, file));
        } catch {
          regionsDone += 1;
          continue;
        }

        for await (const rootValue of iterateRegionChunks(buf)) {
          countChunk(rootValue, counts);
        }

        regionsDone += 1;
        onProgress?.({ dimension, regionsDone, regionsTotal });
      }
    }

    return { counts, dimensions, regionsScanned: regionsDone, cancelled };
  }
}
