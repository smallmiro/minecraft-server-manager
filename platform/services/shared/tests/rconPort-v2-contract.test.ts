/**
 * IRconPort shipped in v2.33.0 with `getEntityPosition(container: string, ...)`.
 * #665 widened the parameter to `ServerName | string`, but shared must keep
 * handing v2 implementations what they received before: the container name
 * string `mc-<server>`, never a ServerName object (#753 review).
 */
import { describe, it, expect } from 'vitest';
import { WorldInfoUseCase } from '../src/application/use-cases/WorldInfoUseCase.js';
import { PlayerManagementUseCase } from '../src/application/use-cases/PlayerManagementUseCase.js';
import { Player, ServerName } from '../src/domain/index.js';
import { containerNameOf } from '../src/infrastructure/adapters/workloadNames.js';
import type {
  EntityPosition,
  IPlayerRepository,
  IRconPort,
  IWorldRepository,
} from '../src/application/ports/index.js';

/** A v2 implementation: it only knows container-name strings. */
class RecordingV2Rcon implements IRconPort {
  readonly received: unknown[] = [];
  async getEntityPosition(container: string, _player: string): Promise<EntityPosition | null> {
    this.received.push(container);
    return { x: 1, y: 2, z: 3 };
  }
}

const server = ServerName.fromExisting('survival');

describe('IRconPort v2 runtime contract (#665)', () => {
  it('WorldInfoUseCase passes the container name string', async () => {
    const rcon = new RecordingV2Rcon();
    const useCase = new WorldInfoUseCase({} as IWorldRepository, {} as never, rcon);

    await useCase.getLivePlayerLocations(containerNameOf(server), ['Steve']);

    expect(rcon.received).toEqual(['mc-survival']);
    expect(typeof rcon.received[0]).toBe('string');
  });

  it('PlayerManagementUseCase passes the container name string', async () => {
    const rcon = new RecordingV2Rcon();
    const steve = Player.create({
      uuid: 'uuid-steve',
      name: 'Steve',
      lastSeen: new Date('2026-01-01T00:00:00.000Z'),
      isOp: false,
      isBanned: false,
      isWhitelisted: false,
      online: false,
    });
    const repo = {
      readUserCache: async () => [],
      listKnownPlayers: async () => [steve],
      readStats: async () => null,
      readPlayerData: async () => null,
    } as IPlayerRepository;
    const useCase = new PlayerManagementUseCase(repo, rcon);

    await useCase.getPlayerDetail('survival', 'uuid-steve', ['Steve'], {
      include: ['nbt'], // livePosition is read with the NBT detail
      container: containerNameOf(server),
    });

    expect(rcon.received).toEqual(['mc-survival']);
    expect(typeof rcon.received[0]).toBe('string');
  });
});
