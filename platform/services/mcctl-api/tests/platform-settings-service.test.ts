import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, statSync, lstatSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import {
  PlatformSettingsService,
  PlatformNotInitializedError,
  PlatformSettingsStaleError,
  PlatformSettingsValidationError,
} from '../src/services/PlatformSettingsService.js';

const ENV = `# platform
HOST_IP=192.168.1.10
DOCKER_GID=999
TZ=Asia/Seoul
EXTRA_ARGS="--forceUpgrade"
RCON_PASSWORD=rconsecret123
RCON_PORT=25575
BACKUP_GITHUB_TOKEN=ghp_oldtoken
BACKUP_GITHUB_REPO=me/backup
LOG_LEVEL=info
MINECRAFT_NETWORK=minecraft-net
DEFAULT_MEMORY=4G
DEFAULT_VERSION=1.21.1
MCCTL_JWT_SECRET=jwtsecretvalue
BETTER_AUTH_SECRET=envauthsecret
BETTER_AUTH_BASE_URL=http://old:5000
MCCTL_SUDO_PASSWORD=sudopw
MY_CUSTOM=hello
`;
const ECOSYSTEM = `module.exports = { apps: [ { name: 'mcctl-console', env: {
  BETTER_AUTH_SECRET: 'ecosystemsecret',
  BETTER_AUTH_BASE_URL: 'http://localhost:5000',
} } ] };
`;

