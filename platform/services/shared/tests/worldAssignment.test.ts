/**
 * World–server assignment rules (#670, ADR-0002): R1–R7 as pure functions.
 */
import { describe, it, expect } from 'vitest';
import {
  WorldAssignmentError,
  checkAssign,
  checkProposed,
  checkRemoval,
  checkReset,
  findDuplicates,
  formatAssignmentWarnings,
  holdersOf,
  planRelease,
  type WorldAssignment,
  type WorldAssignmentSnapshot,
} from '../src/domain/services/worldAssignment.js';
import { EXISTING_WORLD_NAME_PATTERN } from '../src/domain/value-objects/WorldName.js';

function snap(
  assignments: Array<[server: string, world: string, internal?: boolean]>,
  undetermined: string[] = []
): WorldAssignmentSnapshot {
  return {
    assignments: assignments.map(
      ([server, world, internal = false]): WorldAssignment => ({ server, world, internal })
    ),
    undetermined,
  };
}

function expectError(result: unknown, code: string, servers?: string[]): WorldAssignmentError {
  expect(result).toBeInstanceOf(WorldAssignmentError);
  const error = result as WorldAssignmentError;
  expect(error.code).toBe(code);
  if (servers) expect(error.servers).toEqual(servers);
  return error;
}

describe('EXISTING_WORLD_NAME_PATTERN (legacy LEVEL values, R7)', () => {
  it.each(['world', 'My World', 'world.old', '-lobby', 'x y z', '월드'])('accepts %s', (name) => {
    expect(EXISTING_WORLD_NAME_PATTERN.test(name)).toBe(true);
  });

  it.each(['', '.', '..', '../x', 'a/b', 'a\\b', "it's", 'say "hi"', 'a\nb', 'a\tb', 'a\0b', 'a\x7fb'])(
    'rejects %j',
    (name) => {
      expect(EXISTING_WORLD_NAME_PATTERN.test(name)).toBe(false);
    }
  );
});

describe('holdersOf', () => {
  it('matches the world and its dimension folders', () => {
    const s = snap([
      ['a', 'w'],
      ['b', 'w_nether'],
      ['c', 'w_the_end'],
      ['d', 'w2'],
      ['e', 'other'],
    ]);
    expect(holdersOf(s, 'w')).toEqual(['a', 'b', 'c']);
  });

  it('includes internal holders unless asked not to', () => {
    const s = snap([
      ['a', 'w', true],
      ['b', 'w'],
    ]);
    expect(holdersOf(s, 'w')).toEqual(['a', 'b']);
    expect(holdersOf(s, 'w', { includeInternal: false })).toEqual(['b']);
  });

  it('is empty for an unassigned world', () => {
    expect(holdersOf(snap([['a', 'x']]), 'w')).toEqual([]);
  });
});

describe('checkAssign (order: invalid_world, undetermined, server_not_found, internal_world, conflict)', () => {
  it('allows a free world', () => {
    expect(checkAssign(snap([['a', 'a'], ['b', 'b']]), 'free', 'a')).toBeNull();
  });

  it('allows re-assigning the world the server already holds', () => {
    expect(checkAssign(snap([['a', 'w']]), 'w', 'a')).toBeNull();
  });

  it.each(['../x', 'my world', 'world.old', '', 'w_nether', 'w_the_end'])(
    'rejects the world name %j (invalid_world) before anything else',
    (world) => {
      expectError(checkAssign(snap([], ['broken']), world, 'missing'), 'invalid_world');
    }
  );

  it('refuses while any server is undetermined (R7)', () => {
    const error = expectError(checkAssign(snap([['a', 'a']], ['broken']), 'free', 'a'), 'undetermined', [
      'broken',
    ]);
    expect(error.message).toContain('broken');
  });

  it('rejects an unknown server', () => {
    expectError(checkAssign(snap([['a', 'a']]), 'free', 'ghost'), 'server_not_found', ['ghost']);
  });

  it('rejects a target server whose world is inside its data directory (D-1)', () => {
    expectError(checkAssign(snap([['a', 'a', true]]), 'free', 'a'), 'internal_world', ['a']);
  });

  it('rejects a world held by another server (R1, R6) and names the holder', () => {
    const error = expectError(checkAssign(snap([['a', 'w'], ['b', 'b']]), 'w', 'b'), 'conflict', ['a']);
    expect(error.message).toContain("'a'");
  });

  it('treats a dimension folder held by another server as a conflict', () => {
    expectError(checkAssign(snap([['a', 'w_nether'], ['b', 'b']]), 'w', 'b'), 'conflict', ['a']);
  });

  it('counts an internal server as a holder of its name', () => {
    expectError(checkAssign(snap([['a', 'w', true], ['b', 'b']]), 'w', 'b'), 'conflict', ['a']);
  });

  it('treats unset LEVEL servers as holders of "world"', () => {
    expectError(checkAssign(snap([['a', 'world'], ['b', 'b']]), 'world', 'b'), 'conflict', ['a']);
  });

  it('newServer skips the existence and internal checks (create)', () => {
    expect(checkAssign(snap([['a', 'a']]), 'new', 'new', { newServer: true })).toBeNull();
    expectError(checkAssign(snap([['a', 'new']]), 'new', 'new', { newServer: true }), 'conflict', ['a']);
    expectError(checkAssign(snap([], ['x']), 'new', 'new', { newServer: true }), 'undetermined');
  });
});

