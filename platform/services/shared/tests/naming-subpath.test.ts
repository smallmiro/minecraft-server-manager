import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as naming from '../src/naming/index.js';
import * as domain from '../src/domain/index.js';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every non-relative import reachable from a source file. */
function externalImports(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  const source = readFileSync(file, 'utf-8');
  const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!);
  return specifiers.flatMap((spec) =>
    spec.startsWith('.')
      ? externalImports(resolve(dirname(file), spec.replace(/\.js$/, '.ts')), seen)
      : [spec]
  );
}

describe('@minecraft-docker/shared/naming (#721)', () => {
  test('is exported as a package subpath', () => {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf-8'));
    expect(pkg.exports['./naming']).toEqual({
      import: './dist/naming/index.js',
      types: './dist/naming/index.d.ts',
    });
  });

  test('imports no node:* module or package, so client components can use it', () => {
    expect(externalImports(join(pkgRoot, 'src/naming/index.ts'))).toEqual([]);
  });

  test('re-exports the same rules as the domain value objects', () => {
    expect(naming.ServerName).toBe(domain.ServerName);
    expect(naming.WorldName).toBe(domain.WorldName);
    expect(naming.SERVER_NAME_PATTERN).toBe(domain.SERVER_NAME_PATTERN);
    expect(naming.EXISTING_SERVER_NAME_PATTERN).toBe(domain.EXISTING_SERVER_NAME_PATTERN);
    expect(naming.WORLD_NAME_PATTERN).toBe(domain.WORLD_NAME_PATTERN);
    expect(naming.SERVER_NAME_MIN_LENGTH).toBe(domain.SERVER_NAME_MIN_LENGTH);
    expect(naming.SERVER_NAME_MAX_LENGTH).toBe(domain.SERVER_NAME_MAX_LENGTH);
    expect(naming.RESERVED_SERVER_NAMES).toBe(domain.RESERVED_SERVER_NAMES);
  });

  test.each(['survival', 'My_Server', 'router', 'a--b', ''])(
    'validators agree with the patterns for %j',
    (name) => {
      expect(naming.ServerName.validate(name) === undefined).toBe(naming.SERVER_NAME_PATTERN.test(name));
      expect(naming.WorldName.validate(name) === undefined).toBe(naming.WORLD_NAME_PATTERN.test(name));
    }
  );
});
