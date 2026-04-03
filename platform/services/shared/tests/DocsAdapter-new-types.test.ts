import { test, describe } from 'node:test';
import assert from 'node:assert';
import { DocsAdapter } from '../src/infrastructure/adapters/DocsAdapter.js';
import { ServerTypeEnum } from '../src/domain/value-objects/ServerType.js';

describe('DocsAdapter - new server types (LEAF, FOLIA, PUFFERFISH)', () => {
  describe('getDefaultServerTypes', () => {
    test('should include LEAF in default server types', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getDefaultServerTypes(): Array<{ value: ServerTypeEnum }> }).getDefaultServerTypes();
      const values = types.map((t) => t.value);
      assert.ok(values.includes(ServerTypeEnum.LEAF), 'LEAF should be in default server types');
    });

    test('should include FOLIA in default server types', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getDefaultServerTypes(): Array<{ value: ServerTypeEnum }> }).getDefaultServerTypes();
      const values = types.map((t) => t.value);
      assert.ok(values.includes(ServerTypeEnum.FOLIA), 'FOLIA should be in default server types');
    });

    test('should include PUFFERFISH in default server types', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getDefaultServerTypes(): Array<{ value: ServerTypeEnum }> }).getDefaultServerTypes();
      const values = types.map((t) => t.value);
      assert.ok(values.includes(ServerTypeEnum.PUFFERFISH), 'PUFFERFISH should be in default server types');
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
      assert.ok(leaf, 'LEAF entry should exist');
      assert.strictEqual(leaf.label, 'Leaf');
      assert.strictEqual(leaf.supportsPlugins, true);
      assert.strictEqual(leaf.supportsMods, false);
      assert.strictEqual(leaf.isModpack, false);
      assert.ok(leaf.javaVersions.length > 0, 'javaVersions should not be empty');
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
      assert.ok(folia, 'FOLIA entry should exist');
      assert.strictEqual(folia.label, 'Folia');
      assert.strictEqual(folia.supportsPlugins, true);
      assert.strictEqual(folia.supportsMods, false);
      assert.strictEqual(folia.isModpack, false);
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
      assert.ok(pufferfish, 'PUFFERFISH entry should exist');
      assert.strictEqual(pufferfish.label, 'Pufferfish');
      assert.strictEqual(pufferfish.supportsPlugins, true);
      assert.strictEqual(pufferfish.supportsMods, false);
      assert.strictEqual(pufferfish.isModpack, false);
    });
  });

  describe('formatLabel', () => {
    test('should format LEAF as Leaf', () => {
      const adapter = new DocsAdapter();
      const label = (adapter as unknown as { formatLabel(type: string): string }).formatLabel('LEAF');
      assert.strictEqual(label, 'Leaf');
    });

    test('should format FOLIA as Folia', () => {
      const adapter = new DocsAdapter();
      const label = (adapter as unknown as { formatLabel(type: string): string }).formatLabel('FOLIA');
      assert.strictEqual(label, 'Folia');
    });

    test('should format PUFFERFISH as Pufferfish', () => {
      const adapter = new DocsAdapter();
      const label = (adapter as unknown as { formatLabel(type: string): string }).formatLabel('PUFFERFISH');
      assert.strictEqual(label, 'Pufferfish');
    });
  });

  describe('getSupportedTypesForVersion', () => {
    test('should include LEAF for MC 1.20+', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getSupportedTypesForVersion(version: string): string[] }).getSupportedTypesForVersion('1.20.1');
      assert.ok(types.includes('LEAF'), 'LEAF should be supported for 1.20+');
    });

    test('should include FOLIA for MC 1.21+', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getSupportedTypesForVersion(version: string): string[] }).getSupportedTypesForVersion('1.21.1');
      assert.ok(types.includes('FOLIA'), 'FOLIA should be supported for 1.21+');
    });

    test('should include PUFFERFISH for MC 1.20+', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getSupportedTypesForVersion(version: string): string[] }).getSupportedTypesForVersion('1.20.4');
      assert.ok(types.includes('PUFFERFISH'), 'PUFFERFISH should be supported for 1.20+');
    });

    test('should not include LEAF for MC 1.17', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getSupportedTypesForVersion(version: string): string[] }).getSupportedTypesForVersion('1.17.1');
      assert.ok(!types.includes('LEAF'), 'LEAF should not be supported for 1.17');
    });

    test('should not include FOLIA for MC 1.17', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getSupportedTypesForVersion(version: string): string[] }).getSupportedTypesForVersion('1.17.1');
      assert.ok(!types.includes('FOLIA'), 'FOLIA should not be supported for 1.17');
    });

    test('should not include PUFFERFISH for MC 1.17', () => {
      const adapter = new DocsAdapter();
      const types = (adapter as unknown as { getSupportedTypesForVersion(version: string): string[] }).getSupportedTypesForVersion('1.17.1');
      assert.ok(!types.includes('PUFFERFISH'), 'PUFFERFISH should not be supported for 1.17');
    });
  });
});
