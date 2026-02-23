import { randomUUID } from 'node:crypto';
import { ServerName } from '../value-objects/ServerName.js';
import {
  ConfigSnapshotFile,
  type ConfigSnapshotFileData,
} from '../value-objects/ConfigSnapshotFile.js';

/**
 * ConfigSnapshot entity data for reconstruction
 */
export interface ConfigSnapshotData {
  id: string;
  serverName: ServerName;
  createdAt: Date;
  description: string;
  files: ConfigSnapshotFile[];
  scheduleId?: string;
}

/**
 * Database row structure for config_snapshots table
 */
export interface ConfigSnapshotRow {
  id: string;
  server_name: string;
  created_at: string;
  description: string;
  files: string; // JSON string of ConfigSnapshotFileData[]
  schedule_id: string | null;
}

/**
 * ConfigSnapshot Entity
 * Represents a point-in-time capture of server configuration files
 */
export class ConfigSnapshot {
  private readonly _id: string;
  private readonly _serverName: ServerName;
  private readonly _createdAt: Date;
  private readonly _description: string;
  private readonly _files: readonly ConfigSnapshotFile[];
  private readonly _scheduleId?: string;

  private constructor(data: ConfigSnapshotData) {
    this._id = data.id;
    this._serverName = data.serverName;
    this._createdAt = data.createdAt;
    this._description = data.description;
    this._files = Object.freeze([...data.files]);
    this._scheduleId = data.scheduleId;
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get serverName(): ServerName {
    return this._serverName;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get description(): string {
    return this._description;
  }

  get files(): readonly ConfigSnapshotFile[] {
    return this._files;
  }

  get scheduleId(): string | undefined {
    return this._scheduleId;
  }

  /**
   * Create a new ConfigSnapshot entity
   */
  static create(
    serverName: ServerName,
    files: ConfigSnapshotFile[],
    description?: string,
    scheduleId?: string
  ): ConfigSnapshot {
    return new ConfigSnapshot({
      id: randomUUID(),
      serverName,
      createdAt: new Date(),
      description: description ?? '',
      files,
      scheduleId,
    });
  }

  /**
   * Create a ConfigSnapshot from explicit data (e.g., from database reconstruction)
   */
  static fromData(data: ConfigSnapshotData): ConfigSnapshot {
    return new ConfigSnapshot(data);
  }

  /**
   * Create a ConfigSnapshot from a database row
   */
  static fromRaw(row: ConfigSnapshotRow): ConfigSnapshot {
    const filesData: ConfigSnapshotFileData[] = JSON.parse(row.files);
    const files = filesData.map((f) => ConfigSnapshotFile.create(f));

    return new ConfigSnapshot({
      id: row.id,
      serverName: ServerName.create(row.server_name),
      createdAt: new Date(row.created_at),
      description: row.description,
      files,
      scheduleId: row.schedule_id ?? undefined,
    });
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): {
    id: string;
    serverName: string;
    createdAt: string;
    description: string;
    files: ConfigSnapshotFileData[];
    scheduleId?: string;
  } {
    return {
      id: this._id,
      serverName: this._serverName.value,
      createdAt: this._createdAt.toISOString(),
      description: this._description,
      files: this._files.map((f) => f.toJSON()),
      scheduleId: this._scheduleId,
    };
  }
}
