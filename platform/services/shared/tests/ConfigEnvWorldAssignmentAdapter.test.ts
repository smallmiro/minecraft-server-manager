/**
 * ConfigEnvWorldAssignmentAdapter (#670, ADR-0002): assignments derived from
 * servers/<n>/config.env, real files in a temp dir. Replaces lock.bats.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, statSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Paths } from '../src/utils/index.js';
import { ConfigEnvWorldAssignmentAdapter } from '../src/infrastructure/adapters/ConfigEnvWorldAssignmentAdapter.js';
import { WorldAssignmentError } from '../src/domain/services/worldAssignment.js';

const UNIVERSE = 'EXTRA_ARGS=--universe /worlds/\n';

let root: string;
let adapter: ConfigEnvWorldAssignmentAdapter;

function server(name: string, configEnv: string): string {
  mkdirSync(join(root, 'servers', name), { recursive: true });
  const file = join(root, 'servers', name, 'config.env');
  writeFileSync(file, configEnv);
  return file;
}

async function rejection(promise: Promise<unknown>): Promise<WorldAssignmentError> {
  const error = await promise.then(
    () => {
      throw new Error('expected a rejection');
    },
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(WorldAssignmentError);
  return error as WorldAssignmentError;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-assign-'));
  adapter = new ConfigEnvWorldAssignmentAdapter(new Paths(root));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('listAssignments', () => {
  it('returns an empty snapshot when servers/ does not exist', async () => {
    expect(await adapter.listAssignments()).toEqual({ assignments: [], undetermined: [] });
  });

  it('reads LEVEL, the legacy WORLD_NAME, and falls back to "world"', async () => {
    server('c', `TYPE=PAPER\n${UNIVERSE}`);
    server('a', `LEVEL=alpha\n${UNIVERSE}`);
    server('b', `WORLD_NAME=legacy\n${UNIVERSE}`);
    server('d', `LEVEL=wins\nWORLD_NAME=loses\n${UNIVERSE}`);

    expect(await adapter.listAssignments()).toEqual({
      assignments: [
        { server: 'a', world: 'alpha', internal: false },
        { server: 'b', world: 'legacy', internal: false },
        { server: 'c', world: 'world', internal: false },
        { server: 'd', world: 'wins', internal: false },
      ],
      undetermined: [],
    });
  });

  it('skips _template and directories without config.env', async () => {
    server('_template', 'LEVEL=template\n');
    mkdirSync(join(root, 'servers', 'empty'), { recursive: true });
    server('a', `LEVEL=a\n${UNIVERSE}`);

    const snapshot = await adapter.listAssignments();
    expect(snapshot.assignments.map((a) => a.server)).toEqual(['a']);
    expect(snapshot.undetermined).toEqual([]);
  });

  it('keeps legacy names such as "My World" (quoted or bare)', async () => {
    server('a', `LEVEL="My World"\n${UNIVERSE}`);
    server('b', `LEVEL=world.old\n${UNIVERSE}`);

    const snapshot = await adapter.listAssignments();
    expect(snapshot.assignments.map((a) => a.world)).toEqual(['My World', 'world.old']);
    expect(snapshot.undetermined).toEqual([]);
  });

  it.each(['LEVEL=../x', 'LEVEL=..', 'LEVEL=a/b', 'LEVEL="it\'s"', 'LEVEL=a\\b'])(
    'marks %s as undetermined (R7)',
    async (line) => {
      server('bad', `${line}\n${UNIVERSE}`);
      server('ok', `LEVEL=ok\n${UNIVERSE}`);

      const snapshot = await adapter.listAssignments();
      expect(snapshot.undetermined).toEqual(['bad']);
      expect(snapshot.assignments.map((a) => a.server)).toEqual(['ok']);
    }
  );

  it('marks an unreadable config.env (a directory) as undetermined', async () => {
    mkdirSync(join(root, 'servers', 'broken', 'config.env'), { recursive: true });

    expect(await adapter.listAssignments()).toEqual({ assignments: [], undetermined: ['broken'] });
  });

  it('detects a server-internal world (no --universe)', async () => {
    server('old', 'LEVEL=old\nEXTRA_ARGS=-Dfoo=bar\n');
    server('none', 'LEVEL=none\n');

    const snapshot = await adapter.listAssignments();
    expect(snapshot.assignments.map((a) => a.internal)).toEqual([true, true]);
  });

  it('ignores worlds/.locks entirely', async () => {
    server('a', `LEVEL=a\n${UNIVERSE}`);
    mkdirSync(join(root, 'worlds', '.locks'), { recursive: true });
    writeFileSync(join(root, 'worlds', '.locks', 'shared.lock'), 'a:1700000000:1\n');

    expect(await adapter.listAssignments()).toEqual({
      assignments: [{ server: 'a', world: 'a', internal: false }],
      undetermined: [],
    });
  });
});

describe('assign', () => {
  it('writes LEVEL, keeps every other line byte-identical and keeps the file mode', async () => {
    const original = `# comment\nTYPE=PAPER\nLEVEL=old\r\nMOTD='hi there'\n${UNIVERSE}`;
    const file = server('a', original);
    chmodSync(file, 0o640);

    await adapter.assign('new', 'a');

    expect(readFileSync(file, 'utf-8')).toBe(original.replace('LEVEL=old\r', 'LEVEL=new'));
    expect(statSync(file).mode & 0o777).toBe(0o640);
  });

  it('appends LEVEL when the server had none', async () => {
    const file = server('a', `TYPE=PAPER\n${UNIVERSE}`);

    await adapter.assign('new', 'a');

    expect(readFileSync(file, 'utf-8')).toBe(`TYPE=PAPER\n${UNIVERSE}LEVEL=new\n`);
  });

  it('is a no-op when the server already holds the world', async () => {
    const file = server('a', `LEVEL="a"\n${UNIVERSE}`);
    const before = statSync(file).mtimeMs;

    await adapter.assign('a', 'a');

    expect(readFileSync(file, 'utf-8')).toBe(`LEVEL="a"\n${UNIVERSE}`);
    expect(statSync(file).mtimeMs).toBe(before);
  });

  it('refuses a world held by another server and leaves both files unchanged (R1)', async () => {
    const a = server('a', `LEVEL=shared\n${UNIVERSE}`);
    const b = server('b', `LEVEL=b\n${UNIVERSE}`);

    const error = await rejection(adapter.assign('shared', 'b'));

    expect(error.code).toBe('conflict');
    expect(error.servers).toEqual(['a']);
    expect(readFileSync(a, 'utf-8')).toBe(`LEVEL=shared\n${UNIVERSE}`);
    expect(readFileSync(b, 'utf-8')).toBe(`LEVEL=b\n${UNIVERSE}`);
  });

  it('refuses everything while another server is undetermined (R7)', async () => {
    server('bad', `LEVEL=../x\n${UNIVERSE}`);
    const b = server('b', `LEVEL=b\n${UNIVERSE}`);

    expect((await rejection(adapter.assign('free', 'b'))).code).toBe('undetermined');
    expect(readFileSync(b, 'utf-8')).toBe(`LEVEL=b\n${UNIVERSE}`);
  });

  it('refuses a server-internal target', async () => {
    server('old', 'LEVEL=old\n');
    expect((await rejection(adapter.assign('free', 'old'))).code).toBe('internal_world');
  });

  it('refuses an unknown server and an invalid world name', async () => {
    server('a', `LEVEL=a\n${UNIVERSE}`);
    expect((await rejection(adapter.assign('free', 'ghost'))).code).toBe('server_not_found');
    expect((await rejection(adapter.assign('My World', 'a'))).code).toBe('invalid_world');
  });

  it('re-reads config.env before writing (no stale snapshot)', async () => {
    server('a', `LEVEL=a\n${UNIVERSE}`);
    server('b', `LEVEL=b\n${UNIVERSE}`);
    await adapter.listAssignments();
    server('a', `LEVEL=target\n${UNIVERSE}`); // changed by another process

    expect((await rejection(adapter.assign('target', 'b'))).code).toBe('conflict');
  });

  it('makes a deleted server world assignable again (R3, R4)', async () => {
    server('a', `LEVEL=shared\n${UNIVERSE}`);
    const b = server('b', `LEVEL=b\n${UNIVERSE}`);
    await rejection(adapter.assign('shared', 'b'));

    rmSync(join(root, 'servers', 'a'), { recursive: true });
    await adapter.assign('shared', 'b');

    expect(readFileSync(b, 'utf-8')).toBe(`LEVEL=shared\n${UNIVERSE}`);
  });
});

describe('release', () => {
  it("switches the holder back to its default world '<server>'", async () => {
    const file = server('alpha', `LEVEL=w\n${UNIVERSE}`);

    expect(await adapter.release('w')).toEqual({ server: 'alpha', fallback: 'alpha' });
    expect(readFileSync(file, 'utf-8')).toBe(`LEVEL=alpha\n${UNIVERSE}`);
  });

  it('releases a legacy-named world', async () => {
    const file = server('alpha', `LEVEL='My World'\n${UNIVERSE}`);

    await adapter.release('My World');

    expect(readFileSync(file, 'utf-8')).toBe(`LEVEL=alpha\n${UNIVERSE}`);
  });

  it('changes only the holder', async () => {
    server('alpha', `LEVEL=w\n${UNIVERSE}`);
    const beta = server('beta', `LEVEL=beta\n${UNIVERSE}`);

    await adapter.release('w');

    expect(readFileSync(beta, 'utf-8')).toBe(`LEVEL=beta\n${UNIVERSE}`);
  });

  it.each([
    ['not_assigned', { alpha: `LEVEL=alpha\n${UNIVERSE}` }, 'w'],
    ['default_world', { alpha: `LEVEL=alpha\n${UNIVERSE}` }, 'alpha'],
    ['internal_world', { alpha: 'LEVEL=w\n' }, 'w'],
    ['conflict', { alpha: `LEVEL=w\n${UNIVERSE}`, beta: `LEVEL=w\n${UNIVERSE}` }, 'w'],
    ['undetermined', { alpha: `LEVEL=w\n${UNIVERSE}`, bad: 'LEVEL=../x\n' }, 'w'],
  ])('refuses with %s and writes nothing', async (code, servers, world) => {
    const files = Object.entries(servers).map(([name, content]) => [server(name, content), content]);

    expect((await rejection(adapter.release(world))).code).toBe(code);
    for (const [file, content] of files) expect(readFileSync(file!, 'utf-8')).toBe(content);
  });

  it('never creates worlds/.locks', async () => {
    server('alpha', `LEVEL=w\n${UNIVERSE}`);
    await adapter.release('w');
    expect(existsSync(join(root, 'worlds', '.locks'))).toBe(false);
  });
});

describe('internal detection follows the compose env_file order (Codex #4)', () => {
  function globalEnv(content: string) {
    mkdirSync(join(root, 'servers'), { recursive: true });
    writeFileSync(join(root, 'servers', 'global.env'), content);
  }

  it('inherits EXTRA_ARGS from the platform .env when global.env lists the key', async () => {
    globalEnv('# keys\nTZ\nEXTRA_ARGS\n');
    writeFileSync(join(root, '.env'), 'EXTRA_ARGS=--universe /worlds/\n');
    server('a', 'LEVEL=a\n');

    expect((await adapter.listAssignments()).assignments).toEqual([{ server: 'a', world: 'a', internal: false }]);
  });

  it('takes a value written in global.env itself', async () => {
    globalEnv('EXTRA_ARGS=--universe=/worlds\n');
    server('a', 'LEVEL=a\n');

    expect((await adapter.listAssignments()).assignments[0]?.internal).toBe(false);
  });

  it("lets the server's own EXTRA_ARGS win, even when empty", async () => {
    globalEnv('EXTRA_ARGS\n');
    writeFileSync(join(root, '.env'), 'EXTRA_ARGS=--universe /worlds/\n');
    server('a', 'LEVEL=a\nEXTRA_ARGS=\n');

    expect((await adapter.listAssignments()).assignments[0]?.internal).toBe(true);
  });

  it('is internal when nothing sets --universe', async () => {
    globalEnv('EXTRA_ARGS\n');
    server('a', 'LEVEL=a\n');

    expect((await adapter.listAssignments()).assignments[0]?.internal).toBe(true);
  });

  it.each(['--universe /worlds', '--universe=/worlds/', '-Dx=1 --universe /worlds/ --nogui'])(
    'accepts %s as worlds/',
    async (args) => {
      server('a', `LEVEL=a\nEXTRA_ARGS=${args}\n`);
      expect((await adapter.listAssignments()).assignments[0]?.internal).toBe(false);
    }
  );

  it.each(['--universe /data', '--universe .', '--universe=/data/'])('treats %s as server-internal', async (args) => {
    server('a', `LEVEL=a\nEXTRA_ARGS=${args}\n`);
    expect((await adapter.listAssignments()).assignments[0]?.internal).toBe(true);
  });

  it.each(['--universe /srv/elsewhere', '--universe', '--universe ${WORLD_DIR}'])(
    'marks an unsupported location %s as undetermined',
    async (args) => {
      server('a', `LEVEL=a\nEXTRA_ARGS=${args}\n`);
      expect((await adapter.listAssignments()).undetermined).toEqual(['a']);
    }
  );
});

describe('Compose interpolation in LEVEL (Codex #5)', () => {
  it.each(['LEVEL=${MC_WORLD:-shared}', 'LEVEL="$WORLD"', 'WORLD_NAME=${W}'])(
    'marks %s as undetermined',
    async (line) => {
      server('a', `${line}\n${UNIVERSE}`);
      expect((await adapter.listAssignments()).undetermined).toEqual(['a']);
    }
  );

  it('keeps a single-quoted $ literal', async () => {
    server('a', `LEVEL='cash$world'\n${UNIVERSE}`);
    expect((await adapter.listAssignments()).assignments[0]?.world).toBe('cash$world');
  });
});

describe('preview (snapshot restore, migrate)', () => {
  it('returns the snapshot as if the server config.env were replaced, writing nothing', async () => {
    const file = server('a', `LEVEL=a\n${UNIVERSE}`);
    server('b', `LEVEL=held\n${UNIVERSE}`);

    const next = await adapter.preview('a', `LEVEL=held\n${UNIVERSE}`);

    expect(next.assignments).toEqual([
      { server: 'a', world: 'held', internal: false },
      { server: 'b', world: 'held', internal: false },
    ]);
    expect(readFileSync(file, 'utf-8')).toBe(`LEVEL=a\n${UNIVERSE}`);
  });

  it('includes a server that has no directory yet', async () => {
    const next = await adapter.preview('new', `LEVEL=n\n${UNIVERSE}`);
    expect(next.assignments).toEqual([{ server: 'new', world: 'n', internal: false }]);
  });
});
