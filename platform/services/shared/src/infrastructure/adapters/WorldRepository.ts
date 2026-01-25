import { readdir, readFile, stat, rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
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
   * Delete a world directory and its lock file
   */
  async delete(name: string): Promise<boolean> {
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
      return true;
    } catch {
      return false;
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
