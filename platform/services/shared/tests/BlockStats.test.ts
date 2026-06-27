import { describe, it, expect } from 'vitest';
import { aggregateBlockCounts, isOre, isAir } from '../src/domain/index.js';

describe('isOre / isAir', () => {
  it('recognizes vanilla and modded ores', () => {
    expect(isOre('minecraft:diamond_ore')).toBe(true);
    expect(isOre('minecraft:deepslate_iron_ore')).toBe(true);
    expect(isOre('minecraft:ancient_debris')).toBe(true);
    expect(isOre('create:zinc_ore')).toBe(true);
    expect(isOre('minecraft:stone')).toBe(false);
  });

  it('recognizes air variants', () => {
    expect(isAir('minecraft:air')).toBe(true);
    expect(isAir('minecraft:cave_air')).toBe(true);
    expect(isAir('minecraft:stone')).toBe(false);
  });
});

describe('aggregateBlockCounts', () => {
  it('excludes air from totals and top blocks, and extracts ores', () => {
    const agg = aggregateBlockCounts({
      'minecraft:air': 1000,
      'minecraft:cave_air': 50,
      'minecraft:stone': 500,
      'minecraft:deepslate': 300,
      'minecraft:diamond_ore': 12,
      'minecraft:iron_ore': 40,
    });

    expect(agg.totalBlocks).toBe(500 + 300 + 12 + 40); // air excluded
    expect(agg.blockTypeCount).toBe(4);
    expect(agg.ores).toEqual({ 'minecraft:diamond_ore': 12, 'minecraft:iron_ore': 40 });
    expect(agg.topBlocks[0]).toEqual({ id: 'minecraft:stone', count: 500 });
    expect(agg.topBlocks[1]).toEqual({ id: 'minecraft:deepslate', count: 300 });
  });

  it('limits topBlocks to topN and accepts a Map', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 30; i++) counts.set(`mod:block_${i}`, i + 1);
    const agg = aggregateBlockCounts(counts, 5);
    expect(agg.topBlocks).toHaveLength(5);
    expect(agg.topBlocks[0]!.id).toBe('mod:block_29'); // highest count first
    expect(agg.blockTypeCount).toBe(30);
  });

  it('ignores zero/negative counts', () => {
    const agg = aggregateBlockCounts({ 'minecraft:stone': 0, 'minecraft:dirt': 5 });
    expect(agg.totalBlocks).toBe(5);
    expect(agg.blockTypeCount).toBe(1);
  });
});
