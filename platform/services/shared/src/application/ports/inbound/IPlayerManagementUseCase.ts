import type { Player, PlayerStats } from '../../../domain/index.js';

/**
 * Extra data to include in a `getPlayerDetail` result. Only `'stats'` exists
 * today (#528, Phase 2); Phase 3/4 will add `'nbt'`/`'sessions'` later.
 */
export interface GetPlayerDetailOptions {
  include?: Array<'stats'>;
}

/** Result of `getPlayerDetail`: the player, plus any requested extras. */
export interface PlayerDetail {
  player: Player;
  /** Present only when `include` contains `'stats'`. */
  stats?: PlayerStats | null;
}

/**
 * Player Management Use Case - Inbound Port
 *
 * Merges file-based known players with live online status (#528, Phase 1).
 */
export interface IPlayerManagementUseCase {
  /**
   * List every known player for a server, merged with the currently online
   * names (from RCON `list`, resolved by the caller). Online players not
   * present in any file still appear (with `uuid: ''`).
   * Sorted: online first, then last-seen desc, then name.
   */
  listPlayers(serverName: string, onlineNames: string[]): Promise<Player[]>;

  /**
   * A single known player by uuid (matched case-insensitively), or null when
   * not found. `online` is merged from `onlineNames` using the same
   * case-insensitive name match as `listPlayers`. `stats` is only read (and
   * only present on the result) when `options.include` contains `'stats'`.
   */
  getPlayerDetail(
    serverName: string,
    uuid: string,
    onlineNames?: string[],
    options?: GetPlayerDetailOptions
  ): Promise<PlayerDetail | null>;
}
