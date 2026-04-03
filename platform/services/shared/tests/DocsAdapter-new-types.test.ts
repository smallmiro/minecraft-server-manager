import { describe, test, expect } from 'vitest';
import { DocsAdapter } from '../src/infrastructure/adapters/DocsAdapter.js';
import { ServerTypeEnum } from '../src/domain/value-objects/ServerType.js';

describe('DocsAdapter - new server types (LEAF, FOLIA, PUFFERFISH)', () => {
  describe('getDefaultServerTypes', () => {
    test('should include LEAF in default server types', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getDefaultServerTypes(): Array<{ value: ServerTypeEnum }> }).getDefaultServerTypes();
      const values = types.map((t) => t.value);
      expect(values.includes(ServerTypeEnum.LEAF)).toBeTruthy();
    });

    test('should include FOLIA in default server types', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getDefaultServerTypes(): Array<{ value: ServerTypeEnum }> }).getDefaultServerTypes();
      const values = types.map((t) => t.value);
      expect(values.includes(ServerTypeEnum.FOLIA)).toBeTruthy();
    });

    test('should include PUFFERFISH in default server types', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getDefaultServerTypes(): Array<{ value: ServerTypeEnum }> }).getDefaultServerTypes();
      const values = types.map((t) => t.value);
      expect(values.includes(ServerTypeEnum.PUFFERFISH)).toBeTruthy();
    });

    test('LEAF should have correct properties', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getDefaultServerTypes(): Array<{
        value: ServerTypeEnum;
        label: string;
        supportsPlugins: boolean;
        supportsMods: boolean;
        isModpack: boolean;
        javaVersions: string[];
      }> }).getDefaultServerTypes();
      const leaf = types.find((t) => t.value === ServerTypeEnum.LEAF);
      expect(leaf).toBeTruthy();
      expect(leaf!.label).toBe('Leaf');
      expect(leaf!.supportsPlugins).toBe(true);
      expect(leaf!.supportsMods).toBe(false);
      expect(leaf!.isModpack).toBe(false);
      expect(leaf!.javaVersions.length > 0).toBeTruthy();
    });

    test('FOLIA should have correct properties', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getDefaultServerTypes(): Array<{
        value: ServerTypeEnum;
        label: string;
        supportsPlugins: boolean;
        supportsMods: boolean;
        isModpack: boolean;
      }> }).getDefaultServerTypes();
      const folia = types.find((t) => t.value === ServerTypeEnum.FOLIA);
      expect(folia).toBeTruthy();
      expect(folia!.label).toBe('Folia');
      expect(folia!.supportsPlugins).toBe(true);
      expect(folia!.supportsMods).toBe(false);
      expect(folia!.isModpack).toBe(false);
    });

    test('PUFFERFISH should have correct properties', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getDefaultServerTypes(): Array<{
        value: ServerTypeEnum;
        label: string;
        supportsPlugins: boolean;
        supportsMods: boolean;
        isModpack: boolean;
      }> }).getDefaultServerTypes();
      const pufferfish = types.find((t) => t.value === ServerTypeEnum.PUFFERFISH);
      expect(pufferfish).toBeTruthy();
      expect(pufferfish!.label).toBe('Pufferfish');
      expect(pufferfish!.supportsPlugins).toBe(true);
      expect(pufferfish!.supportsMods).toBe(false);
      expect(pufferfish!.isModpack).toBe(false);
    });
  });

  describe('formatLabel', () => {
    test('should format LEAF as Leaf', () => {
      const adapter = new DocsAdapter();
      const label = (adapter as unknown as { formatLabel(type: string): string }).formatLabel('LEAF');
      expect(label).toBe('Leaf');
    });

    test('should format FOLIA as Folia', () => {
      const adapter = new DocsAdapter();
      const label = (adapter as unknown as { formatLabel(type: string): string }).formatLabel('FOLIA');
      expect(label).toBe('Folia');
    });

    test('should format PUFFERFISH as Pufferfish', () => {
      const adapter = new DocsAdapter();
      const label = (adapter as unknown as { formatLabel(type: string): string }).formatLabel('PUFFERFISH');
      expect(label).toBe('Pufferfish');
    });
  });

  describe('getSupportedTypesForVersion', () => {
    test('should include LEAF for MC 1.20+', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getSupportedTypesForVersion(version: string): string[] }).getSupportedTypesForVersion('1.20.1');
      expect(types.includes('LEAF')).toBeTruthy();
    });

    test('should include FOLIA for MC 1.21+', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getSupportedTypesForVersion(version: string): string[] }).getSupportedTypesForVersion('1.21.1');
      expect(types.includes('FOLIA')).toBeTruthy();
    });

    test('should include PUFFERFISH for MC 1.20+', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getSupportedTypesForVersion(version: string): string[] }).getSupportedTypesForVersion('1.20.4');
      expect(types.includes('PUFFERFISH')).toBeTruthy();
    });

    test('should not include LEAF for MC 1.17', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getSupportedTypesForVersion(version: string): string[] }).getSupportedTypesForVersion('1.17.1');
      expect(types.includes('LEAF')).toBe(false);
    });

    test('should not include FOLIA for MC 1.17', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getSupportedTypesForVersion(version: string): string[] }).getSupportedTypesForVersion('1.17.1');
      expect(types.includes('FOLIA')).toBe(false);
    });

    test('should not include PUFFERFISH for MC 1.17', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getSupportedTypesForVersion(version: string): string[] }).getSupportedTypesForVersion('1.17.1');
      expect(types.includes('PUFFERFISH')).toBe(false);
    });
  });
});
