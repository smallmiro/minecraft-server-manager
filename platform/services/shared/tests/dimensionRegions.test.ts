import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveRegionDirs } from '../src/infrastructure/adapters/dimensionRegions.js';
import { Dimension } from '../src/domain/index.js';

describe('resolveRegionDirs', () => {
  let work: string;

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), 'dimregions-'));
  });

  afterEach(() => {
    rmSync(work, { recursive: true, force: true });
  });

  // Create a region dir with one .mca file stamped at the given epoch ms.
  const mkRegion = (dir: string, mtimeMs: number): void => {
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'r.0.0.mca');
    writeFileSync(file, '');
    const secs = mtimeMs / 1000;
    utimesSync(file, secs, secs);
  };

  const dirFor = (worldPath: string, dim: Dimension): string | undefined =>
    resolveRegionDirs(worldPath).find((r) => r.dimension === dim)?.dir;

  const OLD = Date.parse('2026-02-02T12:00:00Z');
  const NEW = Date.parse('2026-06-28T12:00:00Z');

  it('nether: stale satellite + newer single-folder -> single-folder (issue #544)', () => {
    const w = join(work, 'w1');
    mkRegion(join(w, 'DIM-1', 'region'), NEW); // active single-folder
    mkRegion(join(`${w}_nether`, 'DIM-1', 'region'), OLD); // stale satellite
    expect(dirFor(w, Dimension.Nether)).toBe(join(w, 'DIM-1', 'region'));
  });

  it('nether: only split satellite (genuine Paper) -> satellite (no regression)', () => {
    const w = join(work, 'w2');
    mkRegion(join(`${w}_nether`, 'DIM-1', 'region'), NEW);
    expect(dirFor(w, Dimension.Nether)).toBe(join(`${w}_nether`, 'DIM-1', 'region'));
  });

  it('nether: only single-folder -> single-folder', () => {
    const w = join(work, 'w3');
    mkRegion(join(w, 'DIM-1', 'region'), NEW);
    expect(dirFor(w, Dimension.Nether)).toBe(join(w, 'DIM-1', 'region'));
  });

  it('nether: newer split satellite -> satellite', () => {
    const w = join(work, 'w4');
    mkRegion(join(w, 'DIM-1', 'region'), OLD);
    mkRegion(join(`${w}_nether`, 'DIM-1', 'region'), NEW);
    expect(dirFor(w, Dimension.Nether)).toBe(join(`${w}_nether`, 'DIM-1', 'region'));
  });

  it('nether: no region data -> dimension absent', () => {
    const w = join(work, 'w5');
    mkdirSync(w, { recursive: true });
    expect(dirFor(w, Dimension.Nether)).toBeUndefined();
  });

  it('end: stale satellite + newer single-folder -> single-folder', () => {
    const w = join(work, 'e1');
    mkRegion(join(w, 'DIM1', 'region'), NEW);
    mkRegion(join(`${w}_the_end`, 'DIM1', 'region'), OLD);
    expect(dirFor(w, Dimension.End)).toBe(join(w, 'DIM1', 'region'));
  });

  it('overworld: region present -> world region dir', () => {
    const w = join(work, 'o1');
    mkRegion(join(w, 'region'), NEW);
    expect(dirFor(w, Dimension.Overworld)).toBe(join(w, 'region'));
  });

  // Latest Minecraft stores every dimension (overworld included) under
  // dimensions/minecraft/<dim>/region (issue #546).
  it('overworld: dimensions/ layout -> dimensions overworld region', () => {
    const w = join(work, 'd1');
    mkRegion(join(w, 'dimensions', 'minecraft', 'overworld', 'region'), NEW);
    expect(dirFor(w, Dimension.Overworld)).toBe(
      join(w, 'dimensions', 'minecraft', 'overworld', 'region'),
    );
  });

  it('nether: dimensions/ layout -> dimensions the_nether region', () => {
    const w = join(work, 'd2');
    mkRegion(join(w, 'dimensions', 'minecraft', 'the_nether', 'region'), NEW);
    expect(dirFor(w, Dimension.Nether)).toBe(
      join(w, 'dimensions', 'minecraft', 'the_nether', 'region'),
    );
  });

  it('end: dimensions/ layout -> dimensions the_end region', () => {
    const w = join(work, 'd3');
    mkRegion(join(w, 'dimensions', 'minecraft', 'the_end', 'region'), NEW);
    expect(dirFor(w, Dimension.End)).toBe(
      join(w, 'dimensions', 'minecraft', 'the_end', 'region'),
    );
  });

  // All three layouts coexist (classic -> latest migration with a leftover Paper
  // satellite). The active dimensions/ data is newest even though the satellite
  // is newer than the old DIM-1 -> must pick the dimensions/ region.
  it('nether: all three layouts, dimensions/ newest -> dimensions region', () => {
    const w = join(work, 'd4');
    const MID = Date.parse('2026-04-04T12:00:00Z');
    mkRegion(join(w, 'dimensions', 'minecraft', 'the_nether', 'region'), NEW); // active
    mkRegion(join(`${w}_nether`, 'DIM-1', 'region'), MID); // stale satellite
    mkRegion(join(w, 'DIM-1', 'region'), OLD); // stale classic
    expect(dirFor(w, Dimension.Nether)).toBe(
      join(w, 'dimensions', 'minecraft', 'the_nether', 'region'),
    );
  });

  // World-save root BlueMap mounts for each dimension (ported from the removed
  // resolve-dimension-root.bats, #733). Non-split layouts mount the world root
  // and BlueMap resolves DIM-1/DIM1 or dimensions/minecraft/<dim> itself; a
  // Paper satellite mounts the satellite folder.
  describe('root', () => {
    const rootFor = (worldPath: string, dim: Dimension): string | undefined =>
      resolveRegionDirs(worldPath).find((r) => r.dimension === dim)?.root;
    const MID = Date.parse('2026-04-04T12:00:00Z');

    it('nether: stale satellite + newer single-folder -> world root (#542)', () => {
      const w = join(work, 'r1');
      mkRegion(join(w, 'DIM-1', 'region'), NEW);
      mkRegion(join(`${w}_nether`, 'DIM-1', 'region'), OLD);
      expect(rootFor(w, Dimension.Nether)).toBe(w);
    });

    it('nether: only split satellite -> satellite', () => {
      const w = join(work, 'r2');
      mkRegion(join(`${w}_nether`, 'DIM-1', 'region'), NEW);
      expect(rootFor(w, Dimension.Nether)).toBe(`${w}_nether`);
    });

    it('nether: newer split satellite -> satellite', () => {
      const w = join(work, 'r3');
      mkRegion(join(w, 'DIM-1', 'region'), OLD);
      mkRegion(join(`${w}_nether`, 'DIM-1', 'region'), NEW);
      expect(rootFor(w, Dimension.Nether)).toBe(`${w}_nether`);
    });

    it('end: only split satellite -> satellite; stale satellite -> world root', () => {
      const split = join(work, 'r4');
      mkRegion(join(`${split}_the_end`, 'DIM1', 'region'), NEW);
      expect(rootFor(split, Dimension.End)).toBe(`${split}_the_end`);

      const migrated = join(work, 'r5');
      mkRegion(join(migrated, 'DIM1', 'region'), NEW);
      mkRegion(join(`${migrated}_the_end`, 'DIM1', 'region'), OLD);
      expect(rootFor(migrated, Dimension.End)).toBe(migrated);
    });

    it('overworld: region present -> world root', () => {
      const w = join(work, 'r6');
      mkRegion(join(w, 'region'), NEW);
      expect(rootFor(w, Dimension.Overworld)).toBe(w);
    });

    it('dimensions/ layout -> world root for every dimension (#546)', () => {
      const w = join(work, 'r7');
      mkRegion(join(w, 'dimensions', 'minecraft', 'overworld', 'region'), NEW);
      mkRegion(join(w, 'dimensions', 'minecraft', 'the_nether', 'region'), NEW);
      mkRegion(join(w, 'dimensions', 'minecraft', 'the_end', 'region'), NEW);
      expect(rootFor(w, Dimension.Overworld)).toBe(w);
      expect(rootFor(w, Dimension.Nether)).toBe(w);
      expect(rootFor(w, Dimension.End)).toBe(w);
    });

    it('nether: all three layouts, dimensions/ newest -> world root', () => {
      const w = join(work, 'r8');
      mkRegion(join(w, 'dimensions', 'minecraft', 'the_nether', 'region'), NEW);
      mkRegion(join(`${w}_nether`, 'DIM-1', 'region'), MID);
      mkRegion(join(w, 'DIM-1', 'region'), OLD);
      expect(rootFor(w, Dimension.Nether)).toBe(w);
    });

    it('empty region dir counts as no data -> dimension absent (#575)', () => {
      const w = join(work, 'r9');
      mkdirSync(join(w, 'dimensions', 'minecraft', 'the_nether', 'region'), { recursive: true });
      expect(rootFor(w, Dimension.Nether)).toBeUndefined();
    });
  });
});
