import { describe, it, expect, vi } from 'vitest';
import { PlayerManagementUseCase } from '../src/application/use-cases/PlayerManagementUseCase.js';
import { Player, PlayerStats, PlayerData, Dimension } from '../src/domain/index.js';
import type {
  IPlayerRepository,
  IRconPort,
  UserCacheEntry,
  IPlayerSessionUseCase,
  SessionHistory,
} from '../src/application/ports/index.js';

function makeRepo(
  known: Player[],
  stats: PlayerStats | null = null,
  data: PlayerData | null = null
): IPlayerRepository {
  return {
    async readUserCache(): Promise<UserCacheEntry[]> {
      return [];
    },
    async listKnownPlayers(): Promise<Player[]> {
      return known;
    },
    async readStats(): Promise<PlayerStats | null> {
      return stats;
    },
    async readPlayerData(): Promise<PlayerData | null> {
      return data;
    },
  };
}

const steve = Player.create({
  uuid: 'uuid-steve',
  name: 'Steve',
  lastSeen: new Date('2026-01-01T00:00:00.000Z'),
  isOp: true,
  isBanned: false,
  isWhitelisted: true,
  online: false,
});

const alex = Player.create({
  uuid: 'uuid-alex',
  name: 'Alex',
  lastSeen: new Date('2026-02-01T00:00:00.000Z'),
  isOp: false,
  isBanned: false,
  isWhitelisted: false,
  online: false,
});

