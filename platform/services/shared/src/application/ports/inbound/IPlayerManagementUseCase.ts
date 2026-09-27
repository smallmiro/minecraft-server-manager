import type { Player, PlayerStats, PlayerData, EntityPosition } from '../../../domain/index.js';
import type { SessionHistory } from './IPlayerSessionUseCase.js';

/**
 * Extra data to include in a `getPlayerDetail` result.
 */
export interface GetPlayerDetailOptions {
  include?: Array<'stats' | 'nbt' | 'sessions'>;
  /**
   * Server container name (e.g. `mc-<server>`), required to fetch
   * `livePosition` via RCON when `include` contains `'nbt'` and the player
   * is online. Callers own container-name derivation (mirrors
   * `WorldInfoUseCase.getLivePlayerLocations`) — omitted/not running →
   * `livePosition` is `null`.
   */
  container?: string;
}

/** Result of `getPlayerDetail`: the player, plus any requested extras. */
export interface PlayerDetail {
  player: Player;
  /** Present only when `include` contains `'stats'`. */
  stats?: PlayerStats | null;
  /** Present only when `include` contains `'nbt'` (#528, Phase 3). */
  data?: PlayerData | null;
  /**
   * Live RCON position, present only when `include` contains `'nbt'`.
   * `null` when offline, no container was given, or the RCON call failed.
   */
  livePosition?: EntityPosition | null;
  /**
   * Session history, present only when `include` contains `'sessions'`
   * (#528, Phase 4). `null` when no `IPlayerSessionUseCase` was injected.
   */
  sessions?: SessionHistory | null;
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
   * `data`/`livePosition` are likewise only present when `options.include`
   * contains `'nbt'` (#528, Phase 3).
   */
  getPlayerDetail(
    serverName: string,
    uuid: string,
    onlineNames?: string[],
    options?: GetPlayerDetailOptions
  ): Promise<PlayerDetail | null>;
}
