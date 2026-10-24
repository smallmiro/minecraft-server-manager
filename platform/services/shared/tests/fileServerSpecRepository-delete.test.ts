/**
 * FileServerSpecRepository.delete (#735): the files side of `mcctl delete`,
 * ported from delete-server.bats (#652 worlds outlive their server, #660 exact
 * names). Temp MCCTL_ROOT; no docker, no sudo.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { Paths } from '../src/utils/index.js';
import {
  FileServerSpecRepository,
  serverSpecTestHooks,
} from '../src/infrastructure/adapters/server-spec/FileServerSpecRepository.js';
import { includeEntries } from '../src/infrastructure/adapters/server-spec/DockerComposeRenderer.js';

let root: string;
let repo: FileServerSpecRepository;
const defaultHooks = { ...serverSpecTestHooks };

const at = (...p: string[]) => join(root, ...p);
const compose = () => readFileSync(at('servers', 'compose.yml'), 'utf-8');

/** servers/<name>/{config.env,docker-compose.yml}, LEVEL=<name> like mcctl create. */
function addServer(name: string, configEnv = `LEVEL=${name}\n`): void {
  mkdirSync(at('servers', name), { recursive: true });
  writeFileSync(at('servers', name, 'config.env'), configEnv);
  writeFileSync(at('servers', name, 'docker-compose.yml'), '');
}

/** A minimal world folder. */
function mkWorld(...p: string[]): void {
  mkdirSync(at(...p), { recursive: true });
  writeFileSync(at(...p, 'level.dat'), 'level');
}

/** The delete failed and kept `path` and servers/alpha. */
async function expectRefusedKeeping(promise: Promise<unknown>, path: string, message?: RegExp): Promise<void> {
  await expect(promise).rejects.toThrow(message ?? /./);
  expect(existsSync(path)).toBe(true);
  expect(existsSync(at('servers', 'alpha'))).toBe(true);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-spec-delete-'));
  mkdirSync(at('servers'));
  mkdirSync(at('worlds'));
  repo = new FileServerSpecRepository(new Paths(root), undefined, undefined, () => []);
  addServer('alpha');
});

afterEach(() => {
  Object.assign(serverSpecTestHooks, defaultHooks);
  rmSync(root, { recursive: true, force: true });
});

