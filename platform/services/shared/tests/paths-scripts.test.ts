import { describe, test, expect, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Paths } from '../src/index.js';

const repoScripts = resolve(__dirname, '..', '..', '..', 'scripts');
const staleCliScripts = resolve(__dirname, '..', '..', 'cli', 'scripts');

describe('Paths.scripts (#648)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(staleCliScripts, { recursive: true, force: true });
  });

  test('prefers the monorepo platform/scripts over a generated cli/scripts copy', () => {
    vi.stubEnv('MCCTL_SCRIPTS', '');
    mkdirSync(staleCliScripts, { recursive: true });
    expect(existsSync(repoScripts)).toBe(true);
    expect(new Paths('/tmp/x').scripts).toBe(join(repoScripts));
  });
});
