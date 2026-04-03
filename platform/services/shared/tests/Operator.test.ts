import { describe, test, expect } from 'vitest';
import { Operator } from '../src/domain/entities/Operator.js';
import { OpLevel } from '../src/domain/value-objects/OpLevel.js';

describe('Operator', () => {
  describe('create', () => {
    test('필수 필드로 Operator를 생성한다', () => {
      const operator = Operator.create({
        uuid: '12345678-1234-5678-1234-567812345678',
        name: 'TestPlayer',
        level: OpLevel.ADMIN,
      });

      expect(operator.uuid).toBe('12345678-1234-5678-1234-567812345678');
      expect(operator.name).toBe('TestPlayer');
      expect(operator.level).toBe(OpLevel.ADMIN);
      expect(operator.bypassesPlayerLimit).toBe(false); // 기본값
    });

    test('bypassesPlayerLimit 옵션을 포함하여 생성한다', () => {
      const operator = Operator.create({
        uuid: '12345678-1234-5678-1234-567812345678',
        name: 'Owner',
        level: OpLevel.OWNER,
        bypassesPlayerLimit: true,
      });

      expect(operator.bypassesPlayerLimit).toBe(true);
    });

    test('빈 UUID는 에러를 발생시킨다', () => {
      expect(() =>
          Operator.create({
            uuid: '',
            name: 'Player',
            level: OpLevel.MODERATOR,
          })).toThrow(/UUID is required/);
    });

    test('빈 이름은 에러를 발생시킨다', () => {
      expect(() =>
          Operator.create({
            uuid: '12345678-1234-5678-1234-567812345678',
            name: '',
            level: OpLevel.MODERATOR,
          })).toThrow(/Name is required/);
    });
  });

  describe('fromMinecraftOpsJson', () => {
    test('Minecraft ops.json 형식에서 Operator를 생성한다', () => {
      const operator = Operator.fromMinecraftOpsJson({
        uuid: '12345678-1234-5678-1234-567812345678',
        name: 'Admin',
        level: 4,
        bypassesPlayerLimit: false,
      });

      expect(operator.uuid).toBe('12345678-1234-5678-1234-567812345678');
      expect(operator.name).toBe('Admin');
      expect(operator.level).toBe(OpLevel.OWNER);
      expect(operator.bypassesPlayerLimit).toBe(false);
    });

    test('각 레벨(1-4)이 올바르게 변환된다', () => {
      const ops = [
        { uuid: 'uuid1', name: 'Mod', level: 1, bypassesPlayerLimit: false },
        { uuid: 'uuid2', name: 'GM', level: 2, bypassesPlayerLimit: false },
        { uuid: 'uuid3', name: 'Admin', level: 3, bypassesPlayerLimit: false },
        { uuid: 'uuid4', name: 'Owner', level: 4, bypassesPlayerLimit: false },
      ];

      const op1 = Operator.fromMinecraftOpsJson(ops[0]);
      const op2 = Operator.fromMinecraftOpsJson(ops[1]);
      const op3 = Operator.fromMinecraftOpsJson(ops[2]);
      const op4 = Operator.fromMinecraftOpsJson(ops[3]);

      expect(op1.level).toBe(OpLevel.MODERATOR);
      expect(op2.level).toBe(OpLevel.GAMEMASTER);
      expect(op3.level).toBe(OpLevel.ADMIN);
      expect(op4.level).toBe(OpLevel.OWNER);
    });
  });

  describe('toMinecraftOpsJson', () => {
    test('Minecraft ops.json 형식으로 변환한다', () => {
      const operator = Operator.create({
        uuid: '12345678-1234-5678-1234-567812345678',
        name: 'Admin',
        level: OpLevel.ADMIN,
        bypassesPlayerLimit: true,
      });

      const json = operator.toMinecraftOpsJson();

      expect(json).toEqual({
        uuid: '12345678-1234-5678-1234-567812345678',
        name: 'Admin',
        level: 3,
        bypassesPlayerLimit: true,
      });
    });
  });

  describe('updateLevel', () => {
    test('OP 레벨을 변경한다', () => {
      const operator = Operator.create({
        uuid: '12345678-1234-5678-1234-567812345678',
        name: 'Player',
        level: OpLevel.MODERATOR,
      });

      operator.updateLevel(OpLevel.ADMIN);

      expect(operator.level).toBe(OpLevel.ADMIN);
    });
  });

  describe('setBypassesPlayerLimit', () => {
    test('플레이어 제한 우회 설정을 변경한다', () => {
      const operator = Operator.create({
        uuid: '12345678-1234-5678-1234-567812345678',
        name: 'Player',
        level: OpLevel.OWNER,
      });

      expect(operator.bypassesPlayerLimit).toBe(false);

      operator.setBypassesPlayerLimit(true);

      expect(operator.bypassesPlayerLimit).toBe(true);
    });
  });

  describe('hasPermission', () => {
    test('MODERATOR는 레벨 1 권한을 가진다', () => {
      const operator = Operator.create({
        uuid: 'uuid',
        name: 'Mod',
        level: OpLevel.MODERATOR,
      });

      expect(operator.hasPermission(OpLevel.MODERATOR)).toBe(true);
      expect(operator.hasPermission(OpLevel.GAMEMASTER)).toBe(false);
    });

    test('OWNER는 모든 레벨의 권한을 가진다', () => {
      const operator = Operator.create({
        uuid: 'uuid',
        name: 'Owner',
        level: OpLevel.OWNER,
      });

      expect(operator.hasPermission(OpLevel.MODERATOR)).toBe(true);
      expect(operator.hasPermission(OpLevel.GAMEMASTER)).toBe(true);
      expect(operator.hasPermission(OpLevel.ADMIN)).toBe(true);
      expect(operator.hasPermission(OpLevel.OWNER)).toBe(true);
    });

    test('ADMIN은 OWNER 권한을 가지지 않는다', () => {
      const operator = Operator.create({
        uuid: 'uuid',
        name: 'Admin',
        level: OpLevel.ADMIN,
      });

      expect(operator.hasPermission(OpLevel.MODERATOR)).toBe(true);
      expect(operator.hasPermission(OpLevel.GAMEMASTER)).toBe(true);
      expect(operator.hasPermission(OpLevel.ADMIN)).toBe(true);
      expect(operator.hasPermission(OpLevel.OWNER)).toBe(false);
    });
  });
});
