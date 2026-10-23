import { join } from 'node:path';
import yaml from 'js-yaml';
import { applyEnvChanges, parseEnvDocument } from '../../../utils/env-file.js';
import { ServerSpecError, routerHosts, type ServerSpecDocument } from '../../../domain/server-spec/ServerSpecDocument.js';

/**
 * Rendering seam (ADR-0003 §3). Infrastructure, not a port: only the
 * repository adapter calls a renderer. #641 adds a Kubernetes renderer.
 */
export interface RenderContext {
  root: string;
  templatesDir: string;
  hostIps: string[];
  /** Current content of a file (generated files without their mcctl header), undefined when missing. */
  read(path: string): string | undefined;
}

export interface RenderedFile {
  path: string;
  content: string;
  /** Generated from the spec: carries the mcctl header and is checked for hand edits. Otherwise merged. */
  guarded: boolean;
}

export interface ServerSpecRenderer {
  render(doc: ServerSpecDocument, ctx: RenderContext): RenderedFile[];
}

const DUMP_OPTIONS: yaml.DumpOptions = { lineWidth: -1, noRefs: true, quotingType: '"' };
const INCLUDE_HEADER = '# Server compose files, one entry per server (maintained by mcctl, ADR-0003)\n';

const isMapping = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** config.env keys and values of a spec: managed keys, then env (ADR-0003 §3). */
export function projectConfigEnv(doc: ServerSpecDocument): Map<string, string> {
  const { EXTRA_ARGS: extra, ...env } = doc.env;
  const out = new Map<string, string>([['TYPE', doc.type]]);
  if (doc.version !== undefined) out.set('VERSION', doc.version);
  if (doc.memory !== undefined) out.set('MEMORY', doc.memory);
  out.set('LEVEL', doc.world.level);
  if (doc.routing.playitDomain !== undefined) out.set('PLAYIT_DOMAIN', doc.routing.playitDomain);
  // An empty value still overrides servers/global.env (ADR-0002).
  out.set('EXTRA_ARGS', doc.world.storage === 'universe' ? ['--universe /worlds/', extra].filter(Boolean).join(' ') : extra ?? '');
  for (const [key, value] of Object.entries(env)) out.set(key, value);
  return out;
}

/** Docker Compose output: config.env, the server docker-compose.yml and its servers/compose.yml entry. */
export class DockerComposeRenderer implements ServerSpecRenderer {
  render(doc: ServerSpecDocument, ctx: RenderContext): RenderedFile[] {
    const dir = join(ctx.root, 'servers', doc.name);
    const template = (file: string): string => {
      const path = join(ctx.templatesDir, 'servers', '_template', file);
      const text = ctx.read(path);
      if (text === undefined) throw new Error(`Bundled server template missing: ${path}; reinstall mcctl`);
      return text;
    };
    const configPath = join(dir, 'config.env');
    const includePath = join(ctx.root, 'servers', 'compose.yml');
    return [
      { path: configPath, content: renderConfigEnv(doc, ctx.read(configPath) ?? template('config.env')), guarded: true },
      { path: join(dir, 'docker-compose.yml'), content: renderCompose(doc, ctx.hostIps, template('docker-compose.yml')), guarded: true },
      { path: includePath, content: renderInclude(doc.name, ctx.read(includePath)), guarded: false },
    ];
  }
}

/** Set keys whose value differs, remove keys the spec lacks; every other line stays byte-identical. */
function renderConfigEnv(doc: ServerSpecDocument, base: string): string {
  const projected = projectConfigEnv(doc);
  const current = parseEnvDocument(base).values;
  const set: Record<string, string> = {};
  for (const [key, value] of projected) if (current.get(key) !== value) set[key] = value;
  const remove = [...current.keys()].filter((key) => !projected.has(key));
  return applyEnvChanges(base, { set, remove }, { raw: true });
}

function renderCompose(doc: ServerSpecDocument, hostIps: string[], templateText: string): string {
  const tpl = yaml.load(templateText) as { services: Record<string, Record<string, unknown>> };
  const svc = Object.values(tpl.services)[0]!;
  const r = doc.routing;
  const labels: Record<string, unknown> = {
    ...(svc['labels'] as Record<string, unknown>),
    'mc-router.host': routerHosts(doc, hostIps).join(','),
    'mc-router.auto-scale-up': String(r.autoScale.up),
    'mc-router.auto-scale-down': String(r.autoScale.down),
    ...(r.asleepMotd !== undefined && { 'mc-router.auto-scale-asleep-motd': r.asleepMotd }),
    ...(r.loadingMotd !== undefined && { 'mc-router.auto-scale-loading-motd': r.loadingMotd }),
  };
  const service = { ...svc, container_name: `mc-${doc.name}`, image: doc.image, labels };
  // Every string quoted: v2 readers match the mc-router.host label as `"..."` (parseRouterHosts, HostnameService).
  return yaml.dump({ ...tpl, services: { [`mc-${doc.name}`]: service } }, { ...DUMP_OPTIONS, forceQuotes: true });
}

const includePaths = (e: unknown): unknown[] =>
  typeof e === 'string' ? [e] : isMapping(e) ? [e['path']].flat() : [];

/** The compose files servers/compose.yml text includes ([] when missing or unreadable). */
export function includeEntries(text: string | undefined): string[] {
  if (text === undefined) return [];
  try {
    const list = (yaml.load(text) as { include?: unknown } | null)?.include;
    return Array.isArray(list) ? list.flatMap(includePaths).filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

/** Whether servers/compose.yml text has an include entry for `<name>/docker-compose.yml`. */
export function hasIncludeEntry(text: string | undefined, name: string): boolean {
  return includeEntries(text).includes(`${name}/docker-compose.yml`);
}

/** Add `<name>/docker-compose.yml` unless an entry already names it; never rewrite a file it cannot read. */
function renderInclude(name: string, current: string | undefined): string {
  const entry = `${name}/docker-compose.yml`;
  if (current === undefined) return INCLUDE_HEADER + yaml.dump({ include: [entry] }, DUMP_OPTIONS);
  const unreadable = (why: string) =>
    new ServerSpecError('conflict', `servers/compose.yml ${why}; fix it first (nothing was written)`, name);
  let parsed: unknown;
  try {
    parsed = yaml.load(current) ?? {};
  } catch (e) {
    throw unreadable(`does not parse: ${(e as Error).message.split('\n')[0]}`);
  }
  if (!isMapping(parsed)) throw unreadable('is not a mapping');
  const list = parsed['include'] ?? [];
  if (!Array.isArray(list)) throw unreadable("has an 'include' that is not a list");
  if (list.some((e) => includePaths(e).includes(entry))) return current;
  return INCLUDE_HEADER + yaml.dump({ ...parsed, include: [...list, entry] }, DUMP_OPTIONS);
}

/** servers/compose.yml text without the entries naming exactly `<name>/docker-compose.yml`; unchanged when there is none. */
export function removeIncludeEntry(current: string, name: string): string {
  const entry = `${name}/docker-compose.yml`;
  const parsed = yaml.load(current) as Record<string, unknown> | null;
  const list = parsed?.['include'];
  if (!Array.isArray(list) || !list.some((e) => includePaths(e).includes(entry))) return current;
  const kept = list.filter((e) => !includePaths(e).includes(entry));
  return INCLUDE_HEADER + yaml.dump({ ...parsed, include: kept }, DUMP_OPTIONS);
}
