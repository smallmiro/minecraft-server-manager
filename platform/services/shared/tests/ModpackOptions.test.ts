import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ModpackOptions } from '../src/domain/value-objects/ModpackOptions.js';

describe('ModpackOptions', () => {
  describe('modrinth factory', () => {
    test('should create Modrinth modpack options with slug only', () => {
      const options = ModpackOptions.modrinth('fabric-example');

      assert.strictEqual(options.source, 'MODRINTH');
      assert.strictEqual(options.slug, 'fabric-example');
      assert.strictEqual(options.version, undefined);
      assert.strictEqual(options.loader, undefined);
    });

    test('should create Modrinth modpack options with version', () => {
      const options = ModpackOptions.modrinth('fabric-example', { version: '1.0.0' });

      assert.strictEqual(options.source, 'MODRINTH');
      assert.strictEqual(options.slug, 'fabric-example');
      assert.strictEqual(options.version, '1.0.0');
    });

    test('should create Modrinth modpack options with loader', () => {
      const options = ModpackOptions.modrinth('fabric-example', { loader: 'fabric' });

      assert.strictEqual(options.source, 'MODRINTH');
      assert.strictEqual(options.slug, 'fabric-example');
      assert.strictEqual(options.loader, 'fabric');
    });

    test('should throw error for empty slug', () => {
      assert.throws(() => ModpackOptions.modrinth(''), /Modpack slug cannot be empty/);
      assert.throws(() => ModpackOptions.modrinth('  '), /Modpack slug cannot be empty/);
    });
  });

  describe('curseforge factory', () => {
    test('should create CurseForge modpack options with slug only', () => {
      const options = ModpackOptions.curseforge('forge-example');

      assert.strictEqual(options.source, 'CURSEFORGE');
      assert.strictEqual(options.slug, 'forge-example');
      assert.strictEqual(options.version, undefined);
      assert.strictEqual(options.loader, undefined);
    });

    test('should create CurseForge modpack options with version', () => {
      const options = ModpackOptions.curseforge('forge-example', { version: '2.0.0' });

      assert.strictEqual(options.source, 'CURSEFORGE');
      assert.strictEqual(options.slug, 'forge-example');
      assert.strictEqual(options.version, '2.0.0');
    });

    test('should throw error for empty slug', () => {
      assert.throws(() => ModpackOptions.curseforge(''), /Modpack slug cannot be empty/);
    });
  });

  describe('toEnvVars', () => {
    test('should convert Modrinth options to env vars with slug only', () => {
      const options = ModpackOptions.modrinth('fabric-example');
      const envVars = options.toEnvVars();

      assert.deepStrictEqual(envVars, {
        TYPE: 'MODRINTH',
        MODRINTH_MODPACK: 'fabric-example',
      });
    });

    test('should convert Modrinth options to env vars with version', () => {
      const options = ModpackOptions.modrinth('fabric-example', { version: '1.0.0' });
      const envVars = options.toEnvVars();

      assert.deepStrictEqual(envVars, {
        TYPE: 'MODRINTH',
        MODRINTH_MODPACK: 'fabric-example',
        MODRINTH_VERSION: '1.0.0',
      });
    });

    test('should convert Modrinth options to env vars with loader', () => {
      const options = ModpackOptions.modrinth('fabric-example', { loader: 'fabric' });
      const envVars = options.toEnvVars();

      assert.deepStrictEqual(envVars, {
        TYPE: 'MODRINTH',
        MODRINTH_MODPACK: 'fabric-example',
        MODRINTH_LOADER: 'fabric',
      });
    });

    test('should convert CurseForge options to env vars', () => {
      const options = ModpackOptions.curseforge('forge-example', { version: '2.0.0' });
      const envVars = options.toEnvVars();

      assert.deepStrictEqual(envVars, {
        TYPE: 'AUTO_CURSEFORGE',
        CF_SLUG: 'forge-example',
        CF_VERSION: '2.0.0',
      });
    });
  });

  describe('toCliArgs', () => {
    test('should convert Modrinth options to CLI args with slug only', () => {
      const options = ModpackOptions.modrinth('fabric-example');
      const args = options.toCliArgs();

      assert.deepStrictEqual(args, [
        '--type', 'MODRINTH',
        '--modpack-slug', 'fabric-example',
      ]);
    });

    test('should convert Modrinth options to CLI args with all options', () => {
      const options = ModpackOptions.modrinth('fabric-example', {
        version: '1.0.0',
        loader: 'fabric'
      });
      const args = options.toCliArgs();

      assert.deepStrictEqual(args, [
        '--type', 'MODRINTH',
        '--modpack-slug', 'fabric-example',
        '--modpack-version', '1.0.0',
        '--mod-loader', 'fabric',
      ]);
    });

    test('should convert CurseForge options to CLI args', () => {
      const options = ModpackOptions.curseforge('forge-example', { version: '2.0.0' });
      const args = options.toCliArgs();

      assert.deepStrictEqual(args, [
        '--type', 'AUTO_CURSEFORGE',
        '--modpack-slug', 'forge-example',
        '--modpack-version', '2.0.0',
      ]);
    });
  });
});
