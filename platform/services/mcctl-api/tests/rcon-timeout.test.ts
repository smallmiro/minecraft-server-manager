/**
 * #672: an RCON command whose `docker exec` never returns is killed at its
 * timeout and reported as a failure, not left hanging.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { execRcon } from '../src/lib/rcon.js';

const BIN = mkdtempSync(join(tmpdir(), 'mcctl-api-hung-docker-'));

describe('execRcon timeout (#672)', () => {
  const savedPath = process.env.PATH;

  beforeAll(() => {
    const docker = join(BIN, 'docker');
    writeFileSync(docker, '#!/bin/sh\nexec sleep 30\n');
    chmodSync(docker, 0o755);
    process.env.PATH = `${BIN}${delimiter}${savedPath}`;
  });

  afterAll(() => {
    process.env.PATH = savedPath;
    rmSync(BIN, { recursive: true, force: true });
  });

  it('kills a hung docker exec and returns a failed result', async () => {
    const started = Date.now();
    const result = await execRcon('mc-alpha', 'list', 200);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/timed out/);
  });
});
