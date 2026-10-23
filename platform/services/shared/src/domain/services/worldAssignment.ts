import { WORLD_NAME_PATTERN } from '../value-objects/WorldName.js';

/**
 * World–server assignment rules (#670, ADR-0002, decision D-2).
 *
 * A server's world is its `LEVEL` (R5); there is no other record. These pure
 * functions enforce R1, R6 and R7 on a snapshot, so every adapter (config.env
 * today, a ServerSpec or k8s store later) applies the same rules.
 */

export interface WorldAssignment {
  /** resolveWorldName(config.env) */
  world: string;
  server: string;
  /**
   * The world lives in servers/<n>/data, not worlds/ (D-1). Optional for the
   * v2 `{ world, server }` shape; adapters always set it, and absent means false.
   */
  internal?: boolean;
}

export interface WorldAssignmentSnapshot {
  /** One per readable server, sorted by server. */
  assignments: WorldAssignment[];
  /** Servers whose config.env is unreadable or whose world cannot be interpreted. */
  undetermined: string[];
}

export type WorldAssignmentErrorCode =
  | 'invalid_world'
  | 'server_not_found'
  | 'conflict'
  | 'undetermined'
  | 'internal_world'
  | 'not_assigned'
  | 'default_world'
  | 'server_running';

export class WorldAssignmentError extends Error {
  constructor(
    readonly code: WorldAssignmentErrorCode,
    message: string,
    readonly servers: string[] = []
  ) {
    super(message);
    this.name = 'WorldAssignmentError';
  }
}

const DIMENSION_SUFFIX = /_(nether|the_end)$/;

const list = (servers: string[]) => servers.map((s) => `'${s}'`).join(', ');

const conflictError = (world: string, holders: string[]) =>
  new WorldAssignmentError(
    'conflict',
    `World '${world}' is assigned to ${list(holders)}; ` +
      `assign another world to ${list(holders)} or delete it first`,
    holders
  );

/** The folders a world name covers on disk: the world and its two dimension folders. */
function folders(world: string): string[] {
  return [world, `${world}_nether`, `${world}_the_end`];
}

/** Whether two world names share a folder (deleting or using one touches the other). */
function overlaps(a: string, b: string): boolean {
  const fa = folders(a);
  return folders(b).some((f) => fa.includes(f));
}

/**
 * Servers whose world shares a folder with `world`, in snapshot order. A
 * holder covers its LEVEL and LEVEL_nether/LEVEL_the_end; the queried name
 * covers the same three (world delete removes all three), so `w_nether` of
 * a used `w`, and `w_nether_nether` of a legacy `LEVEL=w_nether`, are held.
 */
export function holdersOf(
  s: WorldAssignmentSnapshot,
  world: string,
  opts: { includeInternal?: boolean } = {}
): string[] {
  const includeInternal = opts.includeInternal ?? true;
  return s.assignments
    .filter((a) => overlaps(a.world, world) && (includeInternal || !a.internal))
    .map((a) => a.server);
}

function undeterminedError(s: WorldAssignmentSnapshot): WorldAssignmentError | null {
  if (s.undetermined.length === 0) return null;
  return new WorldAssignmentError(
    'undetermined',
    `Cannot read the world assignment of ${list(s.undetermined)}; ` +
      'assignment changes are refused until its config.env is fixed',
    [...s.undetermined]
  );
}

/**
 * Why `server` may not use `world`, or null when it may.
 * `newServer` (create): the server does not exist yet, so only the world is checked.
 */
export function checkAssign(
  s: WorldAssignmentSnapshot,
  world: string,
  server: string,
  opts: { newServer?: boolean } = {}
): WorldAssignmentError | null {
  if (!WORLD_NAME_PATTERN.test(world) || DIMENSION_SUFFIX.test(world)) {
    return new WorldAssignmentError(
      'invalid_world',
      `Invalid world name '${world}': only letters, numbers, hyphens, and underscores are allowed, ` +
        'and a name may not end in _nether or _the_end'
    );
  }
  const undetermined = undeterminedError(s);
  if (undetermined) return undetermined;

  if (!opts.newServer) {
    const target = s.assignments.find((a) => a.server === server);
    if (!target) {
      return new WorldAssignmentError('server_not_found', `Server '${server}' not found`, [server]);
    }
    if (target.internal) {
      return new WorldAssignmentError(
        'internal_world',
        `Server '${server}' keeps its world inside servers/${server}/data; ` +
          'migrate it to worlds/ before assigning another world',
        [server]
      );
    }
  }

  const others = holdersOf(s, world).filter((h) => h !== server);
  return others.length > 0 ? conflictError(world, others) : null;
}

