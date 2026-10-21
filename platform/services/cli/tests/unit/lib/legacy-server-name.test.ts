import { describe, it, expect } from 'vitest';
import { serverNameArg, legacyServerNameWarning } from '../../../src/lib/legacy-server-name.js';

describe('legacyServerNameWarning', () => {
  it('warns for a legacy name that passes the existing-server rule', () => {
    expect(legacyServerNameWarning('My_Server')).toMatch(/My_Server/);
  });

  it('is silent for names that satisfy the strict rule', () => {
    expect(legacyServerNameWarning('my-server')).toBeUndefined();
  });

  it('is silent for names the existing rule rejects (left to each command)', () => {
    expect(legacyServerNameWarning('bad;name')).toBeUndefined();
    expect(legacyServerNameWarning(undefined)).toBeUndefined();
  });
});

describe('serverNameArg', () => {
  const none = {};
  it('reads the name from the positional for plain commands', () => {
    expect(serverNameArg('start', undefined, ['My_Server'], none)).toBe('My_Server');
    expect(serverNameArg('delete', undefined, ['a'], none)).toBe('a');
  });
  it('reads the name from the sub-command for op/whitelist/ban/console', () => {
    expect(serverNameArg('op', 'My_Server', ['list'], none)).toBe('My_Server');
    expect(serverNameArg('console', 'My_Server', [], none)).toBe('My_Server');
  });
  it('handles world, player, mod and non-server commands', () => {
    expect(serverNameArg('world', 'new', ['w'], { server: 'My_Server' })).toBe('My_Server');
    expect(serverNameArg('world', 'assign', ['w', 'My_Server'], none)).toBe('My_Server');
    expect(serverNameArg('player', 'online', ['My_Server'], none)).toBe('My_Server');
    expect(serverNameArg('player', 'info', ['Steve'], none)).toBeUndefined();
    expect(serverNameArg('mod', 'search', ['sodium'], none)).toBeUndefined();
    expect(serverNameArg('mod', 'add', ['My_Server', 'x'], none)).toBe('My_Server');
    expect(serverNameArg('create', undefined, ['My_Server'], none)).toBeUndefined();
    expect(serverNameArg('start', undefined, [], { all: true })).toBeUndefined();
  });
});
