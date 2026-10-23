/**
 * AvahiHostnameRegistrarAdapter.register (#675, ADR-0003 §5): the commands
 * the README sudoers lines allow, as argv without a shell, against a temp
 * hosts file with fake sudo / systemctl on PATH. Replaces the
 * register_avahi_hostname cases of create-server-avahi.bats.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AvahiHostnameRegistrarAdapter } from '../src/infrastructure/adapters/AvahiHostnameRegistrarAdapter.js';

let dir: string;
let hosts: string;
let calls: string;

function fake(name: string, body: string): void {
  const file = join(dir, 'bin', name);
  writeFileSync(file, `#!/bin/bash\n${body}\n`);
  chmodSync(file, 0o755);
}

const sudoCalls = () => (existsSync(calls) ? readFileSync(calls, 'utf-8').trim().split('\n').filter(Boolean) : []);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mcctl-avahi-'));
  hosts = join(dir, 'avahi-hosts');
  calls = join(dir, 'sudo-calls');
  writeFileSync(hosts, '');
  mkdirSync(join(dir, 'bin'));
  // Fake sudo: log argv (and whether a password reached the environment), read the
  // password for -S -v, otherwise drop the options and run the command.
  fake(
    'sudo',
    [
      `echo "$* env=\${MCCTL_SUDO_PASSWORD:-none}" >> "${calls}"`,
      'if [[ " $* " == *" -v "* ]]; then read -r pw; echo "pw=$pw" >> ' + `"${calls}"` + '; exit "${FAKE_SUDO_AUTH_RC:-0}"; fi',
      '[[ -n "${FAKE_SUDO_RC:-}" ]] && exit "$FAKE_SUDO_RC"',
      'while [[ "${1:-}" == -* ]]; do shift; done',
      'exec "$@"',
    ].join('\n')
  );
  fake('systemctl', 'exit "${FAKE_SYSTEMCTL_RC:-0}"');
  vi.stubEnv('PATH', `${join(dir, 'bin')}:${process.env['PATH']}`);
  vi.stubEnv('MCCTL_SUDO_PASSWORD', 'from-env-must-not-leak');
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

const registrar = (sudoPassword?: string) => {
  const adapter = new AvahiHostnameRegistrarAdapter({ hostsFile: hosts, sudoPassword });
  vi.spyOn(adapter, 'getStatus').mockReturnValue('running');
  return adapter;
};

describe('AvahiHostnameRegistrarAdapter.register', () => {
  it('appends "<ip> <host>" with sudo -n tee -a, then restarts avahi-daemon', async () => {
    expect(await registrar().register('alpha.local', '192.168.1.10')).toEqual({ status: 'changed' });
    expect(readFileSync(hosts, 'utf-8')).toBe('192.168.1.10 alpha.local\n');
    expect(sudoCalls()).toEqual([
      `-n tee -a ${hosts} env=none`,
      '-n systemctl restart avahi-daemon env=none',
    ]);
  });

  it('authenticates a given password with sudo -S -p "" -v on stdin only', async () => {
    expect((await registrar('s3cret pw').register('alpha.local', '192.168.1.10')).status).toBe('changed');
    expect(sudoCalls()).toEqual([
      '-S -p  -v env=none',
      'pw=s3cret pw',
      `-n tee -a ${hosts} env=none`,
      '-n systemctl restart avahi-daemon env=none',
    ]);
  });

  it("treats an empty password (the console's default) like none: sudo -n, no -S -v", async () => {
    expect(await registrar('').register('alpha.local', '192.168.1.10')).toEqual({ status: 'changed' });
    expect(sudoCalls()).toEqual([
      `-n tee -a ${hosts} env=none`,
      '-n systemctl restart avahi-daemon env=none',
    ]);
  });

  it('skips a wrong password without writing', async () => {
    vi.stubEnv('FAKE_SUDO_AUTH_RC', '1');
    const result = await registrar('wrong').register('alpha.local', '192.168.1.10');
    expect(result).toEqual({ status: 'skipped', reason: expect.stringMatching(/sudo/) });
    expect(readFileSync(hosts, 'utf-8')).toBe('');
  });

  it('skips when sudo refuses (no NOPASSWD, no password) and never rejects', async () => {
    vi.stubEnv('FAKE_SUDO_RC', '1');
    const result = await registrar().register('alpha.local', '192.168.1.10');
    expect(result.status).toBe('skipped');
    expect(result.reason).toMatch(/\/etc\/avahi\/hosts|sudo/);
  });

  it('skips when avahi-daemon cannot be restarted', async () => {
    vi.stubEnv('FAKE_SYSTEMCTL_RC', '1');
    expect((await registrar().register('alpha.local', '192.168.1.10')).status).toBe('skipped');
  });

  it.each(['192.168.1.10,100.64.0.5', '999.1.1.1', '192.168.1', 'not-an-ip', '192.168.1.10 extra', ''])(
    'skips a value that is not one IPv4 address (%j) without calling sudo',
    async (ip) => {
      const result = await registrar().register('alpha.local', ip);
      expect(result).toEqual({ status: 'skipped', reason: expect.stringMatching(/IPv4/) });
      expect(sudoCalls()).toEqual([]);
    }
  );

  it('skips an invalid hostname without calling sudo', async () => {
    expect((await registrar().register('bad host', '192.168.1.10')).status).toBe('skipped');
    expect(sudoCalls()).toEqual([]);
  });

  it('skips when avahi-daemon is not installed', async () => {
    const adapter = registrar();
    vi.mocked(adapter.getStatus).mockReturnValue('not installed');
    expect((await adapter.register('alpha.local', '192.168.1.10')).status).toBe('skipped');
    expect(sudoCalls()).toEqual([]);
  });

  it('leaves an exact entry alone (#660)', async () => {
    writeFileSync(hosts, '10.0.0.1 wood.local\n');
    expect(await registrar().register('wood.local', '192.168.1.10')).toEqual({ status: 'unchanged' });
    expect(sudoCalls()).toEqual([]);
  });

  it.each(['10.0.0.1 ironwood.local\n10.0.0.1 woodXlocal\n', '# wood.local\n'])(
    'still registers when only a similar name or a comment matches (%j, #660)',
    async (content) => {
      writeFileSync(hosts, content);
      expect((await registrar().register('wood.local', '192.168.1.10')).status).toBe('changed');
      expect(readFileSync(hosts, 'utf-8')).toContain('192.168.1.10 wood.local\n');
    }
  );
});
