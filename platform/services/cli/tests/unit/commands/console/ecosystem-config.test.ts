/**
 * The generated PM2 config gives mcctl-api time to finish an auto-backup on
 * shutdown (#734): PM2's default kill_timeout (1.6 s) would SIGKILL the API
 * before its onClose hook lets a backup re-enable auto-save (save-on).
 */
import { describe, it, expect } from 'vitest';
import vm from 'node:vm';
import { API_PM2_KILL_TIMEOUT_MS, AUTO_BACKUP_CLOSE_WAIT_MS } from '@minecraft-docker/shared';
import { generateEcosystemConfig } from '../../../../src/commands/console/init.js';

function apps(installApi: boolean, installConsole: boolean, accessMode = 'internal'): Array<Record<string, unknown>> {
  const source = generateEcosystemConfig(
    5001,
    5000,
    '/opt/api/dist/index.js',
    '/opt/console/server.js',
    false,
    { installApi, installConsole },
    { accessMode, apiKey: accessMode.startsWith('api-key') ? 'mctk_x' : null, allowedIps: ['192.168.1.0/24'] },
    '/srv/mcctl'
  );
  const mod = { exports: {} as { apps?: Array<Record<string, unknown>> } };
  vm.runInNewContext(source, { module: mod, process: { env: {} } });
  return mod.exports.apps ?? [];
}

describe('generateEcosystemConfig kill_timeout', () => {
  it('gives mcctl-api a kill_timeout longer than the auto-backup close wait', () => {
    const api = apps(true, true).find((a) => a.name === 'mcctl-api');

    expect(api?.kill_timeout).toBe(API_PM2_KILL_TIMEOUT_MS);
    expect(API_PM2_KILL_TIMEOUT_MS).toBeGreaterThan(AUTO_BACKUP_CLOSE_WAIT_MS);
  });

  it('leaves mcctl-console on the PM2 default', () => {
    const console = apps(true, true).find((a) => a.name === 'mcctl-console');
    expect(console).toBeDefined();
    expect(console?.kill_timeout).toBeUndefined();
  });
});

describe('generateEcosystemConfig bind address (#833)', () => {
  const env = (app: Record<string, unknown> | undefined) => app?.env as Record<string, unknown>;

  it('binds mcctl-api to 127.0.0.1 in internal mode, which allows only local clients', () => {
    expect(env(apps(true, true).find((a) => a.name === 'mcctl-api')).HOST).toBe('127.0.0.1');
  });

  it.each(['api-key', 'ip-whitelist', 'api-key-ip', 'open'])('keeps 0.0.0.0 in %s mode', (mode) => {
    expect(env(apps(true, true, mode).find((a) => a.name === 'mcctl-api')).HOST).toBe('0.0.0.0');
  });

  it('points the console at the IPv4 loopback the API listens on', () => {
    expect(env(apps(true, true).find((a) => a.name === 'mcctl-console')).MCCTL_API_URL).toBe('http://127.0.0.1:5001');
  });
});
