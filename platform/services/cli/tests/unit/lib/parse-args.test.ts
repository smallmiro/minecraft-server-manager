import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../../src/lib/parse-args.js';

describe('parseArgs', () => {
  it('reads a value after a flag', () => {
    expect(parseArgs(['create', 'alpha', '-s', '123', '--type', 'PAPER']).flags).toEqual({ seed: '123', type: 'PAPER' });
  });

  it('takes a negative number as the value (#728)', () => {
    expect(parseArgs(['create', 'alpha', '-s', '-123']).flags).toEqual({ seed: '-123' });
    expect(parseArgs(['create', 'alpha', '--seed', '-4172144997902289642']).flags).toEqual({ seed: '-4172144997902289642' });
  });

  it('takes --key=value, so a value may start with a dash (#728)', () => {
    const { flags, positional } = parseArgs(['create', 'alpha', '--seed=--no-start', '--world-url=https://x/a=b.zip']);
    expect(flags).toEqual({ seed: '--no-start', 'world-url': 'https://x/a=b.zip' });
    expect(positional).toEqual(['alpha']);
  });

  it('keeps negative numbers in a command as positionals (#728)', () => {
    const { flags, positional } = parseArgs(['exec', 'srv', 'tp', '@s', '-1', '64', '-5']);
    expect(positional).toEqual(['srv', 'tp', '@s', '-1', '64', '-5']);
    expect(flags).toEqual({});
  });

  it('reads everything after -- as positionals (#728)', () => {
    const { flags, positional } = parseArgs(['exec', 'srv', '--', 'say', '-h', '--json']);
    expect(positional).toEqual(['srv', 'say', '-h', '--json']);
    expect(flags).toEqual({});
  });

  it('does not take a flag as the value', () => {
    expect(parseArgs(['create', 'alpha', '-s', '--no-start']).flags).toEqual({ seed: true, 'no-start': true });
  });
});
