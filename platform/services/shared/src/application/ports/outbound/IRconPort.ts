import type { EntityPosition } from '../../../domain/index.js';
import type { ServerName } from '../../../domain/value-objects/ServerName.js';

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
   * @param server The server (#665). A string is the container name
   *   (`mc-<server>`): @deprecated, narrowed once every caller passes a
   *   ServerName (#667).
   * @param player Player username.
   */
  getEntityPosition(
    server: ServerName | string,
    player: string
  ): Promise<EntityPosition | null>;
}
