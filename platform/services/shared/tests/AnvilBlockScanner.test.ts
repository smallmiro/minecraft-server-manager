import { describe, it, expect } from 'vitest';
import { decodeSection } from '../src/infrastructure/adapters/AnvilBlockScanner.js';

describe('decodeSection', () => {
  it('counts a single-entry palette as a full section (no data)', () => {
    expect(decodeSection(['minecraft:air'])).toEqual({ 'minecraft:air': 4096 });
  });

  it('decodes a packed 2-entry palette (4 bits/block, 16 blocks/long)', () => {
    // Palette: [air=0, stone=1]. Put index 1 in the first 3 block slots of the
    // first long, everything else index 0. 4096 blocks = 256 longs.
    // long0 = (1<<0) | (1<<4) | (1<<8) = 1 + 16 + 256 = 273.
    const data: [number, number][] = [[0, 273]];
    for (let i = 1; i < 256; i++) data.push([0, 0]);

    const counts = decodeSection(['minecraft:air', 'minecraft:stone'], data);

    expect(counts['minecraft:stone']).toBe(3);
    expect(counts['minecraft:air']).toBe(4093);
    expect(counts['minecraft:stone']! + counts['minecraft:air']!).toBe(4096);
  });

  it('returns empty for an empty palette', () => {
    expect(decodeSection([])).toEqual({});
  });
});