describe('PlayerManagementUseCase', () => {
  describe('listPlayers', () => {
    it('마지막 접속 시각 내림차순으로 정렬한다 (온라인 없음)', async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([steve, alex]));
      const players = await useCase.listPlayers('myserver', []);

      expect(players.map((p) => p.name)).toEqual(['Alex', 'Steve']);
    });

    it('온라인 플레이어를 online:true로 표시하고 최우선 정렬한다', async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([steve, alex]));
      const players = await useCase.listPlayers('myserver', ['Steve']);

      expect(players[0]!.name).toBe('Steve');
      expect(players[0]!.online).toBe(true);
      expect(players[1]!.name).toBe('Alex');
      expect(players[1]!.online).toBe(false);
    });

    it('파일에 없는 온라인 플레이어도 uuid 빈 문자열로 포함한다', async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([alex]));
      const players = await useCase.listPlayers('myserver', ['Ghost']);

      const ghost = players.find((p) => p.name === 'Ghost');
      expect(ghost).toBeDefined();
      expect(ghost!.uuid).toBe('');
      expect(ghost!.online).toBe(true);
    });

    it('온라인 이름 매칭은 대소문자를 구분하지 않는다', async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([steve]));
      const players = await useCase.listPlayers('myserver', ['steve']);

      expect(players[0]!.online).toBe(true);
    });
  });

  describe('getPlayerDetail', () => {
    it('uuid로 플레이어를 조회한다', async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([steve, alex]));
      const detail = await useCase.getPlayerDetail('myserver', 'uuid-alex');

      expect(detail).not.toBeNull();
      expect(detail!.player.name).toBe('Alex');
    });

    it('존재하지 않는 uuid는 null을 반환한다', async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([steve]));
      const detail = await useCase.getPlayerDetail('myserver', 'missing');

      expect(detail).toBeNull();
    });

    it('uuid는 대소문자를 구분하지 않고 매칭한다', async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([steve]));
      const detail = await useCase.getPlayerDetail('myserver', 'UUID-STEVE');

      expect(detail).not.toBeNull();
      expect(detail!.player.name).toBe('Steve');
    });

    it('onlineNames에 포함된 플레이어는 online:true를 반환한다 (listPlayers와 동일한 매칭 로직)', async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([steve, alex]));
      const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve', ['Steve']);

      expect(detail).not.toBeNull();
      expect(detail!.player.online).toBe(true);
    });

    it('onlineNames 매칭도 대소문자를 구분하지 않는다', async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([steve]));
      const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve', ['steve']);

      expect(detail!.player.online).toBe(true);
    });

    it('onlineNames에 없으면 online:false를 반환한다', async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([steve, alex]));
      const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve', ['Alex']);

      expect(detail!.player.online).toBe(false);
    });

    it('include가 없으면 stats를 읽지 않는다', async () => {
      let readStatsCalled = false;
      const repo: IPlayerRepository = {
        ...makeRepo([steve]),
        async readStats() {
          readStatsCalled = true;
          return null;
        },
      };
      const useCase = new PlayerManagementUseCase(repo);
      const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve');

      expect(detail!.stats).toBeUndefined();
      expect(readStatsCalled).toBe(false);
    });

    it("include: ['stats']이면 stats를 포함한다", async () => {
      const stats = PlayerStats.create({
        playTimeSeconds: 60,
        deaths: 1,
        mobKills: 2,
        playerKills: 0,
        distanceMeters: 10,
        blocksMined: 5,
        itemsCrafted: 1,
        advancementsCompleted: 3,
      });
      const useCase = new PlayerManagementUseCase(makeRepo([steve], stats));
      const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve', [], {
        include: ['stats'],
      });

      expect(detail!.stats).toBe(stats);
    });

    it("include: ['stats']이고 stats 파일이 없으면 stats는 null이다", async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([steve], null));
      const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve', [], {
        include: ['stats'],
      });

      expect(detail!.stats).toBeNull();
    });

    describe("include: ['nbt']", () => {
      const playerData = PlayerData.create({
        x: 1,
        y: 2,
        z: 3,
        dimension: Dimension.Overworld,
        gameMode: 'survival',
        inventory: { slotsUsed: 0, items: [] },
      });

      it('include가 없으면 data/livePosition을 읽지 않는다', async () => {
        let readPlayerDataCalled = false;
        const repo: IPlayerRepository = {
          ...makeRepo([steve]),
          async readPlayerData() {
            readPlayerDataCalled = true;
            return playerData;
          },
        };
        const useCase = new PlayerManagementUseCase(repo);
        const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve');

        expect(detail!.data).toBeUndefined();
        expect(detail!.livePosition).toBeUndefined();
        expect(readPlayerDataCalled).toBe(false);
      });

      it('data를 저장소에서 읽어 포함한다', async () => {
        const useCase = new PlayerManagementUseCase(makeRepo([steve], null, playerData));
        const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve', [], {
          include: ['nbt'],
        });

        expect(detail!.data).toBe(playerData);
      });

      it('오프라인이면 livePosition은 null이고 RCON을 호출하지 않는다', async () => {
        const rcon: IRconPort = { getEntityPosition: vi.fn() };
        const useCase = new PlayerManagementUseCase(makeRepo([steve], null, playerData), rcon);
        const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve', [], {
          include: ['nbt'],
          container: 'mc-myserver',
        });

        expect(detail!.livePosition).toBeNull();
        expect(rcon.getEntityPosition).not.toHaveBeenCalled();
      });

      it('온라인 + container가 있으면 RCON으로 livePosition을 조회한다', async () => {
        const position = { x: 5, y: 6, z: 7, dimension: Dimension.Nether };
        const rcon: IRconPort = { getEntityPosition: vi.fn().mockResolvedValue(position) };
        const useCase = new PlayerManagementUseCase(makeRepo([steve], null, playerData), rcon);
        const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve', ['Steve'], {
          include: ['nbt'],
          container: 'mc-myserver',
        });

        expect(detail!.livePosition).toBe(position);
        expect(rcon.getEntityPosition).toHaveBeenCalledWith('mc-myserver', 'Steve');
      });

      it('container가 없으면 온라인이어도 livePosition은 null이다', async () => {
        const rcon: IRconPort = { getEntityPosition: vi.fn() };
        const useCase = new PlayerManagementUseCase(makeRepo([steve], null, playerData), rcon);
        const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve', ['Steve'], {
          include: ['nbt'],
        });

        expect(detail!.livePosition).toBeNull();
        expect(rcon.getEntityPosition).not.toHaveBeenCalled();
      });

      it('rcon이 주입되지 않으면 온라인이어도 livePosition은 null이다', async () => {
        const useCase = new PlayerManagementUseCase(makeRepo([steve], null, playerData));
        const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve', ['Steve'], {
          include: ['nbt'],
          container: 'mc-myserver',
        });

        expect(detail!.livePosition).toBeNull();
      });

      it('RCON 호출이 실패하면 livePosition은 null이다', async () => {
        const rcon: IRconPort = {
          getEntityPosition: vi.fn().mockRejectedValue(new Error('rcon down')),
        };
        const useCase = new PlayerManagementUseCase(makeRepo([steve], null, playerData), rcon);
        const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve', ['Steve'], {
          include: ['nbt'],
          container: 'mc-myserver',
        });

        expect(detail!.livePosition).toBeNull();
      });
    });

    describe("include: ['sessions']", () => {
      const history: SessionHistory = {
        visitCount: 3,
        totalPlaytimeSeconds: 900,
        lastSeen: new Date('2026-01-01T00:00:00.000Z'),
        recent: [],
      };

      it('include가 없으면 sessions를 읽지 않는다', async () => {
        const playerSessions: IPlayerSessionUseCase = {
          ingestLogLines: vi.fn(),
          markServerStopped: vi.fn(),
          getCursor: vi.fn().mockResolvedValue(null),
          getSessionHistory: vi.fn().mockResolvedValue(history),
        };
        const useCase = new PlayerManagementUseCase(makeRepo([steve]), undefined, playerSessions);
        const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve');

        expect(detail!.sessions).toBeUndefined();
        expect(playerSessions.getSessionHistory).not.toHaveBeenCalled();
      });

      it("include: ['sessions']이면 세션 이력을 조회해 포함한다", async () => {
        const playerSessions: IPlayerSessionUseCase = {
          ingestLogLines: vi.fn(),
          markServerStopped: vi.fn(),
          getCursor: vi.fn().mockResolvedValue(null),
          getSessionHistory: vi.fn().mockResolvedValue(history),
        };
        const useCase = new PlayerManagementUseCase(makeRepo([steve]), undefined, playerSessions);
        const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve', [], {
          include: ['sessions'],
        });

        expect(detail!.sessions).toBe(history);
        expect(playerSessions.getSessionHistory).toHaveBeenCalledWith(
          'myserver',
          'Steve',
          expect.any(Date)
        );
      });

      it('IPlayerSessionUseCase가 주입되지 않으면 sessions는 null이다', async () => {
        const useCase = new PlayerManagementUseCase(makeRepo([steve]));
        const detail = await useCase.getPlayerDetail('myserver', 'uuid-steve', [], {
          include: ['sessions'],
        });

        expect(detail!.sessions).toBeNull();
      });
    });
  });
});
