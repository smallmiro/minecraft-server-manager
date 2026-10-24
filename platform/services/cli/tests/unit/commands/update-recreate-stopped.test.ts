import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recreateStoppedServers } from '../../../src/commands/update.js';

// No real docker: the shell and the status query are fakes (#756).
describe('recreateStoppedServers (#796)', () => {
  let dir: string;
  let out: string[];
  let ids: Record<string, string[]>;
  let compose: ReturnType<typeof vi.fn>;
  const shell = () => ({
    dockerCompose: compose as any,
    containerId: async (c: string) => ids[c]?.shift() ?? '',
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mcctl-796-'));
    for (const s of ['_template', 'a', 'b', 'c']) {
      mkdirSync(join(dir, s));
      writeFileSync(join(dir, s, 'docker-compose.yml'), 'services: {}\n');
    }
    out = [];
    vi.spyOn(console, 'log').mockImplementation((m?: unknown) => void out.push(String(m).replace(/\u001b\[[0-9;]*m/g, '')));
    compose = vi.fn().mockResolvedValue(0);
    ids = {};
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it('runs compose up --no-start --no-deps only for stopped servers and guides for running ones', async () => {
    ids = { 'mc-a': ['old', 'new'], 'mc-c': ['x', 'x'] };
    await recreateStoppedServers(dir, shell(), async (c) => c === 'mc-b');

    expect(compose.mock.calls).toEqual([
      [['up', '--no-start', '--no-deps', 'mc-a']],
      [['up', '--no-start', '--no-deps', 'mc-c']],
    ]);
    const text = out.join('\n');
    expect(text).toContain('a: recreated');
    expect(text).toContain('c: up to date');
    expect(text).toContain('b: running');
    expect(text).toContain('mcctl stop <server> && mcctl start <server>');
  });

  it('reports a failing server and still handles the others', async () => {
    ids = { 'mc-a': ['1', '2'], 'mc-c': ['3', '4'] };
    compose.mockImplementation(async (args: string[]) => (args[3] === 'mc-a' ? 1 : 0));
    await expect(recreateStoppedServers(dir, shell(), async (c) => c === 'mc-b')).resolves.toBeUndefined();

    const text = out.join('\n');
    expect(text).toContain('a (docker compose up --no-start exited 1)');
    expect(text).toContain('c: recreated');
  });

  it('survives a thrown error for one server', async () => {
    const isRunning = vi.fn(async (c: string) => {
      if (c === 'mc-a') throw new Error('boom');
      return false;
    });
    await recreateStoppedServers(dir, shell(), isRunning);
    expect(out.join('\n')).toContain('a (boom)');
    expect(compose).toHaveBeenCalledTimes(2);
  });
});
