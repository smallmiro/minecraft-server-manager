import type {
  IPlayerManagementUseCase,
  GetPlayerDetailOptions,
  PlayerDetail,
} from '../ports/inbound/IPlayerManagementUseCase.js';
import type { IPlayerRepository } from '../ports/outbound/IPlayerRepository.js';
import { Player } from '../../domain/index.js';

/**
 * Player Management Use Case
 *
 * Merges file-based known players (`IPlayerRepository`) with the live
 * online player names resolved by the caller via RCON `list` (#528, Phase 1).
 */
export class PlayerManagementUseCase implements IPlayerManagementUseCase {
  constructor(private readonly playerRepository: IPlayerRepository) {}

  async listPlayers(serverName: string, onlineNames: string[]): Promise<Player[]> {
    const known = await this.playerRepository.listKnownPlayers(serverName);
    const onlineSet = buildOnlineSet(onlineNames);
    const knownNames = new Set(known.map((p) => p.name.toLowerCase()));

    const merged = known.map((p) =>
      onlineSet.has(p.name.toLowerCase())
        ? Player.create({
            uuid: p.uuid,
            name: p.name,
            lastSeen: p.lastSeen,
            isOp: p.isOp,
            isBanned: p.isBanned,
            isWhitelisted: p.isWhitelisted,
            online: true,
          })
        : p
    );

    // Online players with no file record still appear (e.g. brand-new player).
    for (const name of onlineNames) {
      if (!knownNames.has(name.toLowerCase())) {
        merged.push(
          Player.create({
            uuid: '',
            name,
            lastSeen: null,
            isOp: false,
            isBanned: false,
            isWhitelisted: false,
            online: true,
          })
        );
      }
    }

    return merged.sort(comparePlayers);
  }

  async getPlayerDetail(
    serverName: string,
    uuid: string,
    onlineNames: string[] = [],
    options?: GetPlayerDetailOptions
  ): Promise<PlayerDetail | null> {
    const known = await this.playerRepository.listKnownPlayers(serverName);
    const found = known.find((p) => p.uuid.toLowerCase() === uuid.toLowerCase()) ?? null;
    if (!found) return null;

    const onlineSet = buildOnlineSet(onlineNames);
    const player = onlineSet.has(found.name.toLowerCase())
      ? Player.create({
          uuid: found.uuid,
          name: found.name,
          lastSeen: found.lastSeen,
          isOp: found.isOp,
          isBanned: found.isBanned,
          isWhitelisted: found.isWhitelisted,
          online: true,
        })
      : found;

    const detail: PlayerDetail = { player };
    if (options?.include?.includes('stats')) {
      detail.stats = await this.playerRepository.readStats(serverName, player.uuid || uuid);
    }
    return detail;
  }
}

/** Case-insensitive lookup set for online-name matching (shared by listPlayers/getPlayerDetail). */
function buildOnlineSet(onlineNames: string[]): Set<string> {
  return new Set(onlineNames.map((n) => n.toLowerCase()));
}

/** Online first, then last-seen desc, then name. */
function comparePlayers(a: Player, b: Player): number {
  if (a.online !== b.online) return a.online ? -1 : 1;
  const aTime = a.lastSeen?.getTime() ?? -Infinity;
  const bTime = b.lastSeen?.getTime() ?? -Infinity;
  if (aTime !== bTime) return bTime - aTime;
  return a.name.localeCompare(b.name);
}
