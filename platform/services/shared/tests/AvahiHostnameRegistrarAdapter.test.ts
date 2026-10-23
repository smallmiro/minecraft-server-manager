import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';
import { AvahiHostnameRegistrarAdapter } from '../src/infrastructure/adapters/AvahiHostnameRegistrarAdapter.js';

const SYSTEMCTL = 'systemctl is-active --quiet avahi-daemon';
const OPENRC = 'rc-service avahi-daemon status';
const WHICH = 'which avahi-daemon';

/** execSync succeeds only for the given commands */
const succeeds = (...commands: string[]) =>
  vi.mocked(execSync).mockImplementation(((command: string) => {
    if (!commands.includes(command)) throw new Error(`${command} failed`);
    return Buffer.from('');
  }) as never);

describe('AvahiHostnameRegistrarAdapter.getStatus', () => {
  const registrar = new AvahiHostnameRegistrarAdapter();

  beforeEach(() => vi.resetAllMocks());

  it("is 'running' when systemd reports avahi-daemon active", () => {
    succeeds(SYSTEMCTL);
    expect(registrar.getStatus()).toBe('running');
    expect(execSync).toHaveBeenCalledTimes(1);
    expect(execSync).toHaveBeenCalledWith(SYSTEMCTL, { stdio: 'pipe' });
  });

  it("is 'running' when OpenRC reports avahi-daemon started", () => {
    succeeds(OPENRC);
    expect(registrar.getStatus()).toBe('running');
    expect(execSync).toHaveBeenCalledWith(OPENRC, { stdio: 'pipe' });
  });

  it("is 'installed (not running)' when only the binary is found", () => {
    succeeds(WHICH);
    expect(registrar.getStatus()).toBe('installed (not running)');
    expect(execSync).toHaveBeenCalledWith(WHICH, { stdio: 'pipe' });
  });

  it("is 'not installed' when every probe fails", () => {
    succeeds();
    expect(registrar.getStatus()).toBe('not installed');
    expect(execSync).toHaveBeenCalledTimes(3);
  });

  it('is exported from the package root', async () => {
    const shared = await import('../src/index.js');
    expect(shared.AvahiHostnameRegistrarAdapter).toBe(AvahiHostnameRegistrarAdapter);
  });
});
