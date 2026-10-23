/**
 * #735: worlds/ on another filesystem (a symlink to a second disk). rename()
 * fails with EXDEV there; delete-server.sh used mv, which copies, so delete
 * copies and removes too.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, rename: vi.fn(actual.rename) };
});

import { rename } from 'node:fs/promises';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Paths } from '../src/utils/index.js';
import { FileServerSpecRepository } from '../src/infrastructure/adapters/server-spec/FileServerSpecRepository.js';

let root: string;
const at = (...p: string[]) => join(root, ...p);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-spec-exdev-'));
  mkdirSync(at('servers', 'alpha', 'data', 'alpha', 'region'), { recursive: true });
  mkdirSync(at('worlds'));
  writeFileSync(at('servers', 'alpha', 'config.env'), 'LEVEL=alpha\n');
  writeFileSync(at('servers', 'alpha', 'data', 'alpha', 'level.dat'), 'level');
  writeFileSync(at('servers', 'alpha', 'data', 'alpha', 'region', 'r.0.0.mca'), 'chunks');
});

afterEach(() => {
  vi.mocked(rename).mockClear();
  rmSync(root, { recursive: true, force: true });
});

describe('delete: a world moves across filesystems', () => {
  it('copies and removes when rename fails with EXDEV', async () => {
    vi.mocked(rename).mockRejectedValueOnce(Object.assign(new Error('EXDEV: cross-device link not permitted'), { code: 'EXDEV' }));
    const repo = new FileServerSpecRepository(new Paths(root), undefined, undefined, () => []);

    expect((await repo.delete('alpha')).movedWorlds).toEqual(['alpha']);
    expect(readFileSync(at('worlds', 'alpha', 'level.dat'), 'utf-8')).toBe('level');
    expect(readFileSync(at('worlds', 'alpha', 'region', 'r.0.0.mca'), 'utf-8')).toBe('chunks');
    expect(existsSync(at('servers', 'alpha'))).toBe(false);
  });
});
