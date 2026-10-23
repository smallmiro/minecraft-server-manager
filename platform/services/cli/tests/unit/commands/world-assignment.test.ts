/**
 * CLI paths that change a server's world go through the assignment rules
 * (#670): config LEVEL/WORLD_NAME, world list warnings, world release
 * output, and migrate. Real temp platform; only the runtime is faked.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Paths,
  WorldManagementUseCase,
  WorldRepository,
  ServerRepository,
  ConfigEnvWorldAssignmentAdapter,
  ShellAdapter,
  FileServerSpecRepository,
  type IContainerRuntimePort,
  type IPromptPort,
} from '@minecraft-docker/shared';

const state = vi.hoisted(() => ({ container: undefined as unknown, status: 'exited' }));
vi.mock('../../../src/infrastructure/di/container.js', () => ({
  getContainer: () => state.container,
}));
vi.mock('../../../src/lib/rcon.js', () => ({ isContainerRunning: async () => false }));

import { configCommand } from '../../../src/commands/config.js';
import { worldCommand } from '../../../src/commands/world.js';
import { migrateCommand } from '../../../src/commands/migrate.js';
import { serverSpecRepositories } from '../../../src/lib/server-config.js';

const UNIVERSE = 'EXTRA_ARGS=--universe /worlds/\n';
let root: string;
let output: string[];

const TEMPLATE_COMPOSE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../templates/servers/_template/docker-compose.yml'),
  'utf-8'
);

/** A server: its config.env and a compose from the bundled template (#675 writes go through server.yaml). */
function server(name: string, configEnv: string): string {
  mkdirSync(join(root, 'servers', name), { recursive: true });
  const file = join(root, 'servers', name, 'config.env');
  writeFileSync(file, configEnv);
  writeFileSync(
    join(root, 'servers', name, 'docker-compose.yml'),
    TEMPLATE_COMPOSE.replace(/mc-template/g, `mc-${name}`).replace('mc-router.host: "template.local"', `mc-router.host: "${name}.local"`)
  );
  return file;
}

