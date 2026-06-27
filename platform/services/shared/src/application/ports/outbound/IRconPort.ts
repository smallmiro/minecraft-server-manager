import type { EntityPosition } from '../../../domain/index.js';

/**
 * RCON Port - Outbound Port
 *
 * Abstraction over RCON commands executed against a running server
 * container (`docker exec <container> rcon-cli <command>`). Used for
 * real-time player/entity queries.
 */
export interface IRconPort {
  /**
   * Get a player's live position via `data get entity <player> Pos`
   * (and Dimension). Returns null when the server is offline, the player
   * is not online, or the command fails.
   *
   * @param container Server container name (e.g. `mc-<server>`).
   * @param player Player username.
   */
  getEntityPosition(
    container: string,
    player: string
  ): Promise<EntityPosition | null>;
}
