/**
 * CreateServerUseCase with TypeScript provisioning (#675, ADR-0003 §5):
 * the ServerSpec repository on a temp root, fake avahi and runtime.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CreateServerUseCase, ServerStartError } from '../src/application/use-cases/CreateServerUseCase.js';
import { EnvValueError, Paths, parseEnvDocument } from '../src/utils/index.js';
import { McVersion, Memory, ServerName, ServerType, WorldOptions } from '../src/domain/index.js';
import { FileServerSpecRepository } from '../src/infrastructure/adapters/server-spec/FileServerSpecRepository.js';
import { ConfigEnvWorldAssignmentAdapter } from '../src/infrastructure/adapters/ConfigEnvWorldAssignmentAdapter.js';
import type {
  IContainerRuntimePort,
  IHostnameRegistrarPort,
  IPromptPort,
  IServerRepository,
  IShellPort,
} from '../src/application/ports/index.js';

let root: string;
let events: string[];
let started: string[];
let startResult: { success: boolean; error?: string };
let registerResult: { status: 'changed' | 'unchanged' | 'skipped'; reason?: string };
let shell: { createServer: ReturnType<typeof vi.fn> };

const file = (...p: string[]) => join(root, 'servers', ...p);

function useCase(opts: { hostIps?: string[]; prompt?: IPromptPort } = {}) {
  const paths = new Paths(root);
  const runtime = {
    start: vi.fn(async (name: { value: string } | string) => {
      started.push(typeof name === 'string' ? name : `mc-${name.value}`);
      return startResult;
    }),
  } as unknown as IContainerRuntimePort;
  const hostnames = {
    getStatus: () => 'running',
    register: vi.fn(async (host: string, ip: string) => {
      events.push(`register ${host} ${ip}`);
      return registerResult;
    }),
  } as unknown as IHostnameRegistrarPort;
  shell = { createServer: vi.fn() };
  return new CreateServerUseCase(
    opts.prompt ?? ({} as IPromptPort),
    shell as unknown as IShellPort,
    { exists: vi.fn(async () => false) } as unknown as IServerRepository,
    paths,
    undefined,
    undefined,
    undefined,
    new ConfigEnvWorldAssignmentAdapter(paths),
    {
      specRepo: new FileServerSpecRepository(paths, undefined, runtime, () => opts.hostIps ?? ['192.168.1.10']),
      hostnames,
      runtime,
      hostIps: () => opts.hostIps ?? ['192.168.1.10'],
    }
  );
}

const run = { onProgress: (stage: string) => events.push(stage), onLog: (line: string) => events.push(`log ${line}`) };

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-provision-'));
  mkdirSync(join(root, 'servers'));
  mkdirSync(join(root, 'worlds'));
  events = [];
  started = [];
  startResult = { success: true };
  registerResult = { status: 'changed' };
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('CreateServerUseCase.executeWithConfig with provisioning', () => {
  it('writes the server, registers <name>.local, starts it, reporting the SSE stages in order', async () => {
    const server = await useCase().executeWithConfig({ name: 'beta', type: 'PAPER', version: '1.21.1', memory: '2G' }, run);

    expect(server.name.value).toBe('beta');
    expect(events).toEqual(['creating', 'configuring', 'register beta.local 192.168.1.10', 'starting']);
    expect(started).toEqual(['mc-beta']);
    expect(shell.createServer).not.toHaveBeenCalled();
    expect(parseEnvDocument(readFileSync(file('beta', 'config.env'), 'utf-8')).values.get('MEMORY')).toBe('2G');
    expect(readFileSync(file('compose.yml'), 'utf-8')).toContain('beta/docker-compose.yml');
  });

  it('skips the start for autoStart false', async () => {
    await useCase().executeWithConfig({ name: 'beta', version: '1.21.1', autoStart: false }, run);
    expect(events).toEqual(['creating', 'configuring', 'register beta.local 192.168.1.10']);
    expect(started).toEqual([]);
  });

  it('logs a skipped mDNS registration as a warning and still succeeds', async () => {
    registerResult = { status: 'skipped', reason: 'sudo failed' };
    await useCase().executeWithConfig({ name: 'beta', version: '1.21.1' }, run);
    expect(events).toContain('log Warning: mDNS registration of beta.local skipped: sudo failed');
  });

  it('skips mDNS without a host address', async () => {
    await useCase({ hostIps: [] }).executeWithConfig({ name: 'beta', version: '1.21.1', autoStart: false }, run);
    expect(events.some((e) => e.startsWith('register'))).toBe(false);
    expect(events.some((e) => e.includes('HOST_IP'))).toBe(true);
  });

  it('keeps the server created when the start fails and rejects ServerStartError (decision 1)', async () => {
    startResult = { success: false, error: 'port is already allocated' };
    const error = await useCase()
      .executeWithConfig({ name: 'beta', version: '1.21.1' }, run)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServerStartError);
    expect((error as ServerStartError).message).toMatch(/port is already allocated.*mcctl start beta/);
    expect(existsSync(file('beta', 'server.yaml'))).toBe(true);
  });

  it('leaves VERSION to the modpack when none is given', async () => {
    await useCase().executeWithConfig({ name: 'beta', type: 'MODRINTH', modpackSlug: 'cobblemon', autoStart: false });
    expect(parseEnvDocument(readFileSync(file('beta', 'config.env'), 'utf-8')).values.has('VERSION')).toBe(false);
  });

  it.each(['LATEST', 'latest'])('writes VERSION=LATEST for a modpack given version %s', async (version) => {
    await useCase().executeWithConfig({ name: 'beta', type: 'MODRINTH', modpackSlug: 'cobblemon', version, autoStart: false });
    expect(parseEnvDocument(readFileSync(file('beta', 'config.env'), 'utf-8')).values.get('VERSION')).toBe('LATEST');
  });

  it('writes nothing when the create fails, and a retry succeeds at once (#657)', async () => {
    writeFileSync(file('compose.yml'), 'include: [broken\n');
    await expect(useCase().executeWithConfig({ name: 'beta', version: '1.21.1' }, run)).rejects.toMatchObject({
      name: 'ServerSpecError',
    });
    expect(existsSync(file('beta'))).toBe(false);
    expect(started).toEqual([]);

    writeFileSync(file('compose.yml'), 'include: []\n');
    await useCase().executeWithConfig({ name: 'beta', version: '1.21.1' }, run);
    expect(started).toEqual(['mc-beta']);
  });

  it('refuses a seed config.env cannot hold and leaves nothing behind (#675)', async () => {
    // Needs quotes for the $, and 'seed$VAR\' would not close for Compose
    await expect(
      useCase().executeWithConfig({ name: 'beta', version: '1.21.1', seed: 'seed$VAR\\' }, run)
    ).rejects.toBeInstanceOf(EnvValueError);
    expect(existsSync(file('beta'))).toBe(false);
    expect(existsSync(file('compose.yml'))).toBe(false);
  });

  it.each(['24w14a', '1.20.5-rc1'])('writes a snapshot or pre-release version (%s) as given', async (version) => {
    await useCase().executeWithConfig({ name: 'beta', version, autoStart: false });
    expect(parseEnvDocument(readFileSync(file('beta', 'config.env'), 'utf-8')).values.get('VERSION')).toBe(version);
  });

  it.each([
    [{ name: 'beta', memory: '256M' }, /at least 512M/],
    [{ name: 'beta', type: 'CRAFTBUKKIT2' }, /CRAFTBUKKIT2/],
    [{ name: 'beta', type: 'MODRINTH' }, /Modpack slug is required/],
    [{ name: 'Bad Name' }, /./],
  ])('refuses invalid input %j as invalid_spec before writing anything', async (config, message) => {
    const error = await useCase().executeWithConfig(config, run).catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'ServerSpecError', code: 'invalid_spec', message: expect.stringMatching(message) });
    expect(events).toEqual([]);
    expect(existsSync(file('beta'))).toBe(false);
  });

  it('creates a server whose name contains "error" (#658)', async () => {
    await useCase().executeWithConfig({ name: 'error-test', version: '1.21.1' }, run);
    expect(existsSync(file('error-test', 'server.yaml'))).toBe(true);
  });
});

/** Answers for the interactive flow: server beta, PAPER 1.21.1, new world, 2G, no whitelist. */
function interactivePrompt() {
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    note: vi.fn(),
    isCancel: () => false,
    spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
    promptServerName: async () => ServerName.create('beta'),
    promptServerType: async () => ServerType.create('PAPER'),
    promptMcVersion: async () => McVersion.create('1.21.1'),
    promptWorldOptions: async () => WorldOptions.newWorld(),
    promptMemory: async () => Memory.create('2G'),
    confirm: async () => false,
  };
}

