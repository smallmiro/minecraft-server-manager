/**
 * Worlds inside servers/<n>/data and `mcctl migrate worlds` (#655), with a
 * temporary root and a fake docker on PATH: no real container is touched.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli, isCliBuild } from './helpers.js';

let root: string;
let env: Record<string, string>;
const log = () => (existsSync(join(root, 'docker.log')) ? readFileSync(join(root, 'docker.log'), 'utf-8') : '');
const data = (...p: string[]) => join(root, 'servers', 'alpha', 'data', ...p);
const configEnv = () => readFileSync(join(root, 'servers', 'alpha', 'config.env'), 'utf-8');

beforeAll(async () => {
  if (!(await isCliBuild())) throw new Error('CLI not built. Run "pnpm build" in cli directory first.');
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-e2e-migrate-'));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  // Logs every call; says mc-alpha exists; notes whether the world was still in data/ when it was removed
  writeFileSync(
    join(bin, 'docker'),
    `#!/bin/sh
echo "$*" >> "${root}/docker.log"
case "$*" in
  *"rm -f"*) [ -d "${data('alpha')}" ] && echo before-move >> "${root}/docker.log" ;;
  "ps -a"*|"compose ps"*) echo mc-alpha ;;
esac
exit 0
`,
    { mode: 0o755 }
  );
  env = { PATH: `${bin}:${process.env.PATH}`, MCCTL_ROOT: root };

  writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
  mkdirSync(data('alpha'), { recursive: true });
  writeFileSync(data('alpha', 'level.dat'), 'alpha');
  mkdirSync(data('alpha_nether'));
  writeFileSync(join(root, 'servers', 'alpha', 'config.env'), 'TYPE=PAPER\nLEVEL=alpha\n');
  writeFileSync(
    join(root, 'servers', 'alpha', 'docker-compose.yml'),
    readFileSync(join(__dirname, '../../templates/servers/_template/docker-compose.yml'), 'utf-8').replace(/template/g, 'alpha')
  );
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('servers that keep their world in servers/<n>/data (#655)', () => {
  it('mcctl status says the server needs migration', async () => {
    const r = await runCli(['status', '--root', root], { env });
    expect(r.stderr).toContain('needs migration (mcctl migrate worlds --server alpha)');
  });

  it('mcctl world list says the server needs migration', async () => {
    const r = await runCli(['world', 'list', '--root', root], { env });
    expect(r.stdout + r.stderr).toContain('servers/alpha/data/alpha: needs migration');
  });
});

describe('mcctl migrate worlds (#655)', () => {
  it('--dry-run shows the real moves and changes nothing', async () => {
    const r = await runCli(['migrate', 'worlds', '--server', 'alpha', '--dry-run', '--root', root], { env });

    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain(`${data('alpha')} → ${join(root, 'worlds', 'alpha')}`);
    expect(r.stdout).toContain(`${data('alpha_nether')} → ${join(root, 'worlds', 'alpha_nether')}`);
    expect(existsSync(data('alpha', 'level.dat'))).toBe(true);
    expect(log()).not.toContain('rm');
  });

  it('removes the container before moving data/<LEVEL> and its dimensions, and does not start it', async () => {
    const r = await runCli(['migrate', 'worlds', '--server', 'alpha', '--force', '--root', root], { env });

    expect(r.exitCode).toBe(0);
    expect(readFileSync(join(root, 'worlds', 'alpha', 'level.dat'), 'utf-8')).toBe('alpha');
    expect(existsSync(join(root, 'worlds', 'alpha_nether'))).toBe(true);
    expect(configEnv()).toMatch(/^LEVEL=alpha$/m);
    expect(configEnv()).toMatch(/^EXTRA_ARGS=--universe \/worlds\/$/m);
    expect(log()).toContain('compose rm -f mc-alpha');
    expect(log()).toContain('before-move');
    expect(log()).not.toMatch(/\bup\b|\bstart\b/);
  });

  it('stops with nothing changed when worlds/<LEVEL> already exists', async () => {
    mkdirSync(join(root, 'worlds', 'alpha'), { recursive: true });

    const r = await runCli(['migrate', 'worlds', '--server', 'alpha', '--force', '--root', root], { env });

    expect(r.exitCode).toBe(1);
    expect(existsSync(data('alpha', 'level.dat'))).toBe(true);
    expect(configEnv()).toBe('TYPE=PAPER\nLEVEL=alpha\n');
    expect(log()).not.toContain('rm');
  });
});
