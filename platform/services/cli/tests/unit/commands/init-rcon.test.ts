import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { initCommand } from '../../../src/commands/init.js';
import * as promptsModule from '@clack/prompts';
import { Paths } from '@minecraft-docker/shared';
import { execSync } from 'node:child_process';

vi.mock('@clack/prompts');

vi.mock('../../../src/lib/prompts/ip-select.js', () => ({
  selectHostIPs: vi.fn(),
  getNetworkInterfaces: vi.fn(() => []),
}));

vi.mock('@minecraft-docker/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@minecraft-docker/shared')>();
  return {
    ...actual,
    checkPlatformPrerequisites: vi.fn(() => ({
      hasErrors: false,
      results: [],
    })),
  };
});

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
  execSync: vi.fn(),
  spawnSync: vi.fn(),
}));

describe('init command - RCON password', () => {
  const testRoot = join(process.cwd(), 'tests', `.tmp-rcon-test-${process.pid}`);
  const rcon = () => readFileSync(join(testRoot, '.env'), 'utf-8').match(/^RCON_PASSWORD=(.*)$/m)?.[1];
  const run = () => initCommand({ root: testRoot, skipValidation: true, skipDocker: true });

  beforeEach(async () => {
    vi.clearAllMocks();
    rmSync(testRoot, { recursive: true, force: true });
    mkdirSync(testRoot, { recursive: true });
    vi.mocked(promptsModule.isCancel).mockReturnValue(false);
    vi.mocked(promptsModule.confirm).mockResolvedValue(false);
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));
    const { selectHostIPs } = await import('../../../src/lib/prompts/ip-select.js');
    vi.mocked(selectHostIPs).mockResolvedValue('192.168.1.100');
  });

  afterEach(() => rmSync(testRoot, { recursive: true, force: true }));

  it('copies servers/global.env so servers receive RCON_PASSWORD (#685)', async () => {
    expect(await run()).toBe(0);
    expect(readFileSync(join(testRoot, 'servers', 'global.env'), 'utf-8')).toMatch(/^RCON_PASSWORD$/m);
    expect(readFileSync(join(testRoot, 'servers', '_template', 'docker-compose.yml'), 'utf-8')).toContain('- ../global.env');
  });

  it('writes a random RCON_PASSWORD (>=16 chars, not changeme)', async () => {
    expect(await run()).toBe(0);
    const pw = rcon();
    expect(pw).toBeDefined();
    expect(pw!.length).toBeGreaterThanOrEqual(16);
    expect(pw).not.toBe('changeme');
  });

  it('keeps the existing password on re-init', async () => {
    await run();
    const first = rcon();
    expect(await run()).toBe(0);
    expect(rcon()).toBe(first);
  });

  it('generates a different password for each new platform', async () => {
    await run();
    const first = rcon();
    rmSync(testRoot, { recursive: true, force: true });
    mkdirSync(testRoot, { recursive: true });
    await run();
    expect(rcon()).not.toBe(first);
  });
});
