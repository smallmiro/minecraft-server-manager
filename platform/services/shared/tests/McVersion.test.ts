import { test, describe } from 'node:test';
import assert from 'node:assert';
import { McVersion } from '../src/domain/value-objects/McVersion.js';

describe('McVersion', () => {
  describe('recommendedJavaVersion', () => {
    test('should return 21 for MC 1.21+', () => {
      const v = McVersion.create('1.21');
      assert.strictEqual(v.recommendedJavaVersion, 21);
    });

    test('should return 21 for MC 1.21.1', () => {
      const v = McVersion.create('1.21.1');
      assert.strictEqual(v.recommendedJavaVersion, 21);
    });

    test('should return 17 for MC 1.18', () => {
      const v = McVersion.create('1.18');
      assert.strictEqual(v.recommendedJavaVersion, 17);
    });

    test('should return 16 for MC 1.17', () => {
      const v = McVersion.create('1.17');
      assert.strictEqual(v.recommendedJavaVersion, 16);
    });

    test('should return 8 for MC 1.16', () => {
      const v = McVersion.create('1.16');
      assert.strictEqual(v.recommendedJavaVersion, 8);
    });
  });

  describe('recommendedImageTag', () => {
    test('should return java21 for MC 1.21+', () => {
      const v = McVersion.create('1.21');
      assert.strictEqual(v.recommendedImageTag, 'java21');
    });

    test('should return java21 for MC 1.21.1', () => {
      const v = McVersion.create('1.21.1');
      assert.strictEqual(v.recommendedImageTag, 'java21');
    });

    test('should return java21 for MC 1.22 (hypothetical future)', () => {
      const v = McVersion.create('1.22');
      assert.strictEqual(v.recommendedImageTag, 'java21');
    });

    test('should return java17 for MC 1.18', () => {
      const v = McVersion.create('1.18');
      assert.strictEqual(v.recommendedImageTag, 'java17');
    });

    test('should return java17 for MC 1.20', () => {
      const v = McVersion.create('1.20');
      assert.strictEqual(v.recommendedImageTag, 'java17');
    });

    test('should return java17 for MC 1.17', () => {
      const v = McVersion.create('1.17');
      assert.strictEqual(v.recommendedImageTag, 'java17');
    });

    test('should return java8 for MC 1.16', () => {
      const v = McVersion.create('1.16');
      assert.strictEqual(v.recommendedImageTag, 'java8');
    });

    test('should return java8 for MC 1.12', () => {
      const v = McVersion.create('1.12');
      assert.strictEqual(v.recommendedImageTag, 'java8');
    });
  });

  describe('LATEST version', () => {
    test('should create LATEST version', () => {
      const v = McVersion.create('LATEST');
      assert.strictEqual(v.value, 'LATEST');
    });

    test('LATEST version recommendedJavaVersion is a number', () => {
      const v = McVersion.create('LATEST');
      assert.strictEqual(typeof v.recommendedJavaVersion, 'number');
    });
  });
});
