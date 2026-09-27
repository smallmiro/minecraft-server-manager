import type { Player, PlayerStats, PlayerData } from '../../../domain/index.js';

/**
 * Raw entry from a server's `usercache.json`.
 */
export interface UserCacheEntry {
  uuid: string;
  name: string;
  expiresOn?: string;
}

/**
 * Player Repository Port - Outbound Port
 *
 * File-based access to a server's known players: `usercache.json`,
 * `playerdata/*.dat` (mtime as last-seen), `ops.json`, `whitelist.json`,
 * `banned-players.json`. Read-only, offline-capable (#528, Phase 1).
 */
export interface IPlayerRepository {
  /**
   * Raw contents of `usercache.json` for a server. Empty when missing/corrupt.
   */
  readUserCache(serverName: string): Promise<UserCacheEntry[]>;

  /**
   * Union of every player known from files (usercache, playerdata, ops,
   * whitelist, bans), deduped by uuid (falling back to lowercase name).
   * Always returns `online: false` — online status is merged by the use case.
   */
  listKnownPlayers(serverName: string): Promise<Player[]>;

  /**
   * Parsed `stats/<uuid>.json` + `advancements/<uuid>.json` for a player
   * (#528, Phase 2). `null` when the stats file is missing or corrupt; the
   * advancements file is optional (missing/corrupt → 0 advancements).
   */
  readStats(serverName: string, uuid: string): Promise<PlayerStats | null>;

  /**
   * Parsed `playerdata/<uuid>.dat` NBT (position, dimension, vitals, game
   * mode, inventory summary) for a player (#528, Phase 3). `null` when the
   * uuid is malformed or the file is missing/corrupt. Shares its parser
   * with #525's world player locations (`PrismarineWorldDataReader`).
   */
  readPlayerData(serverName: string, uuid: string): Promise<PlayerData | null>;
}
