import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Paths } from '../../utils/index.js';
import { execScript } from '../../docker/index.js';
import {
  Server,
  ServerStatus,
  ServerName,
  ServerType,
  McVersion,
  Memory,
  WorldOptions,
} from '../../domain/index.js';
import type {
  IServerRepository,
  ServerConfigData,
} from '../../application/ports/outbound/IServerRepository.js';

/**
 * ServerRepository
 * Implements IServerRepository for server data access
 */
export class ServerRepository implements IServerRepository {
  private readonly paths: Paths;
  private readonly serversDir: string;

  constructor(paths?: Paths) {
    this.paths = paths ?? new Paths();
    this.serversDir = join(this.paths.root, 'servers');
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
      const serverName = ServerName.create(config.name);
      const serverType = ServerType.create(config.type);
      const mcVersion = McVersion.create(config.version);
      const memory = config.memory ? Memory.create(config.memory) : Memory.default();

      // Determine world options
      let worldOptions: WorldOptions;
      if (config.worldUrl) {
        worldOptions = WorldOptions.downloadWorld(config.worldUrl);
      } else if (config.worldName) {
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
   * Get server status
   */
  async getStatus(name: string): Promise<ServerStatus> {
    try {
      const containerName = `mc-${name}`;
      const result = await execScript('docker', [
        'inspect',
        '-f',
        '{{.State.Status}}',
        containerName,
      ], {});

      if (result.code !== 0) {
        return ServerStatus.STOPPED;
      }

      const status = result.stdout.trim().toLowerCase();

      switch (status) {
        case 'running':
          return ServerStatus.RUNNING;
        case 'exited':
        case 'dead':
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
      const config = this.parseEnvFile(content);

      return {
        name,
        type: config['TYPE'] || 'PAPER',
        version: config['VERSION'] || 'LATEST',
        memory: config['MEMORY'],
        rconPassword: config['RCON_PASSWORD'],
        seed: config['SEED'],
        worldName: config['WORLD'],
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

  /**
   * Parse env file content
   */
  private parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {};

    for (const line of content.split('\n')) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        continue;
      }

      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();

      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      result[key] = value;
    }

    return result;
  }
}
