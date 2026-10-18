import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseEnvDocument, applyEnvChanges, serializeEnvValue } from '../src/utils/index.js';

const SAMPLE = [
  '# Header comment',
  '',
  'MINECRAFT_NETWORK=minecraft-net',
  "RCON_PASSWORD='s3cret'",
  'EXTRA_ARGS="--world-dir /worlds/"',
  'JVM_OPTS=-Dfoo=bar=baz',
  'TZ=Asia/Seoul # inline comment',
  '   # indented comment',
  'export EXPORTED=yes',
  'DUP=first',
  'not a key value line',
  'DUP=second',
  '',
].join('\n');

describe('parseEnvDocument', () => {
  test('reads values: quotes stripped, first = splits, inline comment dropped, last duplicate wins', () => {
    const { values } = parseEnvDocument(SAMPLE);
    expect(values.get('MINECRAFT_NETWORK')).toBe('minecraft-net');
    expect(values.get('RCON_PASSWORD')).toBe('s3cret');
    expect(values.get('EXTRA_ARGS')).toBe('--world-dir /worlds/');
    expect(values.get('JVM_OPTS')).toBe('-Dfoo=bar=baz');
    expect(values.get('TZ')).toBe('Asia/Seoul');
    expect(values.get('EXPORTED')).toBe('yes');
    expect(values.get('DUP')).toBe('second');
    expect(values.size).toBe(7);
  });

  test('keeps every line raw so the document round-trips byte-identically', () => {
    const doc = parseEnvDocument(SAMPLE);
    expect(doc.lines.map((l) => l.raw).join('\n')).toBe(SAMPLE);
    expect(doc.lines.filter((l) => l.key !== undefined).map((l) => l.key)).toEqual([
      'MINECRAFT_NETWORK', 'RCON_PASSWORD', 'EXTRA_ARGS', 'JVM_OPTS', 'TZ', 'EXPORTED', 'DUP', 'DUP',
    ]);
  });

  test('preserves CRLF line endings in raw lines', () => {
    const crlf = 'A=1\r\nB=2\r\n';
    const doc = parseEnvDocument(crlf);
    expect(doc.values.get('A')).toBe('1');
    expect(doc.lines.map((l) => l.raw).join('\n')).toBe(crlf);
  });
});

describe('applyEnvChanges', () => {
  test('no changes returns the content unchanged', () => {
    expect(applyEnvChanges(SAMPLE, {})).toBe(SAMPLE);
  });

  test('sets an existing key and leaves every other line byte-identical', () => {
    const out = applyEnvChanges(SAMPLE, { set: { TZ: 'UTC' } });
    expect(out).toBe(SAMPLE.replace('TZ=Asia/Seoul # inline comment', 'TZ=UTC'));
  });

  test('set rewrites every occurrence of a duplicate key', () => {
    const out = applyEnvChanges(SAMPLE, { set: { DUP: 'third' } });
    expect(out).toBe(SAMPLE.replace('DUP=first', 'DUP=third').replace('DUP=second', 'DUP=third'));
    expect(parseEnvDocument(out).values.get('DUP')).toBe('third');
  });

  test('remove drops every occurrence of the key', () => {
    const out = applyEnvChanges(SAMPLE, { remove: ['DUP', 'RCON_PASSWORD'] });
    expect(out).toBe(SAMPLE.replace("RCON_PASSWORD='s3cret'\n", '').replace('DUP=first\n', '').replace('DUP=second\n', ''));
  });

  test('appends new keys at the end, keeping the trailing newline', () => {
    const out = applyEnvChanges(SAMPLE, { set: { NEW_KEY: 'v1', OTHER: 'a b' } });
    expect(out).toBe(`${SAMPLE}NEW_KEY=v1\nOTHER='a b'\n`);
  });

  test('appends after content without a trailing newline and into an empty file', () => {
    expect(applyEnvChanges('A=1', { set: { B: '2' } })).toBe('A=1\nB=2\n');
    expect(applyEnvChanges('', { set: { B: '2' } })).toBe('B=2\n');
  });

  test('changed values are serialized with the bash-safe quoting rule', () => {
    const out = applyEnvChanges(SAMPLE, { set: { MINECRAFT_NETWORK: '$(touch x)' } });
    expect(out).toContain("MINECRAFT_NETWORK='$(touch x)'\n");
  });

  test('rejects invalid key names', () => {
    expect(() => applyEnvChanges(SAMPLE, { set: { 'BAD\nKEY': 'x' } })).toThrow(/invalid key/i);
    expect(() => applyEnvChanges(SAMPLE, { set: { '1ABC': 'x' } })).toThrow(/invalid key/i);
    expect(() => applyEnvChanges(SAMPLE, { remove: ['A-B'] })).toThrow(/invalid key/i);
  });

  test('rejects a key that is both set and removed', () => {
    expect(() => applyEnvChanges(SAMPLE, { set: { TZ: 'UTC' }, remove: ['TZ'] })).toThrow(/both/i);
  });

  test('prototype-like key names are treated as plain keys', () => {
    const out = applyEnvChanges('A=1\n', { set: JSON.parse('{"__proto__":"x","constructor":"y"}') });
    expect(out).toBe('A=1\n__proto__=x\nconstructor=y\n');
  });
});

describe('serializeEnvValue', () => {
  test('writes bare-safe values bare', () => {
    for (const v of ['', 'abc', '172.28.0.0/16', 'a,b', 'user@host:1', 'x=y', '50%', 'a+b', 'Asia/Seoul', 'my-net_1.0']) {
      expect(serializeEnvValue(v)).toBe(v);
    }
  });

  test('single-quotes everything else', () => {
    expect(serializeEnvValue('a b')).toBe("'a b'");
    expect(serializeEnvValue('$(touch x)')).toBe("'$(touch x)'");
    expect(serializeEnvValue('`id`')).toBe("'`id`'");
    expect(serializeEnvValue('a#b')).toBe("'a#b'");
    expect(serializeEnvValue('"q"')).toBe(`'"q"'`);
  });

  test.each([["it's"], ['a\rb'], ['a\nb'], ['a\0b']])('rejects %j', (v) => {
    expect(() => serializeEnvValue(v)).toThrow();
  });
});

describe('serializeEnvValue bash source round-trip', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mcctl-envfile-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test.each([
    ['$(touch pwned)'],
    ['`touch pwned`'],
    ['a b  c'],
    ['a #not a comment'],
    ['$HOME ${HOME} \\n \\'],
    ['"double" ; touch pwned & | > <'],
    ['-Xmx4G -XX:+UseG1GC'],
    ['plain-value_1.2'],
    [''],
  ])('bash `set -a; source` yields the literal %j', (value) => {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, applyEnvChanges('# c\n', { set: { K: value } }));
    const out = execFileSync('bash', ['-c', 'set -a; source "$1"; printf %s "$K"', 'bash', envPath], { cwd: dir, encoding: 'utf-8' });
    expect(out).toBe(value);
    expect(existsSync(join(dir, 'pwned'))).toBe(false);
  });
});
