/**
 * Every unit test process gets a stand-in docker first on PATH (#666,
 * tests/setup.ts): a daemon with no containers, so no test reaches the host's Docker.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { DockerComposeRuntimeAdapter } from '../src/infrastructure/adapters/DockerComposeRuntimeAdapter.js';

describe('the unit-test docker', () => {
  it('lists no containers and refuses everything else', () => {
    expect(execFileSync('docker', ['ps', '-a'], { encoding: 'utf-8' })).toBe('');
    expect(() => execFileSync('docker', ['inspect', '--', 'mc-alpha'], { stdio: 'pipe' })).toThrow(/real docker/);
    expect(() => execFileSync('docker', ['compose', 'up', '-d', 'mc-alpha'], { stdio: 'pipe' })).toThrow();
  });

  it('reads as a runtime without workloads to the Docker adapter', async () => {
    const runtime = new DockerComposeRuntimeAdapter();
    expect(await runtime.getStatusAsync('mc-alpha')).toBe('not_found');
    expect((await runtime.listStates()).size).toBe(0);
  });
});
