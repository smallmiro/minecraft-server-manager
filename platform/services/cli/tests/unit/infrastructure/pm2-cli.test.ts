/**
 * pm2 on PATH (#650): the probe reports it honestly, and a missing pm2
 * binary is an exit code, not a crash. A fake pm2 in a temp dir stands in.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPm2Installation, followPm2Logs } from '../../../src/infrastructure/pm2-cli.js';

describe('pm2 on PATH (#650)', () => {
  let bin: string;
  const savedPath = process.env.PATH;

  beforeEach(() => {
    bin = mkdtempSync(join(tmpdir(), 'mcctl-pm2-'));
  });

  afterEach(() => {
    process.env.PATH = savedPath;
    rmSync(bin, { recursive: true, force: true });
  });

  it('reports pm2 missing when it is not on PATH', () => {
    process.env.PATH = bin;
    expect(checkPm2Installation()).toEqual({ installed: false });
  });

  it('reports the pm2 on PATH with its version', () => {
    writeFileSync(join(bin, 'pm2'), '#!/bin/sh\necho 6.0.14\n', { mode: 0o755 });
    process.env.PATH = bin;
    expect(checkPm2Installation()).toEqual({ installed: true, path: join(bin, 'pm2'), version: '6.0.14' });
  });

  it('pm2 logs --follow returns 1 when pm2 cannot be spawned', async () => {
    process.env.PATH = bin;
    expect(await followPm2Logs(['mcctl-api'])).toBe(1);
  });
});
