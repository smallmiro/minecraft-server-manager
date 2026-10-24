/**
 * DeleteServerUseCase.deprovision (#735).
 * The real ServerSpec repository on a temp root; fake runtime and avahi.
 * Order: plan (dryRun) → remove the container → files → hostname.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DeleteServerUseCase } from '../src/application/use-cases/DeleteServerUseCase.js';
import { Paths } from '../src/utils/index.js';
import { FileServerSpecRepository } from '../src/infrastructure/adapters/server-spec/FileServerSpecRepository.js';
import type {
  HostnameChangeResult,
  IContainerRuntimePort,
  IHostnameRegistrarPort,
  IPromptPort,
  IServerRepository,
  RuntimeActionResult,
} from '../src/application/ports/index.js';
import type { ServerName } from '../src/domain/value-objects/ServerName.js';

let root: string;
let events: string[];
let removeResult: RuntimeActionResult;
/** What the server does while it stops (writes a folder, say). */
let onRemove: () => void;
let unregisterResult: HostnameChangeResult;

const at = (...p: string[]) => join(root, ...p);
function mkWorld(...p: string[]): void {
  mkdirSync(at(...p), { recursive: true });
  writeFileSync(at(...p, 'level.dat'), 'level');
}

const runtime = {
  remove: vi.fn(async (name: ServerName | string) => {
    events.push(`remove ${typeof name === 'string' ? name : `mc-${name.value}`}`);
    onRemove();
    return removeResult;
  }),
} as unknown as IContainerRuntimePort;
const hostnames = {
  unregister: vi.fn(async (host: string) => {
    events.push(`unregister ${host}`);
    return unregisterResult;
  }),
} as unknown as IHostnameRegistrarPort;

function useCase(deps: { hostnames?: boolean } = {}) {
  const paths = new Paths(root);
  return new DeleteServerUseCase({} as IPromptPort, {} as IServerRepository, runtime, {
    specRepo: new FileServerSpecRepository(paths, undefined, undefined, () => []),
    hostnames: deps.hostnames === false ? undefined : hostnames,
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-deprovision-'));
  mkdirSync(at('servers', 'alpha'), { recursive: true });
  mkdirSync(at('worlds'));
  writeFileSync(at('servers', 'alpha', 'config.env'), 'LEVEL=alpha\n');
  writeFileSync(at('servers', 'compose.yml'), 'include:\n  - alpha/docker-compose.yml\n');
  events = [];
  removeResult = { success: true, stdout: 'Container mc-alpha stopped and removed' };
  onRemove = () => {};
  unregisterResult = { status: 'changed' };
  vi.clearAllMocks();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('DeleteServerUseCase.deprovision', () => {
  it('removes the container, moves the world, removes the files, then the hostname', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    const result = await useCase().deprovision('alpha');
    expect(events).toEqual(['remove mc-alpha', 'unregister alpha.local']);
    expect(result).toMatchObject({ level: 'alpha', movedWorlds: ['alpha'], hostname: { status: 'changed' } });
    expect(existsSync(at('servers', 'alpha'))).toBe(false);
    expect(existsSync(at('worlds', 'alpha', 'level.dat'))).toBe(true);
  });

  it('an unsafe world plan stops before the container is touched (#652)', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    mkdirSync(at('worlds', 'alpha'));
    await expect(useCase().deprovision('alpha')).rejects.toThrow(/worlds\/alpha already exists.*nothing was deleted/);
    expect(events).toEqual([]);
    expect(existsSync(at('servers', 'alpha', 'data', 'alpha', 'level.dat'))).toBe(true);
  });

  it('a container that cannot be stopped aborts and deletes nothing (#652)', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    removeResult = { success: false, error: 'Failed to stop container mc-alpha: boom' };
    await expect(useCase().deprovision('alpha')).rejects.toThrow(/stop container mc-alpha.*Nothing was deleted/);
    expect(events).toEqual(['remove mc-alpha']);
    expect(existsSync(at('servers', 'alpha', 'data', 'alpha', 'level.dat'))).toBe(true);
    expect(existsSync(at('worlds', 'alpha'))).toBe(false);
  });

  it('a dimension created while the server stops is moved too (#652)', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    onRemove = () => mkWorld('servers', 'alpha', 'data', 'alpha_nether');
    expect((await useCase().deprovision('alpha')).movedWorlds).toEqual(['alpha', 'alpha_nether']);
    expect(existsSync(at('worlds', 'alpha_nether', 'level.dat'))).toBe(true);
  });

  it('a destination created while the server stops aborts before deleting and keeps the hostname (#652)', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    onRemove = () => mkdirSync(at('worlds', 'alpha'));
    await expect(useCase().deprovision('alpha')).rejects.toThrow(/Container mc-alpha was stopped and removed/);
    expect(events).toEqual(['remove mc-alpha']);
    expect(existsSync(at('servers', 'alpha', 'data', 'alpha', 'level.dat'))).toBe(true);
    expect(existsSync(at('worlds', 'alpha', 'alpha'))).toBe(false);
  });

  it('deleteWorld deletes the world inside the server', async () => {
    mkWorld('servers', 'alpha', 'data', 'alpha');
    expect(await useCase().deprovision('alpha', { deleteWorld: true })).toMatchObject({ deletedWorlds: ['alpha'] });
    expect(existsSync(at('worlds', 'alpha'))).toBe(false);
  });

  it('a hostname that could not be removed is reported, the server is still deleted', async () => {
    unregisterResult = { status: 'skipped', reason: 'sudo authentication failed' };
    const result = await useCase().deprovision('alpha');
    expect(result.hostname).toEqual(unregisterResult);
    expect(existsSync(at('servers', 'alpha'))).toBe(false);
  });

  it('a legacy server name is deleted too', async () => {
    mkdirSync(at('servers', 'My_Server'));
    writeFileSync(at('servers', 'My_Server', 'config.env'), 'LEVEL=My_Server\n');
    await useCase().deprovision('My_Server');
    expect(events).toEqual(['remove mc-My_Server', 'unregister My_Server.local']);
  });

  it('without a registrar the hostname step is skipped', async () => {
    const result = await useCase({ hostnames: false }).deprovision('alpha');
    expect(result.hostname).toBeUndefined();
    expect(events).toEqual(['remove mc-alpha']);
  });
});
