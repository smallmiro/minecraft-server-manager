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
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'upgrade-v3.sh');
// The host's PATH without directories holding a real mcctl, so the script never
// sees (or runs) an install outside the test; node is linked into the fake bin.
const HOST_PATH = (process.env.PATH ?? '')
  .split(':')
  .filter((d) => d && !existsSync(join(d, 'mcctl')))
  .join(':');

const FAKE_MCCTL = `#!/bin/sh
D="$FAKE_DIR"
n=$(wc -c | tr -d ' ')
echo "$n" >> "$D/stdin.log"
echo "mcctl $*" >> "$D/calls.log"
case "$1" in
  --version) cat "$D/version" ;;
  update)
    [ -n "$FAKE_UPDATE_FAIL" ] && { echo "update failed" >&2; exit 1; }
    # a spinner and colours, as clack prints them
    printf '\\033[?25l\\033[2K\\033[1G\\033[35m◒\\033[39m  Updating\\033[?25h\\n'
    cp "$D/version_after" "$D/version" ;;
  upgrade)
    case "$*" in
      *--dry-run*) echo "DRY RUN: would add DOCKER_GID" ;;
      *) echo "upgraded" ;;
    esac ;;
  migrate) echo "migrate spec: alpha would be imported" ;;
  world)
    [ -n "$FAKE_WORLD_FAIL" ] && { echo "world list failed" >&2; exit 1; }
    printf '\\033[1msurvival\\033[22m  alpha, beta\\n'
    echo "[WARN] World 'survival' is assigned to alpha, beta; only one server may use a world" >&2 ;;
  console)
    # Like the real CLI: with api and console installed and no --api/--console,
    # it asks which to restart, which fails without a terminal (#794)
    case " $* " in
      *" --api "* | *" --console "*) ;;
      *) echo "[ERROR] Unexpected error: TTY initialization failed: uv_tty_init returned EINVAL" >&2; exit 1 ;;
    esac
    [ -n "$FAKE_RESTART_FAIL" ] && { echo "restart failed" >&2; exit 1; }
    # PM2 registers the apps again from the file: the fake pm2 reports this kill_timeout
    [ -z "$FAKE_RESTART_NOOP" ] && grep -oE 'kill_timeout: [0-9]+' "$MCCTL_ROOT/ecosystem.config.cjs" 2>/dev/null | head -n 1 | grep -oE '[0-9]+' > "$D/pm2_kill"
    echo "service restarted" ;;
  backup) echo "pushed" ;;
esac
exit 0
`;

const FAKE_LOGGER = (extra: string) => `#!/bin/sh
echo "$(wc -c | tr -d ' ')" >> "$FAKE_DIR/stdin.log"
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
  symlinkSync(process.execPath, join(bin, 'node'));
  put(join(bin, 'mcctl'), FAKE_MCCTL, 0o755);
  put(
    join(bin, 'npm'),
    FAKE_LOGGER('[ "$1" = view ] && echo "$FAKE_NPM_LATEST"; [ "$1" = prefix ] && echo "$FAKE_NPM_PREFIX"'),
    0o755,
  );
  put(
    join(bin, 'pm2'),
    FAKE_LOGGER(`if [ "$1" = jlist ]; then
  v=$(node -p process.versions.node); k=$(cat "$FAKE_DIR/pm2_kill" 2>/dev/null)
  echo '[{"name":"mcctl-api","pm2_env":{"status":"online","node_version":"'"$v"'"'"\${k:+,\\"kill_timeout\\":$k}"'}},{"name":"mcctl-console","pm2_env":{"status":"online","node_version":"'"$v"'"}}]'
