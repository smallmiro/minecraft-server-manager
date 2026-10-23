# ADR-0002: World–Server Assignment Derived from `LEVEL`

| | |
|---|---|
| **Status** | Accepted (2026-10-23), implemented in #670 |
| **Issue** | [#670](https://github.com/smallmiro/minecraft-server-manager/issues/670) (Hardening A4, decision D-2), milestone M3 (#644), epic #640; includes #715 S4 (remove `lock.sh`) |
| **Changes** | [ADR-0001](0001-container-runtime-ports.md): `IWorldAssignmentPort` is final |
| **Related** | #652 / PR #741 (delete keeps the world), #655 (A5, migrate server-internal worlds), #656 (env parser unification), #669 (A7), #732 (S3, backup adapter; strict runtime lookup), #734 (S5, remove `mcctl.sh`), #736 (S9, v3.0.0) |

## Context

- D-2 rules R1–R7 (see #670) were not enforced. `lock.sh` wrote `worlds/.locks/<world>.lock` only from `world assign`. No start path read it, `create` and `delete` never wrote or cleared it, locks went stale after 24 h, a stale lock could not be released (`set -e` + exit 2), and `WorldRepository.getLockStatus` treated an unreadable lock as "unlocked".
- The assignment that actually matters is each server's `LEVEL` in `servers/<n>/config.env`: it decides which world directory the container opens.
- `WorldManagementUseCase` read server status through `ShellAdapter.serverStatus`, whose argument `mcctl.sh status` ignores, so the check always failed and `LEVEL` changed while the server ran.
- World delete, the API world reset, config snapshot restore and `mcctl migrate` did not check which servers use a world.

## Decision

1. **`LEVEL` is the only source of truth (R5).** A server's world is `resolveWorldName(env)` (`LEVEL`, then the legacy `WORLD_NAME`, else itzg's `world`). There is no other record. Deleting a server's `config.env` releases its world (R3).
2. **`IWorldAssignmentPort` stays a port** (#715: no new ports, methods may be added). The v2 contract stays: `getAssignment` (deprecated) and `listAssignments` (`WorldAssignment[]`, `internal` optional). #670 adds `snapshot` (with undetermined servers), `preview`, and `release` (the unassign method #715 asked for). Callers use `snapshot` with `holdersOf`.
3. **The rules are pure domain functions** (`shared/src/domain/services/worldAssignment.ts`), so a future adapter (k8s, `IServerSpecRepository`) reuses them. The adapter only reads and writes `config.env` and runs `checkAssign` on a fresh snapshot right before it writes.
4. **Fail-closed (R7).** A server is *undetermined* when its `config.env` cannot be read, its resolved world fails `EXISTING_WORLD_NAME_PATTERN`, the world or `EXTRA_ARGS` value would be interpolated by Compose, or its `--universe` points somewhere unsupported. While any server is undetermined, every assignment change and every world delete/reset is refused. Listings still work and show a warning.
5. **A world changes only on a stopped server.** Assign, release, `world new --server`, `config LEVEL|WORLD_NAME`, PATCH `level`, snapshot restore and migrate refuse when the runtime status is `running`, `paused`, `restarting`, or `created`. Nothing stops a server automatically, and `force` never bypasses this.
6. **`world release` = fall back to the default world.** The holding server switches to its own default world `<server>` (the `LEVEL` that `create-server.sh` writes). `--force` is accepted and ignored.
7. **`worlds/.locks` is ignored**: never read, written, created or deleted by mcctl. `mcctl init` stops creating it. Users may delete it.
8. **Duplicates are reported, not fixed**: `mcctl world list`, `GET /api/worlds` (`assignmentWarnings`), and the console worlds page. Start paths are unchanged.
9. **`lock.sh` and `lock.bats` are deleted.** `mcctl.sh world` only prints a removal message until #734 removes the subcommand.
10. **`world delete --force` no longer deletes a world a server uses**; `--force` only skips the prompt.
11. **Concurrent CLI/API changes**: the check-then-write race is accepted (human-driven, millisecond window); `findDuplicates` reports the result. No mutex file.

## Assignment Model

| Case | Rule |
|------|------|
| Normal server | Holds `resolveWorldName(env)`. `LEVEL` unset means it holds `world`. |
| World folders | A world name covers three folders: `<w>`, `<w>_nether`, `<w>_the_end` (world delete removes all three). A holder covers its `LEVEL` and `LEVEL_nether`/`LEVEL_the_end`; two names conflict when they share a folder. `holdersOf`, delete, reset, `listWorlds().servers` and duplicate reports use this one rule, so deleting `w_nether` of a used `w`, deleting `w` while `LEVEL=w_nether` is used, and deleting `w_nether_nether` of a legacy `LEVEL=w_nether` are refused. `assign` rejects a name ending in `_nether` or `_the_end` (`invalid_world`). |
| Legacy names | `WORLD_NAME` is read as today and never written by the port. Existing values are checked with `EXISTING_WORLD_NAME_PATTERN` (no `/`, `\`, `.`/`..`, quotes, control characters), so names such as `My World` or `world.old` keep working. A new `LEVEL` must match `WORLD_NAME_PATTERN`. |
| Interpolation | Compose interpolates unquoted and double-quoted env_file values, not single-quoted ones. `LEVEL=${MC_WORLD:-x}` or `LEVEL="$W"` is undetermined; `LEVEL='cash$world'` is the literal name. |
| Server-internal world (D-1) | The effective `EXTRA_ARGS` follows the template `env_file` order: the server's `config.env` wins (even an empty value), else `servers/global.env` (a bare `EXTRA_ARGS` line takes the platform `.env` value, which gets the same interpolation check). `--universe /worlds` (with or without a trailing slash or `=`) means `worlds/`; no `--universe`, `/data` or `.` means the world lives in `servers/<n>/data/<LEVEL>` (`internal: true`); any other location is undetermined. An internal server **reserves** its name, `assign`/`release` refuse it (`internal_world`) until #655 migrates it, and delete/reset of `worlds/<w>` ignore it. |
| Server dirs | Same filter as `ServerRepository.listNames`: directories not starting with `_` that contain `config.env`. |

## Port and Adapter

```ts
// shared/src/domain/services/worldAssignment.ts  (pure, no I/O)
interface WorldAssignment { world: string; server: string; internal?: boolean } // absent = false (v2 shape)
interface WorldAssignmentSnapshot { assignments: WorldAssignment[]; undetermined: string[] }
type WorldAssignmentErrorCode = 'invalid_world' | 'server_not_found' | 'conflict' | 'undetermined'
  | 'internal_world' | 'not_assigned' | 'default_world' | 'server_running';
class WorldAssignmentError extends Error { code; servers: string[] }

holdersOf(s, world, { includeInternal = true }): string[]
checkAssign(s, world, server, { newServer = false }): WorldAssignmentError | null
planRelease(s, world): { server; fallback } | WorldAssignmentError
checkRemoval(s, world): WorldAssignmentError | null      // world delete
checkReset(s, server): WorldAssignmentError | null       // API world reset
checkProposed(s, server): WorldAssignmentError | null    // snapshot restore, migrate
findDuplicates(s): { world; servers }[]                  // groups of servers sharing a folder
formatAssignmentWarnings({ duplicates, undetermined }): string[]

// shared/src/application/ports/outbound/IWorldAssignmentPort.ts
interface IWorldAssignmentPort {
  /** @deprecated v2: holder of the world's folders or null; rejects undetermined instead of null. */
  getAssignment(world: string): Promise<string | null>;
  listAssignments(): Promise<WorldAssignment[]>;              // v2 shape: readable servers only
  snapshot(): Promise<WorldAssignmentSnapshot>;               // + undetermined; rejects only when servers/ cannot be listed
  preview(server: string, configEnv: string): Promise<WorldAssignmentSnapshot>; // writes nothing
  previewPlatformEnv(dotenv: string): Promise<WorldAssignmentSnapshot>;          // platform .env replaced; writes nothing
  assign(world: string, server: string): Promise<void>;       // checkAssign on a fresh snapshot; no-op if held
  release(world: string): Promise<{ server: string; fallback: string }>;
}
```

- `checkAssign` order: `invalid_world`, `undetermined`, `server_not_found`, `internal_world`, `conflict` (another holder, internal included). `newServer` (create) skips the two server checks.
- `planRelease` order: `undetermined`, `not_assigned`, `conflict` (duplicate), `internal_world`, `default_world`, then `checkAssign(fallback, holder)`. The use case reports whether `worlds/<holder>` already exists (`fallbackExists`); a release of a world that neither exists nor is assigned is "not found".
- `checkReset` order: `undetermined`, `server_not_found`, `internal_world`, `conflict` (another non-internal holder of the family).
- **Adapter**: `ConfigEnvWorldAssignmentAdapter(paths)` reads with `parseEnvDocument`, writes `LEVEL` with `applyEnvChanges` + `writeFileAtomic`, keeping the file mode; other lines stay byte-identical. `server_running` is raised by use cases, not by the adapter.
- **Same parser everywhere it matters**: the API reset route wipes the world `planWorldReset` returns, and `listWorlds().servers` comes from the same snapshot, so a quoted or commented `LEVEL` is read the same way by the check and the action. The API `ConfigService` display parser stays until #656.

### Compatibility (v2.x, #715)

- Constructors only gain optional trailing parameters: `WorldManagementUseCase(…, assignments?, runtime?)`, `CreateServerUseCase(…, modSource?, assignments?)`, `ConfigSnapshotUseCaseImpl(…, collector, assignments?, runtime?)`, `WorldRepository(paths?, assignments?)` (default: the config.env adapter). Without the assignment port every assignment change, world delete, server create and `config.env` restore is refused (`undetermined`); without the runtime port a world change is refused.
- `IWorldManagementUseCase.assignWorldByName` gains an optional `{ requireExisting }` (default `true`). Results gain `errorCode`; `WorldReleaseResult` gains `fallbackWorld` and `fallbackExists`. `WorldManagementUseCase` adds `planWorldReset` and `getAssignmentReport`.
- `isLocked`/`lockedBy` now mean "assigned" (`WorldRepository` fills `World.lockTo()` from one snapshot per call). `findAllWithServerStatus` maps a missing container to `stopped`, not `available`.
- Deprecated, removal in #736: `IWorldAssignmentPort.getAssignment`; `IShellPort`/`ShellAdapter` `worldAssign`, `worldRelease`, `worldList` (they return a failed result naming the replacement and run no script), `serverStatus`; `WorldRepository.getLockStatus` (derived, `pid` undefined), `WorldLockData`, `Paths.locks`, `Paths.lockFile`.

### Composition roots

| Root | Wiring |
|------|--------|
| CLI `Container` | `worldAssignmentPort` and `containerRuntime` getters, passed to `WorldRepository`, `WorldManagementUseCase`, `CreateServerUseCase` and `ConfigSnapshotUseCaseImpl`. |
| API | No container plugin yet (D2). `lib/world-use-case.ts` (`createWorldUseCase`, `worldFailure`) builds the adapter and `DockerComposeRuntimeAdapter`; the server create route builds the adapter for `checkAssign`; `services/config-snapshot-service.ts` passes both ports. D2 moves them into its plugin. |

## Enforcement Points (R1, R6, R7)

| Entry | Check |
|-------|-------|
| `mcctl create [--world W]`, interactive create | `checkAssign(snapshot, W ?? <name>, <name>, { newServer: true })` before `create-server.sh`. Adopting a free `worlds/<name>` stays allowed. |
| API `POST /api/servers` | Same check (replaces the `listWorlds()` block and its `ShellAdapter`). |
| `mcctl world assign`, API `POST /api/worlds/:name/assign` | `assignWorldByName`: `checkAssign` → runtime check → `assignments.assign`. The world must exist in `worlds/`. |
| `mcctl config <srv> LEVEL\|WORLD_NAME <v>` | Only when the effective world (`LEVEL`, else `WORLD_NAME`) changes: `assignWorldByName(newWorld, srv, { requireExisting: false })`. A `WORLD_NAME` under a set `LEVEL` changes nothing and is written as before. |
| `mcctl config <srv> EXTRA_ARGS <v>` | `checkConfigChange` (`checkConfigEnvChange`): when the proposed `config.env` changes the server's world or location (`--universe`), `checkProposed` and a stopped server are required. The API PATCH config has no `EXTRA_ARGS` field. |
| API PATCH `/api/servers/:name/config` with a changed `level` | `assignWorldByName(level, name, { requireExisting: false })` before any other field is written; `level` is then dropped from the config update. Other fields cannot inject a `LEVEL` line (#726). |
| `mcctl world new --server`, API `POST /api/worlds` with `serverName` | Runtime check and `checkAssign` **before** creating the directory, then `assignments.assign`; `start` uses `runtime.start`. `SEED` stays on `shell.setServerConfig` until #734/#726. |
| `mcctl world release`, API `POST /api/worlds/:name/release` | `planRelease` → runtime check on the holder → `assignments.release`. |
| `mcctl world delete`, API `DELETE /api/worlds/:name` | `checkRemoval`: refused while a non-internal server uses one of its folders or anything is undetermined; `--force`/`?force` no longer bypasses this. |
| API `POST /api/servers/:name/world/reset` | `planWorldReset` (`checkReset`), and the route wipes the world it returns. |
| Config snapshot restore (CLI, API `POST …/config-snapshots/:id/restore`) | `config.env`: `checkConfigEnvChange` (`preview` + `checkProposed`, and a runtime check when the assignment changes, whatever `force` says). `docker-compose.yml` (parsed with js-yaml): refused when its `environment` sets `LEVEL`, `WORLD_NAME` or `EXTRA_ARGS`, when its `/worlds` or `/data` mapping or its `env_file` list (or order) differs from the current file, or when it cannot be parsed. API answers 409. |
| API `PUT /api/platform-settings` changing or removing `EXTRA_ARGS` | The platform value reaches servers that inherit it (bare key in `servers/global.env`, no own value). `previewPlatformEnv` + `checkSnapshotChange`: every server whose assignment changes must pass `checkProposed` and be stopped; otherwise 409 with `servers`. An interpolated value leaves inheritors undetermined and is refused. |
| `mcctl migrate worlds` | The new `config.env` is built first and checked with `preview` + `checkProposed` before any world data moves. |

- **Runtime check**: `checkServerStopped(runtime, server)` calls `runtime.getStatus('mc-<server>')` (D1 naming; D4 switches to `ServerName`). **Known limit**: in D1, `not_found` also means "runtime unreachable", so that case passes and a running server can be changed when Docker cannot be queried. A throw is mapped to `undetermined`. Follow-up: replace the call with #732's strict runtime lookup once it is merged (A7, #669).
- **Results and HTTP**: results carry `errorCode`; API routes use `worldFailure`: `invalid_world` → 400, `server_not_found` or a missing world → 404, every other code → 409. Messages name the blocking servers and the next step.
- `mcctl start`, API start, `startAll`, and mc-router auto-start are **not** gated: once config enforces R1, two servers can share a world only through an existing duplicate, and that is reported.

## `worlds/.locks` and Backup

- Nothing reads or writes `.locks`, and `WorldRepository.delete` no longer unlinks lock files. Existing files are harmless (`listNames` skips dot directories); `rm -rf worlds/.locks` is safe. Downgrade is harmless too: the old lock code never enforced anything.
- Backup (#732): keep `.locks` in the exclude list, so it is neither backed up, restored, created, nor deleted. Restoring `worlds/` does not touch `servers/*/config.env`, so assignments survive a restore.

## Reporting and Console

- `mcctl world list` shows `assigned: a, b` (or `unassigned`) and prints one warning per duplicate world and per undetermined server (`formatAssignmentWarnings`; `--json` output unchanged, warnings on stderr). `mcctl status` is unchanged (#655).
- `GET /api/worlds` adds `assignmentWarnings: string[]` (same text). `POST /api/worlds/:name/release` returns `fallbackWorld` and `fallbackExists`.
- Console: the worlds page shows `assignmentWarnings` in one warning `Alert`; `WorldCard` labels assigned worlds "Assigned" and shows "Assigned to N servers" for duplicates; `AssignWorldDialog` disables running servers. The BFF forwards the whole API response.

## Tests

- `lock.bats` was replaced: "a different server cannot take a held lock" → R1 `conflict` tests (adapter, use case, API, CLI); unlock/force → `release` tests; stale locks → `undetermined` tests (no TTL).
- Domain (`worldAssignment.test.ts`), adapter on temp dirs (`ConfigEnvWorldAssignmentAdapter.test.ts`: global.env/.env inheritance, `--universe` locations, interpolation, EISDIR), use cases with mock ports, API routes (`worlds-assignment.test.ts`, `server-config.test.ts`, `servers-world-validation.test.ts`, `config-snapshots.test.ts`), CLI commands (`world-assignment.test.ts`), console components.

## Consequences

- **+** One source of truth; no TTLs, no stale locks, no lock file to back up or migrate to k8s volumes.
- **+** The rules are pure functions, so a ServerSpec or k8s adapter (D5, #641) only reimplements read and write.
- **−** One broken or interpolated `config.env` blocks all assignment changes until it is fixed (deliberate, R7).
- **−** The cross-process race is accepted, not prevented. The runtime check passes when Docker cannot be queried until #732/#669.
- **−** Existing duplicates keep running until the user resolves them.
