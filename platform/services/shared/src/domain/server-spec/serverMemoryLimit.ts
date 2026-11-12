import type { ServerSpecDocument } from './ServerSpecDocument.js';

const MB_PER_UNIT: Record<string, number> = { k: 1 / 1024, m: 1, g: 1024 };

/** MiB of a JVM size as itzg reads MEMORY (`4G`, `2048m`, `1048576k`); undefined for `75%`, bare numbers, ''. */
function sizeMb(value: string | undefined): number | undefined {
  const match = /^(\d+(?:\.\d+)?)([kmg])$/i.exec(value?.trim() ?? '');
  return match ? Math.ceil(Number(match[1]) * MB_PER_UNIT[match[2]!.toLowerCase()]!) : undefined;
}

/**
 * The container memory limit of a server in MiB (#662), or undefined for no
 * limit. MEMORY (or MAX_MEMORY, which wins) is only the JVM heap: metaspace
 * (large for mod loaders), code cache, thread stacks, GC data and direct
 * buffers (netty; up to the heap size by default) come on top. The limit is
 * the heap plus half of it, at least 2G more: an OOM kill stops the server
 * mid-save. No limit when the heap is unknown (unset, a percentage) or a JVM
 * option sets it (-Xmx, -XX:MaxRAM*).
 */
export function serverMemoryLimitMb(doc: Pick<ServerSpecDocument, 'memory' | 'env'>): number | undefined {
  if (Object.values(doc.env).some((v) => /-Xmx|-XX:MaxRAM/i.test(v))) return undefined;
  const heap = sizeMb(doc.env['MAX_MEMORY'] || doc.memory);
  return heap === undefined ? undefined : heap + Math.max(2048, Math.ceil(heap / 2));
}