fi`),
    0o755,
  );
  // inspect answers from $FAKE_DIR/<container>.state and .image; compose up gives a new image
  put(
    join(bin, 'docker'),
    FAKE_LOGGER(`case "$1" in
  inspect)
    case "$3" in
      *State.Status*) cat "$FAKE_DIR/$4.state" 2>/dev/null ;;
      *Config.Image*) echo "itzg/minecraft-server:java21" ;;
      *) cat "$FAKE_DIR/$4.image" 2>/dev/null ;;
    esac ;;
  compose)
    case "$*" in
      *"up --no-start"*)
        [ -n "$FAKE_COMPOSE_FAIL" ] && exit 1
        for a; do :; done
        echo "sha256:new" > "$FAKE_DIR/$a.image" ;;
    esac ;;
esac`),
    0o755,
  );
  put(
    join(bin, 'curl'),
    FAKE_LOGGER(
      `n=$(grep -c '^curl ' "$FAKE_DIR/calls.log"); if [ "$n" -le "\${FAKE_CURL_FAIL_FIRST:-0}" ]; then exit 22; fi; echo '{"status":"ok"}'`,
    ),
    0o755,
  );
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
      PATH: `${join(ctx.fake, 'bin')}:${HOST_PATH}`,
      HOME: ctx.home,
      TMPDIR: ctx.tmp,
      FAKE_DIR: ctx.fake,
      FAKE_NPM_LATEST: '3.0.0',
      FAKE_NPM_PREFIX: ctx.fake, // the fake mcctl is <prefix>/bin/mcctl
      MCCTL_UPGRADE_TTY: join(ctx.base, 'no-such-tty'),
      MCCTL_UPGRADE_HEALTH_WAIT: '0',
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
    expect(r.out).not.toContain('several mcctl installs'); // the host's own mcctl is not on PATH
    const c = calls();
    expect(c).toMatch(/mcctl update --yes/);
    expect(c).toMatch(/mcctl upgrade --non-interactive/);
    expect(c).toMatch(/mcctl console service restart --console --force/);
    expect(c).toMatch(/docker compose config -q/);
    const stdin = readFileSync(join(ctx.fake, 'stdin.log'), 'utf8').trim().split('\n');
    expect(stdin.length).toBeGreaterThan(8);
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

  it('keeps escape sequences on screen but not in upgrade.log', () => {
    const r = run({ args: ['--yes'] });
    expect(r.out).toContain('\x1b[35m◒');
    const log = readFileSync(join(backupDir(), 'upgrade.log'), 'utf8');
    expect(log).toContain('◒  Updating');
    expect(log).toContain('survival  alpha, beta');
    expect(log).not.toContain('\x1b');
  });

  it('says that the update also pulls server images', () => {
    const r = run({ args: ['--yes'] });
    expect(r.out).toMatch(/\? Run 'mcctl update --yes' \(.*pulls server images.*\)\?/);
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
    expect(r.out.slice(r.out.indexOf('Warnings:'))).toContain('      0 3 * * * /home/u/minecraft-servers/scripts/backup.sh push');
  });

  it('shows the macOS console note on Darwin', () => {
    put(join(ctx.fake, 'bin/uname'), '#!/bin/sh\necho Darwin\n', 0o755);
    const r = run({ args: ['--dry-run'] });
    expect(r.out).toContain('mcctl exec');
  });

  it('passes verification without probing the API when the web console is not set up', () => {
    rmSync(join(ctx.root, 'ecosystem.config.cjs'));
    put(join(ctx.fake, 'bin', 'pm2'), FAKE_LOGGER('[ "$1" = jlist ] && echo "[]"'), 0o755);
    const r = run({ args: ['--yes'] });
    expect(r.out).toContain('API: not set up here (no ecosystem.config.cjs)');
    expect(calls()).not.toContain('curl');
    expect(r.out).toMatch(/\[ok\] Step 8 Verify/);
    expect(r.code).toBe(0);
  });

  it('does not warn about several installs when PATH lists the same mcctl twice', () => {
    const bin = join(ctx.fake, 'bin');
    // Only system dirs besides the fake bin, so a real mcctl on the host does not count
    const r = run({ args: ['--dry-run'], env: { PATH: `${bin}:${bin}:/usr/bin:/bin` } });
    expect(r.out).toContain('mcctl version: 2.33.0');
    expect(r.out).not.toContain('several mcctl installs');
  });

  describe('several mcctl installs', () => {
    const otherInstall = (): string => {
      put(join(ctx.base, 'other/bin/mcctl'), '#!/bin/sh\necho 2.33.0\n', 0o755);
      return `${join(ctx.fake, 'bin')}:${join(ctx.base, 'other/bin')}:${HOST_PATH}`;
    };

    it('stops in pre-flight, before any change, when npm installs into another prefix', () => {
      const nvm = join(ctx.base, 'nvm');
      mkdirSync(nvm);
      put(
        join(ctx.root, 'ecosystem.config.cjs'),
        ECOSYSTEM.replace("script: 'index.js',", "script: 'index.js',\n      interpreter: '/opt/node22/bin/node',"),
      );
      const before = snapshot(ctx.root);
      for (const args of [['--yes'], ['--dry-run']]) {
        const r = run({ args, env: { FAKE_NPM_PREFIX: nvm } });
        expect(r.code, args[0]).not.toBe(0);
        expect(r.out).toContain(`is not under npm's global prefix (${nvm})`);
        expect(r.out).toContain('export PATH="/opt/node22/bin:$PATH"');
        expect(r.out).toContain('did not finish');
      }
      expect(snapshot(ctx.root)).toEqual(before);
      expect(calls()).not.toMatch(/mcctl (update|upgrade)/);
    });

    it('suggests nvm use with PM2\'s Node major when the ecosystem names no interpreter', () => {
      const nvm = join(ctx.base, 'nvm');
      mkdirSync(nvm);
      const r = run({ args: ['--yes'], env: { FAKE_NPM_PREFIX: nvm } });
      expect(r.out).toContain(`nvm use ${process.versions.node.split('.')[0]}`);
    });

    it('does not check the prefix when the update is skipped', () => {
      const nvm = join(ctx.base, 'nvm');
      mkdirSync(nvm);
      const r = run({ args: ['--yes', '--skip-update'], env: { FAKE_NPM_PREFIX: nvm } });
      expect(r.code).toBe(0);
      expect(r.out).not.toContain("npm's global prefix");
    });

    it('shows the paths in the warning and how to update the installs left behind', () => {
      const r = run({ args: ['--yes'], env: { PATH: otherInstall() } });
      expect(r.code).toBe(0);
      const warnings = r.out.slice(r.out.indexOf('Warnings:'));
      expect(warnings).toContain(
        `several mcctl installs found (the first one runs):\n      ${join(ctx.fake, 'bin/mcctl')}\n      ${join(ctx.base, 'other/bin/mcctl')}\n`,
      );
      const todo = r.out.slice(r.out.indexOf('Still to do by hand'), r.out.indexOf('Rollback'));
      expect(todo).toContain(`npm install -g --prefix ${join(ctx.base, 'other')} @minecraft-docker/mcctl@3.0.0`);
    });
  });

  it('highlights duplicate world warnings', () => {
    const r = run({ args: ['--yes'] });
    expect(r.out).toContain("World 'survival' is assigned to alpha, beta");
    expect(r.out).toMatch(/world list shows warnings/);
    expect(r.out.slice(r.out.indexOf('Warnings:'))).toContain("      [WARN] World 'survival' is assigned to alpha, beta");
  });
  it('every fake command, not only mcctl, got empty stdin', () => {
    run({ args: ['--yes'] });
    const lines = readFileSync(join(ctx.fake, 'stdin.log'), 'utf8').trim().split('\n');
    expect(lines.length).toBeGreaterThan(15);
    expect(lines.every((n) => n === '0')).toBe(true);
    expect(calls()).toMatch(/^docker /m);
    expect(calls()).toMatch(/^curl /m);
  });

  it('shows world warnings written to stderr in the real wording', () => {
    const r = run({ args: ['--yes'] });
    expect(r.out).toMatch(/! world list shows warnings/);
    const u = run({ args: ['--yes'], env: { FAKE_WORLD_FAIL: '1' } });
    expect(u.out).toMatch(/! mcctl world list failed/);
  });

  it('leaves a one-line ecosystem object alone and says to add it by hand', () => {
    const one = "module.exports = { apps: [{ name: 'mcctl-api', script: 'x' }] };\n";
    put(join(ctx.root, 'ecosystem.config.cjs'), one);
    const r = run({ args: ['--yes'] });
    expect(readFileSync(join(ctx.root, 'ecosystem.config.cjs'), 'utf8')).toBe(one);
    expect(r.out).toMatch(/add .*kill_timeout.* by hand/);
  });

  it('handles a double-quoted name and ignores kill_timeout of another app', () => {
    put(
      join(ctx.root, 'ecosystem.config.cjs'),
      'module.exports = {\n  apps: [\n    {\n      name: "mcctl-api",\n      script: "a.js",\n    },\n    {\n      name: "mcctl-console",\n      kill_timeout: 5,\n    },\n  ],\n};\n',
    );
    run({ args: ['--yes'] });
    const after = readFileSync(join(ctx.root, 'ecosystem.config.cjs'), 'utf8');
    expect(after).toMatch(/name: "mcctl-api",\n {6}kill_timeout: 130000,/);
    expect(after.match(/kill_timeout/g)).toHaveLength(2);
  });

  it('ignores a commented name line', () => {
    put(
      join(ctx.root, 'ecosystem.config.cjs'),
      "module.exports = {\n  apps: [\n    // name: 'mcctl-api',\n    {\n      name: 'mcctl-api',\n      script: 'a.js',\n    },\n  ],\n};\n",
    );
    run({ args: ['--yes'] });
    const after = readFileSync(join(ctx.root, 'ecosystem.config.cjs'), 'utf8');
    expect(after).toMatch(/name: 'mcctl-api',\n {6}kill_timeout: 130000,/);
    expect(after.match(/kill_timeout/g)).toHaveLength(1);
  });

  it('restores the file and does not restart when the edit fails verification', () => {
    // the first name line is inside a block comment, so the edit lands in the comment
    const eco =
      "module.exports = {\n  apps: [\n    /*\n      name: 'mcctl-api',\n    */\n    {\n      name: 'mcctl-api',\n      script: 'a.js',\n    },\n  ],\n};\n";
    put(join(ctx.root, 'ecosystem.config.cjs'), eco);
    const r = run({ args: ['--yes'] });
    expect(readFileSync(join(ctx.root, 'ecosystem.config.cjs'), 'utf8')).toBe(eco);
    expect(calls()).not.toMatch(/console service restart/);
    expect(r.out).toMatch(/\[failed\] Step 5/);
    expect(r.code).toBe(1);
  });

  it('does not edit an ecosystem file that is a symbolic link', () => {
    const real = join(ctx.base, 'real-eco.cjs');
    put(real, ECOSYSTEM);
    rmSync(join(ctx.root, 'ecosystem.config.cjs'));
    spawnSync('ln', ['-s', real, join(ctx.root, 'ecosystem.config.cjs')]);
    const r = run({ args: ['--yes'] });
    expect(readFileSync(real, 'utf8')).toBe(ECOSYSTEM);
    expect(r.out).toMatch(/symbolic link/);
  });

  it('skips the ecosystem step when the file cannot be loaded', () => {
    put(join(ctx.root, 'ecosystem.config.cjs'), 'module.exports = {{{\n');
    const r = run({ args: ['--yes'] });
    expect(r.out).toMatch(/cannot load ecosystem\.config\.cjs/);
    expect(calls()).not.toMatch(/console service restart/);
  });

  it('stops when the folder is not a platform root', () => {
    rmSync(join(ctx.root, 'docker-compose.yml'));
    rmSync(join(ctx.root, '.env'));
    const r = run({ args: ['--yes'] });
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/not a platform root/);
    expect(calls()).not.toMatch(/mcctl update/);
  });

  it('exits 1 when any step failed and lists the restart to do by hand', () => {
    const r = run({ args: ['--yes'], env: { FAKE_RESTART_FAIL: '1' } });
    expect(r.out).toMatch(/\[failed\] Step 5/);
    expect(r.code).toBe(1);
    const todo = r.out.slice(r.out.indexOf('Still to do by hand'), r.out.indexOf('Rollback'));
    expect(todo).toContain('mcctl console service restart --console --force');
  });

  it('checks that PM2 runs mcctl-api with the kill_timeout of the file', () => {
    const ok = run({ args: ['--yes'] });
    expect(ok.out).toContain('PM2 mcctl-api kill_timeout: 130000 (ok)');
    expect(ok.code).toBe(0);
  });

  it('fails step 8 when PM2 did not pick up the new kill_timeout', () => {
    // the restart "succeeds" but PM2 keeps the old registration
    const r = run({ args: ['--yes'], env: { FAKE_RESTART_NOOP: '1' } });
    expect(r.out).toMatch(/\[ok\] Step 5/);
    expect(r.out).toMatch(/PM2 mcctl-api kill_timeout: -, but ecosystem\.config\.cjs has 130000/);
    expect(r.out).toMatch(/\[failed\] Step 8 Verify/);
    expect(r.code).toBe(1);
    const todo = r.out.slice(r.out.indexOf('Still to do by hand'), r.out.indexOf('Rollback'));
    expect(todo).toContain('mcctl console service restart --console --force');
  });

  it('prints a rollback for the files, the CLI, the services and the restart', () => {
    for (const p of ['mcctl-api', 'mcctl-console', 'shared']) {
      put(join(ctx.root, '.services/node_modules/@minecraft-docker', p, 'package.json'), '{}');
    }
    const r = run({ args: ['--yes'] });
    const rb = r.out.slice(r.out.indexOf('Rollback'));
    expect(rb).toContain(`Copy these back from ${backupDir()} to the same paths under ${ctx.root}`);
    for (const f of [
      'docker-compose.yml',
      '.env',
      '.mcctl.json',
      'ecosystem.config.cjs',
      'servers/_template',
      'servers/compose.yml',
      'servers/alpha/config.env',
      'servers/alpha/docker-compose.yml',
      'scripts',
    ]) {
      expect(rb, f).toContain(`\n      ${f}\n`);
    }
    expect(rb).toContain('docker compose up -d router');
    expect(rb).toContain('  npm install -g @minecraft-docker/mcctl@2.33.0\n');
    expect(rb).toContain(
      `  cd ${join(ctx.root, '.services')} && npm install @minecraft-docker/mcctl-api@2.33.0 @minecraft-docker/mcctl-console@2.33.0 @minecraft-docker/shared@2.33.0\n`,
    );
    expect(rb).toContain('  mcctl console service restart --console --force\n');
  });

  it('rolls back services installed in the root itself (no .services)', () => {
    put(join(ctx.root, 'node_modules/@minecraft-docker/mcctl-api/package.json'), '{}');
    const r = run({ args: ['--yes'] });
    expect(r.out.slice(r.out.indexOf('Rollback'))).toContain(
      `  cd ${ctx.root} && npm install @minecraft-docker/mcctl-api@2.33.0\n`,
    );
  });

  describe('stopped servers (step 7b)', () => {
    const server = (name: string, state: string): void => {
      put(join(ctx.root, `servers/${name}/config.env`), 'VERSION=1.21\n');
      put(join(ctx.fake, `mc-${name}.state`), `${state}\n`);
      put(join(ctx.fake, `mc-${name}.image`), 'sha256:old\n');
    };

    it('recreates stopped servers with --yes and leaves running ones to the user', () => {
      server('alpha', 'exited');
      server('beta', 'running');
      const r = run({ args: ['--yes'] });
      expect(calls()).toMatch(/^docker compose up --no-start --no-deps mc-alpha$/m);
      expect(calls()).not.toMatch(/up --no-start --no-deps mc-beta/);
      expect(r.out).toMatch(/Running: beta .*mcctl stop <server> && mcctl start <server>/);
      expect(r.out).toMatch(/\[ok\] Step 7b/);
      expect(r.code).toBe(0);
      expect(r.out.slice(r.out.indexOf('Rollback'))).toContain(
        'docker tag sha256:old itzg/minecraft-server:java21 && docker compose up --no-start --no-deps mc-alpha',
      );
    });

    it('only shows the plan on a dry run', () => {
      server('alpha', 'exited');
      const r = run({ args: ['--dry-run'] });
      expect(r.out).toContain('Stopped: mc-alpha');
      expect(r.out).toMatch(/\[dry-run\] would ask .*docker compose up --no-start --no-deps/);
      expect(calls()).not.toMatch(/compose up/);
      expect(readFileSync(join(ctx.fake, 'mc-alpha.image'), 'utf8')).toBe('sha256:old\n');
    });

    it('skips when no server container is stopped', () => {
      server('beta', 'running');
      const r = run({ args: ['--yes'] });
      expect(calls()).not.toMatch(/compose up/);
      expect(r.out).toMatch(/\[skipped\] Step 7b .* - no stopped servers/);
    });

    it('fails the step when recreating a server fails', () => {
      server('alpha', 'exited');
      const r = run({ args: ['--yes'], env: { FAKE_COMPOSE_FAIL: '1' } });
      expect(r.out).toMatch(/\[failed\] Step 7b .*mc-alpha/);
      expect(r.code).toBe(1);
    });
  });

  it('retries the API health check', () => {
    const r = run({ args: ['--yes'], env: { FAKE_CURL_FAIL_FIRST: '2' } });
    expect(r.code).toBe(0);
    expect(calls().match(/^curl /gm)).toHaveLength(3);
    const f = run({ args: ['--yes', '--skip-update'], env: { FAKE_CURL_FAIL_FIRST: '99' } });
    expect(f.code).toBe(1);
  });

  it('copies a broken symbolic link as a link and goes on', () => {
    rmSync(join(ctx.root, 'servers/compose.yml'));
    spawnSync('ln', ['-s', '/no/such/target', join(ctx.root, 'servers/compose.yml')]);
    const r = run({ args: ['--yes'] });
    expect(r.code).toBe(0);
    const copy = join(backupDir(), 'servers/compose.yml');
    expect(lstatSync(copy).isSymbolicLink()).toBe(true);
  });

  it('runs nothing when the download is cut inside the last line', () => {
    const text = readFileSync(SCRIPT, 'utf8');
    const lastLine = text.trimEnd().split('\n').pop()!;
    const head = text.slice(0, text.lastIndexOf(lastLine));
    for (const cut of ['{ main', '{ main "$@"', '{ main "$@";', '{ main "$@"; exit $?;']) {
      const r = spawnSync('bash', ['-s', '--', '--yes', '--root', ctx.root], {
        input: head + cut,
        encoding: 'utf8',
        env: { PATH: `${join(ctx.fake, 'bin')}:${HOST_PATH}`, HOME: ctx.home, TMPDIR: ctx.tmp, FAKE_DIR: ctx.fake },
      });
      expect(r.status, cut).not.toBe(0);
    }
    expect(calls()).toBe('');
  });

  it('says the upgrade did not finish when it stopped early', () => {
    const r = run({ args: ['--yes'], env: { FAKE_UPDATE_FAIL: '1' } });
    expect(r.out).toMatch(/did not finish/);
    expect(r.out).not.toContain('Still to do by hand');
  });

  it('labels the dry-run preview as the v2 CLI plan', () => {
    const r = run({ args: ['--dry-run'] });
    expect(r.out).toContain('plan of the v2 CLI installed now');
  });
});
