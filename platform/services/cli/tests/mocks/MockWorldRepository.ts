import type {
  IWorldRepository,
  WorldLockData,
  WorldWithServerStatus,
} from '@minecraft-docker/shared';
import { World } from '@minecraft-docker/shared';

/**
 * Mock world data for testing
 */
export interface MockWorldData {
  name: string;
  path?: string;
  isLocked?: boolean;
  lockedBy?: string;
  size?: number;
}

/**
 * Mock World Repository for testing
 */
export class MockWorldRepository implements IWorldRepository {
  private worlds: Map<string, World> = new Map();

  constructor(initialWorlds: MockWorldData[] = []) {
    for (const data of initialWorlds) {
      this.addWorld(data);
    }
  }

  // ========================================
  // Testing Helpers
  // ========================================

  addWorld(data: MockWorldData): void {
    const path = data.path ?? `/worlds/${data.name}`;
    let world: World;

    if (data.isLocked && data.lockedBy) {
      world = World.withLock(data.name, path, data.lockedBy, new Date());
    } else {
      world = new World(data.name, path);
    }

    if (data.size) {
      world.setMetadata(data.size, new Date());
    }

    this.worlds.set(data.name, world);
  }

  removeWorld(name: string): void {
    this.worlds.delete(name);
  }

  clear(): void {
    this.worlds.clear();
  }

  lockWorld(name: string, serverName: string): void {
    const world = this.worlds.get(name);
    if (world && !world.isLocked) {
      world.lockTo(serverName);
    }
  }

  unlockWorld(name: string): void {
    const world = this.worlds.get(name);
    if (world && world.isLocked) {
      world.release();
    }
  }

  // ========================================
  // IWorldRepository Implementation
  // ========================================

  async findAll(): Promise<World[]> {
    return Array.from(this.worlds.values());
  }

  async findByName(name: string): Promise<World | null> {
    return this.worlds.get(name) ?? null;
  }

  async exists(name: string): Promise<boolean> {
    return this.worlds.has(name);
  }

  async findUnlocked(): Promise<World[]> {
    return Array.from(this.worlds.values()).filter((w) => !w.isLocked);
  }

  async findLocked(): Promise<World[]> {
    return Array.from(this.worlds.values()).filter((w) => w.isLocked);
  }

  async findByServer(serverName: string): Promise<World[]> {
    return Array.from(this.worlds.values()).filter(
      (w) => w.isLocked && w.lockedBy === serverName
    );
  }

  async listNames(): Promise<string[]> {
    return Array.from(this.worlds.keys());
  }

  async getLockStatus(name: string): Promise<WorldLockData | null> {
    const world = this.worlds.get(name);
    if (!world || !world.isLocked) return null;

    return {
      worldName: world.name,
      serverName: world.lockedBy ?? 'unknown',
      timestamp: new Date(),
    };
  }

  async findAllWithServerStatus(): Promise<WorldWithServerStatus[]> {
    const worlds = await this.findAll();
    return worlds.map((world) => ({
      world,
      category: world.isLocked ? 'stopped' : 'available',
      assignedServer: world.lockedBy,
    }));
  }

  async delete(name: string): Promise<boolean> {
    if (!this.worlds.has(name)) {
      return false;
    }
    this.worlds.delete(name);
    return true;
  }

  async create(name: string, seed?: string): Promise<World> {
    if (this.worlds.has(name)) {
      throw new Error(`World '${name}' already exists`);
    }

    const path = `/worlds/${name}`;
    const world = new World(name, path);
    if (seed) {
      world.setSeed(seed);
    }
    this.worlds.set(name, world);
    return world;
  }

  async getSeed(name: string): Promise<string | null> {
    const world = this.worlds.get(name);
    return world?.seed ?? null;
  }
}
