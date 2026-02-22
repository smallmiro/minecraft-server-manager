import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { IConfigFileCollector } from '../../application/ports/outbound/IConfigFileCollector.js';
import { ConfigSnapshotFile } from '../../domain/value-objects/ConfigSnapshotFile.js';

/**
 * Known config file names that are always collected if present
 */
const KNOWN_CONFIG_FILES = [
  'server.properties',
  'config.env',
  'docker-compose.yml',
  'bukkit.yml',
  'spigot.yml',
  'paper.yml',
  'paper-global.yml',
  'paper-world-defaults.yml',
  'ops.json',
  'whitelist.json',
  'banned-players.json',
  'banned-ips.json',
];

/**
 * File extensions to collect for additional config files
 */
const CONFIG_EXTENSIONS = ['.yml', '.yaml', '.json', '.properties'];

/**
 * Maximum file size to collect (1MB)
 */
const MAX_FILE_SIZE = 1024 * 1024;

/**
 * FileSystemConfigFileCollector
 * Implements IConfigFileCollector for collecting server configuration files.
 * Collects known config files and additional .yml/.json files from the server directory.
 * Computes SHA-256 hash for each file. Skips files larger than 1MB.
 */
export class FileSystemConfigFileCollector implements IConfigFileCollector {
  constructor(private readonly serversDir: string) {}

  /**
   * Collect all trackable config files for a server
   * Returns metadata (path, hash, size) for each file found
   */
  async collectFiles(serverName: string): Promise<ConfigSnapshotFile[]> {
    const serverDir = join(this.serversDir, serverName);

    if (!existsSync(serverDir)) {
      return [];
    }

    const collectedPaths = new Set<string>();
    const files: ConfigSnapshotFile[] = [];

    // Collect known config files
    for (const fileName of KNOWN_CONFIG_FILES) {
      const filePath = join(serverDir, fileName);
      if (existsSync(filePath)) {
        const file = await this.processFile(serverDir, fileName);
        if (file) {
          files.push(file);
          collectedPaths.add(fileName);
        }
      }
    }

    // Collect additional .yml, .json files in the server root
    try {
      const entries = await readdir(serverDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (collectedPaths.has(entry.name)) continue;

        const ext = this.getExtension(entry.name);
        if (CONFIG_EXTENSIONS.includes(ext)) {
          const file = await this.processFile(serverDir, entry.name);
          if (file) {
            files.push(file);
          }
        }
      }
    } catch {
      // Ignore errors reading directory
    }

    return files;
  }

  /**
   * Read the content of a specific config file
   */
  async readFileContent(serverName: string, filePath: string): Promise<string> {
    const fullPath = join(this.serversDir, serverName, filePath);
    return readFile(fullPath, 'utf-8');
  }

  /**
   * Process a single file: compute hash and size
   * Returns null if file is too large or cannot be read
   */
  private async processFile(
    serverDir: string,
    fileName: string
  ): Promise<ConfigSnapshotFile | null> {
    const fullPath = join(serverDir, fileName);

    try {
      const fileStat = await stat(fullPath);

      // Skip files larger than 1MB
      if (fileStat.size > MAX_FILE_SIZE) {
        return null;
      }

      const content = await readFile(fullPath);

      // Compute SHA-256 hash
      const hash = createHash('sha256').update(content).digest('hex');

      return ConfigSnapshotFile.create({
        path: fileName,
        hash,
        size: fileStat.size,
      });
    } catch {
      return null;
    }
  }

  /**
   * Get file extension (lowercase)
   */
  private getExtension(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex === -1) return '';
    return fileName.substring(dotIndex).toLowerCase();
  }
}
