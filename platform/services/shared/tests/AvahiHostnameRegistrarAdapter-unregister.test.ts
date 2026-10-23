/**
 * AvahiHostnameRegistrarAdapter.unregister (#735): the avahi step of
 * delete-server.sh, with exactly the command the README sudoers line allows
 * (#751) and the sudo password rules of lib/common.sh (#682, was
 * sudo-password.bats). Temp hosts file; fake sudo and systemctl on PATH.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AvahiHostnameRegistrarAdapter } from '../src/infrastructure/adapters/AvahiHostnameRegistrarAdapter.js';

/** The rule names GNU `sed -i`; avahi is Linux-only (#751). */
const gnuSed = spawnSync('sed', ['--version']).status === 0;

let dir: string;
let hosts: string;
let calls: string;

const HOSTS = [
  '# wood.local note',
  '10.0.0.1 ironwood.local',
  '10.0.0.1 wood.local',
  '10.0.0.1 woodXlocal',
  '10.0.0.2 other # wood.local',
  '10.0.0.1 wood.localdomain',
  '',
].join('\n');

function fake(name: string, body: string): void {
  const file = join(dir, 'bin', name);
  writeFileSync(file, `#!/bin/bash\n${body}\n`);
  chmodSync(file, 0o755);
}

const log = () => (existsSync(calls) ? readFileSync(calls, 'utf-8').trim().split('\n').filter(Boolean) : []);
/** sudo argv lines without the ppid prefix. */
const sudoCalls = () => log().filter((l) => l.startsWith('ppid=')).map((l) => l.replace(/^ppid=\d+ /, ''));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mcctl-avahi-unreg-'));
  hosts = join(dir, 'avahi-hosts');
  calls = join(dir, 'sudo-calls');
  writeFileSync(hosts, HOSTS);
  chmodSync(hosts, 0o640);
  mkdirSync(join(dir, 'bin'));
  // Fake sudo modelled on sudo plus the README sudoers rule:
  //   FAKE_SUDO_MODE=nopasswd (default): NOPASSWD, commands run without a password.
  //   FAKE_SUDO_MODE=password: a command runs only after `-S -v` authenticated from the same parent.
  // Only `tee -a <hosts>`, `sed -i <expr> <hosts>` and `systemctl restart avahi-daemon` are allowed.
  // FAIL_SUDO_CMD=<cmd> makes that command fail. Each call logs argv, ppid, env and the command's stdin.
  fake(
    'sudo',
    `echo "ppid=$PPID $* env=\${MCCTL_SUDO_PASSWORD:-none}" >> "${calls}"
validate=false
while [[ $# -gt 0 ]]; do
  case "$1" in -p) shift 2 ;; -v) validate=true; shift ;; --) shift; break ;; -*) shift ;; *) break ;; esac
done
if $validate; then
  IFS= read -r pw || pw=""
  echo "pw=$pw" >> "${calls}"
  [[ "$pw" == "\${FAKE_SUDO_PASS:-}" ]] || { echo "sudo: 1 incorrect password attempt" >&2; exit 1; }
  echo "$PPID" > "${dir}/timestamp"
  exit 0
fi
if [[ "\${FAKE_SUDO_MODE:-nopasswd}" == password && "$(cat "${dir}/timestamp" 2>/dev/null)" != "$PPID" ]]; then
  echo "sudo: a password is required" >&2; exit 1
fi
case "$*" in
  "tee -a ${hosts}"|"systemctl restart avahi-daemon") ;;
  "sed -i "*" ${hosts}") [[ $# -eq 4 ]] || { echo "denied: $*" >> "${calls}"; exit 1; } ;;
  *) echo "denied: $*" >> "${calls}"; exit 1 ;;
esac
[[ "$1" == "\${FAIL_SUDO_CMD:-}" ]] && exit 1
input="$(mktemp)"; cat > "$input"; echo "stdin=$(cat "$input")" >> "${calls}"
exec "$@" < "$input"`
  );
  fake('systemctl', 'exit "${FAKE_SYSTEMCTL_RC:-0}"');
  vi.stubEnv('PATH', `${join(dir, 'bin')}:${process.env['PATH']}`);
  vi.stubEnv('MCCTL_SUDO_PASSWORD', 'from-env-must-not-leak');
  vi.stubEnv('FAKE_SUDO_PASS', 's3cret pw');
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

const registrar = (sudoPassword?: string) => new AvahiHostnameRegistrarAdapter({ hostsFile: hosts, sudoPassword });
const SED_EXPR = '/^[^#]*[[:space:]]wood\\.local\\([[:space:]]\\|#\\|$\\)/d';

