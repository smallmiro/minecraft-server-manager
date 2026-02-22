import { mkdir, writeFile, readFile, readdir, rm, rename, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IConfigSnapshotStorage } from '../../application/ports/outbound/IConfigSnapshotStorage.js';

/**
 * FileSystemConfigSnapshotStorage
 * Implements IConfigSnapshotStorage using filesystem for actual config file copies.
 * Storage path: <basePath>/<serverName>/<snapshotId>/
 *
 * Uses atomic writes (temp directory + rename) for crash safety.
 */
export class FileSystemConfigSnapshotStorage implements IConfigSnapshotStorage {
  constructor(private readonly basePath: string) {}

  /**
   * Store file contents for a snapshot
   * Uses temp directory + rename for atomic write (crash safety)
   */
  async store(
    snapshotId: string,
    serverName: string,
    files: Map<string, string>
  ): Promise<void> {
    const targetDir = this.getSnapshotDir(serverName, snapshotId);
    const tempDir = join(
      this.basePath,
      serverName,
      `.tmp-${randomUUID()}`
    );

    try {
      // Write to temp directory first
      await mkdir(tempDir, { recursive: true });

      for (const [filePath, content] of files) {
        const fullPath = join(tempDir, filePath);
        const fileDir = dirname(fullPath);
        await mkdir(fileDir, { recursive: true });
        await writeFile(fullPath, content, 'utf-8');
      }

      // Ensure parent dir exists for target
      const targetParent = dirname(targetDir);
      await mkdir(targetParent, { recursive: true });

      // Atomic rename
      await rename(tempDir, targetDir);
    } catch (error) {
      // Clean up temp directory on failure
      try {
        if (existsSync(tempDir)) {
          await rm(tempDir, { recursive: true, force: true });
        }
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Retrieve file contents for a snapshot
   * Returns Map of file path to file content
   */
  async retrieve(
    snapshotId: string,
    serverName: string
  ): Promise<Map<string, string>> {
    const snapshotDir = this.getSnapshotDir(serverName, snapshotId);
    const files = new Map<string, string>();

    if (!existsSync(snapshotDir)) {
      return files;
    }

    await this.readDirRecursive(snapshotDir, snapshotDir, files);
    return files;
  }

  /**
   * Delete stored file contents for a snapshot
   */
  async delete(snapshotId: string, serverName: string): Promise<void> {
    const snapshotDir = this.getSnapshotDir(serverName, snapshotId);

    if (existsSync(snapshotDir)) {
      await rm(snapshotDir, { recursive: true, force: true });
    }
  }

  /**
   * Get the snapshot directory path
   */
  private getSnapshotDir(serverName: string, snapshotId: string): string {
    return join(this.basePath, serverName, snapshotId);
  }

  /**
   * Recursively read all files in a directory
   */
  private async readDirRecursive(
    baseDir: string,
    currentDir: string,
    files: Map<string, string>
  ): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await this.readDirRecursive(baseDir, fullPath, files);
      } else if (entry.isFile()) {
        const relativePath = fullPath
          .substring(baseDir.length + 1)
          .replace(/\\/g, '/');
        const content = await readFile(fullPath, 'utf-8');
        files.set(relativePath, content);
      }
    }
  }
}
