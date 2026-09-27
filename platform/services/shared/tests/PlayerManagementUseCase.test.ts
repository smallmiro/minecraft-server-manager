import { describe, it, expect } from 'vitest';
import { PlayerManagementUseCase } from '../src/application/use-cases/PlayerManagementUseCase.js';
import { Player } from '../src/domain/index.js';
import type { IPlayerRepository, UserCacheEntry } from '../src/application/ports/index.js';

function makeRepo(known: Player[]): IPlayerRepository {
  return {
    async readUserCache(): Promise<UserCacheEntry[]> {
      return [];
    },
    async listKnownPlayers(): Promise<Player[]> {
      return known;
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
      const player = await useCase.getPlayerDetail('myserver', 'uuid-alex');

      expect(player).not.toBeNull();
      expect(player!.name).toBe('Alex');
    });

    it('존재하지 않는 uuid는 null을 반환한다', async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([steve]));
      const player = await useCase.getPlayerDetail('myserver', 'missing');

      expect(player).toBeNull();
    });

    it('uuid는 대소문자를 구분하지 않고 매칭한다', async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([steve]));
      const player = await useCase.getPlayerDetail('myserver', 'UUID-STEVE');

      expect(player).not.toBeNull();
      expect(player!.name).toBe('Steve');
    });

    it('onlineNames에 포함된 플레이어는 online:true를 반환한다 (listPlayers와 동일한 매칭 로직)', async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([steve, alex]));
      const player = await useCase.getPlayerDetail('myserver', 'uuid-steve', ['Steve']);

      expect(player).not.toBeNull();
      expect(player!.online).toBe(true);
    });

    it('onlineNames 매칭도 대소문자를 구분하지 않는다', async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([steve]));
      const player = await useCase.getPlayerDetail('myserver', 'uuid-steve', ['steve']);

      expect(player!.online).toBe(true);
    });

    it('onlineNames에 없으면 online:false를 반환한다', async () => {
      const useCase = new PlayerManagementUseCase(makeRepo([steve, alex]));
      const player = await useCase.getPlayerDetail('myserver', 'uuid-steve', ['Alex']);

      expect(player!.online).toBe(false);
    });
  });
});
