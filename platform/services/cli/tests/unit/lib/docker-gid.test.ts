import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setDockerGid, detectDockerGid } from '../../../src/lib/docker-gid.js';

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

describe('setDockerGid edge cases', () => {
  it('handles CRLF-free trailing spaces and empty values', () => {
    const p = tmpEnv('DOCKER_GID=999 \nB=2\n');
    expect(setDockerGid(p, 7)).toBe(true);
    expect(readFileSync(p, 'utf-8')).toBe('DOCKER_GID=7\nB=2\n');
    const q = tmpEnv('DOCKER_GID=\n');
    expect(setDockerGid(q, 7)).toBe(true);
    expect(readFileSync(q, 'utf-8')).toBe('DOCKER_GID=7\n');
  });

  it('adds a newline before appending when file lacks one', () => {
    const p = tmpEnv('A=1');
    setDockerGid(p, 5);
    expect(readFileSync(p, 'utf-8')).toBe('A=1\nDOCKER_GID=5\n');
  });

  it('returns false when .env does not exist', () => {
    expect(setDockerGid(join(tmpdir(), 'no-such-dir', '.env'), 5)).toBe(false);
  });
});

describe('detectDockerGid', () => {
  it('returns null for a missing socket', () => {
    expect(detectDockerGid(join(tmpdir(), 'no-such.sock'))).toBeNull();
  });

  it('returns the owning gid, but null for root group', () => {
    const p = tmpEnv('x');
    const { gid } = statSync(p);
    expect(detectDockerGid(p)).toBe(gid > 0 ? gid : null);
    expect(detectDockerGid('/')).toBeNull(); // owned by root:root
  });
});