/**
 * Why worlds/<world> may not be deleted, or null. Internal holders do not
 * block: their files are in servers/<n>/data, not in worlds/.
 */
export function checkRemoval(s: WorldAssignmentSnapshot, world: string): WorldAssignmentError | null {
  const undetermined = undeterminedError(s);
  if (undetermined) return undetermined;
  const holders = holdersOf(s, world, { includeInternal: false });
  return holders.length > 0 ? conflictError(world, holders) : null;
}

/**
 * Why a proposed snapshot (a restored or migrated config.env already applied)
 * is not acceptable for `server`, or null: R7, then R1 for its world.
 */
export function checkProposed(s: WorldAssignmentSnapshot, server: string): WorldAssignmentError | null {
  const undetermined = undeterminedError(s);
  if (undetermined) return undetermined;
  const target = s.assignments.find((a) => a.server === server);
  if (!target) return null;
  const others = holdersOf(s, target.world).filter((h) => h !== server);
  return others.length > 0 ? conflictError(target.world, others) : null;
}

/** Why `server`'s world (worlds/<LEVEL>) may not be wiped, or null. */
export function checkReset(s: WorldAssignmentSnapshot, server: string): WorldAssignmentError | null {
  const undetermined = undeterminedError(s);
  if (undetermined) return undetermined;
  const target = s.assignments.find((a) => a.server === server);
  if (!target) {
    return new WorldAssignmentError('server_not_found', `Server '${server}' not found`, [server]);
  }
  if (target.internal) {
    return new WorldAssignmentError(
      'internal_world',
      `Server '${server}' keeps its world inside servers/${server}/data, not in worlds/${target.world}; ` +
        'migrate it to worlds/ before resetting',
      [server]
    );
  }
  const others = holdersOf(s, target.world, { includeInternal: false }).filter((h) => h !== server);
  return others.length > 0 ? conflictError(target.world, others) : null;
}

/** The holder of `world` and the world it falls back to (its own name), or why not. */
export function planRelease(
  s: WorldAssignmentSnapshot,
  world: string
): { server: string; fallback: string } | WorldAssignmentError {
  const undetermined = undeterminedError(s);
  if (undetermined) return undetermined;

  const holders = holdersOf(s, world);
  if (holders.length === 0) {
    return new WorldAssignmentError('not_assigned', `World '${world}' is not assigned to any server`);
  }
  if (holders.length > 1) {
    return new WorldAssignmentError(
      'conflict',
      `World '${world}' is assigned to ${list(holders)}; assign another world to all but one of them`,
      holders
    );
  }

  const server = holders[0]!;
  if (s.assignments.find((a) => a.server === server)!.internal) {
    return new WorldAssignmentError(
      'internal_world',
      `Server '${server}' keeps its world inside servers/${server}/data; migrate it to worlds/ first`,
      [server]
    );
  }
  if (world === server) {
    return new WorldAssignmentError(
      'default_world',
      `World '${world}' is the default world of '${server}'; assign another world to '${server}' instead`,
      [server]
    );
  }

  const fallbackError = checkAssign(s, server, server);
  return fallbackError ?? { server, fallback: server };
}

/**
 * Groups of servers whose worlds share a folder, sorted by world. Each group
 * is named after its shortest world name.
 */
export function findDuplicates(s: WorldAssignmentSnapshot): { world: string; servers: string[] }[] {
  const groups: WorldAssignment[][] = [];
  for (const a of s.assignments) {
    const touching = groups.filter((g) => g.some((b) => overlaps(a.world, b.world)));
    const merged = [...touching.flat(), a];
    for (const g of touching) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  }
  return groups
    .filter((g) => g.length > 1)
    .map((g) => ({
      world: g.map((a) => a.world).sort((x, y) => x.length - y.length || x.localeCompare(y))[0]!,
      servers: g.map((a) => a.server).sort(),
    }))
    .sort((a, b) => a.world.localeCompare(b.world));
}

/** One human-readable line per duplicate world and per undetermined server (CLI, API, console). */
export function formatAssignmentWarnings(report: {
  duplicates: { world: string; servers: string[] }[];
  undetermined: string[];
}): string[] {
  return [
    ...report.duplicates.map(
      (d) =>
        `World '${d.world}' is assigned to ${list(d.servers)}; ` +
        'only one server may use a world: assign another world to all but one'
    ),
    ...report.undetermined.map(
      (server) =>
        `Cannot read the world assignment of '${server}'; ` +
        'assignment changes are refused until its config.env is fixed'
    ),
  ];
}
