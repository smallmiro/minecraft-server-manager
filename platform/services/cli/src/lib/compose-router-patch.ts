import * as yaml from 'js-yaml';

export interface ComposePatchResult {
  content: string;
  changes: string[];
  skipped?: 'no-router' | 'no-template' | 'invalid';
}

interface Block {
  lines: string[];
  start: number; // index of the "<service>:" line
  end: number; // exclusive end of the service block (trailing blank/comment lines excluded)
}

const IMAGE_RE = /^(\s+image:\s*)(["']?)itzg\/mc-router:([^\s"'#]+)\2(\s*#.*)?\r?$/;
const meaningful = (l: string) => l.trim() !== '' && !l.trim().startsWith('#');
const indentOf = (l: string) => l.length - l.trimStart().length;
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Locate the block of service `name`. Line-based so comments and formatting stay untouched. */
function findService(content: string, name: string): Block | null {
  const lines = content.split('\n');
  const services = lines.findIndex((l) => /^services:\s*(#.*)?$/.test(l));
  if (services < 0) return null;
  const first = lines.findIndex((l, i) => i > services && meaningful(l));
  if (first < 0) return null;
  const childIndent = indentOf(lines[first]!);
  if (childIndent === 0) return null;

  const keyRe = new RegExp(`^${escape(name)}:\\s*(#.*)?$`);
  let start = -1;
  for (let i = first; i < lines.length; i++) {
    const l = lines[i]!;
    if (meaningful(l) && indentOf(l) === 0) return null; // left the services map
    if (indentOf(l) === childIndent && keyRe.test(l.trim())) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;

  let end = start + 1;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]!;
    if (meaningful(l)) {
      if (indentOf(l) <= childIndent) break;
      end = i + 1;
    }
  }
  return { lines, start, end };
}

const blockLines = (b: Block) => b.lines.slice(b.start + 1, b.end);
/** Indent of the service's own keys (first non-comment line inside the block). */
const childIndent = (b: Block) => indentOf(blockLines(b).find(meaningful) ?? '');

type Service = Record<string, unknown> | undefined;
const parseService = (content: string, name: string): Service =>
  (yaml.load(content) as { services?: Record<string, Record<string, unknown>> } | null)?.services?.[name];
const routerTag = (b: Block) => blockLines(b).map((l) => l.match(IMAGE_RE)?.[3]).find(Boolean);

function newer(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

const isVersion = (t: string) => /^\d+(\.\d+)*$/.test(t);

/** Service keys added from the template's router when the user's service has none (logging: #662). */
const ADDED: Array<[service: string, key: string]> = [
  ['router', 'group_add'],
  ['router', 'logging'],
  ['playit', 'logging'],
];
/** Service keys this patch manages: compared with the template, everything else must stay as it was. */
const MANAGED: Array<[service: string, key: string]> = [['router', 'image'], ...ADDED];

/** The parsed compose without the MANAGED keys. */
function withoutManaged(content: string): unknown {
  const doc = yaml.load(content) as { services?: Record<string, Record<string, unknown>> } | null;
  for (const [service, key] of MANAGED) {
    const svc = doc?.services?.[service];
    if (svc && typeof svc === 'object') delete svc[key];
  }
  return doc;
}

/**
 * `content` with the template's `key` block (and the comment lines right
 * above it) added to service `service` when it has none, before its
 * networks: key or at its end; unchanged when the service or the template
 * key is missing. Throws when `content` does not parse.
 */
function addTemplateKey(content: string, service: string, key: string, tpl: Block): string {
  const block = findService(content, service);
  if (!block) return content;
  const userIndent = childIndent(block);
  const keyRe = new RegExp(`^\\s+${escape(key)}:`);
  // also counts YAML merge keys
  if (blockLines(block).some((l) => keyRe.test(l)) || parseService(content, service)?.[key] !== undefined) return content;

  const tplIndent = childIndent(tpl);
  const tplLines = blockLines(tpl).map((l) => l.replace(/\r$/, ''));
  const g = tplLines.findIndex((l) => indentOf(l) === tplIndent && keyRe.test(l));
  if (g < 0) return content;
  let gEnd = g + 1;
  while (gEnd < tplLines.length && meaningful(tplLines[gEnd]!) && indentOf(tplLines[gEnd]!) > tplIndent) gEnd++;
  let gStart = g;
  while (gStart > 0 && tplLines[gStart - 1]!.trim().startsWith('#')) gStart--;
  const eol = content.includes('\r\n') ? '\r' : '';
  const insert = tplLines
    .slice(gStart, gEnd)
    .map((l) => ' '.repeat(Math.round((indentOf(l) / tplIndent) * userIndent)) + l.trimStart() + eol);

  const { lines, start, end } = block;
  let at = lines.findIndex((l, i) => i > start && i < end && indentOf(l) === userIndent && /^\s+networks:/.test(l));
  if (at < 0) at = end;
  while (at - 1 > start && lines[at - 1]!.trim().startsWith('#')) at--; // keep comments with their key
  return [...lines.slice(0, at), ...insert, ...lines.slice(at)].join('\n');
}

/**
 * Patch only router.image (bump if lower than the template's) and the ADDED keys (add if missing)
 * in a user's docker-compose.yml. The result is re-parsed and refused unless nothing else changed.
 */
export function patchRouterCompose(user: string, template: string): ComposePatchResult {
  const unchanged = (skipped?: ComposePatchResult['skipped']): ComposePatchResult => ({
    content: user,
    changes: [],
    ...(skipped && { skipped }),
  });

  const tpl = findService(template, 'router');
  if (!tpl) return unchanged('no-template');
  const block = findService(user, 'router');
  if (!block) return unchanged('no-router');

  const changes: string[] = [];
  const lines = [...block.lines];
  const userIndent = childIndent(block);

  // image: bump only a lower itzg/mc-router version tag
  const tplTag = routerTag(tpl);
  const imageIdx = lines.findIndex(
    (l, i) => i > block.start && i < block.end && indentOf(l) === userIndent && IMAGE_RE.test(l),
  );
  if (tplTag && imageIdx >= 0) {
    const m = lines[imageIdx]!.match(IMAGE_RE)!;
    const oldTag = m[3]!;
    if (isVersion(oldTag) && isVersion(tplTag) && newer(tplTag, oldTag)) {
      lines[imageIdx] = lines[imageIdx]!.replace(`mc-router:${oldTag}`, `mc-router:${tplTag}`);
      for (let i = imageIdx - 1; i > block.start && lines[i]!.trim().startsWith('#'); i--) {
        lines[i] = lines[i]!.replace(`Pinned to v${oldTag}`, `Pinned to v${tplTag}`);
      }
      changes.push(`router.image ${oldTag} → ${tplTag}`);
    }
  }

  // Keys the user lacks get the template's lines
  let content = lines.join('\n');
  for (const [service, key] of ADDED) {
    try {
      const next = addTemplateKey(content, service, key, tpl);
      if (next !== content) changes.push(`${service}.${key} added`);
      content = next;
    } catch {
      return unchanged('invalid');
    }
  }

  if (changes.length === 0) return unchanged();

  try {
    if (JSON.stringify(withoutManaged(content)) !== JSON.stringify(withoutManaged(user))) {
      return unchanged('invalid');
    }
    const want = parseService(template, 'router');
    if (changes.some((c) => c.startsWith('router.image')) && parseService(content, 'router')?.['image'] !== want?.['image']) {
      return unchanged('invalid');
    }
    for (const [service, key] of ADDED) {
      if (!changes.includes(`${service}.${key} added`)) continue;
      if (JSON.stringify(parseService(content, service)?.[key]) !== JSON.stringify(want?.[key])) return unchanged('invalid');
    }
  } catch {
    return unchanged('invalid');
  }
  return { content, changes };
}
