import { join } from 'path';
import {
  ConfigSnapshotUseCaseImpl,
  ConfigSnapshotDatabase,
  SqliteConfigSnapshotRepository,
  FileSystemConfigSnapshotStorage,
  FileSystemConfigFileCollector,
  type IConfigSnapshotUseCase,
  type ConfigSnapshot,
  type SnapshotDiff,
  serverExists,
  getContainerStatus,
} from '@minecraft-docker/shared';
import { config } from '../config/index.js';

/**
 * Singleton instances for the config snapshot service
 */
let database: ConfigSnapshotDatabase | null = null;
let useCase: IConfigSnapshotUseCase | null = null;

/**
 * Get or create the ConfigSnapshotDatabase singleton
 */
function getDatabase(): ConfigSnapshotDatabase {
  if (!database) {
    const dbPath = join(config.mcctlRoot, 'data', 'config-snapshots.db');
    database = new ConfigSnapshotDatabase(dbPath);
  }
  return database;
}

/**
 * Get or create the ConfigSnapshotUseCase singleton
 */
export function getConfigSnapshotUseCase(): IConfigSnapshotUseCase {
  if (!useCase) {
    const db = getDatabase();
    const repository = new SqliteConfigSnapshotRepository(db);
    const storagePath = join(config.mcctlRoot, 'data', 'config-snapshot-storage');
    const storage = new FileSystemConfigSnapshotStorage(storagePath);
    const serversDir = join(config.platformPath, 'servers');
    const collector = new FileSystemConfigFileCollector(serversDir);
    useCase = new ConfigSnapshotUseCaseImpl(repository, storage, collector);
  }
  return useCase;
}

/**
 * Create a config snapshot for a server
 */
export async function createSnapshot(
  serverName: string,
  description?: string
): Promise<ConfigSnapshot> {
  const uc = getConfigSnapshotUseCase();
  return uc.create(serverName, description);
}

/**
 * List config snapshots for a server
 */
export async function listSnapshots(
  serverName: string,
  limit?: number,
  offset?: number
): Promise<{ snapshots: ConfigSnapshot[]; total: number }> {
  const uc = getConfigSnapshotUseCase();
  const snapshots = await uc.list(serverName, limit, offset);
  const total = await uc.count(serverName);
  return { snapshots, total };
}

/**
 * Get a config snapshot by ID
 */
export async function getSnapshotById(
  id: string
): Promise<ConfigSnapshot | null> {
  const uc = getConfigSnapshotUseCase();
  return uc.findById(id);
}

/**
 * Delete a config snapshot
 */
export async function deleteSnapshot(id: string): Promise<void> {
  const uc = getConfigSnapshotUseCase();
  return uc.delete(id);
}

/**
 * Compare two snapshots
 */
export async function diffSnapshots(
  id1: string,
  id2: string
): Promise<SnapshotDiff> {
  const uc = getConfigSnapshotUseCase();
  return uc.diff(id1, id2);
}

/**
 * Restore a config snapshot
 */
export async function restoreSnapshot(
  snapshotId: string,
  force?: boolean
): Promise<void> {
  const uc = getConfigSnapshotUseCase();
  return uc.restore(snapshotId, force);
}

/**
 * Check if a server exists
 */
export async function checkServerExists(serverName: string): Promise<boolean> {
  try {
    return await serverExists(serverName, config.platformPath);
  } catch {
    return false;
  }
}

/**
 * Check if a server container is running
 */
export async function isServerRunning(serverName: string): Promise<boolean> {
  try {
    const status = await getContainerStatus(`mc-${serverName}`);
    return status === 'running';
  } catch {
    return false;
  }
}

/**
 * Close the database (for graceful shutdown)
 */
export function closeConfigSnapshotDatabase(): void {
  if (database) {
    database.close();
    database = null;
    useCase = null;
  }
}