describe('delete: server directory and include entry', () => {
  it('an unknown server is not_found and removes nothing', async () => {
    await expect(repo.delete('nope')).rejects.toMatchObject({ code: 'not_found' });
    expect(existsSync(at('servers', 'alpha'))).toBe(true);
  });

  it('rejects a name outside the naming rule and removes nothing (#652)', async () => {
    await expect(repo.delete('../servers/alpha')).rejects.toMatchObject({ code: 'not_found' });
    expect(existsSync(at('servers', 'alpha'))).toBe(true);
  });

  it('a legacy name that predates the strict rule can still be deleted (#652)', async () => {
    addServer('My_Server');
    await repo.delete('My_Server');
    expect(existsSync(at('servers', 'My_Server'))).toBe(false);
  });

  it('removes the server directory and keeps worlds/', async () => {
    mkWorld('worlds', 'alpha');
    await repo.delete('alpha');
    expect(existsSync(at('servers', 'alpha'))).toBe(false);
    expect(existsSync(at('worlds', 'alpha', 'level.dat'))).toBe(true);
  });

  it('drops the include entry and keeps the others', async () => {
    writeFileSync(at('servers', 'compose.yml'), 'include:\n  - alpha/docker-compose.yml\n  - beta/docker-compose.yml\n');
    await repo.delete('alpha');
    expect(includeEntries(compose())).toEqual(['beta/docker-compose.yml']);
  });

  it('wood keeps ironwood (#660)', async () => {
    addServer('wood');
    writeFileSync(at('servers', 'compose.yml'), 'include:\n  - wood/docker-compose.yml\n  - ironwood/docker-compose.yml\n');
    await repo.delete('wood');
    expect(includeEntries(compose())).toEqual(['ironwood/docker-compose.yml']);
  });

  it('dropping the last entry drops include: too, like a fresh servers/compose.yml (#660)', async () => {
    writeFileSync(at('servers', 'compose.yml'), 'include:\n  - alpha/docker-compose.yml\n');
    await repo.delete('alpha');
    expect(compose()).not.toMatch(/include/);
  });

  it('quoted and commented entries are removed, others kept (#660)', async () => {
    addServer('wood');
    writeFileSync(
      at('servers', 'compose.yml'),
      'include:\n  - "wood/docker-compose.yml" # managed server\n  - ironwood/docker-compose.yml\n' +
        "  - 'wood/docker-compose.yml'\n  - wood/docker-compose.yml # note\n"
    );
    await repo.delete('wood');
    expect(includeEntries(compose())).toEqual(['ironwood/docker-compose.yml']);
  });

  it('only the top-level include list is edited (#660)', async () => {
    addServer('wood');
    writeFileSync(
      at('servers', 'compose.yml'),
      'include:\n  - wood/docker-compose.yml\n  - ironwood/docker-compose.yml\n' +
        'services:\n  other:\n    command:\n      - wood/docker-compose.yml\n'
    );
    await repo.delete('wood');
    expect(includeEntries(compose())).toEqual(['ironwood/docker-compose.yml']);
    expect(compose()).toMatch(/command:\n\s+- wood\/docker-compose.yml/);
  });

  it('an inline include list is edited too (the script refused it)', async () => {
    addServer('wood');
    writeFileSync(at('servers', 'compose.yml'), 'include: [wood/docker-compose.yml, ironwood/docker-compose.yml]\n');
    await repo.delete('wood');
    expect(includeEntries(compose())).toEqual(['ironwood/docker-compose.yml']);
  });

  it('an object entry listing several paths keeps the other paths (#735 review)', async () => {
    writeFileSync(
      at('servers', 'compose.yml'),
      'include:\n' +
        '  - path:\n      - alpha/docker-compose.yml\n      - beta/docker-compose.yml\n    project_directory: .\n' +
        '  - path: [alpha/docker-compose.yml]\n' +
        '  - path: alpha/docker-compose.yml\n' +
        '  - path: [gamma/docker-compose.yml, delta/docker-compose.yml]\n'
    );
    await repo.delete('alpha');
    expect((yaml.load(compose()) as { include: unknown[] }).include).toEqual([
      { path: ['beta/docker-compose.yml'], project_directory: '.' },
      { path: ['gamma/docker-compose.yml', 'delta/docker-compose.yml'] },
    ]);
  });

  it('drops every path inside servers/alpha/, written any way, and keeps other servers (#735 decision)', async () => {
    writeFileSync(
      at('servers', 'compose.yml'),
      yaml.dump({
        include: [
          {
            path: ['alpha/docker-compose.yml', 'alpha/docker-compose.override.yml', 'beta/docker-compose.yml'],
            env_file: 'shared.env',
          },
          'alpha/extra.yml',
          { path: './alpha/docker-compose.yml', project_directory: '.' },
          { path: ['./alpha//more.yml', 'gamma/docker-compose.yml'] },
          'alphabet/docker-compose.yml',
          'alpha-two/docker-compose.yml',
        ],
      })
    );
    await repo.delete('alpha');
    expect((yaml.load(compose()) as { include: unknown[] }).include).toEqual([
      { path: ['beta/docker-compose.yml'], env_file: 'shared.env' },
      { path: ['gamma/docker-compose.yml'] },
      'alphabet/docker-compose.yml',
      'alpha-two/docker-compose.yml',
    ]);
  });

  it('servers/compose.yml keeps its file mode (#660)', async () => {
    writeFileSync(at('servers', 'compose.yml'), 'include:\n  - alpha/docker-compose.yml\n  - beta/docker-compose.yml\n');
    chmodSync(at('servers', 'compose.yml'), 0o640);
    await repo.delete('alpha');
    expect(statSync(at('servers', 'compose.yml')).mode & 0o777).toBe(0o640);
  });

  it('an unreadable servers/compose.yml aborts before the world moves or the directory goes', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    writeFileSync(at('servers', 'compose.yml'), 'include: [alpha/docker-compose.yml\n');
    await expectRefusedKeeping(repo.delete('alpha'), at('servers', 'alpha', 'data', 'alpha', 'level.dat'));
    expect(existsSync(at('worlds', 'alpha'))).toBe(false);
    expect(compose()).toContain('alpha/docker-compose.yml');
  });

  it('dryRun writes nothing and returns the plan', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    writeFileSync(at('servers', 'compose.yml'), 'include:\n  - alpha/docker-compose.yml\n');
    expect(await repo.delete('alpha', { dryRun: true })).toEqual({ level: 'alpha', movedWorlds: ['alpha'], deletedWorlds: [] });
    expect(existsSync(at('servers', 'alpha', 'data', 'alpha', 'level.dat'))).toBe(true);
    expect(compose()).toContain('alpha/docker-compose.yml');
  });
});

