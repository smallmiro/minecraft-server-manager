import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync, execFileSync } from 'node:child_process';
import { restartRouterService, ensureMinecraftNetwork } from '../../src/infrastructure/compose-project.js';

vi.mock('node:child_process', () => ({ execSync: vi.fn(), execFileSync: vi.fn() }));

describe('compose-project', () => {
  beforeEach(() => vi.clearAllMocks());

  it('restartRouterService uses the compose service name "router", not the container name (#825)', () => {
    restartRouterService('/srv/mc');
    expect(execSync).toHaveBeenCalledWith('docker compose restart router', expect.objectContaining({ cwd: '/srv/mc' }));
  });

  it('ensureMinecraftNetwork creates the network with the given name and subnet (#657)', () => {
    vi.mocked(execFileSync).mockImplementationOnce(() => { throw new Error('no such network'); });
    expect(ensureMinecraftNetwork('mynet', '10.9.0.0/16')).toBe('created');
    expect(execFileSync).toHaveBeenLastCalledWith(
      'docker',
      ['network', 'create', '--driver', 'bridge', '--subnet', '10.9.0.0/16', 'mynet'],
      expect.anything()
    );
  });

  it('ensureMinecraftNetwork defaults to minecraft-net / 172.28.0.0/16', () => {
    vi.mocked(execFileSync).mockImplementationOnce(() => { throw new Error('x'); });
    ensureMinecraftNetwork();
    expect(execFileSync).toHaveBeenLastCalledWith('docker', expect.arrayContaining(['172.28.0.0/16', 'minecraft-net']), expect.anything());
  });
});
