import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recreateStoppedServers } from '../../../src/commands/update.js';

type State = { id: string; status: string } | null;

// No real docker: the shell is a fake (#756). Each containerState call shifts the next state.
describe('recreateStoppedServers (#796)', () => {
  let dir: string;
  let out: string[];
  let states: Record<string, State[]>;
  let compose: ReturnType<typeof vi.fn>;
  const shell = () => ({
    dockerCompose: compose as any,
    containerState: async (c: string): Promise<State> => (states[c]?.length ? states[c].shift()! : null),
  });
  const text = () => out.join('\n');

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mcctl-796-'));
    for (const s of ['_template', 'a', 'b', 'c']) {
      mkdirSync(join(dir, s));
      writeFileSync(join(dir, s, 'docker-compose.yml'), 'services: {}\n');
    }
    out = [];
    vi.spyOn(console, 'log').mockImplementation((m?: unknown) => void out.push(String(m).replace(/\u001b\[[0-9;]*m/g, '')));
    compose = vi.fn().mockResolvedValue(0);
    states = {};
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it('runs compose up --no-start --no-deps only for stopped servers and guides for running ones', async () => {
    states = {
      'mc-a': [{ id: 'old', status: 'exited' }, { id: 'new', status: 'created' }],
      'mc-b': [{ id: 'b', status: 'running' }],
      'mc-c': [{ id: 'x', status: 'created' }, { id: 'x', status: 'created' }],
    };
    await recreateStoppedServers(dir, shell());

    expect(compose.mock.calls).toEqual([
      [['up', '--no-start', '--no-deps', 'mc-a']],
      [['up', '--no-start', '--no-deps', 'mc-c']],
    ]);
    expect(text()).toContain('a: recreated');
    expect(text()).toContain('c: up to date');
    expect(text()).toContain('b: running');
    expect(text()).toContain('mcctl stop <server> && mcctl start <server>');
  });

  it.each(['paused', 'restarting', 'removing', 'dead'])('never touches a %s container', async (status) => {
    states = {
      'mc-a': [{ id: 'a', status }],
      'mc-b': [{ id: 'b', status: 'running' }],
      'mc-c': [{ id: 'c', status: 'running' }],
    };
    await recreateStoppedServers(dir, shell());
    expect(compose).not.toHaveBeenCalled();
  });

  it('skips a server whose container cannot be inspected (a running server must never be recreated by mistake)', async () => {
    states = {
      'mc-a': [null],
      'mc-b': [{ id: 'b', status: 'running' }],
      'mc-c': [{ id: '1', status: 'exited' }, { id: '2', status: 'created' }],
    };
    await recreateStoppedServers(dir, shell());
    expect(compose.mock.calls).toEqual([[['up', '--no-start', '--no-deps', 'mc-c']]]);
    expect(text()).toContain('a: skipped');
  });

  it('reports a failing server and still handles the others', async () => {
    states = {
      'mc-a': [{ id: '1', status: 'exited' }],
      'mc-b': [{ id: 'b', status: 'running' }],
      'mc-c': [{ id: '3', status: 'exited' }, { id: '4', status: 'created' }],
    };
    compose.mockImplementation(async (args: string[]) => (args[3] === 'mc-a' ? 1 : 0));
    await expect(recreateStoppedServers(dir, shell())).resolves.toBeUndefined();
    expect(text()).toContain('a (docker compose up --no-start exited 1)');
    expect(text()).toContain('c: recreated');
  });

  it('reports a container that is gone after compose up as a failure', async () => {
    states = {
      'mc-a': [{ id: '1', status: 'exited' }, null],
      'mc-b': [{ id: 'b', status: 'running' }],
      'mc-c': [{ id: 'c', status: 'running' }],
    };
    await recreateStoppedServers(dir, shell());
    expect(text()).toMatch(/✗ a /);
    expect(text()).not.toContain('a: up to date');
  });

  it('survives a thrown error for one server', async () => {
    states = {
      'mc-b': [{ id: '1', status: 'exited' }, { id: '2', status: 'created' }],
      'mc-c': [{ id: '3', status: 'exited' }, { id: '3', status: 'exited' }],
    };
    const s = shell();
    const real = s.containerState;
    s.containerState = async (c: string) => {
      if (c === 'mc-a') throw new Error('boom');
      return real(c);
    };
    await recreateStoppedServers(dir, s);
    expect(text()).toContain('a (boom)');
    expect(compose).toHaveBeenCalledTimes(2);
  });
});