describe('delete: worlds outlive their server (#652)', () => {
  it('moves the server-internal world and its dimension folders to worlds/', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    mkWorld('servers', 'alpha', 'data', 'alpha_nether');
    mkWorld('servers', 'alpha', 'data', 'alpha_the_end');
    expect(await repo.delete('alpha')).toEqual({
      level: 'alpha',
      movedWorlds: ['alpha', 'alpha_nether', 'alpha_the_end'],
      deletedWorlds: [],
    });
    expect(existsSync(at('servers', 'alpha'))).toBe(false);
    for (const w of ['alpha', 'alpha_nether', 'alpha_the_end']) expect(existsSync(at('worlds', w, 'level.dat'))).toBe(true);
  });

  it("LEVEL defaults to 'world' when config.env does not set it", async () => {
    writeFileSync(at('servers', 'alpha', 'config.env'), '');
    mkWorld('servers', 'alpha', 'data', 'world');
    expect((await repo.delete('alpha')).movedWorlds).toEqual(['world']);
    expect(existsSync(at('worlds', 'world', 'level.dat'))).toBe(true);
  });

  it('creates worlds/ when it is missing', async () => {
    rmSync(at('worlds'), { recursive: true });
    mkWorld('servers', 'alpha', 'data', 'alpha');
    await repo.delete('alpha');
    expect(existsSync(at('worlds', 'alpha', 'level.dat'))).toBe(true);
  });

  it('aborts without touching anything when worlds/ already has that world', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    mkdirSync(at('worlds', 'alpha'));
    for (const dryRun of [true, false]) {
      await expectRefusedKeeping(
        repo.delete('alpha', { dryRun }),
        at('servers', 'alpha', 'data', 'alpha', 'level.dat'),
        /worlds\/alpha/
      );
    }
  });

  it('a dimension folder name clash also aborts before anything is deleted', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    mkWorld('servers', 'alpha', 'data', 'alpha_nether');
    mkdirSync(at('worlds', 'alpha_nether'));
    await expectRefusedKeeping(repo.delete('alpha'), at('servers', 'alpha', 'data', 'alpha', 'level.dat'));
    expect(existsSync(at('worlds', 'alpha'))).toBe(false);
  });

  it('deleteWorld deletes the server-internal world', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    mkWorld('servers', 'alpha', 'data', 'alpha_nether');
    expect(await repo.delete('alpha', { deleteWorld: true })).toEqual({
      level: 'alpha',
      movedWorlds: [],
      deletedWorlds: ['alpha', 'alpha_nether'],
    });
    expect(existsSync(at('servers', 'alpha'))).toBe(false);
    expect(existsSync(at('worlds', 'alpha'))).toBe(false);
    expect(existsSync(at('worlds', 'alpha_nether'))).toBe(false);
  });

  it('a world in worlds/ is only unassigned, even with deleteWorld', async () => {
    mkWorld('worlds', 'alpha');
    expect(await repo.delete('alpha', { deleteWorld: true })).toEqual({
      level: 'alpha',
      movedWorlds: [],
      deletedWorlds: [],
      keptWorld: 'alpha',
    });
    expect(existsSync(at('worlds', 'alpha', 'level.dat'))).toBe(true);
  });

  it('a symlinked world is not moved and its target survives', async () => {
    mkWorld('worlds', 'alpha');
    mkdirSync(at('servers', 'alpha', 'data'));
    symlinkSync(at('worlds', 'alpha'), at('servers', 'alpha', 'data', 'alpha'));
    expect((await repo.delete('alpha')).movedWorlds).toEqual([]);
    expect(existsSync(at('servers', 'alpha'))).toBe(false);
    expect(existsSync(at('worlds', 'alpha', 'level.dat'))).toBe(true);
  });

  it('a world symlinked to a folder outside the server is only unlinked', async () => {
    mkWorld('elsewhere', 'alpha');
    mkdirSync(at('servers', 'alpha', 'data'));
    symlinkSync(at('elsewhere', 'alpha'), at('servers', 'alpha', 'data', 'alpha'));
    await repo.delete('alpha');
    expect(existsSync(at('servers', 'alpha'))).toBe(false);
    expect(existsSync(at('elsewhere', 'alpha', 'level.dat'))).toBe(true);
  });

  it('a destination appearing between moves stops and reports what moved', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    mkWorld('servers', 'alpha', 'data', 'alpha_nether');
    // Another process creates worlds/alpha_nether while alpha is being moved.
    serverSpecTestHooks.beforeWorldMove = async (world) => {
      if (world === 'alpha_nether') mkdirSync(at('worlds', 'alpha_nether'));
    };
    await expect(repo.delete('alpha')).rejects.toThrow(/Already moved: servers\/alpha\/data\/alpha -> worlds\/alpha/);
    expect(existsSync(at('worlds', 'alpha', 'level.dat'))).toBe(true);
    expect(existsSync(at('servers', 'alpha', 'data', 'alpha_nether', 'level.dat'))).toBe(true);
    expect(existsSync(at('worlds', 'alpha_nether', 'alpha_nether'))).toBe(false);
  });
});

