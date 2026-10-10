import * as yaml from 'js-yaml';

export interface ComposePatchResult {
  content: string;
  changes: string[];
  skipped?: 'no-router' | 'no-template' | 'invalid';
}

interface Block {
  lines: string[];
  start: number; // index of the "router:" line
  end: number; // exclusive end of the router block (trailing blank/comment lines excluded)
}

const IMAGE_RE = /^(\s+image:\s*)(["']?)itzg\/mc-router:([^\s"'#]+)\2(\s*#.*)?\r?$/;
const meaningful = (l: string) => l.trim() !== '' && !l.trim().startsWith('#');
const indentOf = (l: string) => l.length - l.trimStart().length;

/** Locate the `router:` service block. Line-based so comments and formatting stay untouched. */
function findRouter(content: string): Block | null {
  const lines = content.split('\n');
  const services = lines.findIndex((l) => /^services:\s*(#.*)?$/.test(l));
  if (services < 0) return null;
  const first = lines.findIndex((l, i) => i > services && meaningful(l));
  if (first < 0) return null;
  const childIndent = indentOf(lines[first]!);
  if (childIndent === 0) return null;

  let start = -1;
  for (let i = first; i < lines.length; i++) {
    const l = lines[i]!;
    if (meaningful(l) && indentOf(l) === 0) return null; // left the services map
    if (indentOf(l) === childIndent && /^router:\s*(#.*)?$/.test(l.trim())) {
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

const routerLines = (b: Block) => b.lines.slice(b.start + 1, b.end);
/** Indent of the router's own keys (first non-comment line inside the block). */
const childIndent = (b: Block) => indentOf(routerLines(b).find(meaningful) ?? '');

type Router = Record<string, unknown> | undefined;
const parseRouter = (content: string): Router =>
  (yaml.load(content) as { services?: { router?: Record<string, unknown> } } | null)?.services?.router;
const routerTag = (b: Block) => routerLines(b).map((l) => l.match(IMAGE_RE)?.[3]).find(Boolean);

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

/** Everything in the parsed compose except router.image / router.group_add. */
function withoutManaged(content: string): unknown {
  const doc = yaml.load(content) as { services?: { router?: Record<string, unknown> } } | null;
  if (doc?.services?.router) {
    delete doc.services.router['image'];
    delete doc.services.router['group_add'];
  }
  return doc;
}

/**
 * Patch only router.image (bump if lower than the template's) and router.group_add (add if missing)
 * in a user's docker-compose.yml. The result is re-parsed and refused unless nothing else changed.
 */
export function patchRouterCompose(user: string, template: string): ComposePatchResult {
  const unchanged = (skipped?: ComposePatchResult['skipped']): ComposePatchResult => ({
    content: user,
    changes: [],
    ...(skipped && { skipped }),
  });

  const tpl = findRouter(template);
  if (!tpl) return unchanged('no-template');
  const block = findRouter(user);
  if (!block) return unchanged('no-router');

  const changes: string[] = [];
  const lines = [...block.lines];
  let end = block.end;
  const userIndent = childIndent(block);
  const eol = user.includes('\r\n') ? '\r' : '';

  // image: bump only a lower itzg/mc-router version tag
  const tplTag = routerTag(tpl);
  const imageIdx = lines.findIndex(
    (l, i) => i > block.start && i < end && indentOf(l) === userIndent && IMAGE_RE.test(l),
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

  // group_add: add the template's lines when the user has none (also counts YAML merge keys)
  let userHasGroupAdd = lines.slice(block.start + 1, end).some((l) => /^\s+group_add:/.test(l));
  try {
    userHasGroupAdd ||= parseRouter(user)?.['group_add'] !== undefined;
  } catch {
    return unchanged('invalid');
  }
  if (!userHasGroupAdd) {
    const tplRouter = routerLines(tpl).map((l) => l.replace(/\r$/, ''));
    const g = tplRouter.findIndex((l) => /^\s+group_add:/.test(l));
    if (g >= 0) {
      let gEnd = g + 1;
      while (gEnd < tplRouter.length && /^\s+-\s/.test(tplRouter[gEnd]!)) gEnd++;
      let gStart = g;
      while (gStart > 0 && tplRouter[gStart - 1]!.trim().startsWith('#')) gStart--;
      const tplIndent = childIndent(tpl);
      const insert = tplRouter
        .slice(gStart, gEnd)
        .map((l) => ' '.repeat(Math.round((indentOf(l) / tplIndent) * userIndent)) + l.trimStart() + eol);

      let at = lines.findIndex((l, i) => i > block.start && i < end && indentOf(l) === userIndent && /^\s+networks:/.test(l));
      if (at < 0) at = end;
      while (at - 1 > block.start && lines[at - 1]!.trim().startsWith('#')) at--; // keep comments with their key
      lines.splice(at, 0, ...insert);
      end += insert.length;
      changes.push('router.group_add added');
    }
  }

  if (changes.length === 0) return unchanged();

  const content = lines.join('\n');
  try {
    if (JSON.stringify(withoutManaged(content)) !== JSON.stringify(withoutManaged(user))) {
      return unchanged('invalid');
    }
    const patched = parseRouter(content);
    const want = parseRouter(template);
    if (changes.some((c) => c.startsWith('router.image')) && patched?.['image'] !== want?.['image']) {
      return unchanged('invalid');
    }
    if (
      changes.includes('router.group_add added') &&
      JSON.stringify(patched?.['group_add']) !== JSON.stringify(want?.['group_add'])
    ) {
      return unchanged('invalid');
    }
  } catch {
    return unchanged('invalid');
  }
  return { content, changes };
}
