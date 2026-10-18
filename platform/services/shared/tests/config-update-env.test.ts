import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Config, Paths } from '../src/index.js';

describe('Config.updateEnv', () => {
  let dir: string;
  let envPath: string;
  let config: Config;

  const read = () => readFileSync(envPath, 'utf-8');
  /** Value of `key` after `set -a; source .env` (how backup.sh loads it). */
  const sourced = (key: string) =>
    execFileSync('bash', ['-c', `set -a; source "$1"; printf %s "\${${key}}"`, '_', envPath], { encoding: 'utf-8', cwd: dir });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mcctl-update-env-'));
    envPath = join(dir, '.env');
    config = new Config(new Paths(dir));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('replaces existing keys, appends new ones and keeps other lines', async () => {
    writeFileSync(envPath, '# comment\nTZ=UTC\nRCON_PORT=25575\n');
    await config.updateEnv({ TZ: 'Asia/Seoul', BACKUP_AUTO_ON_STOP: true });
    expect(read()).toBe('# comment\nTZ=Asia/Seoul\nRCON_PORT=25575\nBACKUP_AUTO_ON_STOP=true\n');
  });

  test('quotes values so bash sources them literally', async () => {
    writeFileSync(envPath, 'TZ=UTC\n');
    const token = 'ghp_a b$(touch pwned)`id`;#x';
    await config.updateEnv({ BACKUP_GITHUB_TOKEN: token });
    expect(sourced('BACKUP_GITHUB_TOKEN')).toBe(token);
    expect(readdirSync(dir)).not.toContain('pwned');
  });

  test('rejects unrepresentable values and leaves the file untouched', async () => {
    writeFileSync(envPath, 'TZ=UTC\n');
    await expect(config.updateEnv({ BACKUP_GITHUB_TOKEN: "it's" })).rejects.toThrow(/single quote/);
    await expect(config.updateEnv({ BACKUP_GITHUB_TOKEN: 'a\nEVIL=1' })).rejects.toThrow();
    expect(read()).toBe('TZ=UTC\n');
  });

  test('writes atomically with 0600 and leaves no temp files', async () => {
    await config.updateEnv({ TZ: 'UTC' });
    expect(read()).toBe('TZ=UTC\n');
    expect(statSync(envPath).mode & 0o777).toBe(0o600);
    expect(readdirSync(dir)).toEqual(['.env']);
  });
});
