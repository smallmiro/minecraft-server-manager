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
});
