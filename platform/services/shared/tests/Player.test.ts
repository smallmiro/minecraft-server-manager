import { describe, test, expect } from 'vitest';
import { Player } from '../src/domain/entities/Player.js';

describe('Player', () => {
  describe('create', () => {
    test('필수 필드로 Player를 생성한다', () => {
      const player = Player.create({
        uuid: '12345678-1234-5678-1234-567812345678',
        name: 'Steve',
        lastSeen: new Date('2026-01-01T00:00:00.000Z'),
        isOp: true,
        isBanned: false,
        isWhitelisted: true,
        online: false,
      });

      expect(player.uuid).toBe('12345678-1234-5678-1234-567812345678');
      expect(player.name).toBe('Steve');
      expect(player.lastSeen).toEqual(new Date('2026-01-01T00:00:00.000Z'));
      expect(player.isOp).toBe(true);
      expect(player.isBanned).toBe(false);
      expect(player.isWhitelisted).toBe(true);
      expect(player.online).toBe(false);
    });

    test('온라인 전용 플레이어는 uuid가 빈 문자열이어도 생성된다', () => {
      const player = Player.create({
        uuid: '',
        name: 'Alex',
        lastSeen: null,
        isOp: false,
        isBanned: false,
        isWhitelisted: false,
        online: true,
      });

      expect(player.uuid).toBe('');
      expect(player.lastSeen).toBeNull();
      expect(player.online).toBe(true);
    });

    test('빈 이름은 에러를 발생시킨다', () => {
      expect(() =>
        Player.create({
          uuid: 'uuid',
          name: '',
          lastSeen: null,
          isOp: false,
          isBanned: false,
          isWhitelisted: false,
          online: false,
        })
      ).toThrow(/Name is required/);
    });
  });

  describe('toJSON', () => {
    test('lastSeen을 ISO 문자열로 직렬화한다', () => {
      const player = Player.create({
        uuid: 'uuid',
        name: 'Steve',
        lastSeen: new Date('2026-01-01T00:00:00.000Z'),
        isOp: false,
        isBanned: false,
        isWhitelisted: false,
        online: true,
      });

      expect(player.toJSON()).toEqual({
        uuid: 'uuid',
        name: 'Steve',
        lastSeen: '2026-01-01T00:00:00.000Z',
        isOp: false,
        isBanned: false,
        isWhitelisted: false,
        online: true,
      });
    });

    test('lastSeen이 null이면 null로 직렬화한다', () => {
      const player = Player.create({
        uuid: '',
        name: 'Alex',
        lastSeen: null,
        isOp: false,
        isBanned: false,
        isWhitelisted: false,
        online: true,
      });

      expect(player.toJSON().lastSeen).toBeNull();
    });
  });
});
