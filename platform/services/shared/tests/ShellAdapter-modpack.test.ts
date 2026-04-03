import { describe, test, expect } from 'vitest';
import { ServerName, ServerType, ServerTypeEnum, McVersion, WorldOptions } from '../src/domain/index.js';
import type { CreateServerOptions } from '../src/application/ports/outbound/IShellPort.js';

/**
 * ShellAdapter Modpack Unit Tests
 *
 * These tests verify that CreateServerOptions correctly support modpack fields.
 * The actual script integration is tested in CLI/E2E tests.
 */
describe('ShellAdapter - Modpack Support', () => {
  describe('CreateServerOptions interface', () => {
    test('should accept modpack options for MODRINTH type', () => {
      const options: CreateServerOptions = {
        type: ServerType.fromEnum(ServerTypeEnum.MODRINTH),
        version: McVersion.create('1.21.1'),
        worldOptions: WorldOptions.newWorld(),
        modpackSlug: 'fabric-example',
        autoStart: false,
      };

      expect(options.modpackSlug).toBe('fabric-example');
      expect(options.type.value).toBe(ServerTypeEnum.MODRINTH);
    });

    test('should accept modpack version option', () => {
      const options: CreateServerOptions = {
        type: ServerType.fromEnum(ServerTypeEnum.MODRINTH),
        version: McVersion.create('1.21.1'),
        worldOptions: WorldOptions.newWorld(),
        modpackSlug: 'fabric-example',
        modpackVersion: '1.0.0',
        autoStart: false,
      };

      expect(options.modpackSlug).toBe('fabric-example');
      expect(options.modpackVersion).toBe('1.0.0');
    });

    test('should accept mod loader option', () => {
      const options: CreateServerOptions = {
        type: ServerType.fromEnum(ServerTypeEnum.MODRINTH),
        version: McVersion.create('1.21.1'),
        worldOptions: WorldOptions.newWorld(),
        modpackSlug: 'fabric-example',
        modLoader: 'fabric',
        autoStart: false,
      };

      expect(options.modpackSlug).toBe('fabric-example');
      expect(options.modLoader).toBe('fabric');
    });

    test('should accept all modpack options together', () => {
      const options: CreateServerOptions = {
        type: ServerType.fromEnum(ServerTypeEnum.MODRINTH),
        version: McVersion.create('1.21.1'),
        worldOptions: WorldOptions.newWorld(),
        modpackSlug: 'fabric-example',
        modpackVersion: '1.0.0',
        modLoader: 'fabric',
        autoStart: false,
      };

      expect(options.modpackSlug).toBe('fabric-example');
      expect(options.modpackVersion).toBe('1.0.0');
      expect(options.modLoader).toBe('fabric');
    });

    test('should work for AUTO_CURSEFORGE type', () => {
      const options: CreateServerOptions = {
        type: ServerType.fromEnum(ServerTypeEnum.AUTO_CURSEFORGE),
        version: McVersion.create('1.21.1'),
        worldOptions: WorldOptions.newWorld(),
        modpackSlug: 'forge-example',
        modpackVersion: '2.0.0',
        autoStart: false,
      };

      expect(options.type.value).toBe(ServerTypeEnum.AUTO_CURSEFORGE);
      expect(options.modpackSlug).toBe('forge-example');
      expect(options.modpackVersion).toBe('2.0.0');
    });

    test('should work without modpack options for non-modpack server types', () => {
      const options: CreateServerOptions = {
        type: ServerType.fromEnum(ServerTypeEnum.PAPER),
        version: McVersion.create('1.21.1'),
        worldOptions: WorldOptions.newWorld(),
        autoStart: false,
      };

      expect(options.type.value).toBe(ServerTypeEnum.PAPER);
      expect(options.modpackSlug).toBe(undefined);
      expect(options.modpackVersion).toBe(undefined);
      expect(options.modLoader).toBe(undefined);
    });
  });
});
