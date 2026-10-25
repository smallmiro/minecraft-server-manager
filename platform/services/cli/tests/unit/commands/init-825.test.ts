import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initCommand } from '../../../src/commands/init.js';
import * as promptsModule from '@clack/prompts';
import { execSync } from 'node:child_process';

vi.mock('@clack/prompts');
vi.mock('../../../src/lib/prompts/ip-select.js', () => ({
  selectHostIPs: vi.fn(),
  getNetworkInterfaces: vi.fn(() => []),
}));
vi.mock('../../../src/commands/playit.js', () => ({ ensurePlayitService: vi.fn() }));
vi.mock('../../../src/lib/server-config.js', () => ({
  rerenderServers: vi.fn(async () => ({ updated: [], failed: [] })),
}));
vi.mock('@minecraft-docker/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@minecraft-docker/shared')>();
  return { ...actual, checkPlatformPrerequisites: vi.fn(() => ({ hasErrors: false, results: [] })) };
});
vi.mock('node:child_process', () => ({ execFile: vi.fn(), execSync: vi.fn(), spawnSync: vi.fn() }));

describe('init command (#825)', () => {
  const root = join(process.cwd(), 'tests', `.tmp-825-test-${process.pid}`);
  let out: string[];

  const selectIps = async (value: string | null) => {
    const { selectHostIPs } = await import('../../../src/lib/prompts/ip-select.js');
    vi.mocked(selectHostIPs).mockResolvedValueOnce(value);
  };
  const env = () => readFileSync(join(root, '.env'), 'utf-8');

  beforeEach(() => {
    vi.clearAllMocks();
    rmSync(root, { recursive: true, force: true });
    mkdirSync(root, { recursive: true });
    vi.mocked(promptsModule.isCancel).mockReturnValue(false);
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));
    out = [];
    vi.spyOn(console, 'log').mockImplementation((m?: unknown) => void out.push(String(m).replace(/\u001b\[[0-9;]*m/g, '')));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  describe('fresh init', () => {
    it('clears the template placeholder HOST_IP when the IP selection is cancelled', async () => {
      await selectIps(null);
      vi.mocked(promptsModule.confirm).mockResolvedValueOnce(false);
      await initCommand({ root, skipValidation: true, skipDocker: true });
      expect(env()).toMatch(/^HOST_IP=$/m);
    });

    it('prints "mcctl router start" before the connection step and the real data directory', async () => {
      await selectIps('10.0.0.5');
      vi.mocked(promptsModule.confirm).mockResolvedValueOnce(false);
      await initCommand({ root, skipValidation: true, skipDocker: true });
      const text = out.join('\n');
      expect(text).toContain('mcctl router start');
      expect(text.indexOf('mcctl router start')).toBeLessThan(text.indexOf('Connect via Minecraft'));
      expect(text).not.toContain('~/.minecraft-servers');
      expect(text).toContain('~/minecraft-servers');
    });

    it('adds the playit compose service for --playit-key', async () => {
      const { ensurePlayitService } = await import('../../../src/commands/playit.js');
      await selectIps('10.0.0.5');
      await initCommand({ root, skipValidation: true, skipDocker: true, playitKey: 'abc' });
      expect(ensurePlayitService).toHaveBeenCalledTimes(1);
    });

    it('adds the playit compose service when enabled interactively', async () => {
      const { ensurePlayitService } = await import('../../../src/commands/playit.js');
      await selectIps('10.0.0.5');
      vi.mocked(promptsModule.confirm).mockResolvedValueOnce(true);
      vi.mocked(promptsModule.password).mockResolvedValueOnce('abc');
      await initCommand({ root, skipValidation: true, skipDocker: true });
      expect(ensurePlayitService).toHaveBeenCalledTimes(1);
    });

    it('does not add the playit service with --no-playit', async () => {
      const { ensurePlayitService } = await import('../../../src/commands/playit.js');
      await selectIps('10.0.0.5');
      await initCommand({ root, skipValidation: true, skipDocker: true, noPlayit: true });
      expect(ensurePlayitService).not.toHaveBeenCalled();
    });
  });

  describe('reconfigure', () => {
    beforeEach(async () => {
      await selectIps('10.0.0.5');
      await initCommand({ root, skipValidation: true, skipDocker: true, noPlayit: true });
      vi.clearAllMocks();
      vi.mocked(promptsModule.isCancel).mockReturnValue(false);
      writeFileSync(join(root, '.env'), env().replace(/^HOST_IP=.*$/m, 'HOST_IP=10.0.0.5\nHOST_IPS=10.0.0.5,100.64.0.1'));
      vi.mocked(promptsModule.multiselect).mockResolvedValueOnce(['HOST_IP']);
    });

    it('drops HOST_IPS when a single IP is chosen (HOST_IPS wins over HOST_IP)', async () => {
      await selectIps('192.168.0.9');
      vi.mocked(promptsModule.confirm).mockResolvedValue(false);
      await initCommand({ root, reconfigure: true });
      const hostIps = env().match(/^HOST_IPS=(.*)$/m)?.[1]?.replace(/"/g, '') ?? '';
      expect(hostIps).toBe('');
      expect(env()).toContain('192.168.0.9');
    });

    it('restarts the compose service "router" and tells to recreate the servers', async () => {
      await selectIps('192.168.0.9');
      vi.mocked(promptsModule.confirm).mockResolvedValue(true);
      await initCommand({ root, reconfigure: true });
      expect(vi.mocked(execSync).mock.calls.map((c) => c[0])).toContain('docker compose restart router');
      expect(out.join('\n')).toMatch(/stop.*start|recreate/i);
    });
  });
});
