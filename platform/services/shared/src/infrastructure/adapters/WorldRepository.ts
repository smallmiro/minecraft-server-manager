import {
  readdir,
  readFile,
  stat,
  rm,
  unlink,
  mkdir,
  writeFile,
  rename,
  cp,
} from 'node:fs/promises';
import { join, basename, dirname, resolve, sep } from 'node:path';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import * as unzipper from 'unzipper';
import { createReadStream, createWriteStream } from 'node:fs';
import { Paths } from '../../utils/index.js';
import { World } from '../../domain/index.js';
import { getContainerStatus } from '../../docker/index.js';
import type {
  IWorldRepository,
  WorldLockData,
  WorldWithServerStatus,
  ServerStatus,
  WorldAvailabilityCategory,
} from '../../application/ports/outbound/IWorldRepository.js';

// ---------------------------------------------------------------------------
// Exported pure helper — testable without real zips
// ---------------------------------------------------------------------------

/** Allowed world-name characters (defense-in-depth, independent of API schema). */
const WORLD_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Reject world names that could escape the worlds/ directory.
 * This guards the repository boundary so traversal is impossible even if a
 * future caller forgets upstream validation.
 */
function assertValidWorldName(name: string): void {
  if (!WORLD_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid world name '${name}'`);
  }
}

/** Caps to defend against decompression bombs during zip extraction. */
const WORLD_EXTRACT_MAX_SIZE =
  Number(process.env['WORLD_EXTRACT_MAX_SIZE']) || 5 * 1024 * 1024 * 1024; // 5 GB
const WORLD_EXTRACT_MAX_ENTRIES =
  Number(process.env['WORLD_EXTRACT_MAX_ENTRIES']) || 100000;

/**
 * World layout descriptor returned by findWorldLayout
 */
export interface WorldLayout {
  /** Absolute path to the directory that contains level.dat */
  mainDir: string;
  /** Absolute path to the nether satellite directory, if present */
  nether?: string;
  /** Absolute path to the_end satellite directory, if present */
  theEnd?: string;
}

/**
 * Recursively find all level.dat files under rootDir, pick the shallowest
 * one, and detect split-dimension satellite sibling directories.
 *
 * Exported so that unit tests can exercise it with plain directory fixtures.
 */
export async function findWorldLayout(rootDir: string): Promise<WorldLayout> {
  // Collect all level.dat paths
  const levelDats: string[] = [];
  await collectLevelDats(rootDir, levelDats);

  if (levelDats.length === 0) {
    throw new Error('No valid Minecraft world found (level.dat missing)');
  }

  // Pick the shallowest level.dat (fewest path separators relative to rootDir)
  levelDats.sort((a, b) => {
    const depthA = a.split('/').length;
    const depthB = b.split('/').length;
    return depthA - depthB;
  });

  const mainDir = dirname(levelDats[0]!);
  const parentDir = dirname(mainDir);
  const baseName = basename(mainDir);

  // Look for split-dimension sibling dirs (case-insensitive suffix match)
  let nether: string | undefined;
  let theEnd: string | undefined;

  const netherCandidate = join(parentDir, `${baseName}_nether`);
  const endCandidate = join(parentDir, `${baseName}_the_end`);

  // Only consider satellites when the world is nested under a real parent
  // INSIDE the archive. In a flat layout (level.dat at the extract root) the
  // "parent" is the temp dir itself, whose unrelated siblings must be ignored.
  if (mainDir !== rootDir) {
    if (existsSync(netherCandidate)) {
      const s = await stat(netherCandidate);
      if (s.isDirectory()) nether = netherCandidate;
    }
    if (existsSync(endCandidate)) {
      const s = await stat(endCandidate);
      if (s.isDirectory()) theEnd = endCandidate;
    }
  }

  return { mainDir, nether, theEnd };
}

async function collectLevelDats(dir: string, results: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryPath = join(dir, entry.name);
    if (entry.isFile() && entry.name === 'level.dat') {
      results.push(entryPath);
    } else if (entry.isDirectory()) {
      await collectLevelDats(entryPath, results);
    }
  }
}

// ---------------------------------------------------------------------------
// WorldRepository
// ---------------------------------------------------------------------------

/**
 * WorldRepository
 * Implements IWorldRepository for world data access
 */
export class WorldRepository implements IWorldRepository {
  private readonly paths: Paths;
  private readonly worldsDir: string;
  private readonly locksDir: string;

  constructor(paths?: Paths) {
    this.paths = paths ?? new Paths();
    this.worldsDir = join(this.paths.root, 'worlds');
    this.locksDir = join(this.worldsDir, '.locks');
  }

  /**
   * Get all worlds
   */
  async findAll(): Promise<World[]> {
    const names = await this.listNames();
    const worlds: World[] = [];

    for (const name of names) {
      const world = await this.findByName(name);
      if (world) {
        worlds.push(world);
      }
    }

    return worlds;
  }

  /**
   * Find world by name
   */
  async findByName(name: string): Promise<World | null> {
    const worldPath = join(this.worldsDir, name);

    if (!existsSync(worldPath)) {
      return null;
    }

    const world = new World(name, worldPath);

    // Get lock status
    const lockData = await this.getLockStatus(name);
    if (lockData) {
      world.lockTo(lockData.serverName, lockData.pid);
    }

    // Get world metadata and seed
    try {
      const worldStat = await stat(worldPath);
      const size = await this.getDirectorySize(worldPath);
      const seed = await this.getSeed(name);
      world.setMetadata(size, worldStat.mtime, seed ?? undefined);
    } catch {
      // Ignore metadata errors
    }

    return world;
  }

  /**
   * Check if world exists
   */
  async exists(name: string): Promise<boolean> {
    const worldPath = join(this.worldsDir, name);
    return existsSync(worldPath);
  }

  /**
   * Get unlocked worlds
   */
  async findUnlocked(): Promise<World[]> {
    const worlds = await this.findAll();
    return worlds.filter((w) => !w.isLocked);
  }

  /**
   * Get locked worlds
   */
  async findLocked(): Promise<World[]> {
    const worlds = await this.findAll();
    return worlds.filter((w) => w.isLocked);
  }

  /**
   * Get worlds locked by a specific server
   */
  async findByServer(serverName: string): Promise<World[]> {
    const worlds = await this.findAll();
    return worlds.filter((w) => w.lockedBy === serverName);
  }

  /**
   * List world names
   */
  async listNames(): Promise<string[]> {
    if (!existsSync(this.worldsDir)) {
      return [];
    }

    try {
      const entries = await readdir(this.worldsDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) => !entry.name.startsWith('.')) // Skip hidden dirs like .locks
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  /**
   * Get lock status for a world
   */
  async getLockStatus(name: string): Promise<WorldLockData | null> {
    const lockFile = join(this.locksDir, `${name}.lock`);

    if (!existsSync(lockFile)) {
      return null;
    }

    try {
      const content = await readFile(lockFile, 'utf-8');
      const [serverName, timestampStr, pidStr] = content.trim().split(':');

      if (!serverName || !timestampStr) {
        return null;
      }

      return {
        worldName: name,
        serverName,
        timestamp: new Date(parseInt(timestampStr, 10) * 1000),
        pid: pidStr ? parseInt(pidStr, 10) : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get all worlds with their server status
   * Returns worlds categorized by availability
   */
  async findAllWithServerStatus(): Promise<WorldWithServerStatus[]> {
    const worlds = await this.findAll();
    const results: WorldWithServerStatus[] = [];

    for (const world of worlds) {
      if (!world.isLocked) {
        // World is not locked by any server - available
        results.push({
          world,
          category: 'available',
        });
      } else {
        // World is locked - check server status
        const serverName = world.lockedBy!;
        const containerName = serverName.startsWith('mc-')
          ? serverName
          : `mc-${serverName}`;
        const containerStatus = getContainerStatus(containerName);

        let serverStatus: ServerStatus;
        let category: WorldAvailabilityCategory;

        if (containerStatus === 'running') {
          serverStatus = 'running';
          category = 'running';
        } else if (containerStatus === 'not_found') {
          serverStatus = 'not_found';
          // If container not found, treat as available (stale lock)
          category = 'available';
        } else {
          // exited, paused, created, etc. - server is stopped
          serverStatus = 'stopped';
          category = 'stopped';
        }

        results.push({
          world,
          assignedServer: serverName,
          serverStatus,
          category,
        });
      }
    }

    // Sort: available first, then stopped, then running
    const categoryOrder: Record<WorldAvailabilityCategory, number> = {
      available: 0,
      stopped: 1,
      running: 2,
    };

    return results.sort((a, b) => {
      const orderDiff = categoryOrder[a.category] - categoryOrder[b.category];
      if (orderDiff !== 0) return orderDiff;
      return a.world.name.localeCompare(b.world.name);
    });
  }

  /**
   * Delete a world directory and its lock file.
   * Also deletes split-dimension satellites (<name>_nether, <name>_the_end).
   * Returns true if the main world was deleted.
   */
  async delete(name: string): Promise<boolean> {
    assertValidWorldName(name);
    const worldPath = join(this.worldsDir, name);
    const lockFile = join(this.locksDir, `${name}.lock`);

    if (!existsSync(worldPath)) {
      return false;
    }

    try {
      // Delete lock file if exists
      if (existsSync(lockFile)) {
        await unlink(lockFile);
      }

      // Delete world directory
      await rm(worldPath, { recursive: true, force: true });

      // Cascade-delete split-dimension satellites
      for (const suffix of ['_nether', '_the_end']) {
        const satellitePath = join(this.worldsDir, `${name}${suffix}`);
        const satelliteLock = join(this.locksDir, `${name}${suffix}.lock`);
        if (existsSync(satellitePath)) {
          if (existsSync(satelliteLock)) {
            await unlink(satelliteLock).catch(() => {});
          }
          await rm(satellitePath, { recursive: true, force: true });
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a new world directory with optional seed
   */
  async create(name: string, seed?: string): Promise<World> {
    assertValidWorldName(name);
    const worldPath = join(this.worldsDir, name);

    // Check if already exists
    if (existsSync(worldPath)) {
      throw new Error(`World '${name}' already exists`);
    }

    // Ensure worlds directory exists
    if (!existsSync(this.worldsDir)) {
      await mkdir(this.worldsDir, { recursive: true });
    }

    // Create world directory
    await mkdir(worldPath, { recursive: true });

    // Create .meta file with seed if provided
    const metaPath = join(worldPath, '.meta');
    const metaContent = {
      name,
      seed: seed || null,
      createdAt: new Date().toISOString(),
    };
    await writeFile(metaPath, JSON.stringify(metaContent, null, 2), 'utf-8');

    // Create and return the World entity
    const world = new World(name, worldPath);
    if (seed) {
      world.setSeed(seed);
    }

    return world;
  }

  /**
   * Get seed for a world from .meta file
   */
  async getSeed(name: string): Promise<string | null> {
    const metaPath = join(this.worldsDir, name, '.meta');

    if (!existsSync(metaPath)) {
      return null;
    }

    try {
      const content = await readFile(metaPath, 'utf-8');
      const meta = JSON.parse(content);
      return meta.seed || null;
    } catch {
      return null;
    }
  }

  /**
   * Import a world from a .zip archive at zipPath.
   * 1. Throws if worlds/<name> already exists.
   * 2. Extracts zip into a fresh temp dir.
   * 3. Calls assembleWorld to move files to their final locations.
   * 4. Cleans up the temp dir (even on error).
   * 5. On error after creating target dirs, rolls back.
   */
  async importFromZip(name: string, zipPath: string): Promise<World> {
    assertValidWorldName(name);
    const targetPath = join(this.worldsDir, name);

    // Reject if the world or any of its split-dimension satellites already exist,
    // so the rollback below can safely remove every path it creates.
    for (const suffix of ['', '_nether', '_the_end']) {
      if (existsSync(join(this.worldsDir, `${name}${suffix}`))) {
        throw new Error(`World '${name}' already exists`);
      }
    }

    // Ensure worlds dir exists
    if (!existsSync(this.worldsDir)) {
      await mkdir(this.worldsDir, { recursive: true });
    }

    const tempDir = join(tmpdir(), `mc-import-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    try {
      // Extract zip into tempDir
      await this.extractZip(zipPath, tempDir);

      // Assemble the world (move files to worlds/ dir)
      await this.assembleWorld(tempDir, name);
    } catch (err) {
      // Roll back any created target dirs
      for (const suffix of ['', '_nether', '_the_end']) {
        const p = join(this.worldsDir, `${name}${suffix}`);
        if (existsSync(p)) {
          await rm(p, { recursive: true, force: true }).catch(() => {});
        }
      }
      throw err;
    } finally {
      // Always clean up temp dir
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }

    // Return the newly created World entity with metadata
    const world = new World(name, targetPath);
    try {
      const worldStat = await stat(targetPath);
      const size = await this.getDirectorySize(targetPath);
      world.setMetadata(size, worldStat.mtime);
    } catch {
      // Non-fatal
    }

    return world;
  }

  /**
   * Extract a zip file into destDir with defenses against:
   * - decompression bombs (cumulative uncompressed-size + entry-count caps,
   *   pre-checked from the central directory and re-checked while streaming), and
   * - zip-slip (every entry is resolved and confirmed to stay within destDir).
   */
  private async extractZip(zipPath: string, destDir: string): Promise<void> {
    const directory = await unzipper.Open.file(zipPath);
    const base = resolve(destDir);

    // Pre-check from the central directory before writing anything.
    if (directory.files.length > WORLD_EXTRACT_MAX_ENTRIES) {
      throw new Error(
        `World archive has too many entries (>${WORLD_EXTRACT_MAX_ENTRIES})`
      );
    }
    const declaredTotal = directory.files.reduce(
      (sum, f) => sum + (f.uncompressedSize || 0),
      0
    );
    if (declaredTotal > WORLD_EXTRACT_MAX_SIZE) {
      throw new Error('World archive too large when extracted');
    }

    let written = 0;
    for (const file of directory.files) {
      const target = resolve(base, file.path);
      // zip-slip guard: the resolved path must stay within destDir.
      if (target !== base && !target.startsWith(base + sep)) {
        throw new Error(`Unsafe path in archive: ${file.path}`);
      }

      if (file.type === 'Directory') {
        await mkdir(target, { recursive: true });
        continue;
      }

      await mkdir(dirname(target), { recursive: true });
      written += file.uncompressedSize || 0;
      if (written > WORLD_EXTRACT_MAX_SIZE) {
        throw new Error('World archive too large when extracted');
      }
      await new Promise<void>((res, rej) => {
        file
          .stream()
          .pipe(createWriteStream(target))
          .on('finish', res)
          .on('error', rej);
      });
    }
  }

  /**
   * Assemble an extracted world tree into the worlds/ directory.
   * Detects the world layout, moves the main dir and satellites.
   * Writes a .meta file in the main world dir.
   */
  private async assembleWorld(extractedRoot: string, name: string): Promise<void> {
    const layout = await findWorldLayout(extractedRoot);

    const targetMain = join(this.worldsDir, name);

    // Move main world dir
    await this.moveDir(layout.mainDir, targetMain);

    // Move satellites if present
    if (layout.nether) {
      await this.moveDir(layout.nether, join(this.worldsDir, `${name}_nether`));
    }
    if (layout.theEnd) {
      await this.moveDir(layout.theEnd, join(this.worldsDir, `${name}_the_end`));
    }

    // Write .meta in main world dir
    const metaContent = {
      name,
      seed: null,
      createdAt: new Date().toISOString(),
      importedFrom: 'zip',
    };
    await writeFile(
      join(targetMain, '.meta'),
      JSON.stringify(metaContent, null, 2),
      'utf-8'
    );
  }

  /**
   * Move a directory from src to dest.
   * Falls back to recursive copy + rm when rename fails (cross-device EXDEV).
   */
  private async moveDir(src: string, dest: string): Promise<void> {
    // Refuse to overwrite an existing destination so rename (throws) and the
    // cp/EXDEV fallback (which would silently merge) behave identically.
    if (existsSync(dest)) {
      throw new Error(`Destination already exists: ${dest}`);
    }
    try {
      await rename(src, dest);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EXDEV') {
        // Cross-device: copy then remove
        await cp(src, dest, { recursive: true });
        await rm(src, { recursive: true, force: true });
      } else {
        throw err;
      }
    }
  }

  /**
   * Get directory size recursively
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = join(dirPath, entry.name);

        if (entry.isFile()) {
          const fileStat = await stat(entryPath);
          totalSize += fileStat.size;
        } else if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(entryPath);
        }
      }
    } catch {
      // Ignore errors
    }

    return totalSize;
  }
}
