import { describe, test, expect } from 'vitest';
import { ModpackOptions } from '../src/domain/value-objects/ModpackOptions.js';

describe('ModpackOptions', () => {
  describe('modrinth factory', () => {
    test('should create Modrinth modpack options with slug only', () => {
      const options = ModpackOptions.modrinth('fabric-example');

      expect(options.source).toBe('MODRINTH');
      expect(options.slug).toBe('fabric-example');
      expect(options.version).toBe(undefined);
      expect(options.loader).toBe(undefined);
    });

    test('should create Modrinth modpack options with version', () => {
      const options = ModpackOptions.modrinth('fabric-example', { version: '1.0.0' });

      expect(options.source).toBe('MODRINTH');
      expect(options.slug).toBe('fabric-example');
      expect(options.version).toBe('1.0.0');
    });

    test('should create Modrinth modpack options with loader', () => {
      const options = ModpackOptions.modrinth('fabric-example', { loader: 'fabric' });

      expect(options.source).toBe('MODRINTH');
      expect(options.slug).toBe('fabric-example');
      expect(options.loader).toBe('fabric');
    });

    test('should throw error for empty slug', () => {
      expect(() => ModpackOptions.modrinth('')).toThrow(/Modpack slug cannot be empty/);
      expect(() => ModpackOptions.modrinth('  ')).toThrow(/Modpack slug cannot be empty/);
    });
  });

  describe('curseforge factory', () => {
    test('should create CurseForge modpack options with slug only', () => {
      const options = ModpackOptions.curseforge('forge-example');

      expect(options.source).toBe('CURSEFORGE');
      expect(options.slug).toBe('forge-example');
      expect(options.version).toBe(undefined);
      expect(options.loader).toBe(undefined);
    });

    test('should create CurseForge modpack options with version', () => {
      const options = ModpackOptions.curseforge('forge-example', { version: '2.0.0' });

      expect(options.source).toBe('CURSEFORGE');
      expect(options.slug).toBe('forge-example');
      expect(options.version).toBe('2.0.0');
    });

    test('should throw error for empty slug', () => {
      expect(() => ModpackOptions.curseforge('')).toThrow(/Modpack slug cannot be empty/);
    });
  });

  describe('toEnvVars', () => {
    test('should convert Modrinth options to env vars with slug only', () => {
      const options = ModpackOptions.modrinth('fabric-example');
      const envVars = options.toEnvVars();

      expect(envVars).toEqual({
        TYPE: 'MODRINTH',
        MODRINTH_MODPACK: 'fabric-example',
      });
    });

    test('should convert Modrinth options to env vars with version', () => {
      const options = ModpackOptions.modrinth('fabric-example', { version: '1.0.0' });
      const envVars = options.toEnvVars();

      expect(envVars).toEqual({
        TYPE: 'MODRINTH',
        MODRINTH_MODPACK: 'fabric-example',
        MODRINTH_VERSION: '1.0.0',
      });
    });

    test('should convert Modrinth options to env vars with loader', () => {
      const options = ModpackOptions.modrinth('fabric-example', { loader: 'fabric' });
      const envVars = options.toEnvVars();

      expect(envVars).toEqual({
        TYPE: 'MODRINTH',
        MODRINTH_MODPACK: 'fabric-example',
        MODRINTH_LOADER: 'fabric',
      });
    });

    test('should convert CurseForge options to env vars', () => {
      const options = ModpackOptions.curseforge('forge-example', { version: '2.0.0' });
      const envVars = options.toEnvVars();

      expect(envVars).toEqual({
        TYPE: 'AUTO_CURSEFORGE',
        CF_SLUG: 'forge-example',
        CF_VERSION: '2.0.0',
      });
    });

    test('should convert Modrinth excludeFiles to MODRINTH_EXCLUDE_FILES (comma-joined)', () => {
      const options = ModpackOptions.modrinth('create-plus', {
        loader: 'neoforge',
        excludeFiles: ['statuseffectbars', 'jei'],
      });
      const envVars = options.toEnvVars();

      expect(envVars).toEqual({
        TYPE: 'MODRINTH',
        MODRINTH_MODPACK: 'create-plus',
        MODRINTH_LOADER: 'neoforge',
        MODRINTH_EXCLUDE_FILES: 'statuseffectbars,jei',
      });
    });

    test('should convert CurseForge excludeFiles to CF_EXCLUDE_MODS', () => {
      const options = ModpackOptions.curseforge('forge-example', {
        excludeFiles: ['1284599'],
      });
      const envVars = options.toEnvVars();

      expect(envVars).toEqual({
        TYPE: 'AUTO_CURSEFORGE',
        CF_SLUG: 'forge-example',
        CF_EXCLUDE_MODS: '1284599',
      });
    });

    test('should omit exclude env var when excludeFiles is empty', () => {
      const options = ModpackOptions.modrinth('create-plus', { excludeFiles: [] });
      const envVars = options.toEnvVars();

      expect(envVars).toEqual({
        TYPE: 'MODRINTH',
        MODRINTH_MODPACK: 'create-plus',
      });
    });
  });

  describe('toCliArgs', () => {
    test('should convert Modrinth options to CLI args with slug only', () => {
      const options = ModpackOptions.modrinth('fabric-example');
      const args = options.toCliArgs();

      expect(args).toEqual([
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

      expect(args).toEqual([
        '--type', 'MODRINTH',
        '--modpack-slug', 'fabric-example',
        '--modpack-version', '1.0.0',
        '--mod-loader', 'fabric',
      ]);
    });

    test('should convert CurseForge options to CLI args', () => {
      const options = ModpackOptions.curseforge('forge-example', { version: '2.0.0' });
      const args = options.toCliArgs();

      expect(args).toEqual([
        '--type', 'AUTO_CURSEFORGE',
        '--modpack-slug', 'forge-example',
        '--modpack-version', '2.0.0',
      ]);
    });

    test('should convert excludeFiles to --exclude-files CLI arg (comma-joined)', () => {
      const options = ModpackOptions.modrinth('create-plus', {
        loader: 'neoforge',
        excludeFiles: ['statuseffectbars', 'jei'],
      });
      const args = options.toCliArgs();

      expect(args).toEqual([
        '--type', 'MODRINTH',
        '--modpack-slug', 'create-plus',
        '--mod-loader', 'neoforge',
        '--exclude-files', 'statuseffectbars,jei',
      ]);
    });
  });

  describe('excludeFiles normalization', () => {
    test('should trim and drop empty entries', () => {
      const options = ModpackOptions.modrinth('create-plus', {
        excludeFiles: ['  statuseffectbars  ', '', '   ', 'jei'],
      });

      expect(options.excludeFiles).toEqual(['statuseffectbars', 'jei']);
    });

    test('should default excludeFiles to undefined when not provided', () => {
      const options = ModpackOptions.modrinth('create-plus');
      expect(options.excludeFiles).toBe(undefined);
    });
  });
});
