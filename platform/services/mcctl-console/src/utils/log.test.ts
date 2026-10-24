import { describe, it, expect } from 'vitest';
import { stripAnsi, parseLogLine, classifyLogLine } from './log';

const LINE = '[19:28:37] [Server thread/INFO] [minecraft/DedicatedServer]: Loading properties';

describe('stripAnsi', () => {
  it.each(['[Server thread', '[Worker-Main-4', '[LanServerPinger #1', '[minecraft/x]'])(
    'keeps text after a bracket: %s',
    (text) => expect(stripAnsi(text)).toBe(text)
  );

  it('removes ESC sequences', () => {
    expect(stripAnsi('\x1b[m>....\r\x1b[K\x1b[32m[19:28:58] [RCON Listener #1/INFO]: hi')).toBe(
      '[19:28:58] [RCON Listener #1/INFO]: hi'
    );
  });

  it('removes numeric sequences whose ESC was already stripped', () => {
    expect(stripAnsi('[32m[19:28:58] [Server thread/INFO]: hi[0m')).toBe(
      '[19:28:58] [Server thread/INFO]: hi'
    );
  });
});

describe('parseLogLine', () => {
  it('parses a plain line', () => {
    expect(parseLogLine(LINE)).toEqual({
      time: '19:28:37',
      thread: 'Server thread',
      level: 'INFO',
      msg: '[minecraft/DedicatedServer]: Loading properties',
    });
  });

  it('parses the same line wrapped in ESC codes', () => {
    expect(parseLogLine(`\x1b[m>....\r\x1b[K\x1b[32m${LINE}\x1b[m`)).toEqual(parseLogLine(LINE));
  });
});

describe('classifyLogLine', () => {
  it.each([
    ['[19:28:37] [Server thread/ERROR]: Exception ticking world', 'error'],
    ['[19:28:37] [Server thread/FATAL]: Crash', 'error'],
    ['[19:28:37] [Server thread/WARN]: Can\'t keep up!', 'warn'],
    ['[19:28:37] [Server thread/INFO]: Steve joined the game', 'join'],
    ['[19:28:37] [Server thread/INFO]: Steve left the game', 'leave'],
    ['[19:28:37] [Server thread/INFO]: Done (3.214s)! For help, type "help"', 'done'],
    ['[19:28:37] [Server thread/INFO] [minecraft/DedicatedServer]: Done (9.1s)! For help', 'done'],
    ['[19:28:37] [Server thread/INFO]: Preparing spawn area', 'info'],
    ['plain line without a level', 'info'],
  ])('classifies %s as %s', (line, expected) => {
    expect(classifyLogLine(line)).toBe(expected);
  });
});
