/**
 * TDD tests for WorldRepository zip import helpers.
 * Written BEFORE implementation (RED phase).
 *
 * Tests findWorldLayout and assembleWorld using real filesystem fixtures
 * (temp directories with empty level.dat files) to avoid needing actual zips.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { findWorldLayout, WorldRepository } from '../src/infrastructure/adapters/WorldRepository.js';
import type { Paths } from '../src/utils/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a unique temp directory for each test */
async function makeTempDir(): Promise<string> {
  const dir = join(tmpdir(), `mc-test-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Create an empty file (simulates level.dat) */
async function touch(filePath: string): Promise<void> {
  await mkdir(join(filePath, '..'), { recursive: true }).catch(() => {});
  await writeFile(filePath, '');
}

// ---------------------------------------------------------------------------
// findWorldLayout tests
// ---------------------------------------------------------------------------

describe('findWorldLayout', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('(a) flat layout: level.dat at root, no satellites', async () => {
    await touch(join(tmpDir, 'level.dat'));

    const layout = await findWorldLayout(tmpDir);

    expect(layout.mainDir).toBe(tmpDir);
    expect(layout.nether).toBeUndefined();
    expect(layout.theEnd).toBeUndefined();
  });

  test('(b) single wrapper dir: level.dat inside one subdir', async () => {
    const worldDir = join(tmpDir, 'my-world');
    await mkdir(worldDir);
    await touch(join(worldDir, 'level.dat'));

    const layout = await findWorldLayout(tmpDir);

    expect(layout.mainDir).toBe(worldDir);
    expect(layout.nether).toBeUndefined();
    expect(layout.theEnd).toBeUndefined();
  });

  test('(c) split layout: main + _nether + _the_end siblings', async () => {
    // Create main world dir
    const mainDir = join(tmpDir, 'survival');
    await mkdir(mainDir);
    await touch(join(mainDir, 'level.dat'));

    // Create satellite dirs as siblings of mainDir (inside tmpDir)
    const netherDir = join(tmpDir, 'survival_nether');
    const endDir = join(tmpDir, 'survival_the_end');
    await mkdir(netherDir);
    await mkdir(endDir);

    const layout = await findWorldLayout(tmpDir);

    expect(layout.mainDir).toBe(mainDir);
    expect(layout.nether).toBe(netherDir);
    expect(layout.theEnd).toBe(endDir);
  });

  test('(c2) split layout with case-insensitive suffix detection', async () => {
    const mainDir = join(tmpDir, 'World');
    await mkdir(mainDir);
    await touch(join(mainDir, 'level.dat'));

    // Satellites with lowercase suffix
    const netherDir = join(tmpDir, 'World_nether');
    await mkdir(netherDir);

    const layout = await findWorldLayout(tmpDir);

    expect(layout.mainDir).toBe(mainDir);
    expect(layout.nether).toBe(netherDir);
    expect(layout.theEnd).toBeUndefined();
  });

  test('(d) no level.dat → throws with descriptive error', async () => {
    // Empty directory, no level.dat
    await expect(findWorldLayout(tmpDir)).rejects.toThrow(
      'No valid Minecraft world found (level.dat missing)'
    );
  });

  test('picks shallowest level.dat when multiple exist', async () => {
    // Shallow level.dat
    const outerDir = join(tmpDir, 'outer');
    await mkdir(outerDir);
    await touch(join(outerDir, 'level.dat'));

    // Deeper level.dat (should be ignored)
    const innerDir = join(outerDir, 'region', 'inner');
    await mkdir(innerDir, { recursive: true });
    await touch(join(innerDir, 'level.dat'));

    const layout = await findWorldLayout(tmpDir);

    // Should pick the shallowest one (outerDir)
    expect(layout.mainDir).toBe(outerDir);
  });
});

// ---------------------------------------------------------------------------
// WorldRepository.importFromZip (duplicate name guard)
// ---------------------------------------------------------------------------

describe('WorldRepository.importFromZip', () => {
  let worldsRootDir: string;
  let repo: WorldRepository;

  beforeEach(async () => {
    worldsRootDir = await makeTempDir();
    // Create the worlds dir
    const worldsDir = join(worldsRootDir, 'worlds');
    await mkdir(worldsDir, { recursive: true });

    // Minimal Paths stub
    const paths = {
      root: worldsRootDir,
    } as unknown as Paths;
    repo = new WorldRepository(paths);
  });

  afterEach(async () => {
    await rm(worldsRootDir, { recursive: true, force: true });
  });

  test('throws when world with that name already exists', async () => {
    const worldName = 'existing';
    const worldDir = join(worldsRootDir, 'worlds', worldName);
    await mkdir(worldDir, { recursive: true });

    // Use a dummy zipPath; should throw before touching the zip
    await expect(
      repo.importFromZip(worldName, '/nonexistent/dummy.zip')
    ).rejects.toThrow(`World '${worldName}' already exists`);
  });

  test('rejects when a split-dimension satellite already exists, leaving it intact', async () => {
    const worldName = 'survival';
    // Pre-existing satellite (e.g. an independent world or stale data)
    const netherDir = join(worldsRootDir, 'worlds', `${worldName}_nether`);
    await mkdir(netherDir, { recursive: true });
    await writeFile(join(netherDir, 'keep.dat'), 'precious');

    await expect(
      repo.importFromZip(worldName, '/nonexistent/dummy.zip')
    ).rejects.toThrow(`World '${worldName}' already exists`);

    // The pre-existing satellite must NOT have been deleted by any rollback.
    expect(existsSync(join(netherDir, 'keep.dat'))).toBe(true);
  });

  test('rejects names that could escape the worlds directory', async () => {
    await expect(
      repo.importFromZip('../evil', '/nonexistent/dummy.zip')
    ).rejects.toThrow(/Invalid world name/);
    await expect(
      repo.importFromZip('a/b', '/nonexistent/dummy.zip')
    ).rejects.toThrow(/Invalid world name/);
  });
});

// ---------------------------------------------------------------------------
// assembleWorld via WorldRepository internals (integration-level test)
// Uses a real directory tree instead of a zip for speed.
// ---------------------------------------------------------------------------

describe('WorldRepository assembleWorld (via importFromZip with pre-extracted temp dir)', () => {
  let worldsRootDir: string;

  beforeEach(async () => {
    worldsRootDir = await makeTempDir();
    const worldsDir = join(worldsRootDir, 'worlds');
    await mkdir(worldsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(worldsRootDir, { recursive: true, force: true });
  });

  test('assembleWorld moves mainDir and satellites to worlds/ correctly', async () => {
    // Build a simulated "extracted" directory tree:
    //   extractRoot/
    //     MySurvival/
    //       level.dat
    //     MySurvival_nether/   (sibling)
    //     MySurvival_the_end/  (sibling)
    const extractRoot = await makeTempDir();
    const mainDir = join(extractRoot, 'MySurvival');
    await mkdir(mainDir);
    await touch(join(mainDir, 'level.dat'));
    await mkdir(join(extractRoot, 'MySurvival_nether'));
    await mkdir(join(extractRoot, 'MySurvival_the_end'));

    const paths = { root: worldsRootDir } as unknown as Paths;
    const repo = new WorldRepository(paths);

    // Call the exported assembleWorld method
    await (repo as any).assembleWorld(extractRoot, 'imported-world');

    const worldsDir = join(worldsRootDir, 'worlds');

    // Main world placed correctly
    expect(existsSync(join(worldsDir, 'imported-world'))).toBe(true);
    expect(existsSync(join(worldsDir, 'imported-world', 'level.dat'))).toBe(true);

    // Satellites placed as siblings
    expect(existsSync(join(worldsDir, 'imported-world_nether'))).toBe(true);
    expect(existsSync(join(worldsDir, 'imported-world_the_end'))).toBe(true);

    // .meta written in main world dir
    const metaPath = join(worldsDir, 'imported-world', '.meta');
    expect(existsSync(metaPath)).toBe(true);
    const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
    expect(meta.name).toBe('imported-world');
    expect(meta.importedFrom).toBe('zip');

    await rm(extractRoot, { recursive: true, force: true });
  });

  test('assembleWorld with flat layout (no satellites)', async () => {
    const extractRoot = await makeTempDir();
    await touch(join(extractRoot, 'level.dat'));

    const paths = { root: worldsRootDir } as unknown as Paths;
    const repo = new WorldRepository(paths);
    await (repo as any).assembleWorld(extractRoot, 'flat-world');

    const worldsDir = join(worldsRootDir, 'worlds');
    expect(existsSync(join(worldsDir, 'flat-world', 'level.dat'))).toBe(true);
    expect(existsSync(join(worldsDir, 'flat-world_nether'))).toBe(false);
    expect(existsSync(join(worldsDir, 'flat-world_the_end'))).toBe(false);

    await rm(extractRoot, { recursive: true, force: true });
  });
});
