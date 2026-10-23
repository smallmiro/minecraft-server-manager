/**
 * FileServerSpecRepository.write(doc, { create: true }) (#675, ADR-0003 §5):
 * mkdir claim, strict rules, template env, directories, include entry, and
 * all-or-nothing rollback so a retry works at once (#657).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { Paths, parseEnvDocument } from '../src/utils/index.js';
import { FileServerSpecRepository } from '../src/infrastructure/adapters/server-spec/FileServerSpecRepository.js';
import {
  DockerComposeRenderer,
  type RenderContext,
  type RenderedFile,
} from '../src/infrastructure/adapters/server-spec/DockerComposeRenderer.js';
import { ServerSpecError, type ServerSpecDocument } from '../src/domain/server-spec/ServerSpecDocument.js';
import { buildCreateSpec } from '../src/domain/server-spec/buildCreateSpec.js';
import { WorldAssignmentError } from '../src/domain/services/worldAssignment.js';

let root: string;
let repo: FileServerSpecRepository;

const file = (...p: string[]) => join(root, 'servers', ...p);
const read = (...p: string[]) => readFileSync(file(...p), 'utf-8');
const spec = (overrides: Partial<Parameters<typeof buildCreateSpec>[0]> = {}) =>
  buildCreateSpec({ name: 'alpha', type: 'PAPER', version: '1.21.1', memory: '2G', ...overrides });
const includes = () => (yaml.load(read('compose.yml')) as { include: unknown[] }).include;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-spec-create-'));
  mkdirSync(join(root, 'servers'));
  writeFileSync(file('compose.yml'), 'include:\n  - other/docker-compose.yml\n');
  repo = new FileServerSpecRepository(new Paths(root), undefined, undefined, () => ['192.168.1.10']);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('write({ create: true })', () => {
  it('writes the spec with the template keys, the generated files, data/, logs/, global.env and the entry', async () => {
    await repo.write(spec({ seed: '42' }), { create: true });

    const written = (await repo.load('alpha'))!;
    expect(written.warnings).toEqual([]);
    expect(Object.keys(written.document.env)).toEqual([
      'GAMEMODE', 'DIFFICULTY', 'MAX_PLAYERS', 'VIEW_DISTANCE', 'PVP', 'SPAWN_PROTECTION', 'ENABLE_RCON', 'MOTD',
      'MODRINTH_DOWNLOAD_DEPENDENCIES', 'SEED',
    ]);
    const values = parseEnvDocument(read('alpha', 'config.env')).values;
    expect(values.get('MEMORY')).toBe('2G');
    expect(values.get('LEVEL')).toBe('alpha');
    expect(values.get('EXTRA_ARGS')).toBe('--universe /worlds/');
    expect(values.get('SEED')).toBe('42');
    expect(read('alpha', 'docker-compose.yml')).toContain('alpha.192.168.1.10.nip.io');
    expect(existsSync(file('alpha', 'data'))).toBe(true);
    expect(existsSync(file('alpha', 'logs'))).toBe(true);
    expect(read('global.env')).toContain('EXTRA_ARGS');
    expect(includes()).toEqual(['other/docker-compose.yml', 'alpha/docker-compose.yml']);
  });

  it("refuses an existing directory with 'already_exists' and leaves it alone", async () => {
    mkdirSync(file('alpha'));
    writeFileSync(file('alpha', 'keep'), 'x');
    await expect(repo.write(spec(), { create: true })).rejects.toMatchObject({ code: 'already_exists' });
    expect(read('alpha', 'keep')).toBe('x');
  });

  it('applies the strict create rules before claiming anything', async () => {
    const error = await repo.write({ ...spec(), name: 'Bad_Name' } as ServerSpecDocument, { create: true }).catch((e) => e);
    expect(error).toBeInstanceOf(ServerSpecError);
    expect((error as ServerSpecError).code).toBe('invalid_spec');
    expect(existsSync(file('Bad_Name'))).toBe(false);
  });

  it.each(['router', 'a--b', '1abc'])('refuses the server name %j before creating anything (naming-rules.bats)', async (name) => {
    const error = await repo.write({ ...spec(), name, world: { level: 'w', storage: 'universe' } }, { create: true }).catch((e) => e);
    expect((error as ServerSpecError).code).toBe('invalid_spec');
    expect(error.message).toMatch(/name/);
    expect(existsSync(file(name))).toBe(false);
  });

  it.each(['../escape', 'my/world', 'w_nether'])('refuses the world %j before creating anything', async (level) => {
    const error = await repo.write({ ...spec(), world: { level, storage: 'universe' } }, { create: true }).catch((e) => e);
    expect((error as ServerSpecError).code).toBe('invalid_spec');
    expect(existsSync(file('alpha'))).toBe(false);
  });

  it('refuses a seed that would not stay one config.env setting (#726)', async () => {
    await expect(repo.write(spec({ seed: '"" MODS=https://x/p.jar' }), { create: true })).rejects.toMatchObject({
      code: 'invalid_spec',
    });
    expect(existsSync(file('alpha'))).toBe(false);
  });

  it('removes the directory when servers/compose.yml cannot be read, and a retry then succeeds', async () => {
    writeFileSync(file('compose.yml'), 'include: [broken\n');
    await expect(repo.write(spec(), { create: true })).rejects.toBeInstanceOf(ServerSpecError);
    expect(existsSync(file('alpha'))).toBe(false);
    expect(read('compose.yml')).toBe('include: [broken\n');

    writeFileSync(file('compose.yml'), 'include: []\n');
    await repo.write(spec(), { create: true });
    expect(includes()).toEqual(['alpha/docker-compose.yml']);
  });

  it('refuses a world another server holds (R1) and removes the directory', async () => {
    mkdirSync(file('beta'));
    writeFileSync(file('beta', 'config.env'), 'LEVEL=shared\nEXTRA_ARGS=--universe /worlds/\n');
    const error = await repo.write(spec({ worldName: 'shared' }), { create: true }).catch((e) => e);
    expect(error).toBeInstanceOf(WorldAssignmentError);
    expect(existsSync(file('alpha'))).toBe(false);
  });

  it('removes the entry it added when the include write fails, then a retry succeeds', async () => {
    class LosingRenderer extends DockerComposeRenderer {
      override render(doc: ServerSpecDocument, ctx: RenderContext): RenderedFile[] {
        // Writes our entry but drops the others, so the read-back check fails.
        return super.render(doc, ctx).map((f) =>
          f.guarded ? f : { ...f, content: `include:\n  - ${doc.name}/docker-compose.yml\n` }
        );
      }
    }
    const losing = new FileServerSpecRepository(new Paths(root), new LosingRenderer(), undefined, () => []);
    await expect(losing.write(spec(), { create: true })).rejects.toMatchObject({ code: 'conflict' });
    expect(existsSync(file('alpha'))).toBe(false);
    expect(read('compose.yml')).not.toContain('alpha/docker-compose.yml');

    writeFileSync(file('compose.yml'), 'include:\n  - other/docker-compose.yml\n');
    await repo.write(spec(), { create: true });
    expect(includes()).toEqual(['other/docker-compose.yml', 'alpha/docker-compose.yml']);
  });
});
