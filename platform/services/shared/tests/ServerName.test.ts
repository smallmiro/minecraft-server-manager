import { describe, it, expect } from 'vitest';
import {
  ServerName,
  SERVER_NAME_PATTERN,
  EXISTING_SERVER_NAME_PATTERN,
  RESERVED_SERVER_NAMES,
} from '../src/domain/value-objects/ServerName.js';

const VALID = ['ab', 'survival', 'my-server', 'a1', 'srv-2-test', 'a'.repeat(32)];
const INVALID = [
  '',
  'a', // too short
  'a'.repeat(33), // too long
  '1server', // must start with a letter
  'server-', // must end with a letter or number
  'my--server', // no consecutive hyphens
  'My-Server', // lowercase only
  'my_server', // no underscores
  'my.server',
  'my server',
  '../etc',
  'router', // reserved: collides with the mc-router container
];

describe('ServerName (#649)', () => {
  describe('create (new server names)', () => {
    it.each(VALID)('accepts %s', (name) => {
      expect(ServerName.create(name).value).toBe(name);
    });

    it.each(INVALID.filter((n) => n !== 'My-Server'))('rejects %s', (name) => {
      expect(() => ServerName.create(name)).toThrow();
    });

    it('normalizes case and surrounding whitespace', () => {
      expect(ServerName.create('  My-Server ').value).toBe('my-server');
    });

    it('rejects reserved names with a clear message', () => {
      expect(RESERVED_SERVER_NAMES).toContain('router');
      expect(() => ServerName.create('router')).toThrow(/reserved/);
      expect(() => ServerName.create('Router')).toThrow(/reserved/);
    });
  });

  describe('validate', () => {
    it('returns undefined for a valid name and a message otherwise', () => {
      expect(ServerName.validate('survival')).toBeUndefined();
      expect(ServerName.validate('router')).toMatch(/reserved/);
      expect(ServerName.validate('My-Server')).toBeDefined(); // no normalization
    });
  });

  describe('SERVER_NAME_PATTERN', () => {
    it.each([...VALID, ...INVALID])('agrees with validate() for %s', (name) => {
      expect(SERVER_NAME_PATTERN.test(name)).toBe(ServerName.validate(name) === undefined);
    });

    it('keeps mc-<name> a valid DNS-1123 label', () => {
      const longest = `mc-${'a'.repeat(32)}`;
      expect(longest.length).toBeLessThanOrEqual(63);
      expect(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(longest)).toBe(true);
    });
  });

  describe('fromExisting (names of servers that already exist)', () => {
    it.each(['a', 'my--server', 'server-', 'MyServer', 'my_server', '1server', 'a'.repeat(64)])(
      'accepts legacy name %s unchanged',
      (name) => {
        expect(ServerName.fromExisting(name).value).toBe(name);
      }
    );

    it('keeps reserved names working for existing servers', () => {
      expect(ServerName.fromExisting('router').value).toBe('router');
    });

    it.each(['', '../etc', 'a/b', 'my server', 'a;rm -rf', '-x', 'a'.repeat(65), '.hidden'])(
      'rejects unsafe name %s',
      (name) => {
        expect(() => ServerName.fromExisting(name)).toThrow();
      }
    );

    it('EXISTING_SERVER_NAME_PATTERN matches what fromExisting accepts', () => {
      expect(EXISTING_SERVER_NAME_PATTERN.test('MyServer')).toBe(true);
      expect(EXISTING_SERVER_NAME_PATTERN.test('../etc')).toBe(false);
    });
  });
});
