import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { OpsJsonAdapter } from '../../src/infrastructure/adapters/OpsJsonAdapter.js';
import { OpLevel, Operator } from '@minecraft-docker/shared';

describe('OpsJsonAdapter', () => {
  const testDir = join(process.cwd(), '.tmp-test-ops');
  const opsFilePath = join(testDir, 'ops.json');
  let adapter: OpsJsonAdapter;

  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    adapter = new OpsJsonAdapter(opsFilePath);
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('read', () => {
    it('should return empty array when file does not exist', async () => {
      const operators = await adapter.read();
      expect(operators).toEqual([]);
    });

    it('should return empty array when file is empty', async () => {
      writeFileSync(opsFilePath, '[]', 'utf-8');
      const operators = await adapter.read();
      expect(operators).toEqual([]);
    });

    it('should parse valid ops.json file', async () => {
      const opsData = [
        {
          uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
          name: 'Notch',
          level: 4,
          bypassesPlayerLimit: false,
        },
        {
          uuid: '8667ba71-b85a-4004-af54-457a9734eed7',
          name: 'Steve',
          level: 2,
          bypassesPlayerLimit: false,
        },
      ];
      writeFileSync(opsFilePath, JSON.stringify(opsData, null, 2), 'utf-8');

      const operators = await adapter.read();

      expect(operators).toHaveLength(2);
      expect(operators[0].name).toBe('Notch');
      expect(operators[0].level.value).toBe(4);
      expect(operators[0].level.label).toBe('Owner');
      expect(operators[1].name).toBe('Steve');
      expect(operators[1].level.value).toBe(2);
      expect(operators[1].level.label).toBe('Gamemaster');
    });

    it('should handle invalid JSON gracefully', async () => {
      writeFileSync(opsFilePath, 'invalid json', 'utf-8');
      const operators = await adapter.read();
      expect(operators).toEqual([]);
    });
  });

  describe('write', () => {
    it('should create ops.json file with operators', async () => {
      const operators = [
        Operator.create({
          uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
          name: 'Notch',
          level: OpLevel.OWNER,
          bypassesPlayerLimit: false,
        }),
      ];

      await adapter.write(operators);

      expect(existsSync(opsFilePath)).toBe(true);
      const operators2 = await adapter.read();
      expect(operators2).toHaveLength(1);
      expect(operators2[0].name).toBe('Notch');
      expect(operators2[0].level.value).toBe(4);
    });

    it('should overwrite existing ops.json file', async () => {
      // First write
      const operators1 = [
        Operator.create({
          uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
          name: 'Notch',
          level: OpLevel.OWNER,
        }),
      ];
      await adapter.write(operators1);

      // Second write (overwrite)
      const operators2 = [
        Operator.create({
          uuid: '8667ba71-b85a-4004-af54-457a9734eed7',
          name: 'Steve',
          level: OpLevel.GAMEMASTER,
        }),
      ];
      await adapter.write(operators2);

      const result = await adapter.read();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Steve');
    });

    it('should create parent directory if it does not exist', async () => {
      const deepPath = join(testDir, 'deep', 'nested', 'ops.json');
      const deepAdapter = new OpsJsonAdapter(deepPath);

      const operators = [
        Operator.create({
          uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
          name: 'Notch',
          level: OpLevel.ADMIN,
        }),
      ];

      await deepAdapter.write(operators);
      expect(existsSync(deepPath)).toBe(true);
    });
  });

  describe('find', () => {
    beforeEach(async () => {
      const operators = [
        Operator.create({
          uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
          name: 'Notch',
          level: OpLevel.OWNER,
        }),
        Operator.create({
          uuid: '8667ba71-b85a-4004-af54-457a9734eed7',
          name: 'Steve',
          level: OpLevel.GAMEMASTER,
        }),
      ];
      await adapter.write(operators);
    });

    it('should find operator by name (case insensitive)', async () => {
      const op = await adapter.find('notch');
      expect(op).not.toBeNull();
      expect(op?.name).toBe('Notch');
      expect(op?.level.value).toBe(4);
    });

    it('should return null when operator not found', async () => {
      const op = await adapter.find('Alex');
      expect(op).toBeNull();
    });
  });

  describe('add', () => {
    it('should add new operator', async () => {
      const operator = Operator.create({
        uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
        name: 'Notch',
        level: OpLevel.ADMIN,
      });

      await adapter.add(operator);

      const operators = await adapter.read();
      expect(operators).toHaveLength(1);
      expect(operators[0].name).toBe('Notch');
      expect(operators[0].level.value).toBe(3);
    });

    it('should not add duplicate operator', async () => {
      const operator1 = Operator.create({
        uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
        name: 'Notch',
        level: OpLevel.ADMIN,
      });
      await adapter.add(operator1);

      const operator2 = Operator.create({
        uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
        name: 'Notch',
        level: OpLevel.OWNER,
      });
      await adapter.add(operator2);

      const operators = await adapter.read();
      expect(operators).toHaveLength(1);
      // Should keep original level (not update)
      expect(operators[0].level.value).toBe(3);
    });
  });

  describe('remove', () => {
    beforeEach(async () => {
      const operators = [
        Operator.create({
          uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
          name: 'Notch',
          level: OpLevel.OWNER,
        }),
        Operator.create({
          uuid: '8667ba71-b85a-4004-af54-457a9734eed7',
          name: 'Steve',
          level: OpLevel.GAMEMASTER,
        }),
      ];
      await adapter.write(operators);
    });

    it('should remove operator by name (case insensitive)', async () => {
      await adapter.remove('notch');
      const operators = await adapter.read();
      expect(operators).toHaveLength(1);
      expect(operators[0].name).toBe('Steve');
    });

    it('should do nothing when operator not found', async () => {
      await adapter.remove('Alex');
      const operators = await adapter.read();
      expect(operators).toHaveLength(2);
    });
  });

  describe('updateLevel', () => {
    beforeEach(async () => {
      const operators = [
        Operator.create({
          uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
          name: 'Notch',
          level: OpLevel.OWNER,
        }),
      ];
      await adapter.write(operators);
    });

    it('should update operator level', async () => {
      await adapter.updateLevel('Notch', OpLevel.MODERATOR);
      const operators = await adapter.read();
      expect(operators[0].level.value).toBe(1);
      expect(operators[0].level.label).toBe('Moderator');
    });

    it('should throw error when operator not found', async () => {
      await expect(adapter.updateLevel('Alex', OpLevel.ADMIN)).rejects.toThrow(
        'Operator Alex not found'
      );
    });
  });
});
