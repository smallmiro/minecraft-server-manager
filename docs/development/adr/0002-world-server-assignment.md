# ADR-0002: World–Server Assignment Derived from `LEVEL`

| | |
|---|---|
| **Status** | Proposed (2026-10-23) |
| **Issue** | [#670](https://github.com/smallmiro/minecraft-server-manager/issues/670) (Hardening A4, decision D-2), milestone M3 (#644), epic #640; includes #715 S4 (remove `lock.sh`) |
| **Changes** | [ADR-0001](0001-container-runtime-ports.md): `IWorldAssignmentPort` is final |
| **Related** | #652 / PR #741 (delete keeps the world), #655 (A5, migrate server-internal worlds), #669 (A7, runtime unavailable error), #732 (S3, backup adapter), #734 (S5, remove `mcctl.sh`), #736 (S9, v3.0.0) |

## Context

- D-2 rules R1–R7 (see #670) are not enforced. `lock.sh` writes `worlds/.locks/<world>.lock` only from `world assign`. No start path reads it, `create` and `delete` never write or clear it, locks go stale after 24 h, a stale lock cannot be released (`set -e` + exit 2), and `WorldRepository.getLockStatus` treats an unreadable lock as "unlocked".
- The assignment that actually matters is each server's `LEVEL` in `servers/<n>/config.env`: it decides which world directory the container opens. `WorldManagementUseCase.listWorlds()` already builds `servers[]` from it.
- `WorldManagementUseCase` reads server status through `ShellAdapter.serverStatus`, whose argument `mcctl.sh status` ignores, so the check always fails and `LEVEL` changes while the server runs.
- World delete and the API world reset do not check which servers use the world.

## Decision Summary

1. **`LEVEL` is the only source of truth (R5).** A server's world is `resolveWorldName(env)` (`LEVEL`, then the legacy `WORLD_NAME`, else itzg's `world`). There is no other assignment record. Deleting a server's `config.env` releases its world (R3), so delete needs no extra step.
2. **`IWorldAssignmentPort` stays a port** (#715: no new ports) with three async methods: `listAssignments`, `assign`, and `release` (the unassign method #715 asked for). `getAssignment` is dropped; callers use the pure helper `holdersOf`.
3. **The rules are pure domain functions** (`checkAssign`, `planRelease`, `holdersOf`, `findDuplicates`), so a future adapter (k8s, `IServerSpecRepository`) reuses them. The adapter only reads and writes `config.env`, and it runs `checkAssign` on a fresh snapshot right before it writes.
4. **Fail-closed (R7).** A server whose `config.env` cannot be read, or whose resolved world fails `WORLD_NAME_PATTERN`, is *undetermined*. While any server is undetermined, every assignment change and every world delete/reset is refused. Read-only listings still work and show a warning.
5. **`LEVEL` changes only on a stopped server.** `assign`, `release`, `world new --server`, `config LEVEL`, and PATCH `level` refuse when the server's runtime status is `running`, `paused`, `restarting`, or `created`. Nothing stops a server automatically.
6. **`mcctl world release <world>` is redefined**: the holding server falls back to its own default world `<server>` (the `LEVEL` that `create-server.sh` writes). `--force` is accepted and ignored.
7. **`worlds/.locks` is ignored**: never read, written, or deleted by mcctl. `mcctl init` stops creating it. Users may delete it; release notes say so.
8. **Duplicates are reported, not fixed** (plan item 6): in `mcctl world list`, `GET /api/worlds`, and the console worlds page. Start paths are unchanged.
9. **`lock.sh` and `lock.bats` are deleted**; the `mcctl.sh world` subcommand stays, unused, until #734.

## Assignment Model

| Case | Rule |
|------|------|
| Normal server | Holds `resolveWorldName(env)`. `LEVEL` unset means it holds `world`. |
| Dimension folders | `<w>_nether` and `<w>_the_end` are part of `<w>`. `holdersOf(w)` matches servers whose world is `w`, `w_nether`, or `w_the_end`. `assign` rejects a name ending in `_nether` or `_the_end` (`invalid_world`). |
| Legacy names | `WORLD_NAME` is read as today and never written. A resolved world that fails `WORLD_NAME_PATTERN` (spaces, `./x`, `x/`) is ambiguous on disk, so the server is undetermined (same strictness as PR #741). |
| Server-internal world (D-1) | `EXTRA_ARGS` has no `--universe`: the world lives in `servers/<n>/data/<LEVEL>`. The server is listed with `internal: true` and still **reserves** the name (PR #741 moves that world to `worlds/<LEVEL>` on delete and aborts on a name clash). `assign` and `release` refuse such a server (`internal_world`) until #655 migrates it, because a new `LEVEL` would open an empty `data/<LEVEL>` (plan item 4). Delete/reset of `worlds/<w>` ignore internal holders, since their files are elsewhere. |
| Server dirs | Same filter as `ServerRepository.listNames`: directories not starting with `_` that contain `config.env`. |

## Port and Adapter

```ts
// shared/src/domain/services/worldAssignment.ts  (pure, no I/O)
export interface WorldAssignment {
  world: string;      // resolveWorldName(env)
  server: string;
  internal: boolean;  // no --universe in EXTRA_ARGS (D-1)
}
export interface WorldAssignmentSnapshot {
  assignments: WorldAssignment[]; // one per readable server, sorted by server
  undetermined: string[];         // unreadable config.env or invalid resolved world
}
export type WorldAssignmentErrorCode =
  | 'invalid_world' | 'server_not_found' | 'conflict' | 'undetermined'
  | 'internal_world' | 'not_assigned' | 'default_world' | 'server_running';
export class WorldAssignmentError extends Error {
  constructor(readonly code: WorldAssignmentErrorCode, message: string, readonly servers: string[] = []) { super(message); }
}
export function holdersOf(s: WorldAssignmentSnapshot, world: string, opts?: { includeInternal?: boolean }): string[];
export function checkAssign(s: WorldAssignmentSnapshot, world: string, server: string): WorldAssignmentError | null;
export function planRelease(s: WorldAssignmentSnapshot, world: string): { server: string; fallback: string } | WorldAssignmentError;
export function findDuplicates(s: WorldAssignmentSnapshot): { world: string; servers: string[] }[];

// shared/src/application/ports/outbound/IWorldAssignmentPort.ts
export interface IWorldAssignmentPort {
  /** Rejects only when servers/ cannot be listed (ENOENT = empty). A bad server goes to `undetermined`. */
  listAssignments(): Promise<WorldAssignmentSnapshot>;
  /** Writes LEVEL=<world> after checkAssign on a fresh snapshot; no-op if already assigned. Rejects WorldAssignmentError. */
  assign(world: string, server: string): Promise<void>;
  /** The holder's LEVEL becomes `<holder>`. Rejects WorldAssignmentError. */
  release(world: string): Promise<{ server: string; fallback: string }>;
}
```

- `checkAssign` order: `invalid_world`, `undetermined` (any), `server_not_found`, `internal_world` (target), `conflict` (another holder, internal included).
- `planRelease` order: `undetermined`, `not_assigned`, `conflict` (2+ holders: duplicate), `internal_world`, `default_world` (world equals the holder's name), then `checkAssign(fallback, holder)`. If `worlds/<holder>` exists and is free, the holder adopts it; the message says so.
- **Adapter**: `ConfigEnvWorldAssignmentAdapter(paths)` in `shared/src/infrastructure/adapters/ConfigEnvWorldAssignmentAdapter.ts`. It reads with `parseEnvDocument` and writes with `applyEnvChanges({ set: { LEVEL } })` + `writeFileAtomic`, keeping the file's current mode (stat first; the helper defaults to `0o600`). Other lines stay byte-identical.
- `server_running` is raised by use cases, not by the adapter (the port knows nothing about the runtime).
- **Race**: two processes (CLI and API) can both pass `checkAssign` before either writes. Accepted: human-driven, millisecond window, and `findDuplicates` reports the result. Mark it with a `ponytail:` comment; add an `open(..., 'wx')` mutex file if it is ever seen.

### Composition roots

| Root | Change |
|------|--------|
| CLI `Container` | `worldAssignmentPort` getter (`new ConfigEnvWorldAssignmentAdapter(this.paths)`), plus a runtime getter if #668 has not added one. Pass both to `WorldManagementUseCase` and the port to `CreateServerUseCase`. |
| API | No container plugin yet (D2). `createWorldUseCase()` in `routes/worlds.ts`, the create route in `routes/servers.ts`, and `routes/servers/config.ts` construct the adapter and `DockerComposeRuntimeAdapter` with `new`. The `ShellAdapter` built in the create route goes away. D2 moves them into its plugin. |

`WorldManagementUseCase` gains required trailing parameters `assignments` and `runtime`. `CreateServerUseCase` gains an optional trailing `assignments`; when it is missing, create fails closed (`undetermined`). `WorldRepository(paths, assignments = new ConfigEnvWorldAssignmentAdapter(paths))` fills `World.lockTo()` from one snapshot per call, so `isLocked`/`lockedBy` now mean "assigned". `findAllWithServerStatus` maps `not_found` to `stopped`, not `available`: the assignment lives in config, not in the container.

### Deprecated (removal in #736, v3.0.0)

`IShellPort`/`ShellAdapter`: `worldAssign`, `worldRelease`, `serverStatus` (their last callers are removed here). `WorldRepository.getLockStatus` (derived from the snapshot; `pid` undefined), `WorldLockData`, `Paths.locks`, `Paths.lockFile`. The API fields `isLocked`/`lockedBy` stay in v2.x as aliases for "assigned"; the source of truth is `servers[]`.

## Enforcement Points (R1, R6, R7)

| Entry | Check |
|-------|-------|
| `mcctl create [--world W]`, interactive create (`CreateServerUseCase`) | `checkAssign(snapshot, W ?? <name>, <name>)` before `shell.createServer`. The default world `<name>` is checked too: a world left behind by a deleted server of the same name may be held by someone else. Adopting a *free* `worlds/<name>` stays as today. |
| API `POST /api/servers` | Same check, replacing the `listWorlds()` block. 409 on conflict/undetermined. |
| `mcctl world assign`, API `POST /api/worlds/:name/assign` | `WorldManagementUseCase.assignWorldByName` → runtime check → `assignments.assign`. The world must exist in `worlds/`. |
| `mcctl config <srv> LEVEL\|WORLD_NAME <v>`, API PATCH `/api/servers/:name/config` with a changed `level` | `assignWorldByName(v, srv, { requireExisting: false })`. PATCH then drops `level` from the rest of the update. A new world directory is still created on first start, as today. |
| `mcctl world new --server`, API `POST /api/worlds` with `serverName` | Runtime check and `checkAssign` **before** creating the directory, then `assignments.assign`. `start` uses `runtime.start`. `SEED` stays on `shell.setServerConfig` until #734/#726. |
| `mcctl world release`, API `POST /api/worlds/:name/release` | Runtime check on the holder, then `assignments.release`. |
| `mcctl world delete`, API `DELETE /api/worlds/:name` | Refuse when `holdersOf(w, { includeInternal: false })` is non-empty or anything is undetermined. `--force`/`?force` no longer bypasses this; it only skips the prompt. |
| API `POST /api/servers/:name/world/reset` | Refuse when the server is internal (the route would wipe `worlds/<LEVEL>`, which is not its world), when another non-internal server also holds the world, or when anything is undetermined. |

- **Runtime check**: `runtime.getStatus('mc-<server>')` (D1 naming; D4 switches to `ServerName`). In D1, `not_found` also means "runtime unreachable", so that case passes. A7 (#669) will make it throw, and the use case maps the throw to `undetermined`. This is the only fail-open gap, and it closes with A7.
- **Results**: `WorldAssignResult`, `WorldReleaseResult`, and `WorldDeleteResult` gain `errorCode?: WorldAssignmentErrorCode`. API routes map codes instead of matching strings: `invalid_world` → 400, `server_not_found` and "world not found" → 404, everything else → 409. The message names the blocking servers and the next step ("assign another world to `alpha` or delete it").
- `mcctl start`, API start, `startAll`, and mc-router auto-start are **not** gated. Once config enforces R1, two servers can share a world only through an existing duplicate, and that is reported.

## `world release` and `worlds/.locks`

- **Release**: under R5, removing a lock without changing `LEVEL` does nothing. Falling back to `<server>` turns release into "give the world back" and keeps the CLI command, the API route, and the console Release button working (R4, R6). Output: `World 'W' released from 'alpha'; alpha now uses world 'alpha' (created on next start)`.
- **`.locks`**: from PR1 on, nothing reads or writes it, and `WorldRepository.delete` stops unlinking lock files. Existing files are harmless: `listNames` skips dot directories. Nobody deletes them automatically, because mcctl does not touch user data it no longer owns. The v2.x release notes and v3.0.0 (#736) say `rm -rf worlds/.locks` is safe. Downgrade is harmless too: the old lock code never enforced anything.
- **Backup (#732)**: keep `.locks` in the exclude list, so it is neither backed up, restored, created, nor deleted. The TS adapter must not create `worlds/.locks` on restore (`backup.sh:480` does today). Restoring `worlds/` does not touch `servers/*/config.env`, so assignments survive a restore.

## Duplicate and Undetermined Reporting (minimal)

- `WorldManagementUseCase.getAssignmentReport(): Promise<{ duplicates; undetermined }>` wraps `listAssignments` + `findDuplicates`.
- **CLI** `mcctl world list`: shows "assigned: a" instead of "locked: a", and after the list prints one warning per duplicate world ("assigned to a, b; R1 allows one: assign another world to all but one") and per undetermined server ("cannot read assignment of x; assignment changes are refused until fixed"). `mcctl status` is left alone (#655 adds its "migration needed" marker there).
- **API** `GET /api/worlds`: adds `assignmentWarnings: string[]` (same messages). Duplicates are also visible as `servers.length > 1`.

## Console UX (minimal)

1. The worlds page already shows assign/release/delete/create failures as `Alert`s with the API `message`, and the BFF route forwards status and message. No change beyond the clearer messages.
2. Render `assignmentWarnings` as one warning `Alert` on the worlds page.
3. `WorldCard`: when `servers.length > 1`, show a warning chip "Assigned to N servers" with the names in the tooltip. Rename the "Locked" chip label to "Assigned".
4. `AssignWorldDialog`: disable running servers (the API now refuses them) instead of only warning.

## Removing `lock.sh` (S4)

- Delete `platform/scripts/lock.sh`, `platform/scripts/tests/lock.bats`, and the now unused `require_flock` in `tests/helpers.bash`. `sync-scripts` stops shipping the script, so the `verify:package` diff stays clean.
- `mcctl.sh world` stays as is (fixed decision). With `lock.sh` gone it exits through its existing "lock.sh not found" error, and nothing calls it. `ShellAdapter.worldList` (already deprecated, no callers) and `common.sh get_locks_dir` stay until #734/#736.
- `cli/src/commands/init.ts` stops creating `paths.locks`. The `.gitignore` templates keep their `.locks` entries for existing installs.
- `lock.bats` → vitest:

| `lock.bats` test | Becomes |
|------------------|---------|
| acquire writes `<server>:<ts>:<pid>` | adapter: `assign` writes `LEVEL`, other lines byte-identical, mode kept |
| a different server cannot take a held lock | kept as R1: `assign` → `conflict`, file unchanged |
| unlock: non-owner refused, `--force`, owner releases | `release` changes only the holder; no force; refused for running, internal, and default-world cases |
| check: unlocked / locked / stale (exit 2) | `listAssignments`; staleness is gone (no TTL); an unreadable config → `undetermined` |

## Test Plan (TDD, red first)

- **Domain** (`worldAssignment.test.ts`): every `checkAssign`/`planRelease` branch in the order above; satellites; internal reservation; `findDuplicates` on `LEVEL`-unset servers (all hold `world`).
- **Adapter** (tmp dir fixtures): `LEVEL` / `WORLD_NAME` / unset; `_template` and dirs without `config.env` skipped; `config.env` as a directory (EISDIR, portable and works as root) → undetermined; invalid `LEVEL` → undetermined; internal detection; missing `servers/` → empty; `assign` and `release` writes and refusals; a `worlds/.locks/x.lock` fixture has no effect.
- **Use cases** (mock ports): assign/release/createWorld refuse `running` before any write and never call `shell.worldAssign`/`worldRelease`/`setServerConfig('LEVEL')`; delete refuses a referenced world even with `force`; create refuses a held `--world` and a held default name; delete of a server makes its world assignable again (AC 3).
- **API** (inject, mocked shared): 409/400/404 mapping for assign, release, create, PATCH `level`, reset (internal and duplicate), delete; `assignmentWarnings`.
- **CLI**: `config LEVEL` guard, `world list` warnings, `release` output. **Console**: `WorldCard` multi-server chip, worlds page warning.
- **Gate**: `pnpm build && pnpm lint && pnpm typecheck && pnpm test`; PR3 adds `pnpm test:scripts` and `pnpm --filter @minecraft-docker/mcctl verify:package`.

## PR Split

| PR | Owner | Content |
|----|-------|---------|
| PR1 | core-agent | Domain rules, final port, `ConfigEnvWorldAssignmentAdapter`, `WorldRepository` hydration, `WorldManagementUseCase` and `CreateServerUseCase` changes, deprecations, and the minimal wiring in the CLI `Container` and API `createWorldUseCase()` that the new constructor parameters force. After PR1, `world assign/release` no longer use `ShellAdapter`. |
| PR2 | backend + cli + frontend | API create/PATCH/reset/delete guards, `errorCode` mapping, `assignmentWarnings`; CLI `config LEVEL`, `world list`, `release` text; console items 2–4. |
| PR3 | cli + technical-writer | Delete `lock.sh`/`lock.bats`/`require_flock`, `init.ts`; docs EN/KO (`docs/cli/commands.md` world section, `docs/console/setup-guide`, `docs/development/git-workflow`, `docs/documentforllmagent.md`, PRD FR-003). Small; may be folded into PR2. |

## Consequences

- **+** One source of truth; no TTLs, no stale locks, no lock file to back up or migrate to k8s volumes.
- **+** The rules are pure functions, so a ServerSpec or k8s adapter (D5, #641) only reimplements read and write.
- **−** One broken `config.env` blocks all assignment changes until it is fixed (deliberate, R7).
- **−** The check-then-write race between processes is accepted, not prevented.
- **−** Existing duplicates keep running until the user resolves them.

## Open Questions (need a human decision)

1. **`world release` semantics**: (A, recommended) fall back to `<server>` as above; or (B) deprecate it into an error that says "use `world assign`". B leaves `release` on the port without a caller, which breaks ADR-0001's method rule and the #715 decision.
2. **`.locks` cleanup**: (A, recommended) never auto-delete, document only; or (B) have #736's `mcctl upgrade` delete `worlds/.locks`.
3. **Invalid legacy `LEVEL`** blocks every change install-wide (strict R7, matches PR #741). Alternative: count it as a holder by exact name only. Recommended: strict.
4. **`world delete --force`** no longer deletes a referenced world (AC: refuse when referenced). Confirm this CLI/API behaviour change.
5. **`world new --server` on a running server**: refuse (recommended; the auto-stop it intended never worked because of the status bug), or keep the auto-stop via `runtime.stop`.
6. **Cross-process race**: accept (recommended) or add a mutex file now.
