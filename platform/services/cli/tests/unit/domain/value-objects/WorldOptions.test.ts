import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { WorldOptions, WorldSetupType } from '@minecraft-docker/shared';

describe('WorldOptions Value Object', () => {
  describe('new world', () => {
    it('should create new world without seed', () => {
      const options = WorldOptions.newWorld();
      assert.strictEqual(options.setupType, WorldSetupType.NEW);
      assert.strictEqual(options.seed, undefined);
      assert.ok(options.isNewWorld);
    });

    it('should create new world with seed', () => {
      const options = WorldOptions.newWorld('12345');
      assert.strictEqual(options.setupType, WorldSetupType.NEW);
      assert.strictEqual(options.seed, '12345');
    });

    it('should accept string seed', () => {
      const options = WorldOptions.newWorld('minecraft-seed');
      assert.strictEqual(options.seed, 'minecraft-seed');
    });

    it('should reject empty seed when provided', () => {
      assert.throws(() => WorldOptions.newWorld(''), /cannot be empty/);
    });

    it('should trim seed whitespace', () => {
      const options = WorldOptions.newWorld('  12345  ');
      assert.strictEqual(options.seed, '12345');
    });
  });

  describe('existing world', () => {
    it('should create for existing world', () => {
      const options = WorldOptions.existingWorld('survival');
      assert.strictEqual(options.setupType, WorldSetupType.EXISTING);
      assert.strictEqual(options.worldName, 'survival');
      assert.ok(options.isExistingWorld);
    });

    it('should reject empty world name', () => {
      assert.throws(() => WorldOptions.existingWorld(''), /cannot be empty/);
    });

    it('should reject invalid characters', () => {
      assert.throws(() => WorldOptions.existingWorld('world/name'), /can only contain/);
      assert.throws(() => WorldOptions.existingWorld('world name'), /can only contain/);
    });

    it('should accept hyphens and underscores', () => {
      const options = WorldOptions.existingWorld('my-world_1');
      assert.strictEqual(options.worldName, 'my-world_1');
    });
  });

  describe('download world', () => {
    it('should create for download URL', () => {
      const url = 'https://example.com/world.zip';
      const options = WorldOptions.downloadWorld(url);
      assert.strictEqual(options.setupType, WorldSetupType.DOWNLOAD);
      assert.strictEqual(options.downloadUrl, url);
      assert.ok(options.isDownloadWorld);
    });

    it('should accept HTTP URL', () => {
      const options = WorldOptions.downloadWorld('http://example.com/world.zip');
      assert.ok(options.downloadUrl);
    });

    it('should reject empty URL', () => {
      assert.throws(() => WorldOptions.downloadWorld(''), /cannot be empty/);
    });

    it('should reject invalid URL', () => {
      assert.throws(() => WorldOptions.downloadWorld('not-a-url'), /Invalid download URL/);
    });

    it('should reject non-HTTP protocol', () => {
      assert.throws(() => WorldOptions.downloadWorld('ftp://example.com/world.zip'), /HTTP or HTTPS/);
    });
  });

  describe('CLI arguments', () => {
    it('should generate seed argument', () => {
      const options = WorldOptions.newWorld('12345');
      assert.deepStrictEqual(options.toCliArgs(), ['-s', '12345']);
    });

    it('should generate no args for new world without seed', () => {
      const options = WorldOptions.newWorld();
      assert.deepStrictEqual(options.toCliArgs(), []);
    });

    it('should generate world argument', () => {
      const options = WorldOptions.existingWorld('survival');
      assert.deepStrictEqual(options.toCliArgs(), ['-w', 'survival']);
    });

    it('should generate URL argument', () => {
      const options = WorldOptions.downloadWorld('https://example.com/world.zip');
      assert.deepStrictEqual(options.toCliArgs(), ['-u', 'https://example.com/world.zip']);
    });
  });

  describe('default', () => {
    it('should return new world by default', () => {
      const options = WorldOptions.default();
      assert.ok(options.isNewWorld);
      assert.strictEqual(options.seed, undefined);
    });
  });

  describe('equality', () => {
    it('should be equal for same options', () => {
      const o1 = WorldOptions.newWorld('12345');
      const o2 = WorldOptions.newWorld('12345');
      assert.ok(o1.equals(o2));
    });

    it('should not be equal for different options', () => {
      const o1 = WorldOptions.newWorld('12345');
      const o2 = WorldOptions.newWorld('67890');
      assert.ok(!o1.equals(o2));
    });

    it('should not be equal for different types', () => {
      const o1 = WorldOptions.newWorld();
      const o2 = WorldOptions.existingWorld('world');
      assert.ok(!o1.equals(o2));
    });
  });

  describe('toString', () => {
    it('should describe new world', () => {
      const options = WorldOptions.newWorld();
      assert.strictEqual(options.toString(), 'New world');
    });

    it('should describe new world with seed', () => {
      const options = WorldOptions.newWorld('12345');
      assert.ok(options.toString().includes('seed'));
    });

    it('should describe existing world', () => {
      const options = WorldOptions.existingWorld('survival');
      assert.ok(options.toString().includes('survival'));
    });

    it('should describe download', () => {
      const options = WorldOptions.downloadWorld('https://example.com/world.zip');
      assert.ok(options.toString().includes('Download'));
    });
  });
});
