import type { ConfigSnapshotFile } from '../../../domain/value-objects/ConfigSnapshotFile.js';

/**
 * IConfigFileCollector - Outbound Port
 * Port interface for collecting server configuration files
 */
export interface IConfigFileCollector {
  /**
   * Collect all trackable config files for a server
   * Returns metadata (path, hash, size) for each file
   */
  collectFiles(serverName: string): Promise<ConfigSnapshotFile[]>;

  /**
   * Read the content of a specific config file
   */
  readFileContent(serverName: string, filePath: string): Promise<string>;
}
