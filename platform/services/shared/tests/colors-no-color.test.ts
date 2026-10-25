import { describe, it, expect, afterEach, vi } from 'vitest';
import { colors } from '../src/utils/index.js';

describe('colors honors NO_COLOR (#828)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('emits color codes when NO_COLOR is unset', () => {
    vi.stubEnv('NO_COLOR', undefined as unknown as string);
    expect(colors.red('x')).toBe('\x1b[31mx\x1b[0m');
  });

  it('emits plain text when NO_COLOR is non-empty', () => {
    vi.stubEnv('NO_COLOR', '1');
    for (const fn of Object.values(colors)) expect(fn('x')).toBe('x');
  });

  it('ignores an empty NO_COLOR (no-color.org)', () => {
    vi.stubEnv('NO_COLOR', '');
    expect(colors.bold('x')).toBe('\x1b[1mx\x1b[0m');
  });
});
