import { describe, test, expect } from 'vitest';
import { McVersion } from '../src/domain/value-objects/McVersion.js';

describe('McVersion', () => {
  describe('recommendedJavaVersion', () => {
    test('should return 21 for MC 1.21+', () => {
      const v = McVersion.create('1.21');
      expect(v.recommendedJavaVersion).toBe(21);
    });

    test('should return 21 for MC 1.21.1', () => {
      const v = McVersion.create('1.21.1');
      expect(v.recommendedJavaVersion).toBe(21);
    });

    test('should return 17 for MC 1.18', () => {
      const v = McVersion.create('1.18');
      expect(v.recommendedJavaVersion).toBe(17);
    });

    test('should return 16 for MC 1.17', () => {
      const v = McVersion.create('1.17');
      expect(v.recommendedJavaVersion).toBe(16);
    });

    test('should return 8 for MC 1.16', () => {
      const v = McVersion.create('1.16');
      expect(v.recommendedJavaVersion).toBe(8);
    });
  });

  describe('recommendedImageTag', () => {
    test('should return java21 for MC 1.21+', () => {
      const v = McVersion.create('1.21');
      expect(v.recommendedImageTag).toBe('java21');
    });

    test('should return java21 for MC 1.21.1', () => {
      const v = McVersion.create('1.21.1');
      expect(v.recommendedImageTag).toBe('java21');
    });

    test('should return java21 for MC 1.22 (hypothetical future)', () => {
      const v = McVersion.create('1.22');
      expect(v.recommendedImageTag).toBe('java21');
    });

    test('should return java17 for MC 1.18', () => {
      const v = McVersion.create('1.18');
      expect(v.recommendedImageTag).toBe('java17');
    });

    test('should return java17 for MC 1.20', () => {
      const v = McVersion.create('1.20');
      expect(v.recommendedImageTag).toBe('java17');
    });

    test('should return java17 for MC 1.17', () => {
      const v = McVersion.create('1.17');
      expect(v.recommendedImageTag).toBe('java17');
    });

    test('should return java8 for MC 1.16', () => {
      const v = McVersion.create('1.16');
      expect(v.recommendedImageTag).toBe('java8');
    });

    test('should return java8 for MC 1.12', () => {
      const v = McVersion.create('1.12');
      expect(v.recommendedImageTag).toBe('java8');
    });
  });

  // Minecraft 1.20.5 moved to Java 21 (docs/itzg-reference/07-java-versions.md, #826)
  describe('Java boundaries', () => {
    test.each([
      ['1.16.5', 8, 'java8'],
      ['1.17.1', 16, 'java17'],
      ['1.18', 17, 'java17'],
      ['1.20.4', 17, 'java17'],
      ['1.20.5', 21, 'java21'],
      ['1.20.6', 21, 'java21'],
      ['1.21', 21, 'java21'],
      ['1.21.4', 21, 'java21'],
    ])('%s needs Java %i (%s)', (value, java, tag) => {
      const v = McVersion.create(value);
      expect(v.recommendedJavaVersion).toBe(java);
      expect(v.recommendedImageTag).toBe(tag);
    });
  });

  describe('MC 26.x (new versioning)', () => {
    test('should create version 26.1.1', () => {
      const v = McVersion.create('26.1.1');
      expect(v.value).toBe('26.1.1');
      expect(v.major).toBe(26);
      expect(v.minor).toBe(1);
      expect(v.patch).toBe(1);
    });

    test('should return 25 for recommendedJavaVersion', () => {
      const v = McVersion.create('26.1.1');
      expect(v.recommendedJavaVersion).toBe(25);
    });

    test('should return java25 for recommendedImageTag', () => {
      const v = McVersion.create('26.1.1');
      expect(v.recommendedImageTag).toBe('java25');
    });

    test('should create version 26.0', () => {
      const v = McVersion.create('26.0');
      expect(v.major).toBe(26);
      expect(v.recommendedImageTag).toBe('java25');
    });

    test('should handle hypothetical 27.x', () => {
      const v = McVersion.create('27.0.1');
      expect(v.recommendedJavaVersion).toBe(25);
      expect(v.recommendedImageTag).toBe('java25');
    });
  });

  describe('LATEST version', () => {
    test('should create LATEST version', () => {
      const v = McVersion.create('LATEST');
      expect(v.value).toBe('LATEST');
    });

    test('LATEST needs the newest Java (#826)', () => {
      const v = McVersion.create('LATEST');
      expect(v.recommendedJavaVersion).toBe(25);
      expect(v.recommendedImageTag).toBe('java25');
    });
  });

  // A VERSION read from a server must not hide it (#826)
  describe('fromExisting', () => {
    test('reads a release like create', () => {
      expect(McVersion.fromExisting('1.20.6').equals(McVersion.create('1.20.6'))).toBe(true);
      expect(McVersion.fromExisting('1.20.6').recommendedImageTag).toBe('java21');
    });

    test.each(['24w14a', '1.20.5-rc1'])('keeps %s as text, on the newest Java', (value) => {
      const v = McVersion.fromExisting(value);
      expect(v.value).toBe(value);
      expect(v.recommendedJavaVersion).toBe(25);
      expect(v.recommendedImageTag).toBe('java25');
    });

    test('create still refuses it', () => {
      expect(() => McVersion.create('24w14a')).toThrow(/Invalid Minecraft version format/);
    });
  });
});
