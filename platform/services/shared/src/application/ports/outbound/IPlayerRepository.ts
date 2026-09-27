import type { Player, PlayerStats } from '../../../domain/index.js';

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
}
