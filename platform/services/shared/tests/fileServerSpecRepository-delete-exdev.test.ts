/**
 * #735: worlds/ on another filesystem (a symlink to a second disk). rename()
 * fails with EXDEV there; delete-server.sh used mv, which copies, so delete
 * copies and removes too.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, rename: vi.fn(actual.rename), cp: vi.fn(actual.cp), rm: vi.fn(actual.rm) };
});

import { cp, rename, rm } from 'node:fs/promises';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Paths } from '../src/utils/index.js';
import { FileServerSpecRepository } from '../src/infrastructure/adapters/server-spec/FileServerSpecRepository.js';

let root: string;
const at = (...p: string[]) => join(root, ...p);
const repo = () => new FileServerSpecRepository(new Paths(root), undefined, undefined, () => []);
const errno = (code: string) => Object.assign(new Error(`${code}: test`), { code });
const realRename = vi.mocked(rename).getMockImplementation()!;

/** rename() of servers/alpha/data/alpha fails with EXDEV once, after `meanwhile` (another process acting). */
function worldRenameFailsOnce(meanwhile: () => void = () => {}): void {
  vi.mocked(rename).mockImplementation(async (from, to) => {
    if (String(from) !== at('servers', 'alpha', 'data', 'alpha')) return realRename(from, to);
    vi.mocked(rename).mockImplementation(realRename);
    meanwhile();
    throw errno('EXDEV');
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-spec-exdev-'));
  mkdirSync(at('servers', 'alpha', 'data', 'alpha', 'region'), { recursive: true });
  mkdirSync(at('worlds'));
  writeFileSync(at('servers', 'alpha', 'config.env'), 'LEVEL=alpha\n');
  writeFileSync(at('servers', 'alpha', 'data', 'alpha', 'level.dat'), 'level');
  writeFileSync(at('servers', 'alpha', 'data', 'alpha', 'region', 'r.0.0.mca'), 'chunks');
  writeFileSync(at('servers', 'compose.yml'), 'include:\n  - alpha/docker-compose.yml\n');
});

afterEach(() => {
  for (const fn of [rename, cp, rm]) vi.mocked(fn).mockClear();
  vi.mocked(rename).mockImplementation(realRename);
  rmSync(root, { recursive: true, force: true });
});

describe('delete: a world moves across filesystems', () => {
  it('copies and removes when rename fails with EXDEV', async () => {
    worldRenameFailsOnce();
    expect((await repo().delete('alpha')).movedWorlds).toEqual(['alpha']);
    expect(readFileSync(at('worlds', 'alpha', 'level.dat'), 'utf-8')).toBe('level');
    expect(readFileSync(at('worlds', 'alpha', 'region', 'r.0.0.mca'), 'utf-8')).toBe('chunks');
    expect(existsSync(at('servers', 'alpha'))).toBe(false);
  });

  it.each([
    ['other files, which the copy would merge into', 'theirs.txt'],
    ['a file the copy also has, which fails the copy', 'level.dat'],
  ])('a worlds/ folder another process creates after the check is refused, never merged into or removed (%s)', async (_, file) => {
    // The other process creates worlds/alpha between the existence check and the copy.
    worldRenameFailsOnce(() => {
      mkdirSync(at('worlds', 'alpha'));
      writeFileSync(at('worlds', 'alpha', file), 'theirs');
    });

    await expect(repo().delete('alpha')).rejects.toThrow(/worlds\/alpha appeared before data\/alpha could be moved/);
    expect(readdirSync(at('worlds', 'alpha'))).toEqual([file]);
    expect(readFileSync(at('worlds', 'alpha', file), 'utf-8')).toBe('theirs');
    expect(readFileSync(at('servers', 'alpha', 'data', 'alpha', 'level.dat'), 'utf-8')).toBe('level');
  });

  it('a failed copy removes only the folder it claimed and keeps the original', async () => {
    worldRenameFailsOnce();
    vi.mocked(cp).mockImplementationOnce(async (_from, to) => {
      mkdirSync(String(to), { recursive: true });
      writeFileSync(join(String(to), 'level.dat'), 'partial');
      throw errno('ENOSPC');
    });

    await expect(repo().delete('alpha')).rejects.toThrow(/failed to move data\/alpha to worlds\/: ENOSPC/);
    expect(existsSync(at('worlds', 'alpha'))).toBe(false);
    expect(readFileSync(at('servers', 'alpha', 'data', 'alpha', 'level.dat'), 'utf-8')).toBe('level');
  });

  it('an original that cannot be removed after the copy: worlds/alpha is complete, clean up the rest by hand', async () => {
    worldRenameFailsOnce();
    vi.mocked(rm).mockRejectedValueOnce(errno('EACCES')); // the first rm is the original's

    const error = (await repo().delete('alpha').catch((e: unknown) => e)) as Error;
    expect(error.message).toMatch(/worlds\/alpha is a complete copy of data\/alpha/);
    expect(error.message).toMatch(/servers\/alpha\/data\/alpha could not be fully removed \(EACCES/);
    expect(error.message).toContain(`sudo rm -rf '${at('servers', 'alpha', 'data', 'alpha')}'`);
    expect(error.message).toMatch(/servers\/alpha\/ was kept/);
    expect(readFileSync(at('worlds', 'alpha', 'region', 'r.0.0.mca'), 'utf-8')).toBe('chunks');
    expect(existsSync(at('servers', 'alpha', 'config.env'))).toBe(true);
    expect(readFileSync(at('servers', 'compose.yml'), 'utf-8')).toContain('alpha/docker-compose.yml');
  });
});
