/**
 * scripts/upgrade-v3.sh (#787)
 *
 * Runs the real script with bash against a temporary platform root. mcctl, npm,
 * pm2, docker, crontab, curl, git, systemctl are fakes placed first on PATH; they
 * log every call to $FAKE_DIR/calls.log and the stdin they received to stdin.log.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'upgrade-v3.sh');

const FAKE_MCCTL = `#!/bin/sh
D="$FAKE_DIR"
n=$(wc -c | tr -d ' ')
echo "$n" >> "$D/stdin.log"
echo "mcctl $*" >> "$D/calls.log"
case "$1" in
  --version) cat "$D/version" ;;
  update)
    [ -n "$FAKE_UPDATE_FAIL" ] && { echo "update failed" >&2; exit 1; }
    cp "$D/version_after" "$D/version" ;;
  upgrade)
    case "$*" in
      *--dry-run*) echo "DRY RUN: would add DOCKER_GID" ;;
      *) echo "upgraded" ;;
    esac ;;
  migrate) echo "migrate spec: alpha would be imported" ;;
  world) echo "survival  used by alpha"; echo "WARNING: world survival is used by 2 servers" ;;
  console) echo "service restarted" ;;
  backup) echo "pushed" ;;
esac
exit 0
`;

const FAKE_LOGGER = (extra: string) => `#!/bin/sh
echo "$(basename "$0") $*" >> "$FAKE_DIR/calls.log"
${extra}
exit 0
`;

interface Ctx {
  base: string;
  root: string;
  fake: string;
  home: string;
  tmp: string;
}

let ctx: Ctx;

function put(file: string, content: string, mode?: number): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  if (mode) chmodSync(file, mode);
}

const ECOSYSTEM = `module.exports = {
  apps: [
    {
      name: 'mcctl-api',
      script: 'index.js',
      env: {
        AUTH_MODE: 'internal',
      },
      max_memory_restart: '500M',
    },
    {
      name: 'mcctl-console',
      script: 'server.js',
    },
  ],
};
`;

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), 'upgrade-v3-test-'));
  ctx = {
    base,
    root: join(base, 'root'),
    fake: join(base, 'fake'),
    home: join(base, 'home'),
    tmp: join(base, 'tmp'),
  };
  for (const d of [ctx.root, join(ctx.fake, 'bin'), ctx.home, ctx.tmp]) mkdirSync(d, { recursive: true });

  const bin = join(ctx.fake, 'bin');
  put(join(bin, 'mcctl'), FAKE_MCCTL, 0o755);
  put(join(bin, 'npm'), FAKE_LOGGER('[ "$1" = view ] && echo "$FAKE_NPM_LATEST"'), 0o755);
  put(
    join(bin, 'pm2'),
    FAKE_LOGGER(
      `[ "$1" = jlist ] && echo '[{"name":"mcctl-api","pm2_env":{"status":"online","node_version":"'"$(node -p process.versions.node)"'"}},{"name":"mcctl-console","pm2_env":{"status":"online","node_version":"'"$(node -p process.versions.node)"'"}}]'`,
    ),
    0o755,
  );
  put(join(bin, 'docker'), FAKE_LOGGER(''), 0o755);
  put(join(bin, 'curl'), FAKE_LOGGER('echo "{\\"status\\":\\"ok\\"}"'), 0o755);
  put(join(bin, 'git'), FAKE_LOGGER('echo "git version 2.43.0"'), 0o755);
  put(join(bin, 'systemctl'), FAKE_LOGGER(''), 0o755);
  put(
    join(bin, 'crontab'),
    FAKE_LOGGER('if [ "$1" = -l ]; then if [ -n "$FAKE_CRON" ]; then echo "$FAKE_CRON"; else exit 1; fi; fi'),
    0o755,
  );
  put(join(ctx.fake, 'version'), '2.33.0\n');
  put(join(ctx.fake, 'version_after'), '3.0.0\n');

  put(join(ctx.root, 'docker-compose.yml'), 'services: {}\n');
  put(join(ctx.root, '.env'), 'BACKUP_AUTO_ON_STOP=true\nAPI_PORT=5001\n');
  put(join(ctx.root, '.mcctl.json'), '{"templateVersion":"1"}\n');
  put(join(ctx.root, 'ecosystem.config.cjs'), ECOSYSTEM);
  put(join(ctx.root, 'servers/_template/config.env'), 'TYPE=PAPER\n');
  put(join(ctx.root, 'servers/compose.yml'), 'include: []\n');
  put(join(ctx.root, 'servers/alpha/config.env'), 'VERSION=1.21\n');
  put(join(ctx.root, 'servers/alpha/docker-compose.yml'), 'services: {}\n');
  put(join(ctx.root, 'scripts/a.sh'), '#!/bin/sh\necho a\n');
});

afterEach(() => {
  rmSync(ctx.base, { recursive: true, force: true });
});

interface RunOpts {
  env?: Record<string, string>;
  /** extra args after the script (before --root) */
  args?: string[];
  noRoot?: boolean;
}

