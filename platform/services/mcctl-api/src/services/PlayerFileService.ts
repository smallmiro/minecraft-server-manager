import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { atomicWriteFileSync, parseEnvDocument } from '@minecraft-docker/shared/utils';
import { writeServerConfig } from '../lib/server-spec.js';

interface WhitelistPlayer {
  name: string;
  uuid: string;
}

interface BannedPlayer {
  name: string;
  uuid: string;
  reason: string;
  created: string;
  source: string;
  expires: string;
}

interface PlayerListResult {
  players: string[];
  total: number;
  source: 'file' | 'config';
}

interface WhitelistResult {
  players: WhitelistPlayer[];
  total: number;
  source: 'file' | 'config';
}

interface BannedPlayersResult {
  players: BannedPlayer[];
  total: number;
  source: 'file';
}

interface WhitelistEntry {
  uuid: string;
  name: string;
}

interface OpsEntry {
  uuid: string;
  name: string;
  level: number;
  bypassesPlayerLimit: boolean;
}

interface BannedPlayerEntry {
  uuid: string;
  name: string;
  created: string;
  source: string;
  expires: string;
  reason: string;
}

/**
 * Service for reading/writing Minecraft server JSON files directly.
 * Used as fallback when server is offline (RCON unavailable).
 */
export class PlayerFileService {
  private readonly mcctlRoot: string;

  constructor(mcctlRoot: string) {
    this.mcctlRoot = mcctlRoot;
  }

  getServerDataPath(serverName: string): string {
    return join(this.mcctlRoot, 'servers', serverName, 'data');
  }

  private getConfigEnvPath(serverName: string): string {
    return join(this.mcctlRoot, 'servers', serverName, 'config.env');
  }

