# ADR-0001: Container Runtime Ports and the Docker Adapter

| | |
|---|---|
| **Status** | Proposed (2026-10-23) |
| **Issue** | [#654](https://github.com/smallmiro/minecraft-server-manager/issues/654) (Hardening D1), milestone M2 (#643), epic #640 |
| **Follow-ups that change this ADR** | #665 (D4, [port boundary cleanup](#port-boundary-cleanup-665-d4)), #669 (A7), C2, #675 (D5), #641 (k8s adapter), #732 (S3, [backup port](#backup-port-732-s3)), #670 (A4: `IWorldAssignmentPort` final, [ADR-0002](0002-world-server-assignment.md)), #735 (S7, [server delete](#script-removal-s7-delete-serversh-735)) |
| **Consumers** | #667 (D2, API), #668 (D3, CLI), #666 (E3, contract tests), #715 (script removal) |

## Context

- `platform/services/shared/src/docker/index.ts` exports **48 free functions**. The CLI and mcctl-api import them directly, so there is no seam for a second runtime.
- The CLI and mcctl-api also run `docker` themselves in about 20 places (`cli/src/lib/shell.ts`, `cli/src/lib/rcon.ts`, `mcctl-api/src/lib/rcon.ts`, `mcctl-api/src/routes/servers.ts`, and others; see [Direct call sites](#direct-call-sites)).
- The existing ports (`IShellPort`, `IRconPort`, `IServerRepository`) cover none of status, logs, exec, lifecycle, or stats.
- The k8s adapter (#641) must be *added* later, not written by editing call sites again.

This issue is a **structural change only (Tidy First)**. Runtime behaviour, argv, return values, and timing stay as they are.

## Decision Summary

1. **Six runtime ports in D1**: `IContainerRuntimePort`, `IServerConsolePort`, `IRouterStatusPort`, `IPlayitAgentPort`, `IHostnameRegistrarPort`, `IRuntimeEnvironmentPort`.
2. **Method rule**: a method goes into a port only if a current call site will move to it: a function in `docker/index.ts`, or a direct `docker` call in the CLI or API that D2/D3 will migrate. Methods needed only by future k8s or #715 work are deferred. D1 fixes the port surface so that D2 and D3 can work in parallel without editing shared (SYNC-3).
3. **`IServerSpecRepository` and `IWorldAssignmentPort` are reserved as type-only files.** The issue asks for them "interface only", so D1 creates them with the sketched signatures, marked provisional. They have no implementation and no caller in D1. Their shapes depend on designs that are still open (ServerSpec schema, §9.2; the A4 assignment model), so D5 and A4 may rewrite them. See [Reserved ports](#reserved-ports). Both are now settled: `IWorldAssignmentPort` by [ADR-0002](0002-world-server-assignment.md) (#670), `IServerSpecRepository` by [ADR-0003](0003-server-spec.md) (#675).
4. **Contracts are provisional until a second adapter exists.** Until #641 adds the k8s adapter, D4, A7, C2, and D5 may change signatures. The TypeScript compiler finds every call site. Each change updates this ADR.
5. **Synchronous where the code is synchronous today.** Methods backed by `execSync`/`spawnSync`/`execFileSync` stay synchronous. Methods that are async today stay async. C2 converts the port to `Promise` everywhere.
6. **Error model is unchanged**: sentinels (`'not_found'`, `'unknown'`, `''`, `null`, `false`, `'-'`) and result objects that never throw, exactly as today. "Cannot tell" and "absent" stay conflated until A7 adds `RuntimeUnavailableError`.
7. **Workload names are Docker container names in D1** (`mc-<server>`, `mc-router`, `playit-agent`). Only then can the facade wrappers delegate without translation, and only then do the #720 argv tests (`docker-shell-injection.test.ts`) keep passing unchanged. D4 moves the `mc-` rule into the adapter and changes the parameter to `ServerName`. Done in #665: the parameter is widened to `ServerName | string` (see [Port Boundary Cleanup](#port-boundary-cleanup-665-d4)).
8. **One adapter class per port.** The Docker classes live in one module, `infrastructure/adapters/DockerComposeRuntimeAdapter.ts`, and share private `docker inspect` helpers. Avahi gets its own file. A single class cannot implement all ports: `start()`/`stop()` (playit) collide with `start(name)`/`stop(name)` (runtime), and `getHealth()` (router) collides with `getHealth(name)`.
9. **`docker/index.ts` becomes a legacy facade.** It keeps all 48 exports with the same signatures. The leaf functions that run processes delegate in one line to private adapter instances. Composite functions stay verbatim, and process helpers move to `infrastructure/process.ts`. The facade no longer imports `child_process`.
10. **No exported singleton.** Composition roots (CLI `Container` in D3, API `container` plugin in D2) construct adapters with `new`. Only the facade holds a private default instance.
11. **Lint**: `no-restricted-imports` + `no-restricted-syntax` forbid `child_process` outside `src/infrastructure/**` in shared, cli, and mcctl-api. The rule starts as **warn** and becomes **error** per package once that package has zero violations (after D2/D3).

## Port Definitions

Files: `platform/services/shared/src/application/ports/outbound/<Port>.ts`, exported from `outbound/index.ts` and listed in `ports/index.ts`, so D2/D3 import them from the package root (one port per file, as in the rest of the directory). Types such as `ContainerStatus` come from `src/types/index.ts`.

```ts
// IContainerRuntimePort.ts
import type { ContainerStatus, HealthStatus, ContainerStats } from '../../../types/index.js';
import type { ServerName } from '../../../domain/value-objects/ServerName.js';

/** Lifecycle result. Never rejects; failure is `success: false`. */
export interface RuntimeActionResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

/**
 * Per-workload runtime operations.
 * `name` is the server (#665): the adapter maps a ServerName to its workload (Docker: `mc-<server>`).
 * A string is the workload name itself (D1 form; @deprecated for servers, narrowed in #736).
 * D1 contract: "absent" and "runtime unreachable" are NOT distinguished (A7 changes this).
 */
export interface IContainerRuntimePort {
  /** 'not_found' when absent or when the runtime cannot be queried. */
  getStatus(name: ServerName | string): ContainerStatus;
  /** Added by #665: getStatus as an awaited child process, for request paths. */
  getStatusAsync(name: ServerName | string): Promise<ContainerStatus>;
  /** 'none' without a healthcheck, 'unknown' on failure. */
  getHealth(name: ServerName | string): HealthStatus;
  exists(name: ServerName | string): boolean;
  /** Server workloads (mc-* except mc-router), sorted. [] on failure. */
  /** `strict: true` (added by #732): a failed query throws instead of returning []. */
  list(options?: { running?: boolean; strict?: boolean }): string[];
  /** Last `lines` lines (default 50). '' on failure. */
  getLogs(name: ServerName | string, lines?: number): string;
  getStats(name: ServerName | string): ContainerStats | null;
  getUptime(name: ServerName | string): { uptime: string; seconds: number } | null;

  /** Create the workload if missing, then run it. */
  start(name: ServerName | string): Promise<RuntimeActionResult>;
  stop(name: ServerName | string): Promise<RuntimeActionResult>;
  restart(name: ServerName | string): Promise<RuntimeActionResult>;
  /** #735: stop and remove the workload. Absent = success; a runtime that cannot be queried = failure. Server data is not the runtime's. */
  remove(name: ServerName | string): Promise<RuntimeActionResult>;

  /** Timestamped lines since `since`, at most `tail` lines. Rejects on failure. */
  readLogs(name: ServerName | string, options: { since: string; tail: number }): Promise<string[]>;
  /** New output only by default; `options.tail` emits the last N lines first, then follows; `options.follow: false` prints the last `tail` lines (stdout and stderr) and resolves at exit; `options.onExit(code, error?)` reports docker's exit code or a spawn error once, while the promise still always resolves so the v2.x contract holds (#731). */
  followLogs(name: ServerName | string, onChunk: (chunk: string) => void, signal: AbortSignal, options?: { tail?: number; follow?: boolean; onExit?: (code: number | null, error?: Error) => void }): Promise<void>;
}
```

```ts
// IServerConsolePort.ts
import type { PlayerListResult } from '../../../types/index.js';

export interface ConsoleCommandResult { exitCode: number; stdout: string; stderr: string; }
export interface ConsoleEndpoint { host: string; port: number; password: string; }

export interface IServerConsolePort {
  /** `list` via RCON. null when offline or unparseable. */
  listPlayers(name: ServerName | string): Promise<PlayerListResult | null>;
  /** Runs one RCON command. Never rejects (spawn error → exitCode 1, stderr = message).
   *  `signal` (added by #732) is passed to spawn; abort kills the child. */
  command(name: ServerName | string, args: string[], options?: { signal?: AbortSignal }): Promise<ConsoleCommandResult>;
  /** Address and credentials for a direct RCON TCP session (`mcctl rcon`). null when unknown. */
  getEndpoint(name: ServerName | string): Promise<ConsoleEndpoint | null>;
}
```

```ts
// IRouterStatusPort.ts
import type { HealthStatus } from '../../../types/index.js';

export interface IRouterStatusPort {
  /** 'unknown' if the router is not running; else management API probe result. */
  getHealth(): HealthStatus;
  /** Comma-separated router hostnames of a server workload, '-' when none. */
  getHostnames(name: ServerName | string): string;
}

// IPlayitAgentPort.ts
export interface IPlayitAgentPort {
  start(): Promise<{ success: boolean; error?: string }>;
  stop(): Promise<boolean>;
}

// IHostnameRegistrarPort.ts
export type HostnameRegistrarStatus = 'running' | 'installed (not running)' | 'not installed';
/** Added by #675 (ADR-0003). 'skipped' = no/invalid IPv4, registrar missing, or sudo failed. */
export interface HostnameChangeResult { status: 'changed' | 'unchanged' | 'skipped'; reason?: string; }
export interface IHostnameRegistrarPort {
  getStatus(): HostnameRegistrarStatus;
  /** #675: add `<ip> <hostname>` (exact-match check, #660). Never rejects. */
  register(hostname: string, ip: string): Promise<HostnameChangeResult>;
  /**
   * #735: remove the lines that list exactly `hostname` before any comment; 'unchanged' when none does. Never rejects.
   * Command (README sudoers shape, #751): argv, no shell:
   *   sudo -n sed -i '/^[^#]*[[:space:]]<host>\([[:space:]]\|#\|$\)/d' /etc/avahi/hosts
   * <host> is a validated hostname with `[ ] \ . * ^ $ /` escaped; the field-boundary
   * anchors make the match exact. With a password, `sudo -S -p '' -v` runs first.
   */
  unregister(hostname: string): Promise<HostnameChangeResult>;
}

// IRuntimeEnvironmentPort.ts
export interface ToolVersion { installed: boolean; version?: string; }
export interface IRuntimeEnvironmentPort {
  /** Runtime daemon/cluster reachable. */
  isAvailable(): boolean;
  getEngineVersion(): ToolVersion;
  /** Version without a leading 'v'. */
  getComposeVersion(): ToolVersion;
}
```

`IRconPort` (`getEntityPosition`) stays a separate port. D4 (#665) only widened its first parameter to `ServerName | string`; re-implementing `RconCliAdapter` on top of `IServerConsolePort.command`, or merging the two ports, is left to #736 (it would change the argv: `docker exec` without `--`).

### IServerSpecRepository (#675)

Settled by [ADR-0003](0003-server-spec.md) (schema in its §1). **The v2 contract is kept** (release rule, #715/#736): `ServerSpec` stays `{ name: string }` and the four reserved methods keep their signatures. The full type is the new `ServerSpecDocument extends ServerSpec`, and the new behaviour comes from two added methods, as #670 did for `IWorldAssignmentPort`. No new port: `write` renders the generated files through an infrastructure-internal `ServerSpecRenderer`, so `IContainerRuntimePort` needs no `apply(spec)`.

```ts
// IServerSpecRepository.ts
export interface ServerSpec { name: string }   // v2 export, unchanged
// ServerSpecDocument (domain/server-spec) extends ServerSpec; re-exported here.
export interface LoadedServerSpec {
  document: ServerSpecDocument;
  revision: string | null;   // sha256 of server.yaml; null = imported in memory, no server.yaml yet
  warnings: string[];        // absorbed edits, protected compose, import notes
}
export interface WriteServerSpecOptions {
  expectedRevision?: string | null; // from load(); mismatch → ServerSpecError 'conflict'
  create?: boolean;                 // claim servers/<n> with mkdir, add the include entry, roll back on failure
  force?: boolean;                  // overwrite hand-edited generated files after writing a .bak
  allowStorageChange?: boolean;     // only `mcctl migrate worlds`
}
export interface IServerSpecRepository {
  // v2 (D1) signatures, unchanged
  /** One `{ name }` per server directory with server.yaml or config.env. */
  list(): Promise<ServerSpec[]>;
  /** The document, typed as the v2 ServerSpec. @deprecated Use load(). Removed in v3.0.0 (#736). */
  get(name: string): Promise<ServerSpec | null>;
  /** write(spec) after checking that `spec` is a full document; a bare { name } → 'invalid_spec' listing the missing fields. */
  save(spec: ServerSpec): Promise<void>;
  /** #735: see [Script Removal S7](#script-removal-s7-delete-serversh-735). `delete(name)` (v2) still compiles. */
  delete(name: string, options?: { deleteWorld?: boolean; dryRun?: boolean }): Promise<ServerSpecDeleteResult>;
  // added by #675
  /** Imports in memory when server.yaml is missing; absorbs hand edits. No writes. */
  load(name: string): Promise<LoadedServerSpec | null>;
  write(doc: ServerSpecDocument, options?: WriteServerSpecOptions): Promise<void>;
}
// Errors: ServerSpecError (domain) with code 'invalid_spec' | 'not_found' | 'already_exists' | 'conflict'
//   | 'edit_conflict' | 'compose_edited' | 'undetermined' | 'storage_change' | 'locked' | 'unsupported_spec_version';
//   the world guard rethrows ADR-0002's WorldAssignmentError. API: invalid_spec → 400, not_found → 404, others → 409.
```

### Reserved ports

Created in D1 as type-only files with the sketch from the hardening plan §9.1, each with a "provisional" JSDoc. They are async (new code, no synchronous caller to preserve) and import nothing from infrastructure.

| Port | Owner | D1 signature | Why provisional |
|------|-------|--------------|-----------------|
| `IServerSpecRepository` | D5 (#675) | `list(): Promise<ServerSpec[]>`, `get(name): Promise<ServerSpec \| null>`, `save(spec): Promise<void>`, `delete(name): Promise<void>`; `ServerSpec` is a placeholder `{ name: string }` | **Settled by [ADR-0003](0003-server-spec.md)**, see [IServerSpecRepository (#675)](#iserverspecrepository-675) above. |
| `IWorldAssignmentPort` | A4 (#670) | `getAssignment(world): Promise<string \| null>`, `listAssignments(): Promise<WorldAssignment[]>` (`{ world, server }`), `assign(world, server): Promise<void>` (rejects on an R1 violation) | **Superseded, final below.** |

**`IWorldAssignmentPort`, final (#670, [ADR-0002](0002-world-server-assignment.md))**. Assignments are derived from each server's `LEVEL` in `config.env`; there is no separate record. It stays a port (#715: no new ports), and the rules live in pure domain functions (`shared/src/domain/services/worldAssignment.ts`) that adapters reuse.

```ts
interface WorldAssignment { world: string; server: string; internal?: boolean } // internal: world in servers/<n>/data (D-1); optional keeps the v2 shape
interface WorldAssignmentSnapshot { assignments: WorldAssignment[]; undetermined: string[] }

export interface IWorldAssignmentPort {
  /** @deprecated (v2) The holder of the world's folders, or null. Use snapshot() + holdersOf. */
  getAssignment(world: string): Promise<string | null>;
  /** v2 shape: the readable assignments. */
  listAssignments(): Promise<WorldAssignment[]>;
  /** Rejects only when servers/ cannot be listed. An unreadable config or invalid LEVEL goes to `undetermined`. */
  snapshot(): Promise<WorldAssignmentSnapshot>;
  /** The snapshot with one server's config.env replaced (snapshot restore, migrate). Writes nothing. */
  preview(server: string, configEnv: string): Promise<WorldAssignmentSnapshot>;
  /** The snapshot with the platform .env replaced (platform settings EXTRA_ARGS). Writes nothing. */
  previewPlatformEnv(dotenv: string): Promise<WorldAssignmentSnapshot>;
  /** Writes LEVEL=<world>. Rejects WorldAssignmentError (conflict, undetermined, internal_world, ...); fail-closed (R7). */
  assign(world: string, server: string): Promise<void>;
  /** Unassign (#715): the holder's LEVEL falls back to its own default world `<server>`. Rejects WorldAssignmentError. */
  release(world: string): Promise<{ server: string; fallback: string }>;
}
```

The v2 members `getAssignment` (now deprecated) and `listAssignments` (`WorldAssignment[]`) keep their shape (#715, #736); `snapshot`, `preview` and `release` were added. Adapter: `ConfigEnvWorldAssignmentAdapter` (`infrastructure/adapters/ConfigEnvWorldAssignmentAdapter.ts`), built by the CLI `Container` and, until D2, by the API routes.

## Adapters and the Legacy Facade

```
application/ports/outbound/I*Port.ts           (interfaces only, no imports from infrastructure)
        ▲ implements
infrastructure/process.ts                       execCommand, execCommandAsync, execScript, execScriptInteractive (moved verbatim)
infrastructure/adapters/DockerComposeRuntimeAdapter.ts
   ├─ DockerComposeRuntimeAdapter     → IContainerRuntimePort
   ├─ DockerServerConsoleAdapter      → IServerConsolePort
   ├─ DockerRouterStatusAdapter       → IRouterStatusPort
   ├─ DockerPlayitAgentAdapter        → IPlayitAgentPort
   └─ DockerRuntimeEnvironmentAdapter → IRuntimeEnvironmentPort
infrastructure/adapters/AvahiHostnameRegistrarAdapter.ts → IHostnameRegistrarPort (host OS, not Docker)
        ▲ imported by file path (never via a barrel)
docker/index.ts                                 legacy facade: 48 exports, leaf wrappers + verbatim composites
```

- **Why Avahi is separate**: avahi is a host OS service, not a Docker service. Runtime choice and hostname-registrar choice are independent (Docker + avahi on Linux, Docker + nothing on macOS, k8s + nothing).
- **Constructor options** (only where current code needs them):
  - `DockerComposeRuntimeAdapter({ root?: string; env?: () => NodeJS.ProcessEnv })`. `root` defaults to `resolveMcctlRoot()` evaluated per call, as today. `env` applies only to `start`/`stop`/`restart`. The API passes `() => childProcessEnv()` in D2.
  - `DockerPlayitAgentAdapter({ root?: string })`. The playit commands keep inheriting `process.env`, as today.
- **Legacy extras**: three exports have no port equivalent. They stay as `@deprecated` methods on the adapter, outside every port, and are deleted once they have no callers (D3/D4):
  - `startContainer` (`docker start`) has no production caller.
  - `stopContainer` (synchronous `docker stop`) had one caller, the API delete route; since #735 the route deprovisions through `remove()`, so it has none.
  - `checkDockerCompose` has no caller.
- **Composition**: export the classes from `infrastructure/adapters/index.ts` (and therefore from the package root). Do not export instances. The facade creates its own private instances at module load. The constructors have no side effects, so import-time behaviour is unchanged.

### Dependency rules (cycle prevention)

1. Adapter modules and `infrastructure/process.ts` import only `node:*`, `../../types`, `../../utils` (`resolveMcctlRoot`), `../process.js`, and port types. **They never import `docker/index.ts`.**
2. `docker/index.ts` imports adapters **by file path**, never through `infrastructure/index.js` or `infrastructure/adapters/index.js`. The barrel loads `ServerRepository`, which imports the facade; that is a cycle, and a TDZ error on `new` at load time.
3. `ServerRepository` and `WorldRepository` keep importing `execCommandAsync`/`getContainerStatus` from the facade in D1. `world-name-resolution.test.ts` mocks the facade's `execCommandAsync`. D4 switches them to an injected `IContainerRuntimePort`. Done in #665: both take an optional `IContainerRuntimePort` (default `new DockerComposeRuntimeAdapter()`, imported by file path) and no longer import the facade.
4. Composite functions stay in the facade and call the wrappers. They contain no process code. Docker literals in them (`'mc-router'`, `'playit-agent'`, `--in-docker (auto-discovery)`, `:25565`) stay until the composites become a query service (see [Open questions](#open-questions)).

## Lifecycle Semantics and argv Rules

| Method | Docker implementation | Matches today's |
|--------|----------------------|-----------------|
| `start(name)` | `docker compose up -d <name>`, cwd = root, env + `COMPOSE_FILE=docker-compose.yml`, timeout 60 s | `mcctl.sh start` (`:426`), API `executeServerAction('start')` |
| `stop(name)` | `docker stop -- <name>`, env, no timeout | `mcctl.sh stop` (`:464`), `stopContainer`, CLI `migrate.ts:557`, API delete route |
| `restart(name)` | `docker compose restart <name>`, cwd = root, env + `COMPOSE_FILE`, timeout 60 s | API `executeServerAction('restart')` (only caller) |
| `remove(name)` (#735) | `docker ps -a --format {{.Names}}` (exact name; failure = failure, not "absent"); in the compose project (`docker compose ps <name>` lists it): `docker compose stop <name>`, then `docker compose rm -f <name>` (cwd = root, `COMPOSE_FILE`, timeout 60 s each); otherwise `docker rm -f -- <name>`. A failed stop returns before `rm` | `delete-server.sh` step 1 (removed in #735) |

- `start` means "create if missing". `docker start` cannot start a server whose container was never created (`not_created` in the UI). For k8s, `start` is a scale to 1 after the k8s `IServerSpecRepository` adapter has written the spec and applied the manifests (ADR-0003, #641).
- `stop` follows the majority (3 of 4 paths use `docker stop`). The API actions route uses `docker compose stop` today, so its move in D2 is a behaviour change and needs its own commit (see open questions).
- **argv rule**: every Docker command that takes a workload name puts `--` before the name, as #720 does. Leaf functions already do this. New methods (`stop`, `readLogs`, `followLogs`, `command`, `getEndpoint`) add it. Names that reach these calls are already validated, so the only effect is defence in depth. Compose commands (`start`, `restart`) keep the API's current argv.
- Timeouts stay as they are today (`listPlayers` 5 s, `readLogs` 10 s with a 10 MiB buffer, compose 60 s, router probe 3 s, the rest none). C2 sets them uniformly.

## Error Model and Sync/Async (D1)

| Method | Sync | On failure | Source |
|--------|------|-----------|--------|
| `getStatus` | sync | `'not_found'` | `getContainerStatus` |
| `getHealth` | sync | `'unknown'` | `getContainerHealth` |
| `exists` | sync | `false` | `containerExists` |
| `list` | sync | `[]` | `getMcContainers`, `getRunningMcContainers` |
| `getLogs` | sync | `''` | `getContainerLogs` |
| `getStats` / `getUptime` | sync | `null` | `getContainerStats` / `getContainerUptime` |
| `start` / `stop` / `restart` | async | `{ success: false, error }`, never rejects | API `executeServerAction` |
| `readLogs` | async | **rejects** | API `player-session-collector.ts` |
| `followLogs` | async | resolves on close or spawn error | API `servers.ts:581` (adds the missing `error` handler; `signal` is passed to `spawn`, which kills the child on abort, and chunks after abort are dropped) |
| `listPlayers` | async (blocking `execFileSync` inside, as today) | `null` | `getOnlinePlayers` |
| `command` | async | `{ exitCode: 1, stderr }`, never rejects | API `lib/rcon.ts` `execRcon` |
| `getEndpoint` | async | `null` | CLI `commands/rcon.ts` (the copy uses `execFile` and returns `null` on a spawn error; the original has no `error` handler) |
| router `getHealth` | sync | `'unknown'` / `'unhealthy'` | `getRouterHealthViaApi` |
| router `getHostnames` | sync | `'-'` | `getContainerHostname` |
| playit `start` / `stop` | async | `{ success: false, error }` / `false` | `startPlayitAgent` / `stopPlayitAgent` |
| registrar `getStatus` | sync | `'not installed'` | `getAvahiStatus` |
| environment methods | sync | `false` / `{ installed: false }` | `checkDocker`, `getDockerVersion`, `getDockerComposeVersion` |

Why D1 keeps the legacy error model: changing it is a behaviour change, and A7 (#669) owns that change. A7 will make `getStatus` throw `RuntimeUnavailableError` when the runtime cannot be queried, keeping `'not_found'` for "absent". Why D1 stays synchronous: making a synchronous facade wrapper delegate to an async port is impossible without changing every caller. C2 converts the ports and their callers together.

## Mapping: `docker/index.ts` (48 exports)

Callers are production imports (`src/`, tests excluded). "facade" means callers that are other functions in `docker/index.ts`.

**Leaf functions → adapter (facade delegates, 20)**

| Export | Callers | Target |
|--------|---------|--------|
| `getContainerStatus` | api: `routes/players`, `routes/servers`, `routes/servers/config`, `services/config-snapshot-service`; shared: `WorldRepository`; facade | `IContainerRuntimePort.getStatus` |
| `getContainerHealth` | api: `routes/servers`; facade | `.getHealth` |
| `containerExists` | cli: `status`; api: `routes/players`, `routes/servers`; facade | `.exists` |
| `getMcContainers` | cli: `status`; facade | `.list()` |
| `getRunningMcContainers` | cli: `msg`, `player-online` | `.list({ running: true })` |
| `getContainerLogs` | api: `routes/servers` | `.getLogs` |
| `getContainerStats`, `getContainerUptime` | facade | `.getStats`, `.getUptime` |
| `startContainer` | none | `DockerComposeRuntimeAdapter.startContainer` (deprecated extra) |
| `stopContainer` | api: `routes/servers` (delete) | `DockerComposeRuntimeAdapter.stopContainer` (deprecated extra) |
| `getOnlinePlayers` | api: `routes/servers`; facade | `IServerConsolePort.listPlayers` |
| `getRouterHealthViaApi` | facade | `IRouterStatusPort.getHealth` |
| `getContainerHostname` | facade | `IRouterStatusPort.getHostnames` |
| `startPlayitAgent`, `stopPlayitAgent` | cli: `playit`; api: `routes/playit` | `IPlayitAgentPort.start` / `.stop` |
| `getAvahiStatus` | api: `routes/router`; shared: `PrerequisiteChecker` | `IHostnameRegistrarPort.getStatus` |
| `checkDocker` | cli: `status` | `IRuntimeEnvironmentPort.isAvailable` |
| `getDockerVersion`, `getDockerComposeVersion` | shared: `PrerequisiteChecker` | `.getEngineVersion`, `.getComposeVersion` |
| `checkDockerCompose` | none | `DockerRuntimeEnvironmentAdapter.isComposeAvailable` (deprecated extra) |

**Process helpers → `infrastructure/process.ts` (re-exported by the facade, 4)**: `execCommand` (facade only), `execCommandAsync` (shared `ServerRepository`, playit), `execScript` and `execScriptInteractive` (cli `lib/shell`, shared `ShellAdapter`). These are generic process runners, not runtime ports. #715 removes the script runners.

**Composites → stay in the facade verbatim (12)**: `getServerInfo`, `getRouterInfo`, `getPlatformStatus` (cli `status`), `getDetailedServerInfo`, `getDetailedServerInfoWithPlayers` (cli `status`), `getRouterDetailInfo` (cli `status`, api `routes/router`), `getServerInfoFromConfig` (api `routes/playit`, `routes/servers`), `getAllServers` (api `routes/players`, `routes/playit`, `routes/servers`), `serverExists` (7 api files), `getDetailedServerInfoFromConfig`, `getServerDetailedInfo` (api `routes/servers`), `getPlayitAgentStatus` (cli `playit`, api `routes/playit`, `routes/router`). They combine runtime state with config files. Their target is an application query service that takes ports (see open questions).

**Pure or config-file functions → no port (12)**: `parseRconPlayerList` (lives in `DockerComposeRuntimeAdapter.ts` next to `listPlayers`, because adapters cannot import the facade; the facade re-exports it), `formatBytes`, `parseRouterHosts`, `replaceRouterHosts`, `resolvePlayitDomain` (pure); `getWorldsDir`, `getServersDir`, `getWorldDirectorySize` (plan §9.1: moves to `WorldRepository`, async); `getConfiguredServers`, `readServerConfigEnv`, `getServerPlayitDomain`, `setServerPlayitDomain` (config files; their writes move behind `IServerSpecRepository` in #675, ADR-0003 §6; env parsing is unified by A6).

## Direct Call Sites

Production code that imports `child_process` outside `src/infrastructure/**` (23 lint findings before D1) plus the facade-mediated calls in shared. D1 does not migrate any of them; the "Owner" column says who does.

| # | Location | Current command | Target | Owner | Note for the migration |
|---|----------|-----------------|--------|-------|------------------------|
| 1 | api `lib/rcon.ts:33` | `docker exec <c> rcon-cli <cmd>` | `console.command(name, [cmd])` | D2 | caller keeps `output = stdout \|\| stderr`; adds `--` |
| 2 | api `lib/rcon.ts:71` | `docker inspect -f {{.State.Running}}` | `runtime.getStatus(name) === 'running'` | D2 | a paused container is `Running=true` but status `paused` |
| 3 | api `routes/servers.ts:581` | `docker logs -f --tail 0` (SSE) | `runtime.followLogs` + `AbortController` | D2 | spawn errors no longer go unhandled |
| 4 | api `routes/servers.ts:666` | `docker exec <c> rcon-cli <cmd>` | `console.command` | D2 | caller keeps `stdout.trim()` |
| 5 | api `services/player-session-collector.ts:30` | `docker logs --timestamps --since --tail` | `runtime.readLogs` (fits the existing `LogFetcher`) | D2 | same argv plus `--` |
| 6 | api `utils/docker-compose.ts:85` | `docker compose up -d / stop / restart` | `runtime.start` / `.stop` / `.restart` | D2 | `stop` changes from compose stop to `docker stop` (open question 2) |
| 7 | api `routes/servers.ts:1111` | facade `stopContainer` (sync) | `runtime.stop` | D2 | becomes awaited |
| 8 | api `routes/servers.ts:61,858` (create and delete routes), `routes/backup.ts`, `services/backup-scheduler.ts` | `create-server.sh`, `delete-server.sh`, `backup.sh`, `git` | not a runtime port; move under `mcctl-api/src/infrastructure/` | D2; backup paths: #732 | needed before the rule becomes an error. #732 removes the backup ones (see [Backup Port](#backup-port-732-s3)); #675 and #735 removed create and delete (TypeScript use cases, no script) |
| 9 | cli `lib/rcon.ts:16` | `docker inspect -f {{.State.Running}}` | `runtime.getStatusAsync` in `running`/`paused`/`restarting` | D3, done (#668) | `isContainerRunning` keeps the `{{.State.Running}}` meaning (paused and restarting count as running); the server comes from `serverOfContainer` |
| 10 | cli `lib/rcon.ts:43` | `docker exec <c> rcon-cli ...` | `console.command` | D3, done (#668) | `execRconWithOutput` keeps `output = stdout \|\| stderr`; adds `--` |
| 11 | cli `lib/shell.ts:265` | `docker exec` with inherited stdio | `console.command` then print | D3, done (#668) | `mcctl exec`; output is buffered instead of streamed (stdout, then stderr) and written fully before exit. A `docker exec` killed by a signal now exits 1 (was 0). `ShellExecutor.execRcon` was removed |
| 12 | cli `commands/rcon.ts:24,39` | two `docker inspect` (IP, env) | `console.getEndpoint` | done (#734) | |
| 13 | cli `lib/prompts/server-select.ts:109` | `docker ps -a ... {{.Status}}` | `runtime.list()` + `getStatus` per server | D3, done (#668) | paused still counts as running ("Up (Paused)"); the choices are now sorted by name, and only `mc-router` itself is left out (a server named `router2` was hidden before) |
| 14 | cli `commands/migrate.ts:557` | `docker stop <c>` | `runtime.stop` (throw on `!success`) | D3, done (#668) | |
| 15 | cli `lib/shell.ts:145,167,298,321,348`, `commands/init.ts:344,349,679`, `commands/upgrade.ts:365` | `docker pull`, generic `docker compose`, `down`, `startAll`/`stopAll` pipelines, network create, router restart/recreate | not a runtime port: compose-project / platform-install operations; move under `cli/src/infrastructure/` | D3, done (#668) | moved unchanged to `infrastructure/ShellExecutor.ts` (`lib/shell.ts` re-exports it) and `infrastructure/compose-project.ts`. k8s platform lifecycle belongs to Helm (#641). C1 fixes the router service name |
| 16 | cli `commands/console/init.ts`, `console/service.ts`, `update.ts`, `lib/pm2-utils.ts`, `lib/banner.ts` | `npm`, `pm2`, `git` | not a runtime port; move under `cli/src/infrastructure/` | D3, done (#668) | `infrastructure/npm.ts`, `infrastructure/pm2-cli.ts`. `banner.ts` `getGitHash` was deleted: its `require()` never ran in the ESM build |
| 17 | shared `ServerRepository.ts:115` | facade `execCommandAsync('docker', ['inspect', ...])` | `runtime.getStatus` | D4 | done (#665) |
| 18 | shared `WorldRepository.ts:299` | facade `getContainerStatus` | `runtime.getStatus` | D4 | done (#665) |
| 19 | shared `prerequisite/PrerequisiteChecker.ts:1` | `which pm2`, `pm2 --version` | not a runtime port; move the probe under `infrastructure/` | D4 | the only shared finding left after D1 |
| — | shared `RconCliAdapter`, `BlueMapCliRenderer`, `ShellAdapter` | `docker exec`, scripts | already infrastructure adapters | D4 / #715 | allowed by the lint rule |

## Lint Rule

Config files: `platform/services/{shared,cli,mcctl-api}/.eslintrc.json` (ESLint 8.57, eslintrc format). `mcctl-console` uses `next lint`, has no `child_process` in `src/`, and is out of scope.

```jsonc
{
  "rules": {
    // ...existing rules
    "no-restricted-imports": ["warn", { "paths": [
      { "name": "child_process", "message": "child_process is allowed only under src/infrastructure/ (ADR-0001). Use a runtime port." },
      { "name": "node:child_process", "message": "child_process is allowed only under src/infrastructure/ (ADR-0001). Use a runtime port." }
    ]}],
    // no-restricted-imports does not see import() or require() in ESLint 8
    "no-restricted-syntax": ["warn",
      { "selector": "ImportExpression[source.value=/^(node:)?child_process$/]", "message": "..." },
      { "selector": "CallExpression[callee.name='require'][arguments.0.value=/^(node:)?child_process$/]", "message": "..." }
    ]
  },
  "overrides": [
    { "files": ["src/infrastructure/**/*.ts"], "rules": { "no-restricted-imports": "off", "no-restricted-syntax": "off" } }
  ]
}
```

- `pnpm lint` runs `eslint src --ext .ts` without `--max-warnings`, and CI (`ci.yml`) runs `pnpm lint`. Warnings therefore do not fail CI. Tests are not linted (`src` only), so tests that mock `child_process` are unaffected.
- **Measured on 2026-10-23** with this exact config (dry run): shared **2** (`docker/index.ts`, `prerequisite/PrerequisiteChecker.ts`), cli **12**, mcctl-api **9** (6 files, including 3 dynamic `import()`s in `routes/servers.ts`). Total 23. After D1: shared **1**, total **22**. The override correctly exempts `RconCliAdapter` and `BlueMapCliRenderer`.
- **Becoming an error**: per package, in the issue that brings the package to zero (cli: D3, mcctl-api: D2, shared: D4). Rows 8, 15, 16, and 19 above are not runtime work but still block the error.
- **cli is an error since #668** (0 findings). No port method was added: the CLI uses `getStatusAsync`, `getStatus`, `list`, `stop`, and `console.command` as they are.

## Alignment with #715 (Script Removal)

#715 says it will not add new ports and will use the M2 ports. Coverage check:

| Script | What it does | Covered by D1 ports | Deferred (reason) |
|--------|--------------|---------------------|-------------------|
| `logs.sh` (removed in #731) | tail, follow, `--since`, `--timestamps` | `getLogs`, `followLogs({ tail, follow })`, `readLogs` | `--file`/`--json` formatting is CLI presentation, not a port. The avahi `journalctl` view was dropped; run `journalctl -u avahi-daemon` directly. `followLogs` gained optional `tail` (default 0) and `follow` (default true), so existing callers are unchanged. "Last N lines, then follow" is one stream, and `follow: false` prints the last N lines from stdout and stderr, and `onExit` lets a caller turn a failed `docker logs` into a non-zero exit code |
| `mcctl.sh` | start/stop/status, `docker exec -i rcon-cli` console | `start`, `stop`, `getStatus`; console via `getEndpoint` + the existing TCP client (`rcon-client`) | an interactive `attach()` with TTY passthrough; use TCP instead |
| `delete-server.sh` (removed in #735) | stop, remove container, remove compose include, avahi unregister, keep world (D-2) | `stop` | `remove(name)` (no `purgeData`: data is files), `IHostnameRegistrarPort.unregister`, `IServerSpecRepository.delete(name, { deleteWorld, dryRun })`; see [Script Removal S7](#script-removal-s7-delete-serversh-735) |
| `lock.sh` | world locks | — | replaced by `IWorldAssignmentPort.assign`/`release` derived from `LEVEL`; `lock.sh` removed in #670 ([ADR-0002](0002-world-server-assignment.md)) |
| `player.sh` | Mojang API lookup | — | removed in #730 (`mcctl player info` covers it) |
| `backup.sh` | git backup of worlds | flush via `console.command`: `save-off`, `save-all flush`, `save-on` | git storage is `IWorldBackupPort`, not runtime ([Backup Port](#backup-port-732-s3)) |
| `render-map.sh` (removed in #733) | `docker image build`, `docker run --rm` BlueMap | — | moved into the Docker `IMapRenderer` adapter, `BlueMapCliRenderer` (k8s: Job) |
| `create-server.sh` | compose generation, include, avahi register, `compose up` | `start` | `IServerSpecRepository.write(doc, { create: true })` (renders compose, include), `IHostnameRegistrarPort.register` (#675, ADR-0003 §5); no `apply(spec)` |
| `init.sh` | network, platform setup | — | removed in #729; `mcctl init` is TS and platform install is not a runtime port |

Nothing in this table needed a method in D1. #715 (2026-10-23) adds the deferred methods to existing ports instead of new ports: `IHostnameRegistrarPort.register`/`unregister` and `IServerSpecRepository.save`/`delete` (kept with their D1 signatures; #675 adds `load`/`write`, see above), `IContainerRuntimePort.remove` (#735), `IWorldAssignmentPort.release` (ADR-0002).

## Implementation Plan for #654 (core-agent)

Rules: no behaviour change; `refactor`/`test`/`chore` commits only; tests first (a red commit is fine, as in #720); never touch call sites outside shared; run `source ~/.nvm/nvm.sh && nvm use 22` first. Baseline: shared **60 files / 988 tests passing** (2026-10-23).

1. `refactor(shared): add runtime port interfaces (#654)`: the six port files and `outbound/index.ts` exports. Check: `pnpm --filter @minecraft-docker/shared typecheck`.
2. `refactor(shared): move process helpers to infrastructure/process (#654)`: move `execCommand`, `execCommandAsync`, `execScript`, `execScriptInteractive` verbatim; the facade re-exports them. Check: shared tests, especially `world-name-resolution.test.ts` (its facade mock must still apply to `ServerRepository`).
3. `test(shared): characterize Docker runtime adapters (#654)` (red), then `refactor(shared): move docker leaf functions into runtime adapters (#654)` (green). Create the five Docker classes by **moving** 19 leaf bodies (the 20th, `getAvahiStatus`, moves in step 5), and make the facade leaves one-line delegations. After step 5 the facade has no `child_process` import. Export the classes from `infrastructure/adapters/index.ts`. Tests: `vi.mock('node:child_process')`, and for each method assert the exact `(file, argv, options)` and both the success mapping and the failure sentinel. Keep `docker-shell-injection.test.ts` unchanged: its fake `docker` on `PATH` proves wrapper → adapter argv end to end.
4. `test(shared): ...` (red), then `refactor(shared): add lifecycle, log and console methods to Docker adapters (#654)` (green): `start`/`stop`/`restart`, `readLogs`, `followLogs`, `command`, `getEndpoint`, **copied** from the call sites in the direct call sites table. The originals stay until D2/D3. Test `followLogs` with a fake child (`EventEmitter` + `PassThrough`): close resolves, a spawn error resolves, no chunk is forwarded after abort, and `signal` reaches `spawn`. One test runs a real child to prove that abort kills it.
5. `test` (red), then `refactor(shared): add AvahiHostnameRegistrarAdapter (#654)` (green): move `getAvahiStatus` and mock the three `execSync` probes.
6. `chore(lint): warn on child_process outside infrastructure (#654)`: the three `.eslintrc.json` files. Check: `pnpm lint` exits 0 with warnings shared 1, cli 12, mcctl-api 9.
7. Final gate at the repo root: `pnpm build && pnpm lint && pnpm typecheck && pnpm test`. The cli/api tests use `vi.mock('@minecraft-docker/shared', ...)` and must pass unchanged, because every export name and signature is kept.

Review checklist: `git grep -n "docker/index" src/infrastructure/adapters/DockerComposeRuntimeAdapter.ts src/infrastructure/process.ts` is empty; `docker/index.ts` imports adapters by file path; all 48 exports keep their names and signatures (`git diff` on `src/index.ts` shows no removals); no `--max-warnings` added.

## Consequences

- **+** D2, D3, D4, A7, and E3 can start against fixed interfaces, and the k8s adapter becomes an addition.
- **+** The review is mechanical: leaf bodies move unchanged and #720's argv tests guard the move.
- **−** Port signatures will change three more times (D4: `ServerName`; A7: unavailable error; C2: async). That cost is accepted; the compiler lists the call sites.
- **−** About 150 lines are duplicated between the new adapter methods (step 4) and the API/CLI originals until D2/D3 land.
- **−** Docker naming remains in the facade composites until they become a query service.

## Open Questions

1. **Reserved ports** (resolved 2026-10-23): created as two type-only files with the sketched signatures and a placeholder `ServerSpec` that D5 will replace (decision 3). `IWorldAssignmentPort` was finalized by #670 (ADR-0002).
2. **API stop semantics**: moving `executeServerAction('stop')` (`docker compose stop`) to `runtime.stop` (`docker stop`) is a small behaviour change. The two differ only for containers that are not in the compose project. Option A (recommended): accept it in D2 as a separate, labelled commit. Option B: make `stop` compose-based and change `mcctl.sh`-parity callers instead.
3. **Owner of the composites**: none of D2, D4, or #667 names the 12 facade composites. D2's acceptance criterion "route tests with a fake container" needs them injectable. Recommendation: add "turn the composites into an application query service built from ports" to D4 (shared, core-agent), and land it before D2's route migration. **#665 did not do this**: none of its acceptance criteria needs it. It stays open for D2 (#667).
4. **Order of signature changes**: D2, D3, and D4 run in parallel (P3), but D4 changes port parameters to `ServerName`. Option A (recommended): land D4's signature change first, then D2/D3. Option B: run them in parallel and let the compiler-driven fix-ups happen at merge. **Resolved by #665**: the parameters were widened, not replaced, so D2/D3 compile either way and can move call sites to `ServerName` at their own pace.
5. **Scope of the error flip**: rows 8, 15, 16, and 19 (script, git, npm, and pm2 runners) are not runtime work. Confirm they belong to D2/D3/D4, or else the rule stays a warning for that package.

## Port Boundary Cleanup (#665, D4)

Structural change only (Tidy First). Docker argv, return values and error sentinels are unchanged except where noted below, and no shared export or signature is removed (#715: v2.x only deprecates; #736 deletes in v3.0.0).

### Naming rules move to infrastructure

`infrastructure/adapters/workloadNames.ts` holds the runtime naming rules and is exported from the package root:

| Function | Result |
|----------|--------|
| `containerNameOf(server: ServerName \| string)` | `mc-<server>` |
| `serverHostnameOf(server: ServerName \| string)` | `<server>.local` |
| `workloadNameOf(name: ServerName \| string)` | a ServerName → its container; a string → unchanged (the container name) |

The module has no runtime imports, so `@minecraft-docker/shared/naming` stays browser-safe. `ServerName.containerName`/`hostname` and `Server.containerName`/`hostname` remain as `@deprecated` getters that delegate here; that is the only domain → infrastructure import, and it goes away with the getters in #736. The reserved-name message (`conflicts with the mc-router container`) is built the same way, so its text is unchanged.

### Port signature changes

| Port | Before (D1) | After (#665) |
|------|-------------|--------------|
| `IContainerRuntimePort` | `getStatus`, `getHealth`, `exists`, `getLogs`, `getStats`, `getUptime`, `start`, `stop`, `restart`, `readLogs`, `followLogs` take `name: string` | `name: ServerName \| string`. `list()` is unchanged and still returns container names. Added `getStatusAsync(name): Promise<ContainerStatus>` (see repositories below) |
| `IServerConsolePort` | `listPlayers`, `command`, `getEndpoint` take `name: string` | `name: ServerName \| string` |
| `IRouterStatusPort` | `getHostnames(name: string)` | `getHostnames(name: ServerName \| string)` |
| `IRconPort` | `getEntityPosition(container: string, player)` | `getEntityPosition(server: ServerName \| string, player)` |
| `IShellPort` | `exec(script, args)`, `execInteractive(script, args)` | unchanged, `@deprecated` (a port method must not take a script name) |
| `IPlatformSettingsPort` (new) | — | `load(): McctlConfig \| null` |

- **Meaning**: a ServerName is the server and the adapter picks the workload (`workloadNameOf`). A string is the workload name itself, as in D1. The string form is deprecated for servers; the router and playit agent keep their container names until the k8s adapter (#641) gives them their own methods.
- **Why a union, not overloads**: method parameters are bivariant, so a v2 implementation declared with `(name: string)` still satisfies `(name: ServerName | string)`. An overload pair `(name: ServerName)` + `(name: string)` would reject it. `tests/runtimePorts-v2-compat.test.ts` compiles a v2 `IRconPort` implementation and v2 callers to hold this.
- **Released and unreleased ports** (#753 review): of the widened ports only `IRconPort` shipped in v2.33.0 (npm). `IContainerRuntimePort`, `IServerConsolePort`, `IRouterStatusPort` and `IHostnameRegistrarPort` were added by #654 after v2.33.0, so no released implementation exists and passing a ServerName to them is not a breaking change. Shared does so (`checkServerStopped`, `WorldManagementUseCase` start after create, `DeleteServerUseCase` online players, `ServerRepository.getStatus`); the cli and mcctl-api test fakes map it with `workloadNameOf(name)`.
- **`IRconPort` keeps the v2 runtime contract**: its callers (`WorldInfoUseCase.getLivePlayerLocations`, `PlayerManagementUseCase` `options.container`, fed by the API) keep passing the container name string `mc-<server>`, so a v2 implementation receives exactly what it did before. Only `RconCliAdapter` accepts both forms. `tests/rconPort-v2-contract.test.ts` pins this with a recording v2 implementation. New code that computes the name in infrastructure or the API uses `containerNameOf`.

### Repositories take a runtime port

`new ServerRepository(paths?, runtime?)` and `new WorldRepository(paths?, assignments?, runtime?)`. The default is `new DockerComposeRuntimeAdapter()`, the instance the facade delegated to; the CLI `Container` passes its runtime. Neither repository imports the facade any more.

- `ServerRepository.getStatus` awaits `runtime.getStatusAsync(ServerName.fromExisting(name))` and keeps the old mapping (`not_found`, the failed-query sentinel, is `STOPPED`). `getStatusAsync` was added to `IContainerRuntimePort` because the synchronous `getStatus` (`spawnSync`, no timeout) blocked the API event loop once per server in `findAll()` (#753 review). The Docker adapter runs the pre-#665 query through `execCommandAsync` (`docker inspect -f {{.State.Status}} -- <container>`; a non-zero exit is `not_found`, the state is lower-cased); the only argv change is the `--` of the #720 rule. A new method was simpler than making `getStatus` async, which is C2's change across every caller. A name that `fromExisting` rejects returns `UNKNOWN` instead of `STOPPED`; `findByName` never reaches that, because it rejects such names first.
- `WorldRepository.findAllWithServerStatus` passes the container-name string it used before, including the pre-#670 branch that takes a holder starting with `mc-` as a container name. Changing that would be a behaviour change; #736 removes it when the port is narrowed.

### Platform settings port (`CreateServerUseCase`)

`CreateServerUseCase` used `Paths` only to build a `Config` and read `playitEnabled` from `.mcctl.json`. Its fourth constructor parameter is widened to `IPlatformSettingsPort | Paths`. The CLI injects `new Config(paths)`; `Config` satisfies the port structurally, so there is no adapter class. Passing `Paths`, or nothing, still reads `.mcctl.json` under those paths (deprecated v2 form). The change is limited to the constructor so that #675 can rebase onto it.

**Why a new port**: #715 adds no ports unless an issue asks, and #665 names this one. No existing port reads platform settings: `IServerRepository` reads per-server `config.env`, `IPlayitAgentPort` drives the agent container, `IServerSpecRepository` is the D5 server model. The port has one method, the one current caller needs.

### Callers still on the string form

| Caller | Why | Owner |
|--------|-----|-------|
| `docker/index.ts` facade wrappers | Same argv as D1 (decision 9) | #736 |
| `WorldRepository.findAllWithServerStatus` | Exact pre-#670 container name | #736 |
| `GitWorldBackupAdapter` | `list()` returns container names and they go back to `console.command` | #736 or `list()` returning server names |
| `PlayerManagementUseCase` (`options.container`), `WorldInfoUseCase.getLivePlayerLocations(container)` | The API builds `mc-<name>`; public signatures unchanged | D2 (#667) |
| `mcctl logs` for the router | `mc-router` is not a server | #641 |
| CLI `lib/rcon.ts` helpers, `mcctl exec`, the player server prompt, `migrate worlds` | Port calls since #668; they keep the container-name API and convert with `serverOfContainer`, which passes a `ServerName` and falls back to the string only for a name that is not a valid server container | #736 |

### Not done in #665

- The composites query service (open question 3): not needed for the acceptance criteria.
- `PrerequisiteChecker` (direct call site row 19) and the shared lint error flip.
- `ServerStatusUseCase` (deprecated as a whole) and the "Connect via" message in `CreateServerUseCase` still read the deprecated getters. #675 rewrites the creation path; #736 deletes both getters.

### Deprecated in #665 (removed in v3.0.0, #736)

`ServerName.containerName`, `ServerName.hostname`, `Server.containerName`, `Server.hostname`, `IShellPort.exec`, `IShellPort.execInteractive`, `ShellAdapter.exec`, `ShellAdapter.execInteractive`, the string (container-name) form of the server parameter of the ports above, and passing `Paths` (or nothing) to `CreateServerUseCase`'s fourth parameter.

## Backup Port (#732, S3)

Status: Proposed (2026-10-23). Revised after the system-architect review (APPROVE WITH CHANGES) and the Codex review (R1–R14, S1–S5), then simplified after the architect's re-review of `a5d246a` (S1–S5). Absorbs #653, #664, #727. The issue fixed these points, and this section does not reopen them:

- `IShellPort.backup*` splits into one backup port; no new feature port.
- RCON is used only for the flush.
- git runs through `execFile` argv arrays, copies use `fs.cp`, and config is read through the env codec.
- The token never appears in any argv.
- `mcctl.sh` calls `mcctl backup` until #734.

**Supported scope**: a single local host. `worlds/`, `servers/<n>/data/` and `backups/` must be on one filesystem. Regular files and directories only. Anything else is refused before the first change.

### B1. Port, adapter, composition

File `application/ports/outbound/IWorldBackupPort.ts`. Every method is async and **never rejects**. Every failure is a result, including `status` (S5); unexpected exceptions map to `git_failed`/`io_failed`.

```ts
import type { BackupRetentionPolicy } from '../../../domain/index.js';

export type WorldBackupErrorCode =
  | 'not_configured' | 'locked' | 'recovery_required'   // B2, B5 step 6
  | 'runtime_unavailable' | 'servers_running' | 'flush_failed'
  | 'missing_worlds'      // B4 step 3: a world in HEAD is missing from the source (server dir still present)
  | 'unsupported_layout'  // symlink, path escape, cross-device, invalid LEVEL
  | 'restore_conflict'    // the commit's world dir for a server ≠ its current LEVEL
  | 'commit_not_found' | 'empty_source'
  | 'auth_failed' | 'repo_not_found' | 'git_too_old' | 'timeout' | 'lease_conflict'
  | 'git_failed' | 'io_failed';
export interface WorldBackupError { code: WorldBackupErrorCode; message: string; paths?: string[]; servers?: string[]; holder?: BackupLockHolder }
export type WorldBackupResult<T> = { ok: true; value: T } | { ok: false; error: WorldBackupError };
export interface BackupLockHolder { pid: number; hostname: string; bootTime: number; nonce: string; op: 'push' | 'restore' | 'prune'; startedAt: string }
export interface LockOptions { lockWaitMs?: number }   // default 0 = fail fast

export interface WorldBackupStatus {
  configured: boolean;           // token AND repo non-empty (#13)
  repository?: string; branch: string; autoOnStop: boolean;
  lastBackup?: { commit: string; date: Date };   // local cache tip (may be unpushed after a failed push)
}
export interface WorldBackupCommit { hash: string; date: Date; author: string; message: string }  // full hash
export interface PushOutcome { changed: boolean; commit?: string; flushed: string[]; skipped: string[]; warnings: string[] }

export interface IWorldBackupPort {
  status(): Promise<WorldBackupResult<WorldBackupStatus>>;
  history(limit?: number): Promise<WorldBackupResult<WorldBackupCommit[]>>;   // newest first, default 20; [] without a cache
  push(options?: { message?: string; allowMissing?: boolean } & LockOptions): Promise<WorldBackupResult<PushOutcome>>;
  restore(commit: string, options?: LockOptions): Promise<WorldBackupResult<{ commit: string; previousDir: string; skipped: string[] }>>;
  prune(policy: BackupRetentionPolicy, options?: LockOptions): Promise<WorldBackupResult<{ removed: number; warnings: string[] }>>;
  testConnection(credentials: { token: string; repository: string }): Promise<WorldBackupResult<void>>;  // no .env, no lock
}
```

| Item | Decision |
|------|----------|
| Adapter | `infrastructure/adapters/GitWorldBackupAdapter.ts`, `new GitWorldBackupAdapter({ root, runtime: IContainerRuntimePort, environment: IRuntimeEnvironmentPort, console: IServerConsolePort, remoteBase? = 'https://github.com/' })`. Private helpers (not exported): `infrastructure/backup/lock.ts`, `git.ts` (runner and env), `restore-slots.ts` (swap and slots), `support.ts`. The adapter may import domain types (`BackupRetentionPolicy`, the world-name validator) |
| Policy location (B-Q1) | Lock, flush and running checks live in the adapter. Every caller routes through it, and the injected ports make it testable with fakes. No later split is promised (S1) |
| Config | `<root>/.env` through `parseEnvDocument` **on every call**, falling back to `process.env` for keys the file lacks. The API no longer reads a stale `process.env` after `backup init` |
| Names | Ports take container names (`mc-<server>`, D1). Results report server names. One private `serverNameOf()`/`containerNameOf()` pair does the conversion, and D4 moves it |
| CLI root | `Container.worldBackupPort` (built from the Docker adapters); `backupUseCase = new BackupUseCase(promptPort, worldBackupPort)` |
| API root | `routes/backup.ts` and `routes/backup-schedule.ts` each build one instance (runtime `env: () => childProcessEnv()`). `BackupSchedulerService` takes the port instead of `mcctlRoot` and loses its git and retention code. These move to the D2 `container` plugin when it exists. Two instances are fine because the lock is a file |
| `BackupUseCase` (K1) | Parameter 2 widens to `IWorldBackupPort \| IShellPort`, with the guard `'backupPush' in x`. An `IShellPort` keeps today's code path unchanged; there is no new parsing. #736 narrows the type. Prompts stay in the use case; the port never prompts |
| Deprecated | `IShellPort.backupPush/Status/History/Restore` and the same `ShellAdapter` methods get `@deprecated`. They are not delegated. In the PR that deletes `backup.sh`, they return a clear failure (`code: 1`, `stderr: 'backup.sh was removed; use IWorldBackupPort (GitWorldBackupAdapter)'`). The release policy forbids removing exports and changing signatures, not changing behaviour |
| `IServerConsolePort` | `command(name, args, options?: { signal?: AbortSignal })`. The optional signal is passed to `spawn`, which kills the local `docker exec` child on abort (R9). Killing the docker CLI does not necessarily stop `rcon-cli` inside the container. Backward compatible |

### B2. Lock (push, restore, prune; all four callers)

| Step | Rule |
|------|------|
| Path | `<root>/backups/.backup.lock`, after `mkdir -p backups`. It is outside the cache tree and outside `worlds/.locks` |
| Acquire | Write the holder JSON (with a random `nonce` and `bootTime = Date.now() − os.uptime()·1000`) to `.backup.lock.<nonce>.tmp`, then `link(tmp, lock)` and unlink the tmp. `link` fails with `EEXIST` atomically, and the lock file is never partially written |
| Stale | **Only** when `hostname` matches and either `bootTime` differs by more than 60 s (the host rebooted) or `process.kill(pid, 0)` throws `ESRCH`. `EPERM` counts as alive. Time is never used (R3). A different host, a live pid, or unparseable content → `locked` with `holder`. The manual fix ("delete the file after checking the holder process") is in the docs |
| Takeover | `rename(lock, lock.<myNonce>.stale)`, then read the renamed file. If its nonce equals the stale holder's, unlink it and acquire. Otherwise another contender already took over: `link` it back to `lock` and report `locked` |
| Release | If the lock holds our nonce and the unlink succeeds, done. Otherwise (not ours, or the unlink lost to a takeover) a late contender may have moved it aside and will put it back: delete any `.stale` aside copy holding our nonce (the put-back `link` then fails), then re-read the lock and unlink it if the put-back already happened. No polling or timing window (PR #745 review) |
| Waiting | Interactive CLI, API manual push and restore: `lockWaitMs: 0` (API → 409 with the holder). `push --auto` (auto-on-stop) and the scheduler (push and prune): 10 min, polling every 1 s |
| Reads | `status`/`history` do not lock. During the first clone they see "no cache" |

`ponytail:` takeover is safe for two contenders. With three contenders on one stale lock, the put-back `link` can fail with `EEXIST` after a third process acquired the lock, and then two writers exist. Upgrade path: an OS advisory lock (flock through a native binding) if this ever happens.

### B3. Git environment and token

- One helper builds every git child env. It starts from `process.env` and removes the repository-local variables (the list printed by `git rev-parse --local-env-vars`: `GIT_DIR`, `GIT_INDEX_FILE`, `GIT_WORK_TREE`, …) plus every `GIT_CONFIG_*`. User settings such as proxy and CA variables are kept. Then it adds `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, `LC_ALL=C`, and the backup identity (`GIT_AUTHOR_*`/`GIT_COMMITTER_*` = `Minecraft Backup <minecraft-backup@localhost>`) for **every** commit, the README init commit included. Every git child gets `GIT_CONFIG_KEY_0=commit.gpgSign` / `false`, so a user's global signing setting cannot break backup commits.
- Network commands (`ls-remote`, `clone`, `fetch`, `push`) also get three more entries (`GIT_CONFIG_COUNT=4`):
  - `http.<remoteBase>.extraHeader=` (an empty value resets the multi-valued list, R14)
  - `http.<remoteBase>.extraHeader=Authorization: Basic <base64("x-access-token:"+token)>`
  - `credential.helper=` (empty)
- Remote normalization on each run: `git config --unset-all remote.origin.pushurl` (exit 5 is ignored), then `git remote set-url origin <remoteBase><repo>.git`. This also scrubs the token URL that `backup.sh` left behind.
- Git ≥ 2.31 is required (B-Q3). The version is checked once; older git → `git_too_old`.
- `repository` must match `^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`. `branch` must pass `git check-ref-format --branch <b>`.
- Errors carry git's stderr only, never the env.
- **Timeouts** (replace the fixed 15 min):

  | Commands | Limit |
  |----------|-------|
  | network | `GIT_HTTP_LOW_SPEED_LIMIT=1000`, `GIT_HTTP_LOW_SPEED_TIME=300` (abort below 1 KB/s for 5 min) |
  | every git child | 4 h wall-clock cap |
  | `ls-remote` for `testConnection` | 60 s |

### B4. Push

Repository layout (old repositories hold only `worlds/` and stay compatible):

```
README.md                    worlds/<world>/…  (mirror of <root>/worlds, without .locks)
servers/<n>/<LEVEL>/…        plus <LEVEL>_nether, <LEVEL>_the_end when present
```

A server has an internal world when `servers/<n>/data/<LEVEL>/level.dat` is a regular file. `LEVEL` comes from `config.env` (env codec) and must pass the world-name validator: no `/`, `..` or empty value. `servers/<n>`, `data` and `data/<LEVEL>` must not be symlinks. A server that fails these checks is reported in `skipped` and never dropped silently. `_template` is skipped.

1. **Preconditions**: config (`not_configured`), lock, no `INCOMPLETE` restore slot (`recovery_required`), git version and branch check.
2. **Cache** `<root>/backups/worlds`:
   - **No `.git`**: run `ls-remote --heads origin refs/heads/<b>`. Exit ≠ 0 → `auth_failed`/`repo_not_found`/`git_failed`; a network failure is never treated as "branch absent" (R10).
     - Branch present: `clone --depth 50 --branch <b>` (as today). Full history is fetched (`--unshallow`) only by prune and by a restore whose commit is missing (R5).
     - Branch absent: `init` + `checkout -b <b>` + README commit.
   - **`.git` exists**: `fetch origin +refs/heads/<b>:refs/remotes/origin/<b>` (an explicit refspec, so a changed branch works, R10).
     - (a) `origin/<b>` is an ancestor of local `<b>` (a failed push left commits): keep local; this push sends them as a fast-forward (R11).
     - (b) Otherwise, if `local^{tree} == origin^{tree}` (a crash after a prune push, before `update-ref`): `checkout -f -B <b> origin/<b>` silently.
     - (c) Any other divergence: add a warning, then `checkout -f -B <b> origin/<b>`.
3. **Missing-world guard (R7)**, before any cache change:
   - `tracked` = world dirs in `HEAD` (`worlds/*`, `servers/*/*`); `source` = the scan above.
   - Any `tracked − source` → `missing_worlds` with `paths` and nothing changed, unless `allowMissing: true`. A server whose whole `servers/<n>/` dir is gone counts as an intentional deletion and is excluded. A missing `servers/` or an empty `worlds/` still blocks.
   - Consent comes from CLI `--allow-missing` and API body `allowMissing`. The scheduler and auto-on-stop never pass it. The scheduler's failure message names the fix (`mcctl backup push --allow-missing`).
   - An empty source with an empty `HEAD` → `empty_source`.
4. **Runtime gate (K3)**: `environment.isAvailable()` false → `runtime_unavailable`. Then `running = runtime.list({ running: true, strict: true })`; a failed `docker ps` throws → `runtime_unavailable`. Without `strict`, D1 returns `[]` ("nothing running") on failure. `worlds/` or `servers/` being a symlink → `unsupported_layout`.
5. **Flush and copy**:
   - Add each server to the cleanup list **before** sending `save-off`.
   - Send `save-off`, then `save-all flush`, each with `signal: AbortSignal.timeout(60_000)`. A non-zero exit or an abort → `flush_failed`, and nothing is copied.
   - Copy: `fs.rm` + `fs.cp(src, dst, { recursive: true, filter })`. `.locks` is never copied, and a symlink → `unsupported_layout` with no commit. `worlds/` is scanned for symlinks before any RCON; internal worlds are checked by the copy filter.
   - **`finally`**: send `save-on` to each server in the cleanup list, independently. If the push succeeds, a failure goes to `warnings` with the server name. If the flush, the copy or a later git step (commit, push) fails, the save-on failures are appended to the error message and their servers are added to `servers`.
6. **Commit and push**:
   - `add -A`. If `diff --cached --quiet` exits 0 → `{ changed: false }`, which is success (#8).
   - Otherwise `commit -m <message>` (default `Backup: YYYY-MM-DD HH:MM:SS`), then `push origin <b>:refs/heads/<b>` with no force.
   - A failed push keeps the local commit; step 2 of the next run saves it as a recovery ref.

`ponytail:` rm + cp rewrites every file, so git re-hashes the whole tree each run. This is correct but slow on very large worlds. Size/mtime shortcuts (`core.checkStat=minimal`) were rejected because they can miss changes (S2).

### B5. Restore

1. **Preconditions**: lock (`lockWaitMs: 0`); no `INCOMPLETE` slot (`recovery_required`); delete leftover `backups/.restore-*` staging dirs, then `worktree prune`; no cache → run B4 step 2 (needs config).
2. **Commit**: `commit` must match `^[0-9a-f]{4,40}$`. `fetch`. `rev-parse --verify <c>^{commit}` gives the full OID, which every later command uses. If the commit is missing and the cache is shallow, run `fetch --unshallow` and retry. Otherwise → `commit_not_found`.
3. **Runtime gate**: `isAvailable()` false, or the strict list fails → `runtime_unavailable`. Any running server → `servers_running`. The check covers every server, not only those using affected worlds, because the world → server map is unreliable until #670.
4. **Stage and plan**, without touching live data:
   - `worktree add --detach backups/.restore-<ts> <oid>`. This gives the exact tree of the commit (#3) and leaves the cache's HEAD, index and work tree alone.
   - Validate:
     - There must be at least one restorable payload: a non-empty `worlds/`, or a `servers/<n>/<dir>/level.dat` → otherwise `empty_source` (R8).
     - Any symlink in staging → `unsupported_layout`. `.locks` entries in the commit are ignored.
     - The commit's main world dir for server n ≠ its current valid `LEVEL` → `restore_conflict` (R8).
     - `worlds/`, the target `data/` dirs and `backups/` on different devices → `unsupported_layout`. There is no copy fallback (S2).
   - Targets:
     - `worlds/` (every entry except `.locks`), only if the commit has `worlds/`. Old internal-only snapshots leave live `worlds/` alone.
     - For each `servers/<n>/` in the commit: `data/<dir>` for each dir name in the commit, plus the live `<LEVEL>{,_nether,_the_end}`.
     - Servers not in the commit are untouched. A server whose `servers/<n>/` is gone, or whose path is a symlink, goes to `skipped`.
   - Before the first rename: `worlds/` and `servers/` must not be links, and every live target and managed parent (`worlds/`, `servers/<n>/`, `servers/<n>/data/`) is checked with `lstat`. A link, or a device other than that of `backups/`, → `unsupported_layout`.
5. **Re-check the runtime gate** (strict) immediately before the first move (K3, R1).
6. **Swap**:
   - Create the slot `backups/restore-previous/<ISO-ts>/`. Write the planned target list into its `INCOMPLETE` file once, before the first move; that is the manual recovery record.
   - For each target, (a) `rename` live → slot (when it exists), then (b) `rename` staging → live. Completed steps are kept in memory.
   - `.locks` is never moved.
7. **On failure, roll back the in-memory steps in reverse**:
   - Each (b): move live → `slot/.new/…`. New data is set aside, not deleted.
   - Each (a): move slot → live.
   - Full rollback → delete the whole slot (it only holds the parked copy of the commit, which is still in git) and return the original error. Rolled-back slots therefore never count in the rotation. Partial rollback → keep `INCOMPLETE` and return `io_failed` with the slot path. Every later push or restore then returns `recovery_required` until a human recovers by following the target list in `INCOMPLETE` (documented; no `--recover` command in S3).
8. **On success**: remove `INCOMPLETE`, then rotate. Keep the 3 newest complete slots and delete older complete ones. An `INCOMPLETE` slot is never deleted, and nothing is deleted before the swap succeeds (K2).
9. **`finally`**: `worktree remove --force`, then release the lock. A cleanup error never hides the main error: it is appended to the main error's message, and the code and slot path are kept (`withCleanup`).

The port never prompts (#4). `mcctl backup restore <commit>` confirms unless `--force`, and the interactive `BackupUseCase.restore()` is unchanged. Legacy `worlds.bak.<ts>` dirs are left in place, and the docs explain how to remove them (B-Q5).

**Known limit (R1, B-Q7)**: mc-router auto-scale, or a start from the CLI or API, can launch a server between step 5 and the last rename. S3 does not stop mc-router or lock start paths. The docs say: "stop mc-router or disable auto-scale before restoring".

### B6. History, status, diff, connection test

- `history`: `git log -n <limit> --format=%H%x00%aI%x00%an%x00%s%x1e`. `|` and `"` in messages are safe. It returns full hashes; the API route keeps its 7-character `hash` field (#12).
- `status`: env codec plus `git log -1 --format=%H%x00%aI`. `configured` comes from the keys, not from an exit code (#13). An unreadable `.env` or a git error is `{ ok: false }`, not `configured: false` (S5).
- `diff`: **not ported. This is an explicit scope change (S4).** It has no user entry point: `mcctl backup` has `init|status|push|history|restore` only (`diff` in `cli/src/index.ts` is `config-snapshot diff`); the API and console have no diff route; the docs do not mention it. It is reachable only by running the repository's `mcctl.sh`/`backup.sh` directly.
- `testConnection` (#10): `ls-remote --heads <remoteBase><repo>.git` with the B3 env. Exit 0 → ok. stderr `Repository not found`/`404` → `repo_not_found`; `Authentication failed`/`401`/`403` → `auth_failed`.

### B7. Retention rewrite (#9)

`prune(policy)` replaces `truncateHistory`/`applyRetentionPolicy`. The scheduler runs it after a push. A prune failure is audited (lease conflicts separately) and does not fail the run.

1. **Preconditions**: lock and config. Normalize the remote and `fetch` (B4 refspec) only, with no checkout. If the untouched local `<b>` ≠ `origin/<b>`, skip with a warning and touch no ref (the next push reconciles, B4 step 2). Only a missing cache runs the full B4 step 2.
2. **Full history**: if `rev-parse --is-shallow-repository` is true, `fetch --unshallow`; if that fails → no prune (R5). Pin `oldTip = origin/<b>`.
3. **Keep set**: walk `rev-list --first-parent oldTip` in chain order.
   - **The tip is always kept** (R6, K5).
   - Older commits are kept if they are within the newest `maxCount` and, separately, have author date ≥ `now − maxAgeDays × 86 400 000 ms`. This fixes `--reverse -1` returning the newest commit.
   - Nothing dropped → `{ removed: 0 }`.
4. **Rebuild** in the original chain order: `commit-tree <c>^{tree} [-p <prev>] -m <full message>`, with the original author/committer name, email and `%aI`/`%cI` dates in env. Invariant before pushing: `newTip^{tree} == oldTip^{tree}` (R6). No ref, index or work tree changes.
5. **Publish**:
   - `push --force-with-lease=refs/heads/<b>:<oldTip> origin <newTip>:refs/heads/<b>`.
   - On success: `update-ref refs/heads/<b> <newTip> <oldTip>`, then delete the state file. The index stays valid because the trees are equal.
6. **Uncertain outcome (R12)**: on any push error or timeout, `ls-remote origin refs/heads/<b>`.
   - `= newTip` → `update-ref` and success.
   - `= oldTip` → failure, nothing changed.
   - Anything else → `lease_conflict`.
   - The remote is always a complete old or new history, never partial. There is no compensating force push. A crash between push and `update-ref` is resolved by the next push (B4 step 2, case b: equal trees).

### B8. Bug → design → proving test

"repo" means real git, a local bare remote (`remoteBase = file://…`), and a temporary `<root>`. Tests are grouped in five bundles (Codex): **R** restore failure injection, **L** real-process lock, **H** real git history, **U** uncertain remote outcome, **I** integration and transition.

| # | Bug | Fixed by | Proving test (red first) |
|---|-----|----------|--------------------------|
| 1 | copy without flush | B4.4–5 | fake runtime/console: `save-off`×n → `flush`×n → copy → `save-on`×n; `save-on` is sent even when flush aborts (child killed) or the copy throws; `isAvailable()` false → `runtime_unavailable`, no copy |
| 2 | restore over running servers; `.locks` lost | B5.3, B5.5, B5.6 | repo: running → refused; a server that starts after the first check is caught by the re-check; `.locks` byte-identical; `.locks` in the commit ignored |
| 3 | mixed-commit restore | B5.4 | repo: A {x}, B {x, y}; restore A → `y` absent, `x` = A's bytes |
| 4 | restore waits on stdin | B5, B3 | every git env has `GIT_TERMINAL_PROMPT=0`; API restore resolves |
| 5 | no lock | B2 | **L**: two child processes, one holding → `locked`; dead pid → taken over; `EPERM`, other host, old `startedAt` with a live pid → `locked`; two contenders on one stale lock (barrier) → exactly one wins; wait then success |
| 6 | internal worlds missing | B4 layout, B5.4 | repo: `servers/a/data/w` + `w_nether` backed up and restored; internal-only commit restorable; old `worlds/`-only commit leaves them alone; LEVEL change → `restore_conflict`; symlinked `data` → `skipped` |
| 7 | npm install: commit without sync | B1 | **I**: root without `scripts/` → push commits world content; API and scheduler have no `scripts/backup.sh` lookup |
| 8 | "no changes" = failure | B4.6 | repo: second push → `changed: false`; route 200; scheduler success; prune after a no-change push works |
| 9 | unsafe retention rewrite | B7 | **H**: 60+ commits cloned shallow (assert shallow), age-only, count > 50, combined → kept trees match; tip with an old author date is kept; tree invariant holds. **U**: lease conflict, hook reject, timeout after remote applied → converges to new; crash before `update-ref` → fixed next run |
| 10 | connection test fails; token in argv | B6, B3 | fake `git` on `PATH` records argv/env: no token in argv, header in env, inherited `GIT_DIR`/`GIT_CONFIG_*` stripped, proxy vars kept; exit/stderr mapping; `BackupUseCase` init succeeds |
| 11 | token in the `backup.sh` URL | B3 | `PATH` wrapper over real git through clone/fetch/push: token in no argv; `.git/config` has no token, no stale `extraHeader` effect, no `pushurl` |
| 12 | history always empty | B6 | repo: messages with `\|` and `"` → exact entries, newest first; `BackupUseCase` maps them (PR2) |
| 13 | status labels/`configured` | B6 | `.env` without keys → `configured: false`; with keys → real values; unreadable `.env` → `{ ok: false }` |

Bundle **R** also covers the review cases: the N-th rename fails → original bytes recoverable; partial rollback → `INCOMPLETE` blocks the next push and restore; rotation keeps 3 slots; push R7 (one world missing → `missing_worlds`, remote unchanged); a deleted `servers/<n>/` is not `missing_worlds`; R11 (failed push → the next push sends the kept commit as a fast-forward); a crash before `update-ref` → case (b).

### B9. Test plan and PR split

- Behaviour is tested with real git and a bare remote. A fake `git` on `PATH` is used only where argv and env must be observed. Characterize the kept behaviour first: cache path, default branch, README init, message format, identity, `.locks` exclusion.
- **PR1 (core)**: port, adapter, helpers, the `IServerConsolePort` signal option (with the Docker adapter), bundles L/H/U/R and the adapter rows of B8. Additive only; no call site changes.
- **PR2 (cli + backend)**:
  - The widened `BackupUseCase`; CLI `Container`; `mcctl backup push --auto` becomes non-interactive with a 10 min wait (today `--auto` is ignored); `--allow-missing`; restore confirmation.
  - API route (codes → 400/404/409/500, 7-character hash kept) and scheduler.
  - `mcctl.sh`: both auto-on-stop and `cmd_backup` call `"${MCCTL_NODE:-node}" "$MCCTL_CLI" backup …` when `ShellAdapter` exported those two vars (`process.execPath`, `process.argv[1]`); otherwise `mcctl` on `PATH`; otherwise a warning. After PR2 no lockless `backup.sh` writer is reachable from `mcctl.sh` (S3).
- **PR3**: delete `backup.sh` and the unused CLI `lib/shell.ts backup()`; deprecated `ShellAdapter.backup*` return the clear failure; fix the `env-file.ts` comment and the EN/KO docs (restore preconditions, manual lock removal, manual recovery from an `INCOMPLETE` slot); `test:scripts` and `verify:package` pass. **PR2 and PR3 ship in the same release.**

### B10. Decisions and open questions

| | Decision (2026-10-23) |
|---|---|
| B-Q1 | Policy in the adapter, single port (S1) |
| B-Q2 | Widen to `IWorldBackupPort \| IShellPort`; narrow in #736 (K1) |
| B-Q3 | git ≥ 2.31 |
| B-Q4 | `diff` not ported; explicit scope change, no entry point (S4) |
| B-Q5 | Keep `worlds.bak.*`; document removal |
| B-Q6 | One flush failure fails the push |
| B-Q7 | Docs + `isAvailable` + re-check before the swap; the race is a known limit |
| B-Q8 | A stuck `save-off` after a crash: accept and document |
| B-Q9 | API/console stops never auto-backup; #734 owns it |

Not adopted: `Promise.race` for RCON (an `AbortSignal` actually kills the child, R9); `core.checkStat=minimal` (can miss changes) and `verbatimSymlinks` (symlinks are refused); `reflog expire` after prune (local disk is not an acceptance criterion; auto gc handles it); stopping mc-router or locking start paths (outside S3, R1).

Settled at re-review: option names CLI `--allow-missing` / API `allowMissing`; `INCOMPLETE` recovery is manual in S3; the two known limits (auto-start during restore, three lock contenders) are accepted.

## Script Removal S5: `mcctl.sh` (#734)

`mcctl.sh` is deleted. No new port; the existing ones gained one optional parameter.

| Path | Before | After |
|------|--------|-------|
| CLI `start`/`stop <server>` | `ShellExecutor.mcctl` → `mcctl.sh` | `IContainerRuntimePort.start`/`stop` with a `ServerName` (`commands/lifecycle.ts`). Exit codes kept: 2 = already running (start) / not running (stop), 1 = no `servers/<name>/docker-compose.yml` or the runtime cannot be queried (`not_found` confirmed by `list({ strict: true })`, replacing `check_docker`) |
| CLI `console <server>` | `docker exec -i mc-<name> rcon-cli` | the `mcctl rcon` session: `getStatus` + `IServerConsolePort.getEndpoint` + `rcon-client` over TCP (row `mcctl.sh` in [Alignment with #715](#alignment-with-715-script-removal)). Lines run in order; EOF closes after the last reply; the client's `end` ends the session (0), `error` exits 1 |
| Auto-backup on stop | `mcctl.sh stop` → `mcctl backup push --auto` | `autoBackupOnStop(backup, server)` (shared): `status()` → `configured && autoOnStop` → `push({ lockWaitMs: 600000 })`, never `allowMissing`, never rejects. CLI `stop <server>` awaits it (warning on failure, exit 0); the API stop route runs it in the background, logs the result, and an `onClose` hook waits for running ones (at most `AUTO_BACKUP_CLOSE_WAIT_MS`, 2 min; after 90 s it aborts them through `push`'s `signal`, and the adapter stops before the next save-off or copied file, sends `save-on`, and fails with `aborted`; the generated PM2 config gives mcctl-api `kill_timeout` `API_PM2_KILL_TIMEOUT_MS`, 130 s) so the adapter's `save-on` recovery is not cut off by shutdown (B-Q9 closed). Start, restart, `stop --all` and server delete (S7) do not back up |
| `createWorld` SEED | `IShellPort.setServerConfig` → `mcctl.sh config` | `IWorldAssignmentPort.assign(world, server, { seed })`: one write with `LEVEL` (through the ServerSpec since #675, ADR-0003 §6); `SEED` is written even when `LEVEL` is unchanged. `WorldManagementUseCase`'s `shell` parameter is unused (`@deprecated`) |
| Stopped check | `checkServerStopped` passed `not_found` | `not_found` passes only when `list({ strict: true })` succeeds, so an unreachable runtime is `undetermined` (fail-closed) |
| Pre-delete stop | `IShellPort.stopServer` | `DeleteServerUseCase(..., runtime?)`: `runtime.stop` when given (CLI), then `delete-server.sh`. Since #735 there is no separate stop: `deprovision` stops and removes the container with `runtime.remove` ([S7](#script-removal-s7-delete-serversh-735)) |
| API | `new ShellAdapter({ paths })` in `lib/world-use-case.ts` | none: the API no longer resolves `<root>/scripts` for world operations |

`IShellPort`/`ShellAdapter` `startServer`, `stopServer`, `serverStatus`, `setServerConfig`, `logs`, `console`, `status` keep their v2 signatures and return `mcctl.sh was removed (#734); use …` without running a script (removed in #736). The API stop route keeps `executeServerAction` (`docker compose stop`); open question 2 is unchanged.

## Script Removal S7: `delete-server.sh` (#735)

`mcctl delete` and `DELETE /api/servers/:name` delete in TypeScript. No new port: three existing ports gain a method (none of them shipped in v2.33.0, so this is not breaking).

| Step | `delete-server.sh` | TypeScript (`DeleteServerUseCase.deprovision(name, { deleteWorld })`) |
|------|--------------------|------------------------------------------------------------------------|
| Plan the worlds | `plan_worlds`, `worlds_outside_server` before anything | `specRepo.delete(name, { deleteWorld, dryRun: true })`: same rules (see below). An unsafe plan rejects before the container is touched |
| Stop and remove the container | `docker ps -a`, `compose stop` + `compose rm -f`, or `docker rm -f` | `IContainerRuntimePort.remove(name)`. A failure rejects with "Nothing was deleted" |
| Plan again (the server may write while it stops), drop the include entry, move the world, delete `servers/<n>` | steps 2 and 4, include before the move | `specRepo.delete(name, { deleteWorld })`: plan, drop the include entry under the `servers/.compose.yml.lock` lock (#675 `acquireFileLock`), move (`rename`; on `EXDEV`, as `mv` did, claim `worlds/<w>` with a non-recursive `mkdir`, copy, remove the original), then delete `servers/<n>`. The entry goes first, as in the script: `mcctl start` and `POST /api/servers/:name/start` skip the delete queue, and `docker compose up -d mc-<n>` must not recreate the server while its world is copied. The move and the `rm` stay outside the lock, so a long copy does not make other writers fail with `locked`. A failed move takes the lock again and puts the entry back (the replaced text when the file is unchanged, else the original entry merged in, options and path group included; skipped when `servers/<n>/docker-compose.yml` is gone); if that fails too, the error adds how to put it back by hand. The whole delete, dry runs included, holds `servers/.<n>.delete.lock` (`acquireFileLock`, no wait), so a second delete of the server from any process (CLI or API) fails with `locked`. A failure says the container is already gone and which worlds already moved. Files `rm` cannot remove are a warning with a `sudo rm -rf` hint (the delete succeeds and the hostname step runs) |
| Hostname | step 3, before the directory | `IHostnameRegistrarPort.unregister('<name>.local')` after the files, best effort (a skip is a warning) |
| Validate the compose project | `docker compose config` after the include edit, restore the backup on failure | dropped: the include edit is a YAML edit of one key (`removeIncludeEntry`), which keeps the file valid |

- **World plan** (`infrastructure/adapters/server-spec/serverWorldPlan.ts`, #652): `data/<LEVEL>`, `_nether`, `_the_end` (real folders, not symlinks) move to `worlds/`. Refused, changing nothing: `worlds/<w>` exists (`conflict`); dimension folders without `data/<LEVEL>`; a symlinked `servers/<n>` or `data/`; any other world folder in the server (`level.dat`, `level.dat_old`, `region/`, `*.mca`); a symlink whose target is inside the server (all `undetermined`). `deleteWorld` overrides these. `worlds/` resolving inside the server is refused even with `deleteWorld`. **`LEVEL` is read by the ADR-0002 snapshot reader** (Compose semantics: quotes, inline comments, last definition), not by the script's "one plain `LEVEL=` line" rule; a server the reader cannot determine (invalid or interpolated `LEVEL`, unsupported `--universe`) aborts unless `deleteWorld`. The world-folder scan keeps a misread `LEVEL` from losing data: the other world is found and the delete stops.
- **Assignment release**: nothing to call. The assignment is the server's `LEVEL` (ADR-0002 R3, R5), so it goes with `servers/<n>/config.env`; `IWorldAssignmentPort.release` (fall back to `<server>`) is for servers that stay.
- **No backup before the delete.** `remove` stops the container without the auto-backup on stop (S5), so the delete does not run `BACKUP_AUTO_ON_STOP`: the world is kept in `worlds/` (#652), and `--delete-world` is an explicit request to drop it.
- **`unregister` command shape** (README sudoers, #751): `sudo -n sed -i '/^[^#]*[[:space:]]<host>\([[:space:]]\|#\|$\)/d' /etc/avahi/hosts`, then `sudo -n systemctl restart avahi-daemon`, argv without a shell. `<host>` is the validated hostname with `[ ] \ . * ^ $ /` escaped (the expression of the removed `avahi_remove_host`). A password (CLI `--sudo-password` / `MCCTL_SUDO_PASSWORD` / prompt, API request body `sudoPassword`) goes to `sudo -S -p '' -v` on stdin first and never to `sed` or an environment variable (#682); an empty password is none. No hosts file or no exact entry is `unchanged`.
- **API**: `DELETE /api/servers/:name` takes an optional JSON body `{ "sudoPassword": "..." }` (write-only, as in create; not a query parameter because URLs are logged). Before #735 the route ran the script without it, so the avahi entry stayed unless sudo needed no password. The 200 body gains an optional `warning` when the hostname was not removed. `force` no longer changes anything (`remove` stops the container). The create/delete queue (#656) is unchanged.
- **Deprecated** (removed in #736): `IShellPort.deleteServer`, `ShellAdapter.deleteServer` (rejects with "delete-server.sh was removed in #735; …" and runs nothing). `DeleteServerUseCase` without `runtime?` (#734) and its new optional trailing parameter `deprovision?` (`{ specRepo, hostnames? }`) rejects with the same message.
- **Removed scripts and tests**: `delete-server.sh`, `delete-server.bats`, `sudo-password.bats` (its cases are vitest tests of the avahi adapter), `tests/fake-bin/docker`, and every `lib/common.sh` and `tests/helpers.bash` helper that only `delete-server.sh`, `mcctl.sh` (S5) or their tests used. `lib/common.sh` keeps the naming validators that `naming-rules.bats` tests; `platform/scripts/` has no `*.sh` left at its top level.