/** `cat script | bash -s -- args`: the script text is stdin, like curl | bash. */
function run(opts: RunOpts = {}) {
  const args = [...(opts.args ?? []), ...(opts.noRoot ? [] : ['--root', ctx.root])];
  const r = spawnSync('bash', ['-s', '--', ...args], {
    input: readFileSync(SCRIPT, 'utf8'),
    encoding: 'utf8',
    env: {
      PATH: `${join(ctx.fake, 'bin')}:${process.env.PATH}`,
      HOME: ctx.home,
      TMPDIR: ctx.tmp,
      FAKE_DIR: ctx.fake,
      FAKE_NPM_LATEST: '3.0.0',
      MCCTL_UPGRADE_TTY: join(ctx.base, 'no-such-tty'),
      ...opts.env,
    },
    timeout: 60000,
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const calls = () => (existsSync(join(ctx.fake, 'calls.log')) ? readFileSync(join(ctx.fake, 'calls.log'), 'utf8') : '');

function snapshot(dir: string): Record<string, string> {
  const res: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) {
        res[`${relative(dir, p)}/`] = 'dir';
        walk(p);
      } else res[relative(dir, p)] = readFileSync(p, 'utf8');
    }
  };
  walk(dir);
  return res;
}

const backupDir = (): string => {
  const parent = join(ctx.root, 'backups');
  const names = existsSync(parent) ? readdirSync(parent).filter((n) => n.startsWith('upgrade-v3-')) : [];
  expect(names).toHaveLength(1);
  return join(parent, names[0]!);
};

