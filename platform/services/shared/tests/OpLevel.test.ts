import { describe, test, expect } from 'vitest';
import { OpLevel } from '../src/domain/value-objects/OpLevel.js';

describe('OpLevel', () => {
  describe('static constants', () => {
    test('MODERATOR는 레벨 1', () => {
      expect(OpLevel.MODERATOR.value).toBe(1);
      expect(OpLevel.MODERATOR.label).toBe('Moderator');
    });

    test('GAMEMASTER는 레벨 2', () => {
      expect(OpLevel.GAMEMASTER.value).toBe(2);
      expect(OpLevel.GAMEMASTER.label).toBe('Gamemaster');
    });

    test('ADMIN은 레벨 3', () => {
      expect(OpLevel.ADMIN.value).toBe(3);
      expect(OpLevel.ADMIN.label).toBe('Admin');
    });

    test('OWNER는 레벨 4', () => {
      expect(OpLevel.OWNER.value).toBe(4);
      expect(OpLevel.OWNER.label).toBe('Owner');
    });
  });

  describe('from()', () => {
    test('유효한 레벨(1-4)로 OpLevel을 생성한다', () => {
      expect(OpLevel.from(1).value).toBe(1);
      expect(OpLevel.from(2).value).toBe(2);
      expect(OpLevel.from(3).value).toBe(3);
      expect(OpLevel.from(4).value).toBe(4);
    });

    test('1보다 작은 레벨은 에러를 발생시킨다', () => {
      expect(() => OpLevel.from(0)).toThrow(/Invalid OP level: 0\. Must be between 1 and 4/);
      expect(() => OpLevel.from(-1)).toThrow(/Invalid OP level: -1\. Must be between 1 and 4/);
    });

    test('4보다 큰 레벨은 에러를 발생시킨다', () => {
      expect(() => OpLevel.from(5)).toThrow(/Invalid OP level: 5\. Must be between 1 and 4/);
    });

    test('정수가 아닌 값은 에러를 발생시킨다', () => {
      expect(() => OpLevel.from(1.5)).toThrow(/Invalid OP level: 1\.5\. Must be between 1 and 4/);
    });
  });

  describe('description', () => {
    test('MODERATOR 설명을 반환한다', () => {
      expect(OpLevel.MODERATOR.description,
        'Bypass spawn protection).toBe(interact with blocks in protected areas');
    });

    test('GAMEMASTER 설명을 반환한다', () => {
      expect(OpLevel.GAMEMASTER.description,
        'Level 1 + /gamemode, /give, /summon, /clear).toBe(command blocks');
    });

    test('ADMIN 설명을 반환한다', () => {
      expect(OpLevel.ADMIN.description,
        'Level 2 + /op, /deop, /kick, /ban).toBe(/whitelist');
    });

    test('OWNER 설명을 반환한다', () => {
      expect(OpLevel.OWNER.description,
        'Level 3 + /stop, /save-all, /save-on, /save-off).toBe(full server control');
    });
  });

  describe('equals()', () => {
    test('같은 레벨끼리는 equal이다', () => {
      expect(OpLevel.MODERATOR.equals(OpLevel.from(1))).toBe(true);
      expect(OpLevel.GAMEMASTER.equals(OpLevel.from(2))).toBe(true);
      expect(OpLevel.ADMIN.equals(OpLevel.from(3))).toBe(true);
      expect(OpLevel.OWNER.equals(OpLevel.from(4))).toBe(true);
    });

    test('다른 레벨끼리는 equal이 아니다', () => {
      expect(OpLevel.MODERATOR.equals(OpLevel.GAMEMASTER)).toBe(false);
      expect(OpLevel.ADMIN.equals(OpLevel.OWNER)).toBe(false);
    });
  });

  describe('toString()', () => {
    test('레벨과 라벨을 문자열로 반환한다', () => {
      expect(OpLevel.MODERATOR.toString()).toBe('1 (Moderator)');
      expect(OpLevel.GAMEMASTER.toString()).toBe('2 (Gamemaster)');
      expect(OpLevel.ADMIN.toString()).toBe('3 (Admin)');
      expect(OpLevel.OWNER.toString()).toBe('4 (Owner)');
    });
  });
});
