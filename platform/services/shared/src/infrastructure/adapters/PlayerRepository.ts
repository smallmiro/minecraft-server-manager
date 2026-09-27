import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Paths } from '../../utils/index.js';
import { Player, PlayerStats } from '../../domain/index.js';
import type {
  IPlayerRepository,
  UserCacheEntry,
} from '../../application/ports/outbound/IPlayerRepository.js';

interface NamedUuidEntry {
  uuid: string;
  name: string;
}

// Dashed Minecraft UUID, e.g. 069a79f4-44e9-4726-a5be-fca90e38aaf5. Validated
// before building a file path from user input (no path traversal).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Merge target: fields collected from every source, keyed by uuid/name. */
interface PlayerRecord {
  uuid: string;
  name: string;
  lastSeen: Date | null;
}

/**
 * PlayerRepository
 *
 * Filesystem implementation of IPlayerRepository. Reads a server's
 * `usercache.json` / `ops.json` / `whitelist.json` / `banned-players.json`
 * (under `servers/<name>/data/`) and its world's `playerdata/*.dat` (mtime
 * as last-seen) to build the union of every known player (#528, Phase 1).
 */
export class PlayerRepository implements IPlayerRepository {
  private readonly paths: Paths;

  constructor(paths?: Paths) {
    this.paths = paths ?? new Paths();
  }

  private serverDataDir(serverName: string): string {
    return join(this.paths.root, 'servers', serverName, 'data');
  }

  async readUserCache(serverName: string): Promise<UserCacheEntry[]> {
    return this.readJsonArray<UserCacheEntry>(
      join(this.serverDataDir(serverName), 'usercache.json')
    );
  }

  async listKnownPlayers(serverName: string): Promise<Player[]> {
    const dataDir = this.serverDataDir(serverName);
    const [userCache, ops, whitelist, banned, playerData] = await Promise.all([
      this.readUserCache(serverName),
      this.readJsonArray<NamedUuidEntry>(join(dataDir, 'ops.json')),
      this.readJsonArray<NamedUuidEntry>(join(dataDir, 'whitelist.json')),
      this.readJsonArray<NamedUuidEntry>(join(dataDir, 'banned-players.json')),
      this.readPlayerData(serverName),
    ]);

    const opNames = new Set(ops.map((e) => e.name.toLowerCase()));
    const whitelistedNames = new Set(whitelist.map((e) => e.name.toLowerCase()));
    const bannedNames = new Set(banned.map((e) => e.name.toLowerCase()));

    const merged = new Map<string, PlayerRecord>();
    const upsert = (uuid: string, name: string, lastSeen: Date | null) => {
      const key = uuid ? uuid.toLowerCase() : `name:${name.toLowerCase()}`;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { uuid, name, lastSeen });
        return;
      }
      if (!existing.name && name) existing.name = name;
      if (lastSeen && (!existing.lastSeen || lastSeen > existing.lastSeen)) {
        existing.lastSeen = lastSeen;
      }
    };

    for (const e of userCache) upsert(e.uuid, e.name, null);
    for (const e of playerData) upsert(e.uuid, '', e.lastSeen);
    for (const e of ops) upsert(e.uuid, e.name, null);
    for (const e of whitelist) upsert(e.uuid, e.name, null);
    for (const e of banned) upsert(e.uuid, e.name, null);

    return [...merged.values()]
      .filter((p) => p.name)
      .map((p) =>
        Player.create({
          uuid: p.uuid,
          name: p.name,
          lastSeen: p.lastSeen,
          isOp: opNames.has(p.name.toLowerCase()),
          isBanned: bannedNames.has(p.name.toLowerCase()),
          isWhitelisted: whitelistedNames.has(p.name.toLowerCase()),
          online: false,
        })
      );
  }

  async readStats(serverName: string, uuid: string): Promise<PlayerStats | null> {
    if (!UUID_PATTERN.test(uuid)) return null;

    const level = await this.resolveWorldLevel(serverName);
    const worldDir = join(this.paths.root, 'worlds', level);
    const statsJson = await this.readJsonFile(join(worldDir, 'stats', `${uuid}.json`));
    if (statsJson === null) return null;

    const advancementsJson = await this.readJsonFile(
      join(worldDir, 'advancements', `${uuid}.json`)
    );
    return PlayerStats.fromMinecraftJson(statsJson, advancementsJson ?? undefined);
  }

  /** Scan `worlds/<level>/playerdata/*.dat`, using file mtime as last-seen. */
  private async readPlayerData(
    serverName: string
  ): Promise<Array<{ uuid: string; lastSeen: Date }>> {
    const level = await this.resolveWorldLevel(serverName);
    const dir = join(this.paths.root, 'worlds', level, 'playerdata');

    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }

    const results: Array<{ uuid: string; lastSeen: Date }> = [];
    for (const entry of entries) {
      if (!entry.endsWith('.dat')) continue;
      try {
        const fileStat = await stat(join(dir, entry));
        results.push({ uuid: entry.slice(0, -4), lastSeen: fileStat.mtime });
      } catch {
        // Skip files that disappear/fail mid-scan.
      }
    }
    return results;
  }

  /** LEVEL > WORLD_NAME > server name (mirrors WorldManagementUseCase). */
  private async resolveWorldLevel(serverName: string): Promise<string> {
    const configPath = join(this.paths.root, 'servers', serverName, 'config.env');
    try {
      const content = await readFile(configPath, 'utf-8');
      const env = this.parseEnv(content);
      return env.get('LEVEL')?.trim() || env.get('WORLD_NAME')?.trim() || serverName;
    } catch {
      return serverName;
    }
  }

  private parseEnv(content: string): Map<string, string> {
    const result = new Map<string, string>();
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        result.set(trimmed.slice(0, eqIndex).trim(), trimmed.slice(eqIndex + 1).trim());
      }
    }
    return result;
  }

  private async readJsonArray<T>(filePath: string): Promise<T[]> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Parsed JSON, or `null` when the file is missing or not valid JSON. */
  private async readJsonFile(filePath: string): Promise<unknown | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}