describe('planRelease (order: undetermined, not_assigned, conflict, internal_world, default_world, checkAssign)', () => {
  it('falls back to the holder default world <server>', () => {
    expect(planRelease(snap([['alpha', 'w']]), 'w')).toEqual({ server: 'alpha', fallback: 'alpha' });
  });

  it('refuses while any server is undetermined', () => {
    expectError(planRelease(snap([['alpha', 'w']], ['broken']), 'w'), 'undetermined', ['broken']);
  });

  it('rejects an unassigned world', () => {
    expectError(planRelease(snap([['alpha', 'alpha']]), 'w'), 'not_assigned');
  });

  it('rejects a duplicate assignment instead of guessing', () => {
    expectError(planRelease(snap([['a', 'w'], ['b', 'w']]), 'w'), 'conflict', ['a', 'b']);
  });

  it('rejects an internal holder', () => {
    expectError(planRelease(snap([['alpha', 'w', true]]), 'w'), 'internal_world', ['alpha']);
  });

  it('rejects releasing a server from its own default world', () => {
    expectError(planRelease(snap([['alpha', 'alpha']]), 'alpha'), 'default_world', ['alpha']);
  });

  it('rejects when the fallback world is held by someone else', () => {
    expectError(planRelease(snap([['alpha', 'w'], ['beta', 'alpha']]), 'w'), 'conflict', ['beta']);
  });

  it('finds the holder through a dimension folder', () => {
    expect(planRelease(snap([['alpha', 'w_nether']]), 'w')).toEqual({ server: 'alpha', fallback: 'alpha' });
  });
});

describe('findDuplicates (plan item 6)', () => {
  it('reports worlds held by more than one server, sorted', () => {
    const s = snap([
      ['c', 'world'],
      ['a', 'world'],
      ['b', 'world'],
      ['d', 'solo'],
      ['e', 'x'],
      ['f', 'x_nether'],
    ]);
    expect(findDuplicates(s)).toEqual([
      { world: 'world', servers: ['a', 'b', 'c'] },
      { world: 'x', servers: ['e', 'f'] },
    ]);
  });

  it('is empty when every world has one server', () => {
    expect(findDuplicates(snap([['a', 'a'], ['b', 'b']]))).toEqual([]);
  });
});

describe('checkRemoval (world delete: undetermined, conflict on non-internal holders)', () => {
  it('allows an unassigned world', () => {
    expect(checkRemoval(snap([['a', 'a']]), 'w')).toBeNull();
  });

  it('refuses while anything is undetermined', () => {
    expectError(checkRemoval(snap([], ['broken']), 'w'), 'undetermined', ['broken']);
  });

  it('refuses a world or dimension folder used by a server', () => {
    expectError(checkRemoval(snap([['a', 'w'], ['b', 'w_the_end']]), 'w'), 'conflict', ['a', 'b']);
  });

  it('ignores internal holders: their files are in servers/<n>/data', () => {
    expect(checkRemoval(snap([['a', 'w', true]]), 'w')).toBeNull();
  });
});

