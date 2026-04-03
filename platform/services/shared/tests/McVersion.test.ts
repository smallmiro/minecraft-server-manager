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

    test('LATEST version recommendedJavaVersion is a number', () => {
      const v = McVersion.create('LATEST');
      expect(typeof v.recommendedJavaVersion).toBe('number');
    });
  });
});
