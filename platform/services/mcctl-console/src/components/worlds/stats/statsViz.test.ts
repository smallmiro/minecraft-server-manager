import { describe, it, expect } from 'vitest';
import { buildOreSlices, blockCategory, percent, formatDuration } from './statsViz';

describe('buildOreSlices', () => {
  const ores = {
    'minecraft:iron_ore': 100,
    'minecraft:deepslate_iron_ore': 300,
    'minecraft:diamond_ore': 5,
    'minecraft:nether_gold_ore': 20,
    'create:zinc_ore': 10,
  };

  it('merges stone/deepslate/nether variants into one base ore, sorted desc', () => {
    const slices = buildOreSlices(ores);
    expect(slices.map((s) => s.key)).toEqual(['iron', 'gold', 'zinc', 'diamond']);
    expect(slices[0].count).toBe(400);
  });

  it('computes share of total ores and flags rare ores', () => {
    const slices = buildOreSlices(ores);
    const diamond = slices.find((s) => s.key === 'diamond')!;
    expect(diamond.rare).toBe(true);
    expect(slices[0].rare).toBe(false);
    expect(slices.reduce((a, s) => a + s.share, 0)).toBeCloseTo(100);
  });

  it('keeps variants separate when merge is off', () => {
    expect(buildOreSlices(ores, false)).toHaveLength(5);
  });

  it('gives unknown (modded) ores a fallback color', () => {
    expect(buildOreSlices(ores).find((s) => s.key === 'zinc')!.color).toMatch(/^#/);
  });

  it('returns [] for no ores', () => {
    expect(buildOreSlices({})).toEqual([]);
  });
});

describe('blockCategory', () => {
  it.each([
    ['minecraft:stone', 'Stone'],
    ['minecraft:deepslate', 'Stone'],
    ['minecraft:dirt', 'Earth'],
    ['minecraft:oak_log', 'Wood'],
    ['minecraft:water', 'Fluid'],
    ['minecraft:netherrack', 'Nether'],
    ['mod:weird_block', 'Other'],
  ])('%s -> %s', (id, cat) => {
    expect(blockCategory(id).label).toBe(cat);
  });
});

describe('percent / formatDuration', () => {
  it('percent guards zero total', () => {
    expect(percent(1, 0)).toBe(0);
    expect(percent(25, 100)).toBe(25);
  });
  it('formats durations', () => {
    expect(formatDuration(900)).toBe('0.9s');
    expect(formatDuration(7000)).toBe('7.0s');
    expect(formatDuration(125000)).toBe('2m 5s');
  });
});
