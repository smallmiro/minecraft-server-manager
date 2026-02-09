import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { OpsJsonService } from '../src/services/OpsJsonService.js';
import { OpLevel } from '@minecraft-docker/shared';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-ops-json-service-test');

function setupServer(serverName: string, files: Record<string, unknown>) {
  const dataDir = join(TEST_PLATFORM_PATH, 'servers', serverName, 'data');
  mkdirSync(dataDir, { recursive: true });

  for (const [filename, content] of Object.entries(files)) {
    writeFileSync(join(dataDir, filename), JSON.stringify(content, null, 2), 'utf-8');
  }
}

describe('OpsJsonService', () => {
  let service: OpsJsonService;

  beforeEach(() => {
    mkdirSync(TEST_PLATFORM_PATH, { recursive: true });
    service = new OpsJsonService(TEST_PLATFORM_PATH);
  });

  afterEach(() => {
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
  });

  describe('readOps', () => {
    it('should read ops.json and return Operator entities', () => {
      setupServer('test-server', {
        'ops.json': [
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
        ],
      });

      const operators = service.readOps('test-server');

      expect(operators).toHaveLength(2);
      expect(operators[0].name).toBe('Notch');
      expect(operators[0].level.value).toBe(4);
      expect(operators[0].level.label).toBe('Owner');
      expect(operators[1].name).toBe('Steve');
      expect(operators[1].level.value).toBe(2);
      expect(operators[1].level.label).toBe('Gamemaster');
    });

    it('should return empty array if ops.json does not exist', () => {
      setupServer('empty-server', {});

      const operators = service.readOps('empty-server');

      expect(operators).toEqual([]);
    });
  });

  describe('addOperator', () => {
    it('should add a new operator with specified level', () => {
      setupServer('test-server', { 'ops.json': [] });

      const operator = service.addOperator(
        'test-server',
        'TestPlayer',
        '550e8400-e29b-41d4-a716-446655440000',
        OpLevel.ADMIN
      );

      expect(operator.name).toBe('TestPlayer');
      expect(operator.level.value).toBe(3);
      expect(operator.level.label).toBe('Admin');

      // Verify file was written
      const opsPath = join(TEST_PLATFORM_PATH, 'servers', 'test-server', 'data', 'ops.json');
      const content = JSON.parse(readFileSync(opsPath, 'utf-8'));
      expect(content).toHaveLength(1);
      expect(content[0].name).toBe('TestPlayer');
      expect(content[0].level).toBe(3);
    });

    it('should update existing operator level', () => {
      setupServer('test-server', {
        'ops.json': [
          {
            uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
            name: 'Notch',
            level: 4,
            bypassesPlayerLimit: false,
          },
        ],
      });

      const operator = service.addOperator(
        'test-server',
        'Notch',
        '069a79f4-44e9-4726-a5be-fca90e38aaf5',
        OpLevel.MODERATOR
      );

      expect(operator.level.value).toBe(1);

      // Verify file was updated
      const opsPath = join(TEST_PLATFORM_PATH, 'servers', 'test-server', 'data', 'ops.json');
      const content = JSON.parse(readFileSync(opsPath, 'utf-8'));
      expect(content).toHaveLength(1);
      expect(content[0].level).toBe(1);
    });
  });

  describe('updateOperatorLevel', () => {
    it('should update operator level', () => {
      setupServer('test-server', {
        'ops.json': [
          {
            uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
            name: 'Notch',
            level: 4,
            bypassesPlayerLimit: false,
          },
        ],
      });

      const operator = service.updateOperatorLevel('test-server', 'Notch', OpLevel.GAMEMASTER);

      expect(operator).not.toBeNull();
      expect(operator!.level.value).toBe(2);

      // Verify file was updated
      const opsPath = join(TEST_PLATFORM_PATH, 'servers', 'test-server', 'data', 'ops.json');
      const content = JSON.parse(readFileSync(opsPath, 'utf-8'));
      expect(content[0].level).toBe(2);
    });

    it('should return null if operator not found', () => {
      setupServer('test-server', { 'ops.json': [] });

      const operator = service.updateOperatorLevel('test-server', 'NonExistent', OpLevel.ADMIN);

      expect(operator).toBeNull();
    });
  });

  describe('removeOperator', () => {
    it('should remove operator', () => {
      setupServer('test-server', {
        'ops.json': [
          {
            uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
            name: 'Notch',
            level: 4,
            bypassesPlayerLimit: false,
          },
        ],
      });

      const removed = service.removeOperator('test-server', 'Notch');

      expect(removed).toBe(true);

      // Verify file was updated
      const opsPath = join(TEST_PLATFORM_PATH, 'servers', 'test-server', 'data', 'ops.json');
      const content = JSON.parse(readFileSync(opsPath, 'utf-8'));
      expect(content).toHaveLength(0);
    });

    it('should return false if operator not found', () => {
      setupServer('test-server', { 'ops.json': [] });

      const removed = service.removeOperator('test-server', 'NonExistent');

      expect(removed).toBe(false);
    });
  });
});
