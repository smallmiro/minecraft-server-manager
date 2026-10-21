import { describe, it, expect } from 'vitest';
import {
  WorldName,
  WORLD_NAME_PATTERN,
  resolveWorldName,
} from '../src/domain/value-objects/WorldName.js';
import { WorldOptions } from '../src/domain/value-objects/WorldOptions.js';

describe('WorldName (#649)', () => {
  it.each(['world', 'My_World', 'survival-2', 'a', '0'])('accepts %s', (name) => {
    expect(WorldName.create(name).value).toBe(name);
    expect(WORLD_NAME_PATTERN.test(name)).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(WorldName.create('  world ').value).toBe('world');
  });

  it.each(['', '   ', '.', '..', '../x', 'a/b', 'my world', 'world.old', 'a;b', '$(id)'])(
    'rejects %s',
    (name) => {
      expect(() => WorldName.create(name)).toThrow();
    }
  );

  it('WorldOptions.existingWorld uses the same rule', () => {
    expect(WorldOptions.existingWorld('My_World').worldName).toBe('My_World');
    expect(() => WorldOptions.existingWorld('../x')).toThrow();
  });
});

describe('resolveWorldName (#649)', () => {
  it('prefers LEVEL, then WORLD_NAME, then the server name', () => {
    expect(resolveWorldName({ LEVEL: 'lvl', WORLD_NAME: 'wn' }, 'srv')).toBe('lvl');
    expect(resolveWorldName({ WORLD_NAME: 'wn' }, 'srv')).toBe('wn');
    expect(resolveWorldName({}, 'srv')).toBe('srv');
  });

  it('trims values and treats blank values as unset', () => {
    expect(resolveWorldName({ LEVEL: '  lvl ' }, 'srv')).toBe('lvl');
    expect(resolveWorldName({ LEVEL: '  ', WORLD_NAME: 'wn' }, 'srv')).toBe('wn');
  });

  it('ignores WORLD (a download URL, not a world name)', () => {
    expect(resolveWorldName({ WORLD: 'https://example.com/w.zip' }, 'srv')).toBe('srv');
  });

  it('returns undefined without a server name when nothing is configured', () => {
    expect(resolveWorldName({})).toBeUndefined();
    expect(resolveWorldName({ LEVEL: 'lvl' })).toBe('lvl');
  });

  it('does not validate existing values (legacy LEVEL keeps working)', () => {
    expect(resolveWorldName({ LEVEL: 'My World' }, 'srv')).toBe('My World');
  });
});
