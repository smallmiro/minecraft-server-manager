import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, statSync, lstatSync, symlinkSync, chmodSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { atomicWriteFile, atomicWriteFileSync } from '../src/utils/index.js';

// Lets a test fail the write or the final rename midway (#656).
const fail = vi.hoisted(() => ({ rename: false, write: false }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    renameSync: (...args: Parameters<typeof actual.renameSync>) => {
      if (fail.rename) throw new Error('rename failed');
      return actual.renameSync(...args);
    },
    writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) => {
      if (fail.write && typeof args[0] === 'number') throw new Error('write failed');
      return actual.writeFileSync(...args);
    },
  };
});
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    rename: async (...args: Parameters<typeof actual.rename>) => {
      if (fail.rename) throw new Error('rename failed');
      return actual.rename(...args);
    },
    open: async (...args: Parameters<typeof actual.open>) => {
      const handle = await actual.open(...args);
      if (!fail.write) return handle;
      return new Proxy(handle, {
        get(target, key) {
          if (key === 'writeFile') return async () => { throw new Error('write failed'); };
          const value = Reflect.get(target, key);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    },
  };
});

const variants = [
  ['atomicWriteFile', (p: string, c: string, o?: { mode?: number }) => atomicWriteFile(p, c, o)],
  ['atomicWriteFileSync', async (p: string, c: string, o?: { mode?: number }) => atomicWriteFileSync(p, c, o)],
] as const;

describe.each(variants)('%s', (_name, write) => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mcctl-atomic-write-'));
    file = join(dir, 'docker-compose.yml');
    fail.rename = false;
    fail.write = false;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('replaces the content, keeps the existing mode and leaves no temp file', async () => {
    writeFileSync(file, 'old\n');
    chmodSync(file, 0o640);
    await write(file, 'new\n');
    expect(readFileSync(file, 'utf-8')).toBe('new\n');
    expect(statSync(file).mode & 0o777).toBe(0o640);
    expect(readdirSync(dir)).toEqual(['docker-compose.yml']);
  });

  test('creates a missing file with the default (umask) mode', async () => {
    await write(file, 'a\n');
    const umask = process.umask();
    expect(readFileSync(file, 'utf-8')).toBe('a\n');
    expect(statSync(file).mode & 0o777).toBe(0o666 & ~umask);
  });

  test('applies an explicit mode', async () => {
    writeFileSync(file, 'old\n');
    chmodSync(file, 0o664);
    await write(file, 'new\n', { mode: 0o600 });
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  test('writes through a symlink without replacing the link', async () => {
    const real = join(dir, 'real.yml');
    writeFileSync(real, 'old\n');
    symlinkSync(real, file);
    await write(file, 'new\n');
    expect(lstatSync(file).isSymbolicLink()).toBe(true);
    expect(readFileSync(real, 'utf-8')).toBe('new\n');
  });

  test('keeps the original when the rename fails, and removes the temp file', async () => {
    writeFileSync(file, 'old\n');
    fail.rename = true;
    await expect(write(file, 'new\n')).rejects.toThrow('rename failed');
    expect(readFileSync(file, 'utf-8')).toBe('old\n');
    expect(readdirSync(dir)).toEqual(['docker-compose.yml']);
  });

  test('keeps the original when the write fails midway, and removes the temp file', async () => {
    writeFileSync(file, 'old\n');
    fail.write = true;
    await expect(write(file, 'new\n')).rejects.toThrow('write failed');
    expect(readFileSync(file, 'utf-8')).toBe('old\n');
    expect(readdirSync(dir)).toEqual(['docker-compose.yml']);
  });
});