describe('delete: LEVEL is read like Compose reads it (ADR-0002 resolver)', () => {
  it.each(['LEVEL=alpha # world name', 'LEVEL = alpha', 'LEVEL="alpha"', "LEVEL='alpha'", 'export LEVEL=alpha'])(
    '%j is the world alpha, which moves to worlds/',
    async (line) => {
      writeFileSync(at('servers', 'alpha', 'config.env'), `${line}\n`);
      mkWorld('servers', 'alpha', 'data', 'alpha');
      expect((await repo.delete('alpha')).movedWorlds).toEqual(['alpha']);
      expect(existsSync(at('worlds', 'alpha', 'level.dat'))).toBe(true);
    }
  );

  it('LEVEL defined twice is the last one; the first world is then in the way and aborts', async () => {
    writeFileSync(at('servers', 'alpha', 'config.env'), 'LEVEL=alpha\nLEVEL=beta\n');
    mkWorld('servers', 'alpha', 'data', 'alpha');
    await expectRefusedKeeping(repo.delete('alpha'), at('servers', 'alpha', 'data', 'alpha', 'level.dat'), /data\/alpha/);
  });

  it.each(['LEVEL=..', "LEVEL=\"al'pha\"", 'LEVEL=/data/alpha', 'LEVEL=$WORLD'])(
    'an undeterminable %j aborts instead of guessing',
    async (line) => {
      writeFileSync(at('servers', 'alpha', 'config.env'), `${line}\n`);
      mkWorld('servers', 'alpha', 'data', 'alpha');
      await expectRefusedKeeping(repo.delete('alpha'), at('servers', 'alpha', 'data', 'alpha', 'level.dat'), /LEVEL|world/);
    }
  );

  it('an invalid LEVEL aborts even when only its dimension folder exists', async () => {
    writeFileSync(at('servers', 'alpha', 'config.env'), 'LEVEL=my.world\n');
    mkWorld('servers', 'alpha', 'data', 'my.world_nether');
    await expectRefusedKeeping(repo.delete('alpha'), at('servers', 'alpha', 'data', 'my.world_nether', 'level.dat'));
  });

  it('deleteWorld still deletes when the world cannot be located', async () => {
    writeFileSync(at('servers', 'alpha', 'config.env'), 'LEVEL=..\n');
    mkWorld('servers', 'alpha', 'data', 'alpha');
    expect(await repo.delete('alpha', { deleteWorld: true })).toEqual({ movedWorlds: [], deletedWorlds: [] });
    expect(existsSync(at('servers', 'alpha'))).toBe(false);
  });
});

