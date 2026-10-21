import { describe, it, expect } from 'vitest';
import { resolveInside } from '../src/lib/safe-path.js';

describe('resolveInside (#720)', () => {
  const base = '/srv/mc/worlds';

  it.each([
    ['world', '/srv/mc/worlds/world'],
    ['My World', '/srv/mc/worlds/My World'],
    ['world.old', '/srv/mc/worlds/world.old'],
    ['nested/world', '/srv/mc/worlds/nested/world'],
  ])('resolves %s inside the base', (name, expected) => {
    expect(resolveInside(base, name)).toBe(expected);
  });

  it.each(['', '.', '..', '../x', '../../etc', 'a/../../x', '/etc', '/srv/mc/worlds'])(
    'rejects %j',
    (name) => {
      expect(resolveInside(base, name)).toBeNull();
    }
  );

  it('rejects a sibling that only shares the base prefix', () => {
    expect(resolveInside(base, '../worlds-evil')).toBeNull();
  });

  it('ignores a trailing separator on the base', () => {
    expect(resolveInside(`${base}/`, 'world')).toBe('/srv/mc/worlds/world');
  });
});