describe('upgrade-v3.sh', () => {
  it('has valid syntax (bash -n)', () => {
    expect(spawnSync('bash', ['-n', SCRIPT]).status).toBe(0);
  });

  it('is shellcheck clean when shellcheck is available', () => {
    const sc = spawnSync('shellcheck', ['--version']);
    if (sc.error || sc.status !== 0) return; // not installed: skip
    const r = spawnSync('shellcheck', [SCRIPT], { encoding: 'utf8' });
    expect(r.stdout).toBe('');
    expect(r.status).toBe(0);
  });

  it('rejects an unknown option and prints help for --help', () => {
    const bad = run({ args: ['--bogus'], noRoot: true });
    expect(bad.code).not.toBe(0);
    expect(bad.out).toContain('--bogus');
    const help = run({ args: ['--help'], noRoot: true });
    expect(help.code).toBe(0);
    expect(help.out).toContain('--dry-run');
  });

  it('--dry-run changes no file and runs no mutating command', () => {
    const before = snapshot(ctx.root);
    const r = run({ args: ['--dry-run'] });
    expect(r.code).toBe(0);
    expect(snapshot(ctx.root)).toEqual(before);
    const c = calls();
    expect(c).not.toMatch(/mcctl update/);
    expect(c).not.toMatch(/mcctl upgrade --non-interactive/);
    expect(c).not.toMatch(/mcctl migrate spec --all$/m);
    expect(c).not.toMatch(/console service restart/);
    expect(c).not.toMatch(/mcctl backup push/);
    expect(c).toMatch(/mcctl upgrade --dry-run/);
    expect(r.out).toMatch(/dry-run/i);
  });

  it('runs to the end when the script itself is stdin and no command reads stdin', () => {
    const r = run({ args: ['--yes'] });
    expect(r.code).toBe(0);
    expect(r.out).toContain('Summary');
    const c = calls();
    expect(c).toMatch(/mcctl update --yes/);
    expect(c).toMatch(/mcctl upgrade --non-interactive/);
    expect(c).toMatch(/mcctl console service restart --force/);
    expect(c).toMatch(/docker compose config -q/);
    const stdin = readFileSync(join(ctx.fake, 'stdin.log'), 'utf8').trim().split('\n');
    expect(stdin.length).toBeGreaterThan(3);
    expect(stdin.every((n) => n === '0')).toBe(true);
    // default answers: nothing is removed or imported
    expect(existsSync(join(ctx.root, 'scripts/a.sh'))).toBe(true);
    expect(c).not.toMatch(/mcctl migrate spec --all$/m);
    expect(c).not.toMatch(/mcctl backup push/);
  });

  it('backs up the listed files outside servers/ and logs to upgrade.log', () => {
    run({ args: ['--yes'] });
    const b = backupDir();
    for (const f of [
      'docker-compose.yml',
      '.env',
      '.mcctl.json',
      'ecosystem.config.cjs',
      'servers/_template/config.env',
      'servers/compose.yml',
      'servers/alpha/config.env',
      'servers/alpha/docker-compose.yml',
      'scripts/a.sh',
      'upgrade.log',
    ]) {
      expect(existsSync(join(b, f)), f).toBe(true);
    }
    expect(readFileSync(join(b, 'upgrade.log'), 'utf8')).toContain('Summary');
  });

  it('without a terminal and without --yes skips every mutating step', () => {
    const before = snapshot(ctx.root);
    const r = run();
    expect(r.code).not.toBe(0); // update was needed but not done: stopped
    expect(snapshot(ctx.root)).toEqual(before);
    const c = calls();
    expect(c).not.toMatch(/mcctl update/);
    expect(c).not.toMatch(/mcctl upgrade --non-interactive/);
    expect(c).not.toMatch(/service restart/);
    expect(r.out).toMatch(/--yes/);
  });

  it('answers typed on the terminal decide each step', () => {
    const answers = join(ctx.base, 'answers');
    put(answers, 'n\n'.repeat(20));
    const r = run({ env: { MCCTL_UPGRADE_TTY: answers } });
    expect(calls()).not.toMatch(/mcctl update/);
    expect(existsSync(join(ctx.root, 'backups'))).toBe(false);
    expect(r.out).toContain('Summary');
  });

  it('--remove-scripts deletes <root>/scripts only after it was backed up', () => {
    run({ args: ['--yes', '--remove-scripts'] });
    expect(existsSync(join(ctx.root, 'scripts'))).toBe(false);
    expect(existsSync(join(backupDir(), 'scripts/a.sh'))).toBe(true);
  });

  it('--remove-scripts without a backup leaves scripts alone', () => {
    const answers = join(ctx.base, 'answers');
    // first question (backup) n, then y for everything else
    put(answers, 'n\n' + 'y\n'.repeat(20));
    run({ args: ['--remove-scripts'], env: { MCCTL_UPGRADE_TTY: answers } });
    expect(existsSync(join(ctx.root, 'scripts/a.sh'))).toBe(true);
  });

  it('removes only the link when scripts is a symbolic link', () => {
    const outside = join(ctx.base, 'outside');
    put(join(outside, 'keep.sh'), 'x');
    rmSync(join(ctx.root, 'scripts'), { recursive: true });
    spawnSync('ln', ['-s', outside, join(ctx.root, 'scripts')]);
    run({ args: ['--yes', '--remove-scripts'] });
    expect(existsSync(join(ctx.root, 'scripts'))).toBe(false);
    expect(existsSync(join(outside, 'keep.sh'))).toBe(true);
  });

  it('adds kill_timeout to the mcctl-api block only, and only once', () => {
    run({ args: ['--yes'] });
    const after = readFileSync(join(ctx.root, 'ecosystem.config.cjs'), 'utf8');
    expect(after.match(/kill_timeout/g)).toHaveLength(1);
    const apiBlock = after.slice(after.indexOf("name: 'mcctl-api'"), after.indexOf("name: 'mcctl-console'"));
    expect(apiBlock).toMatch(/^ {6}kill_timeout: 130000,$/m);
    expect(after.slice(after.indexOf("name: 'mcctl-console'"))).not.toContain('kill_timeout');
    expect(readdirSync(ctx.root).some((n) => n.startsWith('ecosystem.config.cjs.bak-'))).toBe(true);
    // second run: CLI is 3.x now
    run({ args: ['--yes'] });
    expect(readFileSync(join(ctx.root, 'ecosystem.config.cjs'), 'utf8').match(/kill_timeout/g)).toHaveLength(1);
  });

  it('does not add kill_timeout by default when BACKUP_AUTO_ON_STOP is not true', () => {
    put(join(ctx.root, '.env'), 'API_PORT=5001\n');
    run({ args: ['--yes'] });
    expect(readFileSync(join(ctx.root, 'ecosystem.config.cjs'), 'utf8')).not.toContain('kill_timeout');
  });

  it('stops when npm latest is not 3.x', () => {
    const r = run({ args: ['--yes'], env: { FAKE_NPM_LATEST: '2.33.0' } });
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/not (been )?published/i);
    expect(calls()).not.toMatch(/mcctl update/);
    expect(existsSync(join(ctx.root, 'backups'))).toBe(false);
  });

  it('--skip-update proceeds although npm latest is 2.x', () => {
    const r = run({ args: ['--yes', '--skip-update'], env: { FAKE_NPM_LATEST: '2.33.0' } });
    expect(r.code).toBe(0);
    expect(calls()).not.toMatch(/mcctl update/);
    expect(calls()).toMatch(/mcctl upgrade --non-interactive/);
  });

  it('skips the update when the CLI is already 3.x', () => {
    put(join(ctx.fake, 'version'), '3.0.1\n');
    const r = run({ args: ['--yes'], env: { FAKE_NPM_LATEST: '2.0.0' } });
    expect(r.code).toBe(0);
    expect(calls()).not.toMatch(/mcctl update/);
    expect(r.out).toMatch(/already/i);
  });

  it('stops without upgrading when the update fails', () => {
    const r = run({ args: ['--yes'], env: { FAKE_UPDATE_FAIL: '1' } });
    expect(r.code).not.toBe(0);
    expect(calls()).not.toMatch(/mcctl upgrade --non-interactive/);
  });

  it('stops when the updated CLI is still not 3.x', () => {
    put(join(ctx.fake, 'version_after'), '2.40.0\n');
    const r = run({ args: ['--yes'] });
    expect(r.code).not.toBe(0);
    expect(calls()).not.toMatch(/mcctl upgrade --non-interactive/);
  });

  it('checks old AUTH_MODE values when coming from before 2.32.0', () => {
    put(join(ctx.fake, 'version'), '2.31.0\n');
    const r = run({ args: ['--yes'] });
    expect(r.out).toContain('AUTH_MODE');
    expect(r.out).toContain('internal');
    // default is no: the file keeps the old value
    expect(readFileSync(join(ctx.root, 'ecosystem.config.cjs'), 'utf8')).toContain("AUTH_MODE: 'internal'");
  });

  it('rewrites AUTH_MODE after a yes answer', () => {
    put(join(ctx.fake, 'version'), '2.31.0\n');
    const answers = join(ctx.base, 'answers');
    put(answers, 'y\n'.repeat(30));
    run({ env: { MCCTL_UPGRADE_TTY: answers } });
    const after = readFileSync(join(ctx.root, 'ecosystem.config.cjs'), 'utf8');
    expect(after).toContain("AUTH_MODE: 'ip-whitelist',");
    expect(after).toContain("AUTH_IP_WHITELIST: '127.0.0.1,::1,::ffff:127.0.0.1',");
  });

  it('does not ask about AUTH_MODE from 2.32.0 on', () => {
    const r = run({ args: ['--yes'] });
    expect(r.out).not.toMatch(/AUTH_MODE/);
  });

  it('warns about cron jobs that call scripts or player lookup', () => {
    const r = run({ args: ['--dry-run'], env: { FAKE_CRON: '0 3 * * * /home/u/minecraft-servers/scripts/backup.sh push' } });
    expect(r.out).toMatch(/cron/i);
    expect(r.out).toContain('backup.sh');
  });

  it('shows the macOS console note on Darwin', () => {
    put(join(ctx.fake, 'bin/uname'), '#!/bin/sh\necho Darwin\n', 0o755);
    const r = run({ args: ['--dry-run'] });
    expect(r.out).toContain('mcctl exec');
  });

  it('highlights duplicate world warnings', () => {
    const r = run({ args: ['--yes'] });
    expect(r.out).toContain('WARNING: world survival is used by 2 servers');
  });
});
