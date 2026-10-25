import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Paths, parseEnvDocument } from '../../utils/index.js';
import {
  Server,
  ServerStatus,
  ServerName,
  ServerType,
  McVersion,
  Memory,
  WorldOptions,
  WORLD_NAME_PATTERN,
  configuredWorldName,
} from '../../domain/index.js';
import type {
  IServerRepository,
  ServerConfigData,
} from '../../application/ports/outbound/IServerRepository.js';
import type { IContainerRuntimePort } from '../../application/ports/outbound/IContainerRuntimePort.js';
// By file path, not the facade or the barrel (ADR-0001 dependency rules)
import { DockerComposeRuntimeAdapter } from './DockerComposeRuntimeAdapter.js';

/**
 * ServerRepository
 * Implements IServerRepository for server data access
 */
export class ServerRepository implements IServerRepository {
  private readonly paths: Paths;
  private readonly serversDir: string;
  private readonly runtime: IContainerRuntimePort;

  /**
   * @param runtime Runtime status of the servers (#665). Defaults to the
   *   Docker adapter.
   */
  constructor(paths?: Paths, runtime?: IContainerRuntimePort) {
    this.paths = paths ?? new Paths();
    this.serversDir = join(this.paths.root, 'servers');
    this.runtime = runtime ?? new DockerComposeRuntimeAdapter();
  }

  /**
   * Get all servers
   */
  async findAll(): Promise<Server[]> {
    const names = await this.listNames();
    const servers: Server[] = [];

    for (const name of names) {
      const server = await this.findByName(name);
      if (server) {
        servers.push(server);
      }
    }

    return servers;
  }

  /**
   * Find server by name
   */
  async findByName(name: string): Promise<Server | null> {
    const config = await this.getConfig(name);
    if (!config) {
      return null;
    }

    try {
      const serverName = ServerName.fromExisting(config.name);
      // A TYPE or VERSION create does not offer must not hide the server (#826)
      const serverType = ServerType.fromExisting(config.type);
      const mcVersion = McVersion.fromExisting(config.version);
      const memory = config.memory ? Memory.create(config.memory) : Memory.default();

      // Determine world options
      let worldOptions: WorldOptions;
      if (config.worldUrl) {
        worldOptions = WorldOptions.downloadWorld(config.worldUrl);
      } else if (config.worldName && WORLD_NAME_PATTERN.test(config.worldName)) {
        // A legacy LEVEL that fails the rule must not hide the server
        worldOptions = WorldOptions.existingWorld(config.worldName);
      } else if (config.seed) {
        worldOptions = WorldOptions.newWorld(config.seed);
      } else {
        worldOptions = WorldOptions.default();
      }

      const server = Server.create({
        name: serverName,
        type: serverType,
        version: mcVersion,
        memory,
        worldOptions,
        rconPassword: config.rconPassword,
      });

      // Get status
      const status = await this.getStatus(name);
      server.setStatus(status);

      // TODO: Get player count from docker exec or RCON

      return server;
    } catch {
      return null;
    }
  }

  /**
   * Check if server exists
   */
  async exists(name: string): Promise<boolean> {
    const serverDir = join(this.serversDir, name);
    return existsSync(serverDir);
  }

  /**
   * Get server status from the runtime port, awaited so request paths never
   * block on docker (#665). A failed query ('not_found') counts as stopped, as
   * before; a name no server can have is UNKNOWN.
   */
  async getStatus(name: string): Promise<ServerStatus> {
    try {
      switch (await this.runtime.getStatusAsync(ServerName.fromExisting(name))) {
        case 'running':
          return ServerStatus.RUNNING;
        case 'exited':
        case 'dead':
        case 'not_found':
          return ServerStatus.STOPPED;
        case 'created':
        case 'restarting':
          return ServerStatus.STARTING;
        case 'paused':
          return ServerStatus.STOPPING;
        default:
          return ServerStatus.UNKNOWN;
      }
    } catch {
      return ServerStatus.UNKNOWN;
    }
  }

  /**
   * Get server configuration from config.env
   */
  async getConfig(name: string): Promise<ServerConfigData | null> {
    const configPath = join(this.serversDir, name, 'config.env');

    if (!existsSync(configPath)) {
      return null;
    }

    try {
      const content = await readFile(configPath, 'utf-8');
      const config = Object.fromEntries(parseEnvDocument(content).values);

      return {
        name,
        type: config['TYPE'] || 'PAPER',
        version: config['VERSION'] || 'LATEST',
        memory: config['MEMORY'],
        rconPassword: config['RCON_PASSWORD'],
        seed: config['SEED'],
        worldName: configuredWorldName(config),
        worldUrl: config['WORLD_URL'],
        customEnv: config,
      };
    } catch {
      return null;
    }
  }

  /**
   * List server names
   */
  async listNames(): Promise<string[]> {
    if (!existsSync(this.serversDir)) {
      return [];
    }

    try {
      const entries = await readdir(this.serversDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) => !entry.name.startsWith('_')) // Skip templates
        .filter((entry) => existsSync(join(this.serversDir, entry.name, 'config.env')))
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  /**
   * Get running servers
   */
  async findRunning(): Promise<Server[]> {
    const servers = await this.findAll();
    return servers.filter((s) => s.status === ServerStatus.RUNNING);
  }

  /**
   * Get stopped servers
   */
  async findStopped(): Promise<Server[]> {
    const servers = await this.findAll();
    return servers.filter((s) => s.status === ServerStatus.STOPPED);
  }

}
