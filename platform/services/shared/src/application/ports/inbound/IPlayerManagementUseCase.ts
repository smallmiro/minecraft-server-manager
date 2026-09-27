import type { Player } from '../../../domain/index.js';

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
   * case-insensitive name match as `listPlayers`.
   */
  getPlayerDetail(
    serverName: string,
    uuid: string,
    onlineNames?: string[]
  ): Promise<Player | null>;
}