function world(name: string): void {
  mkdirSync(join(root, 'worlds', name), { recursive: true });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-cli-assign-'));
  writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
  mkdirSync(join(root, 'worlds'), { recursive: true });
  state.status = 'exited';
  const paths = new Paths(root);
  const assignments = new ConfigEnvWorldAssignmentAdapter(paths);
  const runtime = { getStatus: () => state.status, start: async () => ({ success: true }) };
  const prompt = { isCancel: () => false } as unknown as IPromptPort;
  serverSpecRepositories.create = (p) => new FileServerSpecRepository(p, undefined, runtime as unknown as IContainerRuntimePort, () => []);
  state.container = {
    promptPort: prompt,
    worldAssignmentPort: assignments,
    worldManagementUseCase: new WorldManagementUseCase(
      prompt,
      new ShellAdapter({ paths }),
      new WorldRepository(paths, assignments),
      new ServerRepository(paths),
      assignments,
      runtime as unknown as IContainerRuntimePort
    ),
  };
  output = [];
  const capture = (...args: unknown[]) => output.push(args.join(' '));
  vi.spyOn(console, 'log').mockImplementation(capture);
  vi.spyOn(console, 'error').mockImplementation(capture);
  vi.spyOn(console, 'warn').mockImplementation(capture);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('mcctl config <server> LEVEL|WORLD_NAME', () => {
  it('refuses a LEVEL another server uses and leaves config.env alone', async () => {
    server('alpha', `LEVEL=held\n${UNIVERSE}`);
    const file = server('beta', `LEVEL=beta\n${UNIVERSE}`);

    const code = await configCommand({ root, serverName: 'beta', key: 'LEVEL', value: 'held' });

    expect(code).toBe(1);
    expect(output.join('\n')).toContain("'alpha'");
    expect(readFileSync(file, 'utf-8')).toBe(`LEVEL=beta\n${UNIVERSE}`);
  });

  it('refuses a LEVEL change on a running server', async () => {
    const file = server('beta', `LEVEL=beta\n${UNIVERSE}`);
    state.status = 'running';

    expect(await configCommand({ root, serverName: 'beta', key: 'LEVEL', value: 'free' })).toBe(1);
    expect(readFileSync(file, 'utf-8')).toBe(`LEVEL=beta\n${UNIVERSE}`);
  });

  it('assigns a free LEVEL', async () => {
    const file = server('beta', `LEVEL=beta\n${UNIVERSE}`);

    expect(await configCommand({ root, serverName: 'beta', key: 'LEVEL', value: 'free' })).toBe(0);
    expect(readFileSync(file, 'utf-8')).toBe(`LEVEL=free\n${UNIVERSE}`);
  });

  it('writes WORLD_NAME without a check when LEVEL keeps the world (Codex #7)', async () => {
    server('alpha', `LEVEL=held\n${UNIVERSE}`);
    const file = server('beta', `LEVEL=beta\n${UNIVERSE}`);
    state.status = 'running';

    expect(await configCommand({ root, serverName: 'beta', key: 'WORLD_NAME', value: 'held' })).toBe(0);
    expect(readFileSync(file, 'utf-8')).toContain('WORLD_NAME=held');
    expect(readFileSync(file, 'utf-8')).toContain('LEVEL=beta');
  });

  it('checks WORLD_NAME when it is the effective world', async () => {
    server('alpha', `LEVEL=held\n${UNIVERSE}`);
    const file = server('beta', `WORLD_NAME=beta\n${UNIVERSE}`);

    expect(await configCommand({ root, serverName: 'beta', key: 'WORLD_NAME', value: 'held' })).toBe(1);
    expect(readFileSync(file, 'utf-8')).toBe(`WORLD_NAME=beta\n${UNIVERSE}`);
  });
});

describe('mcctl config <server> EXTRA_ARGS (world location, Codex PR #750)', () => {
  it('refuses moving a running server between worlds/ and its data directory', async () => {
    const file = server('alpha', `LEVEL=alpha\n${UNIVERSE}`);
    state.status = 'running';

    expect(await configCommand({ root, serverName: 'alpha', key: 'EXTRA_ARGS', value: '--universe /data' })).toBe(1);
    expect(readFileSync(file, 'utf-8')).toBe(`LEVEL=alpha\n${UNIVERSE}`);
  });

  it('refuses pointing a server at worlds/ when another server uses that world', async () => {
    const file = server('alpha', 'LEVEL=held\nEXTRA_ARGS=--universe /data\n');
    server('beta', `LEVEL=held_nether\n${UNIVERSE}`);

    expect(await configCommand({ root, serverName: 'alpha', key: 'EXTRA_ARGS', value: '--universe /worlds/' })).toBe(1);
    expect(output.join('\n')).toContain("'beta'");
    expect(readFileSync(file, 'utf-8')).toBe('LEVEL=held\nEXTRA_ARGS=--universe /data\n');
  });

  it('writes EXTRA_ARGS that keep the world location, even on a running server', async () => {
    const file = server('alpha', `LEVEL=alpha\n${UNIVERSE}`);
    state.status = 'running';

    expect(
      await configCommand({ root, serverName: 'alpha', key: 'EXTRA_ARGS', value: '--universe /worlds/ --nogui' })
    ).toBe(0);
    expect(readFileSync(file, 'utf-8')).toContain('EXTRA_ARGS=');
    expect(readFileSync(file, 'utf-8')).toContain('--nogui');
  });

  it('writes EXTRA_ARGS that move a stopped server whose world is free', async () => {
    const file = server('alpha', `LEVEL=alpha\n${UNIVERSE}`);

    expect(await configCommand({ root, serverName: 'alpha', key: 'EXTRA_ARGS', value: '--universe /data' })).toBe(0);
    // ServerSpec (#675): /data is world.storage 'data', rendered as an empty EXTRA_ARGS (the same location)
    expect(readFileSync(join(root, 'servers', 'alpha', 'server.yaml'), 'utf-8')).toContain('storage: data');
    expect(readFileSync(file, 'utf-8')).toMatch(/^EXTRA_ARGS=$/m);
  });
});

describe('mcctl world list', () => {
  it('shows who a world is assigned to and warns about duplicates', async () => {
    world('shared');
    server('alpha', `LEVEL=shared\n${UNIVERSE}`);
    server('beta', `LEVEL=shared\n${UNIVERSE}`);

    expect(await worldCommand({ root, subCommand: 'list' })).toBe(0);

    const text = output.join('\n');
    expect(text).toContain('assigned: alpha, beta');
    expect(text).toMatch(/World 'shared' is assigned to 'alpha', 'beta'/);
  });

  it('warns about a server whose assignment cannot be read', async () => {
    world('w');
    server('broken', `LEVEL=../x\n${UNIVERSE}`);

    await worldCommand({ root, subCommand: 'list' });

    expect(output.join('\n')).toMatch(/Cannot read the world assignment of 'broken'/);
  });
});

describe('mcctl world release', () => {
  it('says which world the holder uses now', async () => {
    world('held');
    const file = server('alpha', `LEVEL=held\n${UNIVERSE}`);

    expect(await worldCommand({ root, subCommand: 'release', worldName: 'held' })).toBe(0);

    expect(output.join('\n')).toContain("'alpha' now uses world 'alpha' (created on next start)");
    expect(readFileSync(file, 'utf-8')).toBe(`LEVEL=alpha\n${UNIVERSE}`);
  });
});

describe('mcctl migrate worlds (Codex #2)', () => {
  it('refuses to point a server at a world another server uses, before moving anything', async () => {
    server('alpha', `LEVEL=beta\n${UNIVERSE}`);
    const file = server('beta', 'LEVEL=world\n');
    mkdirSync(join(root, 'servers', 'beta', 'data', 'world'), { recursive: true });

    const code = await migrateCommand({ root, subCommand: 'worlds', serverName: 'beta', force: true });

    expect(code).toBe(1);
    expect(readFileSync(file, 'utf-8')).toBe('LEVEL=world\n');
    expect(existsSync(join(root, 'servers', 'beta', 'data', 'world'))).toBe(true);
    expect(output.join('\n')).toContain("'alpha'");
  });

  it('migrates a server whose target world is free', async () => {
    const file = server('beta', 'LEVEL=world\n');
    mkdirSync(join(root, 'servers', 'beta', 'data', 'world'), { recursive: true });

    expect(await migrateCommand({ root, subCommand: 'worlds', serverName: 'beta', force: true })).toBe(0);
    expect(readFileSync(file, 'utf-8')).toMatch(/^LEVEL=beta$/m);
    expect(existsSync(join(root, 'worlds', 'beta'))).toBe(true);
  });
});
