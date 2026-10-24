/**
 * EXTRA_ARGS and the itzg `--universe` option (ADR-0002 D-1, ADR-0003 §1).
 * Pure: shared by the world assignment snapshot, the ServerSpec import and
 * setEnvKey.
 */

/**
 * Where --universe puts worlds: 'worlds' for /worlds, 'internal' for none or
 * /data (the container's working directory), undefined for anything else.
 */
export function universeLocation(extraArgs: string): 'worlds' | 'internal' | undefined {
  const args = extraArgs.trim().split(/\s+/).filter(Boolean);
  const i = args.findIndex((a) => a === '--universe' || a.startsWith('--universe='));
  if (i < 0) return 'internal';
  const value = args[i]!.startsWith('--universe=') ? args[i]!.slice('--universe='.length) : args[i + 1];
  if (!value || value.includes('$')) return undefined;
  const path = value.replace(/\/+$/, '') || '/';
  if (path === '/worlds') return 'worlds';
  if (path === '/data' || path === '.' || path === './') return 'internal';
  return undefined;
}

/** EXTRA_ARGS without its --universe option (that is world.storage). */
export function withoutUniverse(extraArgs: string): string {
  const args = extraArgs.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--universe') i++;
    else if (!args[i]!.startsWith('--universe=')) out.push(args[i]!);
  }
  return out.join(' ');
}
