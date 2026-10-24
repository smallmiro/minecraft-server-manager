import { describe, it, expect } from 'vitest';
import {
  WorldName,
  WORLD_NAME_PATTERN,
  EXISTING_WORLD_DIR_PATTERN,
  configuredWorldName,
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

  it('validate() reports why a name is invalid, with the message create() throws (#721)', () => {
    expect(WorldName.validate('My_World')).toBeUndefined();
    for (const name of ['', 'a/b', 'my world']) {
      const error = WorldName.validate(name);
      expect(error).toBeTypeOf('string');
      expect(() => WorldName.create(name)).toThrow(error);
    }
  });

  it('WorldOptions.existingWorld uses the same rule', () => {
    expect(WorldOptions.existingWorld('My_World').worldName).toBe('My_World');
    expect(() => WorldOptions.existingWorld('../x')).toThrow();
  });
});

describe('resolveWorldName (#649, #721)', () => {
  it("prefers LEVEL, then WORLD_NAME, then itzg's default 'world'", () => {
    expect(resolveWorldName({ LEVEL: 'lvl', WORLD_NAME: 'wn' })).toBe('lvl');
    expect(resolveWorldName({ WORLD_NAME: 'wn' })).toBe('wn');
    expect(resolveWorldName({})).toBe('world');
  });

  it('trims values and treats blank values as unset', () => {
    expect(resolveWorldName({ LEVEL: '  lvl ' })).toBe('lvl');
    expect(resolveWorldName({ LEVEL: '  ', WORLD_NAME: 'wn' })).toBe('wn');
    expect(resolveWorldName({ LEVEL: '  ' })).toBe('world');
  });

  it('ignores WORLD (a download URL, not a world name)', () => {
    expect(resolveWorldName({ WORLD: 'https://example.com/w.zip' })).toBe('world');
  });

  it('configuredWorldName returns undefined when nothing is configured', () => {
    expect(configuredWorldName({})).toBeUndefined();
    expect(configuredWorldName({ LEVEL: ' ' })).toBeUndefined();
    expect(configuredWorldName({ LEVEL: 'lvl' })).toBe('lvl');
  });

  it('does not validate existing values (legacy LEVEL keeps working)', () => {
    expect(resolveWorldName({ LEVEL: 'My World' })).toBe('My World');
  });
});

describe('EXISTING_WORLD_DIR_PATTERN (a directory already under worlds/, #728)', () => {
  it.each(['world', 'My World', 'world.old', '-lobby', "it's", 'say "hi"', '월드'])('accepts %j', (name) => {
    expect(EXISTING_WORLD_DIR_PATTERN.test(name)).toBe(true);
  });

  it.each(['', '.', '..', '.locks', '../x', 'a/b', 'a\\b', '/etc', 'a\nb', 'a\0b', 'a\x7fb'])('rejects %j', (name) => {
    expect(EXISTING_WORLD_DIR_PATTERN.test(name)).toBe(false);
  });
});
