import { test, describe } from 'node:test';
import assert from 'node:assert';
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

      assert.strictEqual(operator.uuid, '12345678-1234-5678-1234-567812345678');
      assert.strictEqual(operator.name, 'TestPlayer');
      assert.strictEqual(operator.level, OpLevel.ADMIN);
      assert.strictEqual(operator.bypassesPlayerLimit, false); // 기본값
    });

    test('bypassesPlayerLimit 옵션을 포함하여 생성한다', () => {
      const operator = Operator.create({
        uuid: '12345678-1234-5678-1234-567812345678',
        name: 'Owner',
        level: OpLevel.OWNER,
        bypassesPlayerLimit: true,
      });

      assert.strictEqual(operator.bypassesPlayerLimit, true);
    });

    test('빈 UUID는 에러를 발생시킨다', () => {
      assert.throws(
        () =>
          Operator.create({
            uuid: '',
            name: 'Player',
            level: OpLevel.MODERATOR,
          }),
        /UUID is required/
      );
    });

    test('빈 이름은 에러를 발생시킨다', () => {
      assert.throws(
        () =>
          Operator.create({
            uuid: '12345678-1234-5678-1234-567812345678',
            name: '',
            level: OpLevel.MODERATOR,
          }),
        /Name is required/
      );
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

      assert.strictEqual(operator.uuid, '12345678-1234-5678-1234-567812345678');
      assert.strictEqual(operator.name, 'Admin');
      assert.strictEqual(operator.level, OpLevel.OWNER);
      assert.strictEqual(operator.bypassesPlayerLimit, false);
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

      assert.strictEqual(op1.level, OpLevel.MODERATOR);
      assert.strictEqual(op2.level, OpLevel.GAMEMASTER);
      assert.strictEqual(op3.level, OpLevel.ADMIN);
      assert.strictEqual(op4.level, OpLevel.OWNER);
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

      assert.deepStrictEqual(json, {
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

      assert.strictEqual(operator.level, OpLevel.ADMIN);
    });
  });

  describe('setBypassesPlayerLimit', () => {
    test('플레이어 제한 우회 설정을 변경한다', () => {
      const operator = Operator.create({
        uuid: '12345678-1234-5678-1234-567812345678',
        name: 'Player',
        level: OpLevel.OWNER,
      });

      assert.strictEqual(operator.bypassesPlayerLimit, false);

      operator.setBypassesPlayerLimit(true);

      assert.strictEqual(operator.bypassesPlayerLimit, true);
    });
  });

  describe('hasPermission', () => {
    test('MODERATOR는 레벨 1 권한을 가진다', () => {
      const operator = Operator.create({
        uuid: 'uuid',
        name: 'Mod',
        level: OpLevel.MODERATOR,
      });

      assert.strictEqual(operator.hasPermission(OpLevel.MODERATOR), true);
      assert.strictEqual(operator.hasPermission(OpLevel.GAMEMASTER), false);
    });

    test('OWNER는 모든 레벨의 권한을 가진다', () => {
      const operator = Operator.create({
        uuid: 'uuid',
        name: 'Owner',
        level: OpLevel.OWNER,
      });

      assert.strictEqual(operator.hasPermission(OpLevel.MODERATOR), true);
      assert.strictEqual(operator.hasPermission(OpLevel.GAMEMASTER), true);
      assert.strictEqual(operator.hasPermission(OpLevel.ADMIN), true);
      assert.strictEqual(operator.hasPermission(OpLevel.OWNER), true);
    });

    test('ADMIN은 OWNER 권한을 가지지 않는다', () => {
      const operator = Operator.create({
        uuid: 'uuid',
        name: 'Admin',
        level: OpLevel.ADMIN,
      });

      assert.strictEqual(operator.hasPermission(OpLevel.MODERATOR), true);
      assert.strictEqual(operator.hasPermission(OpLevel.GAMEMASTER), true);
      assert.strictEqual(operator.hasPermission(OpLevel.ADMIN), true);
      assert.strictEqual(operator.hasPermission(OpLevel.OWNER), false);
    });
  });
});
