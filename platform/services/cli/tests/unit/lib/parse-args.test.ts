import { describe, it, expect } from 'vitest';
import { parseArgs, intFlag, stripRootFlag } from '../../../src/lib/parse-args.js';

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

  it('reads --flag=true/false of a boolean-only flag as a boolean (#728)', () => {
    expect(parseArgs(['delete', 'srv', '--force=true', '--json=false']).flags).toEqual({ force: true, json: false });
  });

  it('keeps any other --flag=value as a string, so it never turns an on/off flag on (#728)', () => {
    expect(parseArgs(['create', 'alpha', '--version=1.21.1', '--force=0']).flags).toEqual({ version: '1.21.1', force: '0' });
  });

  it('does not take a flag as the value', () => {
    expect(parseArgs(['create', 'alpha', '-s', '--no-start']).flags).toEqual({ seed: true, 'no-start': true });
  });

  it('reads the subcommand of audit (#824)', () => {
    const r = parseArgs(['audit', 'list', '--limit', '5']);
    expect(r.subCommand).toBe('list');
    expect(r.flags).toEqual({ limit: '5' });
  });

  it.each(['modrinth', 'curseforge', 'spiget', 'url'])('keeps every name after --%s as a positional (#824)', (src) => {
    const r = parseArgs(['mod', 'add', 'srv', `--${src}`, 'a', 'b']);
    expect(r.flags).toEqual({ [src]: true });
    expect(r.positional).toEqual(['srv', 'a', 'b']);
  });

  it('takes the value of --version after a command, but --version alone before one is the flag (#824)', () => {
    expect(parseArgs(['create', 'x', '--version', '1.21.1']).flags).toEqual({ version: '1.21.1' });
    expect(parseArgs(['create', 'x', '-v', '1.21.1']).flags).toEqual({ version: '1.21.1' });
    expect(parseArgs(['--version']).flags).toEqual({ version: true });
    expect(parseArgs(['status', '--version']).flags).toEqual({ version: true });
  });
});

describe('intFlag (#824)', () => {
  it('is undefined when the flag is absent and an integer otherwise', () => {
    expect(intFlag('level', undefined)).toBeUndefined();
    expect(intFlag('level', '2')).toBe(2);
  });

  it.each(['abc', true, '2x', ''])('rejects %j with a clear message', (v) => {
    expect(() => intFlag('level', v as string | boolean)).toThrow('--level must be an integer');
  });
});

describe('stripRootFlag (#824)', () => {
  it('removes --root <path> and --root=<path>, keeping the rest', () => {
    expect(stripRootFlag(['list', '--root', '/x', '--json'])).toEqual(['list', '--json']);
    expect(stripRootFlag(['--root=/x', 'status'])).toEqual(['status']);
    expect(stripRootFlag(['list'])).toEqual(['list']);
  });
});