describe('PlatformSettingsService', () => {
  let dir: string;
  let envPath: string;
  let proc: Record<string, string | undefined>;
  let svc: PlatformSettingsService;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'plat-settings-'));
    envPath = join(dir, '.env');
    writeFileSync(envPath, ENV);
    writeFileSync(join(dir, 'ecosystem.config.cjs'), ECOSYSTEM);
    proc = { LOG_LEVEL: 'info', BACKUP_GITHUB_TOKEN: 'ghp_oldtoken', BACKUP_GITHUB_REPO: 'me/backup', AUTH_MODE: 'api-key' };
    svc = new PlatformSettingsService(dir, join(dir, 'ecosystem.config.cjs'), proc);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const find = (r: { settings: any[] }, key: string) => r.settings.find((s) => s.key === key);

  it('classifies keys', async () => {
    const r = await svc.get();
    expect(find(r, 'HOST_IP')).toMatchObject({ status: 'supported', source: 'platform-env', editable: true, value: '192.168.1.10', restartScope: 'next-create' });
    expect(find(r, 'MINECRAFT_NETWORK')).toMatchObject({ status: 'readonly', editable: false, value: 'minecraft-net' });
    expect(find(r, 'DEFAULT_MEMORY')).toMatchObject({ status: 'legacy', source: 'legacy' });
    expect(find(r, 'DEFAULT_VERSION')).toMatchObject({ status: 'legacy' });
    expect(find(r, 'BETTER_AUTH_SECRET')).toMatchObject({ status: 'shadowed', source: 'shadowed', differsFromEnv: true, secret: true });
    expect(find(r, 'BETTER_AUTH_BASE_URL')).toMatchObject({ status: 'shadowed', differsFromEnv: true, value: 'http://old:5000' });
    expect(find(r, 'MY_CUSTOM')).toMatchObject({ status: 'unknown', source: 'unknown', editable: true, value: 'hello' });
    expect(find(r, 'EXTRA_ARGS').value).toBe('--forceUpgrade');
  });

  it('lists absent supported keys without value', async () => {
    const s = find(await svc.get(), 'PLAYIT_SECRET_KEY');
    expect(s).toMatchObject({ secret: true, configured: false });
    expect(s.value).toBeUndefined();
  });

  it('masks secrets, including heuristic ones; plaintext never serialized', async () => {
    const r = await svc.get();
    const json = JSON.stringify(r);
    for (const p of ['rconsecret123', 'ghp_oldtoken', 'jwtsecretvalue', 'envauthsecret', 'sudopw', 'ecosystemsecret']) {
      expect(json).not.toContain(p);
    }
    expect(find(r, 'MCCTL_SUDO_PASSWORD')).toMatchObject({ secret: true, type: 'secret', configured: true });
    expect(find(r, 'MCCTL_JWT_SECRET')).toMatchObject({ secret: true, configured: true });
    expect(find(r, 'RCON_PASSWORD')).toMatchObject({ configured: true });
  });

  it('computes applied for api-scope keys', async () => {
    proc.LOG_LEVEL = 'debug';
    proc.BACKUP_GITHUB_TOKEN = 'different';
    const r = await svc.get();
    expect(find(r, 'LOG_LEVEL').applied).toBe(false);
    expect(find(r, 'BACKUP_GITHUB_TOKEN').applied).toBe(false);
    expect(find(r, 'BACKUP_GITHUB_REPO').applied).toBe(true);
    expect(find(r, 'HOST_IP').applied).toBeUndefined();
  });

  it('probes ecosystem by text parse and never returns secret', async () => {
    const r = await svc.get();
    expect(r.runtime).toEqual(
      expect.arrayContaining([
        { key: 'BETTER_AUTH_BASE_URL', source: 'pm2-ecosystem', value: 'http://localhost:5000' },
        { key: 'BETTER_AUTH_SECRET', source: 'pm2-ecosystem', configured: true },
        { key: 'AUTH_MODE', source: 'pm2-ecosystem', value: 'api-key' },
      ]),
    );
  });

  it('does not evaluate the ecosystem file', async () => {
    writeFileSync(join(dir, 'ecosystem.config.cjs'), `throw new Error('evaluated'); // BETTER_AUTH_BASE_URL: 'http://x'\nBETTER_AUTH_BASE_URL: 'http://x',\n`);
    const r = await svc.get();
    expect(r.runtime.find((x) => x.key === 'BETTER_AUTH_BASE_URL')?.value).toBe('http://x');
  });

  it('throws NotInitialized when .env missing', async () => {
    rmSync(envPath);
    await expect(svc.get()).rejects.toBeInstanceOf(PlatformNotInitializedError);
  });

  describe('update', () => {
    it('sets and removes, bumps revision, returns scopes', async () => {
      const { revision } = await svc.get();
      const res = await svc.update({ revision, set: { HOST_IP: '10.0.0.5', LOG_LEVEL: 'debug' }, remove: ['MY_CUSTOM'] });
      expect(res.changedKeys.sort()).toEqual(['HOST_IP', 'LOG_LEVEL']);
      expect(res.removedKeys).toEqual(['MY_CUSTOM']);
      expect(res.restartScopes.sort()).toEqual(['api', 'next-create', 'servers']); // MY_CUSTOM (unknown) reaches all server containers
      expect(res.revision).not.toBe(revision);
      const text = readFileSync(envPath, 'utf8');
      expect(text).toContain('HOST_IP=10.0.0.5');
      expect(text).not.toContain('MY_CUSTOM');
      expect(text).toContain('# platform');
      expect(text).toContain('EXTRA_ARGS="--forceUpgrade"');
      expect(statSync(envPath).mode & 0o777).toBe(0o600);
      expect((await svc.get()).revision).toBe(res.revision);
    });

    it('stale revision -> StaleError, file unchanged', async () => {
      await expect(svc.update({ revision: 'bogus', set: { HOST_IP: '10.0.0.5' }, remove: [] })).rejects.toBeInstanceOf(PlatformSettingsStaleError);
      expect(readFileSync(envPath, 'utf8')).toBe(ENV);
    });

    it('blank secret preserves; non-blank rotates; remove clears', async () => {
      let { revision } = await svc.get();
      let r = await svc.update({ revision, set: { RCON_PASSWORD: '', TZ: 'UTC' }, remove: [] });
      expect(r.changedKeys).toEqual(['TZ']);
      expect(readFileSync(envPath, 'utf8')).toContain('RCON_PASSWORD=rconsecret123');
      r = await svc.update({ revision: r.revision, set: { RCON_PASSWORD: 'new pass' }, remove: [] });
      expect(readFileSync(envPath, 'utf8')).toContain("RCON_PASSWORD='new pass'");
      r = await svc.update({ revision: r.revision, set: {}, remove: ['RCON_PASSWORD'] });
      expect(readFileSync(envPath, 'utf8')).not.toContain('RCON_PASSWORD');
      expect(JSON.stringify(r)).not.toContain('new pass');
    });

    it('rejects everything before writing when any key invalid, with field errors', async () => {
      const { revision } = await svc.get();
      const err = await svc
        .update({
          revision,
          set: { HOST_IP: '999.1.1.1', RCON_PORT: '0', LOG_LEVEL: 'loud', MINECRAFT_NETWORK: 'x', 'bad key': 'v', MY_CUSTOM: "it's", BACKUP_GITHUB_REPO: 'nope', TZ: 'Not/AZone', DOCKER_GID: '70000', BACKUP_AUTO_ON_STOP: 'yes', HOST_IPS: '1.1.1.1,abc' },
          remove: ['COMPOSE_PROJECT_NAME'],
        })
        .catch((e) => e);
      expect(err).toBeInstanceOf(PlatformSettingsValidationError);
      const keys = err.errors.map((e: any) => e.key).sort();
      expect(keys).toEqual(['BACKUP_AUTO_ON_STOP', 'BACKUP_GITHUB_REPO', 'COMPOSE_PROJECT_NAME', 'DOCKER_GID', 'HOST_IPS', 'HOST_IP', 'LOG_LEVEL', 'MINECRAFT_NETWORK', 'MY_CUSTOM', 'RCON_PORT', 'TZ', 'bad key'].sort());
      expect(JSON.stringify(err.errors)).not.toContain("it's");
      expect(readFileSync(envPath, 'utf8')).toBe(ENV);
    });

    it('rejects key in both set and remove, and CR/LF/NUL values', async () => {
      const { revision } = await svc.get();
      const err = await svc.update({ revision, set: { MY_CUSTOM: 'a\nb', HOST_IP: '1.1.1.1' }, remove: ['HOST_IP'] }).catch((e) => e);
      expect(err).toBeInstanceOf(PlatformSettingsValidationError);
      expect(err.errors.map((e: any) => e.key).sort()).toEqual(['HOST_IP', 'MY_CUSTOM']);
    });

    it('shell metacharacters are written literally (bash source round-trip)', async () => {
      const { revision } = await svc.get();
      await svc.update({ revision, set: { EXTRA_ARGS: '$(touch pwned) a;b' }, remove: [] });
      const out = execFileSync('bash', ['-c', `cd ${dir}; set -a; source .env; printf %s "$EXTRA_ARGS"`]).toString();
      expect(out).toBe('$(touch pwned) a;b');
    });

    it('does not replace a symlinked .env', async () => {
      const real = join(dir, 'real.env');
      writeFileSync(real, ENV);
      rmSync(envPath);
      symlinkSync(real, envPath);
      const { revision } = await svc.get();
      await svc.update({ revision, set: { TZ: 'UTC' }, remove: [] });
      expect(lstatSync(envPath).isSymbolicLink()).toBe(true);
      expect(readFileSync(real, 'utf8')).toContain('TZ=UTC');
    });

    it('removes shadowed legacy keys explicitly but set on shadowed is rejected', async () => {
      const { revision } = await svc.get();
      const err = await svc.update({ revision, set: { BETTER_AUTH_SECRET: 'x' }, remove: [] }).catch((e) => e);
      expect(err).toBeInstanceOf(PlatformSettingsValidationError);
      const r = await svc.update({ revision, set: {}, remove: ['BETTER_AUTH_SECRET', 'DEFAULT_MEMORY'] });
      expect(r.removedKeys.sort()).toEqual(['BETTER_AUTH_SECRET', 'DEFAULT_MEMORY']);
    });
  });
});
