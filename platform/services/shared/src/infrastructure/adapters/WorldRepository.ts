import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Paths } from '../../utils/index.js';
import { World } from '../../domain/index.js';
import type {
  IWorldRepository,
  WorldLockData,
} from '../../application/ports/outbound/IWorldRepository.js';

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

    // Get world metadata
    try {
      const worldStat = await stat(worldPath);
      const size = await this.getDirectorySize(worldPath);
      world.setMetadata(size, worldStat.mtime);
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
