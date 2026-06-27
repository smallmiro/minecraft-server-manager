import { promisify } from 'node:util';
import zlib from 'node:zlib';
import nbt from 'prismarine-nbt';

const inflate = promisify(zlib.inflate);
const gunzip = promisify(zlib.gunzip);

const SECTOR_BYTES = 4096;

/** Decompress a single Anvil chunk payload by its compression-type byte. */
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

/**
 * Iterate the parsed NBT root value of every present chunk in an Anvil region
 * (`.mca`) buffer. Empty/corrupt chunks are skipped. Yields the chunk root's
 * `value` (the top-level compound's field map).
 *
 * Shared by the structure reader (#530) and the block scanner (#531) so the
 * `.mca` header/decompression handling lives in one place.
 */
export async function* iterateRegionChunks(buffer: Buffer): AsyncGenerator<unknown> {
  if (buffer.length < SECTOR_BYTES) return;

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
      root = (await nbt.parse(raw)).parsed as { value: unknown };
    } catch {
      continue;
    }
    yield root.value;
  }
}
