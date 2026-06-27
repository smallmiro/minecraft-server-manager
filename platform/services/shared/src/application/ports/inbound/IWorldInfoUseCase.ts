import type { WorldInfo, PlayerLocation, Structure } from '../../../domain/index.js';

/**
 * World Info Use Case - Inbound Port
 *
 * Provides world metadata, offline player locations, and live (RCON)
 * player locations for the World Info feature (#525, Phase 1).
 */
export interface IWorldInfoUseCase {
  /**
   * Get aggregated world info (level.dat metadata + on-disk structure).
   * @param name World name.
   */
  getWorldInfo(name: string): Promise<WorldInfo>;

  /**
   * Get offline player locations from `playerdata`.
   * @param name World name.
   */
  getPlayerLocations(name: string): Promise<PlayerLocation[]>;

  /**
   * Get live player locations via RCON for a running server.
   * Players not resolvable (offline/no entity) are omitted.
   *
   * @param container Server container name (e.g. `mc-<server>`).
   * @param players Online player usernames to resolve.
   */
  getLivePlayerLocations(
    container: string,
    players: string[]
  ): Promise<PlayerLocation[]>;

  /**
   * Extract generated structures across all present dimensions (#530).
   * @param name World name.
   */
  getStructures(name: string): Promise<Structure[]>;
}