describe('checkReset (order: undetermined, server_not_found, internal_world, conflict)', () => {
  it('allows the sole holder', () => {
    expect(checkReset(snap([['a', 'w'], ['old', 'w', true]]), 'a')).toBeNull();
  });

  it('refuses while anything is undetermined, even for the undetermined server itself', () => {
    expectError(checkReset(snap([['a', 'w']], ['b']), 'b'), 'undetermined', ['b']);
  });

  it('rejects an unknown server', () => {
    expectError(checkReset(snap([['a', 'w']]), 'ghost'), 'server_not_found', ['ghost']);
  });

  it('rejects an internal server: worlds/<LEVEL> is not its world', () => {
    expectError(checkReset(snap([['a', 'w', true]]), 'a'), 'internal_world', ['a']);
  });

  it('rejects a world another server also uses (duplicate)', () => {
    expectError(checkReset(snap([['a', 'w'], ['b', 'w']]), 'a'), 'conflict', ['b']);
  });
});

describe('formatAssignmentWarnings', () => {
  it('writes one line per duplicate world and per undetermined server', () => {
    expect(
      formatAssignmentWarnings({ duplicates: [{ world: 'w', servers: ['a', 'b'] }], undetermined: ['x'] })
    ).toEqual([
      "World 'w' is assigned to 'a', 'b'; only one server may use a world: assign another world to all but one",
      "Cannot read the world assignment of 'x'; assignment changes are refused until its config.env is fixed",
    ]);
  });

  it('is empty for a clean report', () => {
    expect(formatAssignmentWarnings({ duplicates: [], undetermined: [] })).toEqual([]);
  });
});

describe('world family: a world and its dimension folders are one unit (Codex #1)', () => {
  it('a legacy LEVEL=w_nether holds its own dimension folders w_nether_nether and w_nether_the_end', () => {
    const s = snap([['a', 'w_nether']]);
    expect(holdersOf(s, 'w_nether_nether')).toEqual(['a']);
    expect(holdersOf(s, 'w_nether_the_end')).toEqual(['a']);
    expectError(checkRemoval(s, 'w_nether_nether'), 'conflict', ['a']);
  });

  it('deleting w (which also deletes w_nether) is refused while LEVEL=w_nether is used', () => {
    expectError(checkRemoval(snap([['a', 'w_nether']]), 'w'), 'conflict', ['a']);
  });

  it('unrelated names stay free', () => {
    const s = snap([['a', 'w']]);
    expect(holdersOf(s, 'w2')).toEqual([]);
    expect(holdersOf(s, 'w_nether_nether')).toEqual([]);
  });

  it('holdersOf a dimension folder finds the holder of the parent world', () => {
    expect(holdersOf(snap([['a', 'w']]), 'w_nether')).toEqual(['a']);
    // w_the_end and w_nether share no folder: deleting one never touches the other
    expect(holdersOf(snap([['a', 'w_the_end']]), 'w_nether')).toEqual([]);
  });

  it('deleting a dimension folder of a used world is refused', () => {
    expectError(checkRemoval(snap([['a', 'w']]), 'w_nether'), 'conflict', ['a']);
  });

  it('resetting a legacy LEVEL=w_nether server sees the holder of w', () => {
    expectError(checkReset(snap([['a', 'w_nether'], ['b', 'w']]), 'a'), 'conflict', ['b']);
  });
});

describe('checkProposed (snapshot restore, migrate)', () => {
  it('allows a server that alone uses its world', () => {
    expect(checkProposed(snap([['a', 'w'], ['b', 'b']]), 'a')).toBeNull();
  });

  it('refuses a world another server already uses', () => {
    expectError(checkProposed(snap([['a', 'w'], ['b', 'w_nether']]), 'a'), 'conflict', ['b']);
  });

  it('refuses while anything is undetermined', () => {
    expectError(checkProposed(snap([['a', 'w']], ['a']), 'a'), 'undetermined', ['a']);
  });
});

describe('findDuplicates with overlapping world folders', () => {
  it('groups LEVEL=w_nether with the holder of w', () => {
    expect(findDuplicates(snap([['a', 'w'], ['b', 'w_nether']]))).toEqual([{ world: 'w', servers: ['a', 'b'] }]);
  });

  it('groups LEVEL=w_nether with LEVEL=w_nether_nether', () => {
    expect(findDuplicates(snap([['a', 'w_nether'], ['b', 'w_nether_nether']]))).toEqual([
      { world: 'w_nether', servers: ['a', 'b'] },
    ]);
  });
});
