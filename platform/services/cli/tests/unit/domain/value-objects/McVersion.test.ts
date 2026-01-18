import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { McVersion } from '@minecraft-docker/shared';

describe('McVersion Value Object', () => {
  describe('valid versions', () => {
    it('should accept X.Y format', () => {
      const version = McVersion.create('1.21');
      assert.strictEqual(version.value, '1.21');
      assert.strictEqual(version.major, 1);
      assert.strictEqual(version.minor, 21);
      assert.strictEqual(version.patch, 0);
    });

    it('should accept X.Y.Z format', () => {
      const version = McVersion.create('1.21.1');
      assert.strictEqual(version.value, '1.21.1');
      assert.strictEqual(version.major, 1);
      assert.strictEqual(version.minor, 21);
      assert.strictEqual(version.patch, 1);
    });

    it('should accept LATEST keyword', () => {
      const version = McVersion.create('LATEST');
      assert.strictEqual(version.value, 'LATEST');
    });

    it('should accept lowercase latest', () => {
      const version = McVersion.create('latest');
      assert.strictEqual(version.value, 'LATEST');
    });

    it('should trim whitespace', () => {
      const version = McVersion.create('  1.20.4  ');
      assert.strictEqual(version.value, '1.20.4');
    });
  });

  describe('invalid versions', () => {
    it('should reject empty string', () => {
      assert.throws(() => McVersion.create(''), /Invalid Minecraft version/);
    });

    it('should reject invalid format', () => {
      assert.throws(() => McVersion.create('1'), /Invalid Minecraft version/);
      assert.throws(() => McVersion.create('1.2.3.4'), /Invalid Minecraft version/);
      assert.throws(() => McVersion.create('abc'), /Invalid Minecraft version/);
    });

    it('should reject major version 0', () => {
      assert.throws(() => McVersion.create('0.1.0'), /major version must be at least 1/);
    });
  });

  describe('Java version recommendation', () => {
    it('should recommend Java 21 for 1.21+', () => {
      const version = McVersion.create('1.21.1');
      assert.strictEqual(version.recommendedJavaVersion, 21);
    });

    it('should recommend Java 17 for 1.18-1.20', () => {
      const version = McVersion.create('1.20.4');
      assert.strictEqual(version.recommendedJavaVersion, 17);
    });

    it('should recommend Java 16 for 1.17', () => {
      const version = McVersion.create('1.17');
      assert.strictEqual(version.recommendedJavaVersion, 16);
    });

    it('should recommend Java 8 for older versions', () => {
      const version = McVersion.create('1.16.5');
      assert.strictEqual(version.recommendedJavaVersion, 8);
    });
  });

  describe('version comparison', () => {
    it('should compare versions correctly', () => {
      const v1 = McVersion.create('1.20.4');
      const v2 = McVersion.create('1.21.1');

      assert.ok(v1.isOlderThan(v2));
      assert.ok(v2.isNewerThan(v1));
    });

    it('should consider LATEST as newest', () => {
      const latest = McVersion.create('LATEST');
      const specific = McVersion.create('1.21.1');

      assert.ok(latest.isNewerThan(specific));
      assert.ok(specific.isOlderThan(latest));
    });

    it('should compare patch versions', () => {
      const v1 = McVersion.create('1.21.0');
      const v2 = McVersion.create('1.21.1');

      assert.ok(v1.isOlderThan(v2));
    });
  });

  describe('static methods', () => {
    it('should create LATEST version', () => {
      const version = McVersion.latest();
      assert.strictEqual(version.value, 'LATEST');
    });
  });

  describe('equality', () => {
    it('should be equal for same version', () => {
      const v1 = McVersion.create('1.21.1');
      const v2 = McVersion.create('1.21.1');
      assert.ok(v1.equals(v2));
    });

    it('should not be equal for different versions', () => {
      const v1 = McVersion.create('1.21.0');
      const v2 = McVersion.create('1.21.1');
      assert.ok(!v1.equals(v2));
    });
  });
});