describe('delete: no world is lost when its location is unclear (#652 review)', () => {
  it('dimension folders without their base world abort', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha_nether');
    await expectRefusedKeeping(repo.delete('alpha'), at('servers', 'alpha', 'data', 'alpha_nether', 'level.dat'));
  });

  it('a symlink to a world inside the server aborts and names the world', async () => {
    mkWorld('servers', 'alpha', 'data', 'realworld');
    symlinkSync('realworld', at('servers', 'alpha', 'data', 'alpha'));
    await expectRefusedKeeping(
      repo.delete('alpha'),
      at('servers', 'alpha', 'data', 'realworld', 'level.dat'),
      /data\/realworld/
    );
  });

  it('a world under another name (old LEVEL) aborts and names it', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    mkWorld('servers', 'alpha', 'data', 'world');
    await expectRefusedKeeping(repo.delete('alpha'), at('servers', 'alpha', 'data', 'world', 'level.dat'), /data\/world/);
    expect(existsSync(at('servers', 'alpha', 'data', 'alpha', 'level.dat'))).toBe(true);
  });

  it('a symlinked data/ aborts and leaves its target alone', async () => {
    mkWorld('external-data', 'alpha');
    symlinkSync(at('external-data'), at('servers', 'alpha', 'data'));
    await expectRefusedKeeping(repo.delete('alpha'), at('external-data', 'alpha', 'level.dat'));
    expect(existsSync(at('worlds', 'alpha'))).toBe(false);
  });

  it('a symlinked server directory aborts', async () => {
    rmSync(at('servers', 'alpha'), { recursive: true });
    mkdirSync(at('real-alpha'));
    writeFileSync(at('real-alpha', 'config.env'), 'LEVEL=alpha\n');
    symlinkSync(at('real-alpha'), at('servers', 'alpha'));
    await expectRefusedKeeping(repo.delete('alpha'), at('real-alpha', 'config.env'), /symlink/);
  });

  it('a symlink target inside the server with only level.dat_old aborts', async () => {
    mkdirSync(at('servers', 'alpha', 'data', 'realworld'), { recursive: true });
    writeFileSync(at('servers', 'alpha', 'data', 'realworld', 'level.dat_old'), 'old');
    symlinkSync('realworld', at('servers', 'alpha', 'data', 'alpha'));
    await expectRefusedKeeping(repo.delete('alpha'), at('servers', 'alpha', 'data', 'realworld', 'level.dat_old'));
  });

  it('a world with only region files is not deleted unnoticed', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    mkdirSync(at('servers', 'alpha', 'data', 'oldworld', 'region'), { recursive: true });
    writeFileSync(at('servers', 'alpha', 'data', 'oldworld', 'region', 'r.0.0.mca'), '');
    await expectRefusedKeeping(
      repo.delete('alpha'),
      at('servers', 'alpha', 'data', 'oldworld', 'region', 'r.0.0.mca'),
      /data\/oldworld/
    );
  });

  it('a symlink pointing inside the server aborts even without world files', async () => {
    mkdirSync(at('servers', 'alpha', 'saves', 'realworld', 'playerdata'), { recursive: true });
    writeFileSync(at('servers', 'alpha', 'saves', 'realworld', 'playerdata', 'p.dat'), '');
    mkdirSync(at('servers', 'alpha', 'data'));
    symlinkSync('../saves/realworld', at('servers', 'alpha', 'data', 'alpha'));
    await expectRefusedKeeping(
      repo.delete('alpha'),
      at('servers', 'alpha', 'saves', 'realworld', 'playerdata', 'p.dat'),
      /data\/alpha/
    );
  });

  it('worlds/ resolving inside the server aborts, even with deleteWorld', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    mkWorld('servers', 'alpha', 'saved', 'other');
    rmSync(at('worlds'), { recursive: true });
    symlinkSync('servers/alpha/saved', at('worlds'));
    for (const deleteWorld of [false, true]) {
      await expectRefusedKeeping(
        repo.delete('alpha', { deleteWorld }),
        at('servers', 'alpha', 'saved', 'other', 'level.dat'),
        /worlds\//
      );
      expect(existsSync(at('servers', 'alpha', 'data', 'alpha', 'level.dat'))).toBe(true);
    }
  });

  it('a broken worlds/ symlink aborts', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    rmSync(at('worlds'), { recursive: true });
    symlinkSync(at('missing'), at('worlds'));
    await expectRefusedKeeping(repo.delete('alpha'), at('servers', 'alpha', 'data', 'alpha', 'level.dat'), /broken symlink/);
  });
});
