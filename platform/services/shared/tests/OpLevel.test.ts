import { test, describe } from 'node:test';
import assert from 'node:assert';
import { OpLevel } from '../src/domain/value-objects/OpLevel.js';

describe('OpLevel', () => {
  describe('static constants', () => {
    test('MODERATOR는 레벨 1', () => {
      assert.strictEqual(OpLevel.MODERATOR.value, 1);
      assert.strictEqual(OpLevel.MODERATOR.label, 'Moderator');
    });

    test('GAMEMASTER는 레벨 2', () => {
      assert.strictEqual(OpLevel.GAMEMASTER.value, 2);
      assert.strictEqual(OpLevel.GAMEMASTER.label, 'Gamemaster');
    });

    test('ADMIN은 레벨 3', () => {
      assert.strictEqual(OpLevel.ADMIN.value, 3);
      assert.strictEqual(OpLevel.ADMIN.label, 'Admin');
    });

    test('OWNER는 레벨 4', () => {
      assert.strictEqual(OpLevel.OWNER.value, 4);
      assert.strictEqual(OpLevel.OWNER.label, 'Owner');
    });
  });

  describe('from()', () => {
    test('유효한 레벨(1-4)로 OpLevel을 생성한다', () => {
      assert.strictEqual(OpLevel.from(1).value, 1);
      assert.strictEqual(OpLevel.from(2).value, 2);
      assert.strictEqual(OpLevel.from(3).value, 3);
      assert.strictEqual(OpLevel.from(4).value, 4);
    });

    test('1보다 작은 레벨은 에러를 발생시킨다', () => {
      assert.throws(
        () => OpLevel.from(0),
        /Invalid OP level: 0\. Must be between 1 and 4/
      );
      assert.throws(
        () => OpLevel.from(-1),
        /Invalid OP level: -1\. Must be between 1 and 4/
      );
    });

    test('4보다 큰 레벨은 에러를 발생시킨다', () => {
      assert.throws(
        () => OpLevel.from(5),
        /Invalid OP level: 5\. Must be between 1 and 4/
      );
    });

    test('정수가 아닌 값은 에러를 발생시킨다', () => {
      assert.throws(
        () => OpLevel.from(1.5),
        /Invalid OP level: 1\.5\. Must be between 1 and 4/
      );
    });
  });

  describe('description', () => {
    test('MODERATOR 설명을 반환한다', () => {
      assert.strictEqual(
        OpLevel.MODERATOR.description,
        'Bypass spawn protection, interact with blocks in protected areas'
      );
    });

    test('GAMEMASTER 설명을 반환한다', () => {
      assert.strictEqual(
        OpLevel.GAMEMASTER.description,
        'Level 1 + /gamemode, /give, /summon, /clear, command blocks'
      );
    });

    test('ADMIN 설명을 반환한다', () => {
      assert.strictEqual(
        OpLevel.ADMIN.description,
        'Level 2 + /op, /deop, /kick, /ban, /whitelist'
      );
    });

    test('OWNER 설명을 반환한다', () => {
      assert.strictEqual(
        OpLevel.OWNER.description,
        'Level 3 + /stop, /save-all, /save-on, /save-off, full server control'
      );
    });
  });

  describe('equals()', () => {
    test('같은 레벨끼리는 equal이다', () => {
      assert.strictEqual(OpLevel.MODERATOR.equals(OpLevel.from(1)), true);
      assert.strictEqual(OpLevel.GAMEMASTER.equals(OpLevel.from(2)), true);
      assert.strictEqual(OpLevel.ADMIN.equals(OpLevel.from(3)), true);
      assert.strictEqual(OpLevel.OWNER.equals(OpLevel.from(4)), true);
    });

    test('다른 레벨끼리는 equal이 아니다', () => {
      assert.strictEqual(OpLevel.MODERATOR.equals(OpLevel.GAMEMASTER), false);
      assert.strictEqual(OpLevel.ADMIN.equals(OpLevel.OWNER), false);
    });
  });

  describe('toString()', () => {
    test('레벨과 라벨을 문자열로 반환한다', () => {
      assert.strictEqual(OpLevel.MODERATOR.toString(), '1 (Moderator)');
      assert.strictEqual(OpLevel.GAMEMASTER.toString(), '2 (Gamemaster)');
      assert.strictEqual(OpLevel.ADMIN.toString(), '3 (Admin)');
      assert.strictEqual(OpLevel.OWNER.toString(), '4 (Owner)');
    });
  });
});
