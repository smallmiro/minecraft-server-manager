import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { Paths } from '../../../utils/index.js';
import { parseEnvDocument, envRevision } from '../../../utils/env-file.js';
import { atomicWriteFile } from '../../../utils/atomic-write.js';
import { EXISTING_SERVER_NAME_PATTERN } from '../../../domain/value-objects/ServerName.js';
import {
  ServerSpecError,
  assertServerSpecDocument,
  type ServerSpec,
  type ServerSpecDocument,
} from '../../../domain/server-spec/ServerSpecDocument.js';
import type {
  IServerSpecRepository,
  LoadedServerSpec,
  WriteServerSpecOptions,
} from '../../../application/ports/outbound/IServerSpecRepository.js';
import { importDockerServer, type ServerSpecImport } from './importDockerServer.js';

const SPEC_FILE = 'server.yaml';

async function readOptional(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return undefined;
    throw err;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** server.yaml text: fixed key order, absent optional fields omitted, js-yaml quoting. */
function dumpServerSpec(doc: ServerSpecDocument): string {
  const r = doc.routing;
  const ordered = {
    specVersion: doc.specVersion,
    name: doc.name,
    type: doc.type,
    ...(doc.version !== undefined && { version: doc.version }),
    ...(doc.memory !== undefined && { memory: doc.memory }),
    image: doc.image,
    world: { level: doc.world.level, storage: doc.world.storage },
    routing: {
      customHostnames: [...r.customHostnames],
      ...(r.playitDomain !== undefined && { playitDomain: r.playitDomain }),
      autoScale: { up: r.autoScale.up, down: r.autoScale.down },
      ...(r.asleepMotd !== undefined && { asleepMotd: r.asleepMotd }),
      ...(r.loadingMotd !== undefined && { loadingMotd: r.loadingMotd }),
    },
    env: { ...doc.env },
  };
  return yaml.dump(ordered, { lineWidth: -1, noRefs: true, quotingType: '"' });
}

/**
 * IServerSpecRepository on the Docker file layout (#675, ADR-0003 §2):
 * servers/<n>/server.yaml, with servers that have none imported in memory
 * from config.env and docker-compose.yml.
 */
export class FileServerSpecRepository implements IServerSpecRepository {
  constructor(private readonly paths: Paths = new Paths()) {}

  async list(): Promise<ServerSpec[]> {
    let entries: string[];
    try {
      entries = await readdir(this.paths.servers);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    const names: ServerSpec[] = [];
    for (const name of entries.sort()) {
      if (name.startsWith('_') || !EXISTING_SERVER_NAME_PATTERN.test(name)) continue;
      const dir = this.paths.serverDir(name);
      if (!(await isDirectory(dir))) continue;
      const files = await readdir(dir);
      if (files.includes(SPEC_FILE) || files.includes('config.env')) names.push({ name });
    }
    return names;
  }

  /** @deprecated Use load(). Removed in v3.0.0 (#736). */
  async get(name: string): Promise<ServerSpec | null> {
    return (await this.load(name))?.document ?? null;
  }

  async save(spec: ServerSpec): Promise<void> {
    await this.write(spec as ServerSpecDocument);
  }

  async delete(name: string): Promise<void> {
    throw new ServerSpecError(
      'conflict',
      `Removing server '${name}' through the ServerSpec repository arrives with #735; use mcctl delete ${name}`,
      name
    );
  }

  async load(name: string): Promise<LoadedServerSpec | null> {
    if (!EXISTING_SERVER_NAME_PATTERN.test(name)) return null;
    const dir = this.paths.serverDir(name);
    const text = await readOptional(join(dir, SPEC_FILE));
    if (text !== undefined) {
      return { document: this.parse(name, text), revision: envRevision(text), warnings: [] };
    }
    if ((await readOptional(join(dir, 'config.env'))) === undefined) return null;

    const result = await this.importServer(name);
    if (result.status === 'refused') {
      throw new ServerSpecError('undetermined', `Cannot import server '${name}': ${result.reason}`, name);
    }
    return { document: result.document, revision: null, warnings: result.warnings };
  }

  async write(doc: ServerSpecDocument, options: WriteServerSpecOptions = {}): Promise<void> {
    const server = typeof doc?.name === 'string' ? doc.name : '?';
    assertServerSpecDocument(doc, 'existing', { server, file: `servers/${server}/${SPEC_FILE}` });
    const dir = this.paths.serverDir(doc.name);
    if (!(await isDirectory(dir))) {
      throw new ServerSpecError('not_found', `Server '${doc.name}' not found (no servers/${doc.name} directory)`, doc.name);
    }
    const file = join(dir, SPEC_FILE);
    const content = dumpServerSpec(doc);
    const current = await readOptional(file);
    // ponytail: compare-then-rename leaves a microsecond window (ADR-0003 §2);
    // add a mkdir lock only if lost updates are ever observed.
    if (options.expectedRevision !== undefined) {
      const revision = current === undefined ? null : envRevision(current);
      if (revision !== options.expectedRevision) {
        throw new ServerSpecError(
          'conflict',
          `servers/${doc.name}/${SPEC_FILE} changed since it was read; load it again and retry`,
          doc.name
        );
      }
    }
    if (current === content) return;
    const mode = current === undefined ? await this.configEnvMode(dir) : undefined;
    await atomicWriteFile(file, content, mode === undefined ? {} : { mode });
  }

  /**
   * Import servers/<n> from config.env and docker-compose.yml, ignoring any
   * server.yaml (`mcctl migrate spec --force`). Reads only.
   */
  async importServer(name: string): Promise<ServerSpecImport> {
    return importDockerServer(name, { paths: this.paths, hostIps: await this.hostIps() });
  }

  private parse(name: string, text: string): ServerSpecDocument {
    const file = `servers/${name}/${SPEC_FILE}`;
    let value: unknown;
    try {
      value = yaml.load(text, { schema: yaml.CORE_SCHEMA });
    } catch (e) {
      throw new ServerSpecError(
        'invalid_spec',
        `${file} is not valid YAML: ${(e as Error).message.split('\n')[0]}; fix it or run mcctl migrate spec ${name} --force`,
        name
      );
    }
    const doc = assertServerSpecDocument(value, 'existing', { server: name, file });
    if (doc.name !== name) {
      throw new ServerSpecError(
        'invalid_spec',
        `${file} has name '${doc.name}'; it must match its directory '${name}'`,
        name,
        [{ path: 'name', message: `must be '${name}'` }]
      );
    }
    return doc;
  }

  /** server.yaml holds config.env's values (secrets included), so it gets config.env's mode. */
  private async configEnvMode(dir: string): Promise<number | undefined> {
    try {
      return (await stat(join(dir, 'config.env'))).mode & 0o777;
    } catch {
      return undefined;
    }
  }

  /** HOST_IPS, else HOST_IP (comma lists) from the platform .env. */
  private async hostIps(): Promise<string[]> {
    const text = await readOptional(this.paths.envFile);
    if (text === undefined) return [];
    const values = parseEnvDocument(text).values;
    const list = values.get('HOST_IPS')?.trim() || values.get('HOST_IP') || '';
    return list.split(',').map((ip) => ip.trim()).filter(Boolean);
  }
}
