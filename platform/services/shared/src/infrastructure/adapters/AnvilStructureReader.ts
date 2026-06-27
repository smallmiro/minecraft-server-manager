import { promisify } from 'node:util';
import zlib from 'node:zlib';
import nbt from 'prismarine-nbt';
import {
  Dimension,
  type Structure,
  StructureCategory,
  STRUCTURE_CATEGORY_LABELS,
  categorizeStructure,
} from '../../domain/index.js';

const inflate = promisify(zlib.inflate);
const gunzip = promisify(zlib.gunzip);

const SECTOR_BYTES = 4096;

/** Decompress a single Anvil chunk payload by its compression type byte. */
async function decompressChunk(data: Buffer, compression: number): Promise<Buffer | null> {
  try {
    if (compression === 1) return await gunzip(data);
    if (compression === 2) return await inflate(data);
    if (compression === 3) return data; // uncompressed
  } catch {
    return null;
  }
  return null;
}

/** Read an NBT property regardless of intermediate tag-wrapping. */
function prop(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object') {
    const v = (obj as Record<string, { value?: unknown }>)[key];
    if (v && typeof v === 'object' && 'value' in v) return (v as { value: unknown }).value;
  }
  return undefined;
}

/**
 * Coerce an NBT numeric value to a JS number. Handles plain numbers, bigints,
 * and Long-typed values that simplify to `[hi, lo]` pairs or decimal strings.
 * Returns null when no finite number can be derived.
 */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value) && value.length === 2) {
    // prismarine-nbt Long as [high, low] 32-bit words.
    const n = Number((BigInt(value[0] as number) << 32n) | BigInt((value[1] as number) >>> 0));
    return Number.isFinite(n) ? n : null;
  }
  if (value != null) {
    const n = Number(String(value));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Derive a representative block position for a structure start. Prefers the
 * union centre of the children bounding boxes (BB = [minX,minY,minZ,maxX,maxY,maxZ]);
 * falls back to the start chunk centre. Y defaults to 64 when unknown.
 */
function structurePosition(start: unknown): { x: number; y: number; z: number } {
  const childrenList = prop(start, 'Children');
  const children = (childrenList as { value?: unknown[] } | undefined)?.value;
  if (Array.isArray(children) && children.length > 0) {
    let minX = Infinity, minZ = Infinity, minY = Infinity;
    let maxX = -Infinity, maxZ = -Infinity, maxY = -Infinity;
    let found = false;
    for (const child of children) {
      const bb = prop(child, 'BB') as number[] | undefined;
      if (Array.isArray(bb) && bb.length >= 6) {
        found = true;
        minX = Math.min(minX, bb[0]!);
        minY = Math.min(minY, bb[1]!);
        minZ = Math.min(minZ, bb[2]!);
        maxX = Math.max(maxX, bb[3]!);
        maxY = Math.max(maxY, bb[4]!);
        maxZ = Math.max(maxZ, bb[5]!);
      }
    }
    if (found) {
      return {
        x: Math.round((minX + maxX) / 2),
        y: Number.isFinite(minY) ? Math.round((minY + maxY) / 2) : 64,
        z: Math.round((minZ + maxZ) / 2),
      };
    }
  }
  const cx = toNumber(prop(start, 'ChunkX'));
  const cz = toNumber(prop(start, 'ChunkZ'));
  return {
    x: cx !== null ? cx * 16 + 8 : 0,
    y: 64,
    z: cz !== null ? cz * 16 + 8 : 0,
  };
}

/** Extract the `structures.starts` map from a parsed chunk root (1.13+/1.18+). */
function getStarts(root: unknown): Record<string, unknown> | undefined {
  const modern = prop(root, 'structures');
  const starts = modern !== undefined ? prop(modern, 'starts') : undefined;
  if (starts && typeof starts === 'object') return starts as Record<string, unknown>;
  // Legacy (pre-1.18): Level.Structures.Starts
  const level = prop(root, 'Level');
  const legacy = level !== undefined ? prop(level, 'Structures') : undefined;
  const legacyStarts = legacy !== undefined ? prop(legacy, 'Starts') : undefined;
  if (legacyStarts && typeof legacyStarts === 'object') return legacyStarts as Record<string, unknown>;
  return undefined;
}

/**
 * Parse all structure starts from a single Anvil region (`.mca`) buffer.
 * Skips empty/corrupt chunks and `INVALID` starts (references, not origins).
 */
export async function parseStructuresFromRegion(
  buffer: Buffer,
  dimension: Dimension
): Promise<Structure[]> {
  if (buffer.length < SECTOR_BYTES) return [];
  const out: Structure[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < 1024; i++) {
    const entry = buffer.readUInt32BE(i * 4);
    const sectorOffset = entry >>> 8;
    const sectorCount = entry & 0xff;
    if (sectorOffset < 2 || sectorCount === 0) continue;

    const start = sectorOffset * SECTOR_BYTES;
    if (start + 5 > buffer.length) continue;
    const length = buffer.readUInt32BE(start);
    if (length <= 1 || start + 4 + length > buffer.length) continue;
    const compression = buffer.readUInt8(start + 4);
    const payload = buffer.subarray(start + 5, start + 4 + length);

    const raw = await decompressChunk(payload, compression);
    if (!raw) continue;

    let root: { value: unknown };
    try {
      const result = await nbt.parse(raw);
      root = result.parsed as { value: unknown };
    } catch {
      continue;
    }

    const starts = getStarts(root.value);
    if (!starts) continue;

    for (const [, startTag] of Object.entries(starts)) {
      const inner = (startTag as { value?: unknown })?.value ?? startTag;
      const id = prop(inner, 'id');
      if (typeof id !== 'string' || id === 'INVALID') continue;

      const pos = structurePosition(inner);
      // Deduplicate identical starts that span multiple referenced chunks.
      const key = `${id}:${pos.x}:${pos.z}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const category = categorizeStructure(id);
      out.push({
        id,
        category,
        label: STRUCTURE_CATEGORY_LABELS[category],
        x: pos.x,
        y: pos.y,
        z: pos.z,
        dimension,
      });
    }
  }

  return out;
}

// Re-export for callers that only need the enum here.
export { StructureCategory };
