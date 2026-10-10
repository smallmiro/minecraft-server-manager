import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setDockerGid } from '../../../src/lib/docker-gid.js';

function tmpEnv(content: string): string {
  const p = join(mkdtempSync(join(tmpdir(), 'dgid-')), '.env');
  writeFileSync(p, content);
  return p;
}

describe('setDockerGid', () => {
  it('replaces the template default (999)', () => {
    const p = tmpEnv('A=1\nDOCKER_GID=999\n');
    expect(setDockerGid(p, 1001)).toBe(true);
    expect(readFileSync(p, 'utf-8')).toBe('A=1\nDOCKER_GID=1001\n');
  });

  it('appends when DOCKER_GID is missing', () => {
    const p = tmpEnv('A=1\n');
    setDockerGid(p, 1001);
    expect(readFileSync(p, 'utf-8')).toBe('A=1\nDOCKER_GID=1001\n');
  });

  it('keeps a value the user customized', () => {
    const p = tmpEnv('DOCKER_GID=42\n');
    expect(setDockerGid(p, 1001)).toBe(false);
    expect(readFileSync(p, 'utf-8')).toBe('DOCKER_GID=42\n');
  });

  it('does nothing when gid is unknown', () => {
    const p = tmpEnv('A=1\n');
    expect(setDockerGid(p, null)).toBe(false);
    expect(readFileSync(p, 'utf-8')).toBe('A=1\n');
  });
});
