/**
 * Parity of the TypeScript provision with create-server.sh (#675, ADR-0003
 * §5): each fixture in fixtures/create-server-golden was written by the
 * script, captured by create-server-golden.bats (commit 19ffef52) before
 * the script was removed. The provision must produce the
 * same config.env settings, the same server compose and the same include
 * list. Comments, key order in YAML and the mcctl header are not compared.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { CreateServerUseCase } from '../src/application/use-cases/CreateServerUseCase.js';
import { Config, Paths, parseEnvDocument } from '../src/utils/index.js';
import { FileServerSpecRepository } from '../src/infrastructure/adapters/server-spec/FileServerSpecRepository.js';
import { ConfigEnvWorldAssignmentAdapter } from '../src/infrastructure/adapters/ConfigEnvWorldAssignmentAdapter.js';
import type { CreateServerConfig, IPromptPort, IServerRepository } from '../src/application/ports/index.js';

const GOLDEN = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'create-server-golden');

/** The CreateServerConfig equivalent of each create-server.sh invocation (create-server-golden.bats). */
const CASES: Record<string, CreateServerConfig & { noHostIp?: boolean }> = {
  paper: { name: 'alpha', type: 'PAPER', version: '1.21.1', memory: '2G' },
  latest: { name: 'beta', type: 'PAPER', version: 'LATEST', memory: '4G' },
  seed: { name: 'gamma', type: 'PAPER', version: '1.21.1', memory: '4G', seed: '12345' },
  'text-seed': { name: 'delta', type: 'PAPER', version: '1.21.1', memory: '4G', seed: 'a text seed & more' },
  'world-url': { name: 'eps', type: 'PAPER', version: '1.21.1', memory: '4G', worldUrl: 'https://example.com/world.zip' },
  world: { name: 'zeta', type: 'PAPER', version: '1.21.1', memory: '4G', worldName: 'shared' },
  'world-missing': { name: 'ghost', type: 'PAPER', version: '1.21.1', memory: '4G', worldName: 'nowhere' },
  modrinth: {
    name: 'eta',
    type: 'MODRINTH',
    memory: '6G',
    modpackSlug: 'cobblemon',
    modpackVersion: '1.5.2',
    modLoader: 'fabric',
    modpackExcludeFiles: ['a.jar', 'b.jar'],
  },
  curseforge: {
    name: 'theta',
    type: 'AUTO_CURSEFORGE',
    version: '1.20.1',
    memory: '6G',
    modpackSlug: 'atm9',
    modpackVersion: '0.2.5',
    modLoader: 'forge',
    modpackExcludeFiles: ['x.jar'],
  },
  whitelist: { name: 'iota', type: 'PAPER', version: '1.21.1', memory: '4G', whitelistPlayers: ['steve', 'alex'] },
  'enable-whitelist': { name: 'kappa', type: 'PAPER', version: '1.21.1', memory: '4G', enableWhitelist: true },
  'no-whitelist': {
    name: 'lambda',
    type: 'PAPER',
    version: '1.21.1',
    memory: '4G',
    whitelistPlayers: ['a'],
    enableWhitelist: false,
  },
  playit: { name: 'mu', type: 'PAPER', version: '1.21.1', memory: '4G', playitDomain: 'aa.example.com' },
  fabric: { name: 'omega', type: 'FABRIC', version: '1.21.4', memory: '4G' },
  'no-host-ip': { name: 'nu', type: 'PAPER', version: '1.21.1', memory: '4G', noHostIp: true },
};

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-golden-'));
  mkdirSync(join(root, 'servers'));
  mkdirSync(join(root, 'worlds', 'shared'), { recursive: true });
  writeFileSync(join(root, '.env'), 'HOST_IPS=192.168.1.10,100.64.0.5\n');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const settings = (text: string) => Object.fromEntries(parseEnvDocument(text).values);
const services = (text: string) => (yaml.load(text) as { services: unknown }).services;
const includes = (text: string) => (yaml.load(text) as { include: unknown }).include;

describe('TypeScript provision matches create-server.sh', () => {
  it('has a fixture for every case', () => {
    expect(readdirSync(GOLDEN).sort()).toEqual(Object.keys(CASES).sort());
  });

  it.each(Object.entries(CASES))('%s', async (name, { noHostIp, ...config }) => {
    const paths = new Paths(root);
    if (noHostIp) writeFileSync(paths.envFile, '');
    const specRepo = new FileServerSpecRepository(paths, undefined, undefined, noHostIp ? () => [] : undefined);
    await new CreateServerUseCase(
      {} as IPromptPort,
      { exists: async () => false } as unknown as IServerRepository,
      new Config(paths),
      { specRepo },
      undefined,
      undefined,
      undefined,
      new ConfigEnvWorldAssignmentAdapter(paths)
    ).executeWithConfig({ ...config, autoStart: false });

    const golden = (f: string) => readFileSync(join(GOLDEN, name, f), 'utf-8');
    const actual = (...p: string[]) => readFileSync(join(root, 'servers', ...p), 'utf-8');
    expect(settings(actual(config.name, 'config.env'))).toEqual(settings(golden('config.env')));
    expect(services(actual(config.name, 'docker-compose.yml'))).toEqual(services(golden('docker-compose.yml')));
    expect(includes(actual('compose.yml'))).toEqual(includes(golden('compose.yml')));
  });
});