  private readJsonFile<T>(filePath: string): T[] {
    if (!existsSync(filePath)) return [];
    try {
      const content = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeJsonFile<T>(filePath: string, data: T[]): void {
    atomicWriteFileSync(filePath, JSON.stringify(data, null, 2));
  }

  private readConfigEnv(serverName: string): Map<string, string> {
    const configPath = this.getConfigEnvPath(serverName);
    if (!existsSync(configPath)) return new Map();

    return parseEnvDocument(readFileSync(configPath, 'utf-8')).values;
  }

  /** Through the ServerSpec (#675): server.yaml, config.env rendered from it. */
  private async writeConfigEnv(serverName: string, key: string, value: string): Promise<void> {
    await writeServerConfig(this.mcctlRoot, serverName, { set: { [key]: value } });
  }

  private parseCommaSeparated(value: string | undefined): string[] {
    if (!value) return [];
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }

  // ==================== READ ====================

  readWhitelistEnabled(serverName: string): boolean {
    const env = this.readConfigEnv(serverName);
    const value = env.get('ENABLE_WHITELIST');
    if (!value) return false;
    return value.toLowerCase() === 'true';
  }

  async setWhitelistEnabled(serverName: string, enabled: boolean): Promise<void> {
    await this.writeConfigEnv(serverName, 'ENABLE_WHITELIST', enabled ? 'TRUE' : 'FALSE');
  }

  readWhitelist(serverName: string): WhitelistResult {
    const jsonPath = join(this.getServerDataPath(serverName), 'whitelist.json');
    const entries = this.readJsonFile<WhitelistEntry>(jsonPath);

    if (entries.length > 0) {
      return {
        players: entries.map(e => ({ name: e.name, uuid: e.uuid })),
        total: entries.length,
        source: 'file',
      };
    }

    // Fallback to config.env WHITELIST variable
    const env = this.readConfigEnv(serverName);
    const configPlayers = this.parseCommaSeparated(env.get('WHITELIST'));
    if (configPlayers.length > 0) {
      return {
        players: configPlayers.map(name => ({ name, uuid: '' })),
        total: configPlayers.length,
        source: 'config'
      };
    }

    return { players: [], total: 0, source: 'file' };
  }

  readOps(serverName: string): PlayerListResult {
    const jsonPath = join(this.getServerDataPath(serverName), 'ops.json');
    const entries = this.readJsonFile<OpsEntry>(jsonPath);

    if (entries.length > 0) {
      return {
        players: entries.map(e => e.name),
        total: entries.length,
        source: 'file',
      };
    }

    // Fallback to config.env OPS variable
    const env = this.readConfigEnv(serverName);
    const configPlayers = this.parseCommaSeparated(env.get('OPS'));
    if (configPlayers.length > 0) {
      return { players: configPlayers, total: configPlayers.length, source: 'config' };
    }

    return { players: [], total: 0, source: 'file' };
  }

  readBannedPlayers(serverName: string): BannedPlayersResult {
    const jsonPath = join(this.getServerDataPath(serverName), 'banned-players.json');
    const entries = this.readJsonFile<BannedPlayerEntry>(jsonPath);

    return {
      players: entries.map(e => ({
        name: e.name,
        uuid: e.uuid,
        reason: e.reason,
        created: e.created,
        source: e.source,
        expires: e.expires,
      })),
      total: entries.length,
      source: 'file',
    };
  }

  // ==================== WRITE ====================

  addToWhitelist(serverName: string, playerName: string, uuid: string): void {
    const jsonPath = join(this.getServerDataPath(serverName), 'whitelist.json');
    const entries = this.readJsonFile<WhitelistEntry>(jsonPath);

    const exists = entries.some(e => e.name.toLowerCase() === playerName.toLowerCase());
    if (exists) return;

    entries.push({ uuid, name: playerName });
    this.writeJsonFile(jsonPath, entries);
  }

  removeFromWhitelist(serverName: string, playerName: string): void {
    const jsonPath = join(this.getServerDataPath(serverName), 'whitelist.json');
    const entries = this.readJsonFile<WhitelistEntry>(jsonPath);

    const filtered = entries.filter(e => e.name.toLowerCase() !== playerName.toLowerCase());
    this.writeJsonFile(jsonPath, filtered);
  }

  addToOps(serverName: string, playerName: string, uuid: string): void {
    const jsonPath = join(this.getServerDataPath(serverName), 'ops.json');
    const entries = this.readJsonFile<OpsEntry>(jsonPath);

    const exists = entries.some(e => e.name.toLowerCase() === playerName.toLowerCase());
    if (exists) return;

    entries.push({ uuid, name: playerName, level: 4, bypassesPlayerLimit: false });
    this.writeJsonFile(jsonPath, entries);
  }

  removeFromOps(serverName: string, playerName: string): void {
    const jsonPath = join(this.getServerDataPath(serverName), 'ops.json');
    const entries = this.readJsonFile<OpsEntry>(jsonPath);

    const filtered = entries.filter(e => e.name.toLowerCase() !== playerName.toLowerCase());
    this.writeJsonFile(jsonPath, filtered);
  }

  addToBannedPlayers(serverName: string, playerName: string, uuid: string, reason?: string): void {
    const jsonPath = join(this.getServerDataPath(serverName), 'banned-players.json');
    const entries = this.readJsonFile<BannedPlayerEntry>(jsonPath);

    const exists = entries.some(e => e.name.toLowerCase() === playerName.toLowerCase());
    if (exists) return;

    entries.push({
      uuid,
      name: playerName,
      created: new Date().toISOString(),
      source: 'mcctl-api',
      expires: 'forever',
      reason: reason || 'Banned via mcctl-api',
    });
    this.writeJsonFile(jsonPath, entries);
  }

  removeFromBannedPlayers(serverName: string, playerName: string): void {
    const jsonPath = join(this.getServerDataPath(serverName), 'banned-players.json');
    const entries = this.readJsonFile<BannedPlayerEntry>(jsonPath);

    const filtered = entries.filter(e => e.name.toLowerCase() !== playerName.toLowerCase());
    this.writeJsonFile(jsonPath, filtered);
  }
}

export function createPlayerFileService(mcctlRoot: string): PlayerFileService {
  return new PlayerFileService(mcctlRoot);
}
