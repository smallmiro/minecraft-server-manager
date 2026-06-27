import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BlueMapMarkerWriter, buildMarkerSets } from '../src/infrastructure/adapters/BlueMapMarkerWriter.js';
import { Dimension, StructureCategory, type Structure } from '../src/domain/index.js';

const struct = (over: Partial<Structure>): Structure => ({
  id: 'minecraft:village_plains',
  category: StructureCategory.Village,
  label: 'Village',
  x: 100,
  y: 64,
  z: 200,
  dimension: Dimension.Overworld,
  ...over,
});

describe('buildMarkerSets', () => {
  it('groups structures into one toggleable marker-set per category', () => {
    const sets = buildMarkerSets([
      struct({ category: StructureCategory.Village, label: 'Village', x: 1, z: 2 }),
      struct({ category: StructureCategory.Village, label: 'Village', x: 3, z: 4 }),
      struct({ category: StructureCategory.EndCity, label: 'End City', x: 5, z: 6 }),
    ]);
    expect(Object.keys(sets).sort()).toEqual(['end_city', 'village']);
    expect(sets['village']!.toggleable).toBe(true);
    expect(Object.keys(sets['village']!.markers)).toHaveLength(2);
    expect(Object.keys(sets['end_city']!.markers)).toHaveLength(1);
  });

  it('encodes position and puts coordinates in the popup detail', () => {
    const sets = buildMarkerSets([struct({ x: 120, y: 70, z: 50, label: 'Village' })]);
    const marker = Object.values(sets['village']!.markers)[0]!;
    expect(marker.position).toEqual({ x: 120, y: 70, z: 50 });
    expect(marker.type).toBe('poi');
    expect(marker.detail).toContain('120');
    expect(marker.detail).toContain('50');
  });
});

describe('BlueMapMarkerWriter', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'bm-markers-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const webroot = () => join(root, 'web');

  it('writes per-dimension markers.json only for rendered map dirs', async () => {
    // overworld + nether map dirs exist; end does not.
    mkdirSync(join(webroot(), 'maps', 'overworld'), { recursive: true });
    mkdirSync(join(webroot(), 'maps', 'nether'), { recursive: true });

    const writer = new BlueMapMarkerWriter();
    const result = await writer.writeMarkers(webroot(), [
      struct({ dimension: Dimension.Overworld, category: StructureCategory.Village }),
      struct({ dimension: Dimension.Nether, category: StructureCategory.Fortress, label: 'Nether Fortress' }),
      struct({ dimension: Dimension.End, category: StructureCategory.EndCity }),
    ]);

    expect(existsSync(join(webroot(), 'maps', 'overworld', 'live', 'markers.json'))).toBe(true);
    expect(existsSync(join(webroot(), 'maps', 'nether', 'live', 'markers.json'))).toBe(true);
    // end map dir does not exist → skipped
    expect(existsSync(join(webroot(), 'maps', 'end', 'live', 'markers.json'))).toBe(false);

    const overworld = JSON.parse(
      readFileSync(join(webroot(), 'maps', 'overworld', 'live', 'markers.json'), 'utf-8')
    );
    expect(overworld['village']).toBeDefined();
    // Counts: overworld got 1 village, nether got 1 fortress, end skipped.
    expect(result).toEqual({ overworld: 1, nether: 1 });
  });

  it('does not overwrite an existing markers.json when there are no structures', async () => {
    // A prior write left markers; a later empty parse must NOT wipe it.
    const liveDir = join(webroot(), 'maps', 'overworld', 'live');
    mkdirSync(liveDir, { recursive: true });
    writeFileSync(join(liveDir, 'markers.json'), '{"village":{"markers":{}}}', 'utf-8');

    const writer = new BlueMapMarkerWriter();
    const result = await writer.writeMarkers(webroot(), []);

    expect(result).toEqual({});
    // Existing file preserved (not overwritten with {}).
    const data = JSON.parse(readFileSync(join(liveDir, 'markers.json'), 'utf-8'));
    expect(data.village).toBeDefined();
  });
});
