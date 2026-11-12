import type {
  IServerRepository,
  ServerConfigData,
} from '../application/ports/outbound/IServerRepository.js';
import {
  Server,
  ServerName,
  ServerType,
  McVersion,
  Memory,
  WorldOptions,
  ServerStatus,
} from '../domain/index.js';

/** One server of an InMemoryServerRepository. */
export interface InMemoryServerData {
  name: string;
  type?: string;
  version?: string;
  memory?: string;
  status?: ServerStatus;
  playerCount?: number;
}

/** In-memory IServerRepository: servers built from InMemoryServerData, status as given. */
export class InMemoryServerRepository implements IServerRepository {
  private servers: Map<string, Server> = new Map();

  constructor(initialServers: InMemoryServerData[] = []) {
    for (const data of initialServers) {
      this.addServer(data);
    }
  }

  // ========================================
  // Testing Helpers
  // ========================================

  addServer(data: InMemoryServerData): void {
    const server = Server.create({
      name: ServerName.create(data.name),
      type: ServerType.create(data.type ?? 'PAPER'),
      version: McVersion.create(data.version ?? '26.1.1'),
      memory: Memory.create(data.memory ?? '4G'),
      worldOptions: WorldOptions.newWorld(),
    });

    // Set status and player count if provided
    if (data.status) {
      (server as unknown as { _status: ServerStatus })._status = data.status;
    }
    if (data.playerCount !== undefined) {
      (server as unknown as { _playerCount: number })._playerCount = data.playerCount;
    }

    this.servers.set(data.name, server);
  }

  removeServer(name: string): void {
    this.servers.delete(name);
  }

  clear(): void {
    this.servers.clear();
  }

  // ========================================
  // IServerRepository Implementation
  // ========================================

  async findAll(): Promise<Server[]> {
    return Array.from(this.servers.values());
  }

  async findByName(name: string): Promise<Server | null> {
    return this.servers.get(name) ?? null;
  }

  async exists(name: string): Promise<boolean> {
    return this.servers.has(name);
  }

  async getStatus(name: string): Promise<ServerStatus> {
    const server = this.servers.get(name);
    return server?.status ?? ServerStatus.STOPPED;
  }

  async getConfig(name: string): Promise<ServerConfigData | null> {
    const server = this.servers.get(name);
    if (!server) return null;

    return {
      name: server.name.value,
      type: server.type.value,
      version: server.version.value,
      memory: server.memory.value,
    };
  }

  async listNames(): Promise<string[]> {
    return Array.from(this.servers.keys());
  }

  async findRunning(): Promise<Server[]> {
    return Array.from(this.servers.values()).filter((s) => s.isRunning);
  }

  async findStopped(): Promise<Server[]> {
    return Array.from(this.servers.values()).filter((s) => !s.isRunning);
  }
}
