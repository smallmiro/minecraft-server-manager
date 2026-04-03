import { test, describe } from 'node:test';
import assert from 'node:assert';
import { McVersion } from '../src/domain/value-objects/McVersion.js';

describe('McVersion', () => {
  describe('create - basic validation', () => {
    test('should create version 1.21.1', () => {
      const v = McVersion.create('1.21.1');
      assert.strictEqual(v.value, '1.21.1');
      assert.strictEqual(v.major, 1);
      assert.strictEqual(v.minor, 21);
      assert.strictEqual(v.patch, 1);
    });

    test('should create version 1.20', () => {
      const v = McVersion.create('1.20');
      assert.strictEqual(v.value, '1.20');
      assert.strictEqual(v.major, 1);
      assert.strictEqual(v.minor, 20);
      assert.strictEqual(v.patch, 0);
    });

    test('should create LATEST', () => {
      const v = McVersion.create('LATEST');
      assert.strictEqual(v.value, 'LATEST');
    });

    test('should reject invalid format', () => {
      assert.throws(() => McVersion.create('invalid'), /Invalid Minecraft version format/);
    });

    test('should reject major version 0', () => {
      assert.throws(() => McVersion.create('0.21.1'), /major version must be at least 1/);
    });
  });

  describe('create - Minecraft 26.x new versioning', () => {
    test('should create version 26.1.1', () => {
      const v = McVersion.create('26.1.1');
      assert.strictEqual(v.value, '26.1.1');
      assert.strictEqual(v.major, 26);
      assert.strictEqual(v.minor, 1);
      assert.strictEqual(v.patch, 1);
    });

    test('should create version 26.0', () => {
      const v = McVersion.create('26.0');
      assert.strictEqual(v.major, 26);
      assert.strictEqual(v.minor, 0);
    });

    test('should create version 27.0.0', () => {
      const v = McVersion.create('27.0.0');
      assert.strictEqual(v.major, 27);
    });
  });

  describe('recommendedJavaVersion', () => {
    test('1.21.1 requires Java 21', () => {
      assert.strictEqual(McVersion.create('1.21.1').recommendedJavaVersion, 21);
    });

    test('1.21 requires Java 21', () => {
      assert.strictEqual(McVersion.create('1.21').recommendedJavaVersion, 21);
    });

    test('1.20.4 requires Java 17', () => {
      assert.strictEqual(McVersion.create('1.20.4').recommendedJavaVersion, 17);
    });

    test('1.18 requires Java 17', () => {
      assert.strictEqual(McVersion.create('1.18').recommendedJavaVersion, 17);
    });

    test('1.17 requires Java 16', () => {
      assert.strictEqual(McVersion.create('1.17').recommendedJavaVersion, 16);
    });

    test('1.16 requires Java 8', () => {
      assert.strictEqual(McVersion.create('1.16').recommendedJavaVersion, 8);
    });

    test('26.1.1 requires Java 25', () => {
      assert.strictEqual(McVersion.create('26.1.1').recommendedJavaVersion, 25);
    });

    test('26.0 requires Java 25', () => {
      assert.strictEqual(McVersion.create('26.0').recommendedJavaVersion, 25);
    });

    test('27.0.0 requires Java 25', () => {
      assert.strictEqual(McVersion.create('27.0.0').recommendedJavaVersion, 25);
    });
  });

  describe('recommendedImageTag', () => {
    test('1.21.1 uses java21 image tag', () => {
      assert.strictEqual(McVersion.create('1.21.1').recommendedImageTag, 'java21');
    });

    test('1.20.4 uses java17 image tag', () => {
      assert.strictEqual(McVersion.create('1.20.4').recommendedImageTag, 'java17');
    });

    test('1.18 uses java17 image tag', () => {
      assert.strictEqual(McVersion.create('1.18').recommendedImageTag, 'java17');
    });

    test('1.17 uses java17 image tag', () => {
      assert.strictEqual(McVersion.create('1.17').recommendedImageTag, 'java17');
    });

    test('1.16 uses java8 image tag', () => {
      assert.strictEqual(McVersion.create('1.16').recommendedImageTag, 'java8');
    });

    test('26.1.1 uses java25 image tag', () => {
      assert.strictEqual(McVersion.create('26.1.1').recommendedImageTag, 'java25');
    });

    test('26.0 uses java25 image tag', () => {
      assert.strictEqual(McVersion.create('26.0').recommendedImageTag, 'java25');
    });

    test('27.0.0 uses java25 image tag', () => {
      assert.strictEqual(McVersion.create('27.0.0').recommendedImageTag, 'java25');
    });
  });

  describe('isCompatibleWithJava', () => {
    test('26.1.1 is compatible with Java 25', () => {
      assert.strictEqual(McVersion.create('26.1.1').isCompatibleWithJava(25), true);
    });

    test('26.1.1 is not compatible with Java 21', () => {
      assert.strictEqual(McVersion.create('26.1.1').isCompatibleWithJava(21), false);
    });

    test('1.21.1 is compatible with Java 21', () => {
      assert.strictEqual(McVersion.create('1.21.1').isCompatibleWithJava(21), true);
    });

    test('1.21.1 is compatible with Java 25 (higher version)', () => {
      assert.strictEqual(McVersion.create('1.21.1').isCompatibleWithJava(25), true);
    });
  });

  describe('compareTo', () => {
    test('26.1.1 is newer than 1.21.1', () => {
      const v26 = McVersion.create('26.1.1');
      const v121 = McVersion.create('1.21.1');
      assert.strictEqual(v26.isNewerThan(v121), true);
    });

    test('LATEST is newer than 26.1.1', () => {
      const latest = McVersion.create('LATEST');
      const v26 = McVersion.create('26.1.1');
      assert.strictEqual(latest.isNewerThan(v26), true);
    });
  });
});
