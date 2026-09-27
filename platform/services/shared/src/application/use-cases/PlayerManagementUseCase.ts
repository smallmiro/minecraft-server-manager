import type { IPlayerManagementUseCase } from '../ports/inbound/IPlayerManagementUseCase.js';
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
    onlineNames: string[] = []
  ): Promise<Player | null> {
    const known = await this.playerRepository.listKnownPlayers(serverName);
    const player = known.find((p) => p.uuid.toLowerCase() === uuid.toLowerCase()) ?? null;
    if (!player) return null;

    const onlineSet = buildOnlineSet(onlineNames);
    if (!onlineSet.has(player.name.toLowerCase())) return player;

    return Player.create({
      uuid: player.uuid,
      name: player.name,
      lastSeen: player.lastSeen,
      isOp: player.isOp,
      isBanned: player.isBanned,
      isWhitelisted: player.isWhitelisted,
      online: true,
    });
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
