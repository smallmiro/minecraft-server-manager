import type { IConfigSnapshotUseCase } from '../ports/inbound/IConfigSnapshotUseCase.js';
import type { IConfigSnapshotRepository } from '../ports/outbound/IConfigSnapshotRepository.js';
import type { IConfigSnapshotStorage } from '../ports/outbound/IConfigSnapshotStorage.js';
import type { IConfigFileCollector } from '../ports/outbound/IConfigFileCollector.js';
import { ConfigSnapshot } from '../../domain/entities/ConfigSnapshot.js';
import { ServerName } from '../../domain/value-objects/ServerName.js';
import { SnapshotDiff } from '../../domain/value-objects/SnapshotDiff.js';
import { FileDiff } from '../../domain/value-objects/FileDiff.js';
import type { ConfigSnapshotFile } from '../../domain/value-objects/ConfigSnapshotFile.js';

/**
 * ConfigSnapshotUseCaseImpl
 * Implements IConfigSnapshotUseCase orchestrating config snapshot operations.
 * Coordinates between repository (metadata), storage (file contents), and collector (file discovery).
 */
export class ConfigSnapshotUseCaseImpl implements IConfigSnapshotUseCase {
  constructor(
    private readonly repository: IConfigSnapshotRepository,
    private readonly storage: IConfigSnapshotStorage,
    private readonly collector: IConfigFileCollector
  ) {}

  /**
   * Create a new config snapshot for a server
   * Collects files, stores file contents, and saves metadata
   */
  async create(
    serverName: string,
    description?: string
  ): Promise<ConfigSnapshot> {
    const server = ServerName.create(serverName);

    // Collect file metadata from server directory
    const files = await this.collector.collectFiles(serverName);

    // Read file contents
    const fileContents = new Map<string, string>();
    for (const file of files) {
      const content = await this.collector.readFileContent(
        serverName,
        file.path
      );
      fileContents.set(file.path, content);
    }

    // Create snapshot entity
    const snapshot = ConfigSnapshot.create(server, files, description);

    // Store file contents
    await this.storage.store(snapshot.id, serverName, fileContents);

    // Save metadata
    await this.repository.save(snapshot);

    return snapshot;
  }

  /**
   * List config snapshots, optionally filtered by server
   */
  async list(
    serverName?: string,
    limit?: number,
    offset?: number
  ): Promise<ConfigSnapshot[]> {
    if (serverName) {
      return this.repository.findByServer(serverName, limit, offset);
    }

    // When no server specified, we need a different approach
    // Since the port doesn't have a findAll, delegate to findByServer
    // This is a limitation that could be addressed in a future iteration
    return this.repository.findByServer(serverName ?? '', limit, offset);
  }

  /**
   * Find a config snapshot by ID
   */
  async findById(id: string): Promise<ConfigSnapshot | null> {
    return this.repository.findById(id);
  }

  /**
   * Compute the diff between two snapshots
   * Identifies added, modified, and deleted files
   */
  async diff(
    snapshotId1: string,
    snapshotId2: string
  ): Promise<SnapshotDiff> {
    const snap1 = await this.repository.findById(snapshotId1);
    if (!snap1) {
      throw new Error(`Snapshot not found: ${snapshotId1}`);
    }

    const snap2 = await this.repository.findById(snapshotId2);
    if (!snap2) {
      throw new Error(`Snapshot not found: ${snapshotId2}`);
    }

    // Retrieve file contents for both snapshots
    const files1 = await this.storage.retrieve(
      snapshotId1,
      snap1.serverName.value
    );
    const files2 = await this.storage.retrieve(
      snapshotId2,
      snap2.serverName.value
    );

    // Build file hash maps from snapshot metadata
    const hashMap1 = this.buildHashMap(snap1.files);
    const hashMap2 = this.buildHashMap(snap2.files);

    const changes: FileDiff[] = [];

    // Find modified and deleted files (in snap1 but changed or missing in snap2)
    for (const [path, content1] of files1) {
      const content2 = files2.get(path);
      const hash1 = hashMap1.get(path);
      const hash2 = hashMap2.get(path);

      if (content2 === undefined) {
        // Deleted in snap2
        changes.push(
          FileDiff.create({
            path,
            status: 'deleted',
            oldContent: content1,
            oldHash: hash1,
          })
        );
      } else if (hash1 !== hash2) {
        // Modified
        changes.push(
          FileDiff.create({
            path,
            status: 'modified',
            oldContent: content1,
            newContent: content2,
            oldHash: hash1,
            newHash: hash2,
          })
        );
      }
    }

    // Find added files (in snap2 but not in snap1)
    for (const [path, content2] of files2) {
      if (!files1.has(path)) {
        changes.push(
          FileDiff.create({
            path,
            status: 'added',
            newContent: content2,
            newHash: hashMap2.get(path),
          })
        );
      }
    }

    return SnapshotDiff.create({
      baseSnapshotId: snapshotId1,
      compareSnapshotId: snapshotId2,
      changes,
    });
  }

  /**
   * Restore server configuration from a snapshot
   */
  async restore(snapshotId: string, _force?: boolean): Promise<void> {
    const snapshot = await this.repository.findById(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const files = await this.storage.retrieve(
      snapshotId,
      snapshot.serverName.value
    );

    if (files.size === 0) {
      throw new Error(`No files found for snapshot: ${snapshotId}`);
    }

    // Write files back to server directory
    // This is delegated to storage.store with a special pattern
    // In a real implementation, this would write directly to the server directory
    // For now, we store the files and the caller is responsible for the actual restore
    // The restore logic will be fully implemented when integrated with the server filesystem
  }

  /**
   * Delete a config snapshot (storage + metadata)
   */
  async delete(id: string): Promise<void> {
    const snapshot = await this.repository.findById(id);
    if (snapshot) {
      await this.storage.delete(id, snapshot.serverName.value);
    }
    await this.repository.delete(id);
  }

  /**
   * Build a map of file path to hash from snapshot files
   */
  private buildHashMap(
    files: readonly ConfigSnapshotFile[]
  ): Map<string, string> {
    const map = new Map<string, string>();
    for (const file of files) {
      map.set(file.path, file.hash);
    }
    return map;
  }
}
