import { describe, it, expect } from 'vitest';
import { Fail, withCleanup } from '../src/infrastructure/backup/support.js';

describe('withCleanup (#732 review P2, ADR B5.9)', () => {
  it('a cleanup error never hides the main error; it is added to the message', async () => {
    const main = new Fail({ code: 'io_failed', message: 'could not roll back', paths: ['/root/backups/restore-previous/x'] });
    const err = await withCleanup(
      async () => {
        throw main;
      },
      async () => {
        throw new Error('EACCES staging');
      }
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Fail);
    const f = err as Fail;
    expect(f.error.code).toBe('io_failed');
    expect(f.error.paths).toEqual(['/root/backups/restore-previous/x']);
    expect(f.error.message).toContain('could not roll back');
    expect(f.error.message).toContain('cleanup failed: EACCES staging');
  });

  it('returns the value and ignores a cleanup error after success', async () => {
    expect(
      await withCleanup(
        async () => 42,
        async () => {
          throw new Error('late');
        }
      )
    ).toBe(42);
  });
});