describe.skipIf(!gnuSed)('AvahiHostnameRegistrarAdapter.unregister', () => {
  it('removes only the exact wood.local line with sudo -n sed -i, then restarts avahi-daemon (#660, #751)', async () => {
    expect(await registrar().unregister('wood.local')).toEqual({ status: 'changed' });
    expect(readFileSync(hosts, 'utf-8')).toBe(HOSTS.replace('10.0.0.1 wood.local\n', ''));
    expect(statSync(hosts).mode & 0o777).toBe(0o640);
    expect(sudoCalls()).toEqual([
      `-n sed -i ${SED_EXPR} ${hosts} env=none`,
      '-n systemctl restart avahi-daemon env=none',
    ]);
    expect(log().some((l) => l.startsWith('denied'))).toBe(false);
  });

  it('escapes the dots: a.b.local does not remove aXb.local', async () => {
    writeFileSync(hosts, '10.0.0.1 aXb.local\n10.0.0.1 a.b.local\n');
    expect((await registrar().unregister('a.b.local')).status).toBe('changed');
    expect(readFileSync(hosts, 'utf-8')).toBe('10.0.0.1 aXb.local\n');
  });

  it('leaves the file alone when no line lists the host exactly', async () => {
    writeFileSync(hosts, '# wood.local\n10.0.0.1 ironwood.local\n');
    expect(await registrar().unregister('wood.local')).toEqual({ status: 'unchanged' });
    expect(sudoCalls()).toEqual([]);
  });

  it('a missing hosts file is unchanged (avahi not configured)', async () => {
    rmSync(hosts);
    expect(await registrar().unregister('wood.local')).toEqual({ status: 'unchanged' });
    expect(sudoCalls()).toEqual([]);
  });

  it('skips an invalid hostname without calling sudo', async () => {
    expect((await registrar().unregister('bad host')).status).toBe('skipped');
    expect(sudoCalls()).toEqual([]);
  });

  it('a failed sed leaves the hosts file intact and says how to fix it (#751)', async () => {
    vi.stubEnv('FAIL_SUDO_CMD', 'sed');
    const result = await registrar().unregister('wood.local');
    expect(result).toEqual({ status: 'skipped', reason: expect.stringMatching(/sudo password|manually/) });
    expect(readFileSync(hosts, 'utf-8')).toBe(HOSTS);
  });

  it('reports a restart failure after the line was removed', async () => {
    vi.stubEnv('FAKE_SYSTEMCTL_RC', '1');
    const result = await registrar().unregister('wood.local');
    expect(result).toEqual({ status: 'skipped', reason: expect.stringMatching(/removed.*avahi-daemon/) });
    expect(readFileSync(hosts, 'utf-8')).not.toContain('10.0.0.1 wood.local\n');
  });
});

/** Was sudo-password.bats (#682): the password only authenticates sudo. */
describe.skipIf(!gnuSed)('sudo password (#682)', () => {
  beforeEach(() => vi.stubEnv('FAKE_SUDO_MODE', 'password'));

  it('authenticates with sudo -S -p "" -v on stdin; the command never sees the password', async () => {
    expect((await registrar('s3cret pw').unregister('wood.local')).status).toBe('changed');
    expect(sudoCalls()).toEqual([
      '-S -p  -v env=none',
      `-n sed -i ${SED_EXPR} ${hosts} env=none`,
      '-n systemctl restart avahi-daemon env=none',
    ]);
    expect(log().filter((l) => l.startsWith('stdin='))).toEqual(['stdin=', 'stdin=']);
  });

  it('authentication and command run from the same parent process (sudo keys tty-less credentials by ppid)', async () => {
    await registrar('s3cret pw').unregister('wood.local');
    const ppids = log().filter((l) => l.startsWith('ppid=')).map((l) => l.split(' ')[0]);
    expect(new Set(ppids).size).toBe(1);
  });

  it('a password starting with -n is passed literally', async () => {
    vi.stubEnv('FAKE_SUDO_PASS', '-n');
    expect((await registrar('-n').unregister('wood.local')).status).toBe('changed');
    expect(log()).toContain('pw=-n');
  });

  it('a wrong password fails, writes nothing and names the cause', async () => {
    const result = await registrar('wrong').unregister('wood.local');
    expect(result).toEqual({ status: 'skipped', reason: expect.stringMatching(/sudo authentication failed/) });
    expect(readFileSync(hosts, 'utf-8')).toBe(HOSTS);
  });

  it('without a password and without NOPASSWD it is skipped, and the file is intact', async () => {
    const result = await registrar().unregister('wood.local');
    expect(result.status).toBe('skipped');
    expect(readFileSync(hosts, 'utf-8')).toBe(HOSTS);
  });

  it('an empty password is no password (register and unregister)', async () => {
    vi.stubEnv('FAKE_SUDO_MODE', 'nopasswd');
    const adapter = registrar('');
    vi.spyOn(adapter, 'getStatus').mockReturnValue('running');
    expect((await adapter.unregister('wood.local')).status).toBe('changed');
    expect((await adapter.register('new.local', '192.168.1.10')).status).toBe('changed');
    expect(sudoCalls().some((c) => c.includes('-v'))).toBe(false);
  });
});
