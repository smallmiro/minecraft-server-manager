/**
 * IConfigSnapshotStorage - Outbound Port
 * Port interface for storing and retrieving snapshot file contents
 */
export interface IConfigSnapshotStorage {
  /**
   * Store file contents for a snapshot
   * @param snapshotId - The snapshot ID
   * @param serverName - The server name
   * @param files - Map of file path to file content
   */
  store(
    snapshotId: string,
    serverName: string,
    files: Map<string, string>
  ): Promise<void>;

  /**
   * Retrieve file contents for a snapshot
   * @param snapshotId - The snapshot ID
   * @param serverName - The server name
   * @returns Map of file path to file content
   */
  retrieve(
    snapshotId: string,
    serverName: string
  ): Promise<Map<string, string>>;

  /**
   * Delete stored file contents for a snapshot
   * @param snapshotId - The snapshot ID
   * @param serverName - The server name
   */
  delete(snapshotId: string, serverName: string): Promise<void>;
}