describe('CreateServerUseCase.execute (interactive) with provisioning', () => {
  it('rejects ServerStartError without printing it, so the CLI reports it once', async () => {
    startResult = { success: false, error: 'port is already allocated' };
    const prompt = interactivePrompt();
    const error = await useCase({ prompt: prompt as unknown as IPromptPort }).execute().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServerStartError);
    expect(existsSync(file('beta', 'server.yaml'))).toBe(true);
    expect(prompt.error).not.toHaveBeenCalled();
  });

  it('rejects a failed create without printing it', async () => {
    writeFileSync(file('compose.yml'), 'include: [broken\n');
    const prompt = interactivePrompt();
    await expect(useCase({ prompt: prompt as unknown as IPromptPort }).execute()).rejects.toThrow(/servers\/compose\.yml/);
    expect(prompt.error).not.toHaveBeenCalled();
  });

  it('leaves VERSION to the modpack: the flow asks no Minecraft version for it', async () => {
    const prompt = {
      ...interactivePrompt(),
      promptServerType: async () => ServerType.create('MODRINTH'),
      promptModpackSlug: async () => 'cobblemon',
      promptModpackLoader: async () => undefined,
      promptModpackVersion: async () => undefined,
      promptModpackExcludeFiles: async () => undefined,
    };
    await useCase({ prompt: prompt as unknown as IPromptPort }).execute();
    expect(parseEnvDocument(readFileSync(file('beta', 'config.env'), 'utf-8')).values.has('VERSION')).toBe(false);
  });
});
