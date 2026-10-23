# ADR-0001: Container Runtime Ports and the Docker Adapter

| | |
|---|---|
| **Status** | Proposed (2026-10-23) |
| **Issue** | [#654](https://github.com/smallmiro/minecraft-server-manager/issues/654) (Hardening D1), milestone M2 (#643), epic #640 |
| **Follow-ups that change this ADR** | #665 (D4), #669 (A7), C2, #675 (D5), #641 (k8s adapter), #732 (S3, [backup port](#backup-port-732-s3)) |
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
3. **`IServerSpecRepository` and `IWorldAssignmentPort` are reserved as type-only files.** The issue asks for them "interface only", so D1 creates them with the sketched signatures, marked provisional. They have no implementation and no caller in D1. Their shapes depend on designs that are still open (ServerSpec schema, §9.2; the A4 assignment model), so D5 and A4 may rewrite them. See [Reserved ports](#reserved-ports).
4. **Contracts are provisional until a second adapter exists.** Until #641 adds the k8s adapter, D4, A7, C2, and D5 may change signatures. The TypeScript compiler finds every call site. Each change updates this ADR.
5. **Synchronous where the code is synchronous today.** Methods backed by `execSync`/`spawnSync`/`execFileSync` stay synchronous. Methods that are async today stay async. C2 converts the port to `Promise` everywhere.
6. **Error model is unchanged**: sentinels (`'not_found'`, `'unknown'`, `''`, `null`, `false`, `'-'`) and result objects that never throw, exactly as today. "Cannot tell" and "absent" stay conflated until A7 adds `RuntimeUnavailableError`.
7. **Workload names are Docker container names in D1** (`mc-<server>`, `mc-router`, `playit-agent`). Only then can the facade wrappers delegate without translation, and only then do the #720 argv tests (`docker-shell-injection.test.ts`) keep passing unchanged. D4 moves the `mc-` rule into the adapter and changes the parameter to `ServerName`.
8. **One adapter class per port.** The Docker classes live in one module, `infrastructure/adapters/DockerComposeRuntimeAdapter.ts`, and share private `docker inspect` helpers. Avahi gets its own file. A single class cannot implement all ports: `start()`/`stop()` (playit) collide with `start(name)`/`stop(name)` (runtime), and `getHealth()` (router) collides with `getHealth(name)`.
9. **`docker/index.ts` becomes a legacy facade.** It keeps all 48 exports with the same signatures. The leaf functions that run processes delegate in one line to private adapter instances. Composite functions stay verbatim, and process helpers move to `infrastructure/process.ts`. The facade no longer imports `child_process`.
10. **No exported singleton.** Composition roots (CLI `Container` in D3, API `container` plugin in D2) construct adapters with `new`. Only the facade holds a private default instance.
11. **Lint**: `no-restricted-imports` + `no-restricted-syntax` forbid `child_process` outside `src/infrastructure/**` in shared, cli, and mcctl-api. The rule starts as **warn** and becomes **error** per package once that package has zero violations (after D2/D3).

## Port Definitions

Files: `platform/services/shared/src/application/ports/outbound/<Port>.ts`, exported from `outbound/index.ts` and listed in `ports/index.ts`, so D2/D3 import them from the package root (one port per file, as in the rest of the directory). Types such as `ContainerStatus` come from `src/types/index.ts`.

```ts
// IContainerRuntimePort.ts
import type { ContainerStatus, HealthStatus, ContainerStats } from '../../../types/index.js';

/** Lifecycle result. Never rejects; failure is `success: false`. */
export interface RuntimeActionResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

/**
 * Per-workload runtime operations.
 * `name` is the runtime workload name. In D1 this is the Docker container name (`mc-<server>`).
 * D1 contract: "absent" and "runtime unreachable" are NOT distinguished (A7 changes this).
 */
export interface IContainerRuntimePort {
  /** 'not_found' when absent or when the runtime cannot be queried. */
  getStatus(name: string): ContainerStatus;
  /** 'none' without a healthcheck, 'unknown' on failure. */
  getHealth(name: string): HealthStatus;
  exists(name: string): boolean;
  /** Server workloads (mc-* except mc-router), sorted. [] on failure. */
  /** `strict: true` (added by #732): a failed query throws instead of returning []. */
  list(options?: { running?: boolean; strict?: boolean }): string[];
  /** Last `lines` lines (default 50). '' on failure. */
  getLogs(name: string, lines?: number): string;
  getStats(name: string): ContainerStats | null;
  getUptime(name: string): { uptime: string; seconds: number } | null;

  /** Create the workload if missing, then run it. */
  start(name: string): Promise<RuntimeActionResult>;
  stop(name: string): Promise<RuntimeActionResult>;
  restart(name: string): Promise<RuntimeActionResult>;

  /** Timestamped lines since `since`, at most `tail` lines. Rejects on failure. */
  readLogs(name: string, options: { since: string; tail: number }): Promise<string[]>;
  /** New output only by default; `options.tail` emits the last N lines first, then follows; `options.follow: false` prints the last `tail` lines (stdout and stderr) and resolves at exit; `options.onExit(code, error?)` reports docker's exit code or a spawn error once, while the promise still always resolves so the v2.x contract holds (#731). */
  followLogs(name: string, onChunk: (chunk: string) => void, signal: AbortSignal, options?: { tail?: number; follow?: boolean; onExit?: (code: number | null, error?: Error) => void }): Promise<void>;
}
```

```ts
// IServerConsolePort.ts
import type { PlayerListResult } from '../../../types/index.js';

export interface ConsoleCommandResult { exitCode: number; stdout: string; stderr: string; }
export interface ConsoleEndpoint { host: string; port: number; password: string; }

export interface IServerConsolePort {
  /** `list` via RCON. null when offline or unparseable. */
  listPlayers(name: string): Promise<PlayerListResult | null>;
  /** Runs one RCON command. Never rejects (spawn error → exitCode 1, stderr = message).
   *  `signal` (added by #732) is passed to spawn; abort kills the child. */
  command(name: string, args: string[], options?: { signal?: AbortSignal }): Promise<ConsoleCommandResult>;
  /** Address and credentials for a direct RCON TCP session (`mcctl rcon`). null when unknown. */
  getEndpoint(name: string): Promise<ConsoleEndpoint | null>;
}
```

```ts
// IRouterStatusPort.ts
import type { HealthStatus } from '../../../types/index.js';

export interface IRouterStatusPort {
  /** 'unknown' if the router is not running; else management API probe result. */
  getHealth(): HealthStatus;
  /** Comma-separated router hostnames of a server workload, '-' when none. */
  getHostnames(name: string): string;
}

// IPlayitAgentPort.ts
export interface IPlayitAgentPort {
  start(): Promise<{ success: boolean; error?: string }>;
  stop(): Promise<boolean>;
}

// IHostnameRegistrarPort.ts
export type HostnameRegistrarStatus = 'running' | 'installed (not running)' | 'not installed';
export interface IHostnameRegistrarPort {
  getStatus(): HostnameRegistrarStatus;
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

`IRconPort` (`getEntityPosition`) stays as it is. D4 decides whether to re-implement `RconCliAdapter` on top of `IServerConsolePort.command` or to merge the two ports.

### Reserved ports

Created in D1 as type-only files with the sketch from the hardening plan §9.1, each with a "provisional" JSDoc. They are async (new code, no synchronous caller to preserve) and import nothing from infrastructure.

| Port | Owner | D1 signature | Why provisional |
|------|-------|--------------|-----------------|
| `IServerSpecRepository` | D5 (#675) | `list(): Promise<ServerSpec[]>`, `get(name): Promise<ServerSpec \| null>`, `save(spec): Promise<void>`, `delete(name): Promise<void>`; `ServerSpec` is a placeholder `{ name: string }` | The real `ServerSpec` schema is a D5 design item (§8, §9.2). D5 replaces the placeholder type. |
| `IWorldAssignmentPort` | A4 (#670) | `getAssignment(world): Promise<string \| null>`, `listAssignments(): Promise<WorldAssignment[]>` (`{ world, server }`), `assign(world, server): Promise<void>` (rejects on an R1 violation) | A4 may derive assignments from each server's `LEVEL` as a domain service, so this may stop being a port. |

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
  - `stopContainer` (synchronous `docker stop`) has one caller (the API delete route) that moves to `stop()`.
  - `checkDockerCompose` has no caller.
- **Composition**: export the classes from `infrastructure/adapters/index.ts` (and therefore from the package root). Do not export instances. The facade creates its own private instances at module load. The constructors have no side effects, so import-time behaviour is unchanged.

### Dependency rules (cycle prevention)

1. Adapter modules and `infrastructure/process.ts` import only `node:*`, `../../types`, `../../utils` (`resolveMcctlRoot`), `../process.js`, and port types. **They never import `docker/index.ts`.**
2. `docker/index.ts` imports adapters **by file path**, never through `infrastructure/index.js` or `infrastructure/adapters/index.js`. The barrel loads `ServerRepository`, which imports the facade; that is a cycle, and a TDZ error on `new` at load time.
3. `ServerRepository` and `WorldRepository` keep importing `execCommandAsync`/`getContainerStatus` from the facade in D1. `world-name-resolution.test.ts` mocks the facade's `execCommandAsync`. D4 switches them to an injected `IContainerRuntimePort`.
4. Composite functions stay in the facade and call the wrappers. They contain no process code. Docker literals in them (`'mc-router'`, `'playit-agent'`, `--in-docker (auto-discovery)`, `:25565`) stay until the composites become a query service (see [Open questions](#open-questions)).

## Lifecycle Semantics and argv Rules

| Method | Docker implementation | Matches today's |
|--------|----------------------|-----------------|
| `start(name)` | `docker compose up -d <name>`, cwd = root, env + `COMPOSE_FILE=docker-compose.yml`, timeout 60 s | `mcctl.sh start` (`:426`), API `executeServerAction('start')` |
| `stop(name)` | `docker stop -- <name>`, env, no timeout | `mcctl.sh stop` (`:464`), `stopContainer`, CLI `migrate.ts:557`, API delete route |
| `restart(name)` | `docker compose restart <name>`, cwd = root, env + `COMPOSE_FILE`, timeout 60 s | API `executeServerAction('restart')` (only caller) |

- `start` means "create if missing". `docker start` cannot start a server whose container was never created (`not_created` in the UI). For k8s, `start` is a scale to 1 (after `apply` in D5).
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

**Pure or config-file functions → no port (12)**: `parseRconPlayerList` (lives in `DockerComposeRuntimeAdapter.ts` next to `listPlayers`, because adapters cannot import the facade; the facade re-exports it), `formatBytes`, `parseRouterHosts`, `replaceRouterHosts`, `resolvePlayitDomain` (pure); `getWorldsDir`, `getServersDir`, `getWorldDirectorySize` (plan §9.1: moves to `WorldRepository`, async); `getConfiguredServers`, `readServerConfigEnv`, `getServerPlayitDomain`, `setServerPlayitDomain` (config files, later `IServerSpecRepository` in D5; env parsing is unified by A6).

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
| 8 | api `routes/servers.ts:61,858` (create and delete routes), `routes/backup.ts`, `services/backup-scheduler.ts` | `create-server.sh`, `delete-server.sh`, `backup.sh`, `git` | not a runtime port; move under `mcctl-api/src/infrastructure/` | D2; backup paths: #732 | needed before the rule becomes an error. #732 removes the backup ones (see [Backup Port](#backup-port-732-s3)) |
| 9 | cli `lib/rcon.ts:16` | `docker inspect -f {{.State.Running}}` | `runtime.getStatus === 'running'` | D3 | same note as #2 |
| 10 | cli `lib/rcon.ts:43` | `docker exec <c> rcon-cli ...` | `console.command` | D3 | caller keeps `output \|\| errorOutput` |
| 11 | cli `lib/shell.ts:265` | `docker exec` with inherited stdio | `console.command` then print | D3 | output is buffered instead of streamed |
| 12 | cli `commands/rcon.ts:24,39` | two `docker inspect` (IP, env) | `console.getEndpoint` | D3 | |
| 13 | cli `lib/prompts/server-select.ts:109` | `docker ps -a ... {{.Status}}` | `runtime.list()` + `list({ running: true })` | D3 | "Up (Paused)" counted as running today |
| 14 | cli `commands/migrate.ts:557` | `docker stop <c>` | `runtime.stop` (throw on `!success`) | D3 | |
| 15 | cli `lib/shell.ts:145,167,298,321,348`, `commands/init.ts:344,349,679`, `commands/upgrade.ts:365` | `docker pull`, generic `docker compose`, `down`, `startAll`/`stopAll` pipelines, network create, router restart/recreate | not a runtime port: compose-project / platform-install operations; move under `cli/src/infrastructure/` | D3 | k8s platform lifecycle belongs to Helm (#641). C1 fixes the router service name |
| 16 | cli `commands/console/init.ts`, `console/service.ts`, `update.ts`, `lib/pm2-utils.ts`, `lib/banner.ts` | `npm`, `pm2`, `git` | not a runtime port; move under `cli/src/infrastructure/` | D3 | needed before the rule becomes an error |
| 17 | shared `ServerRepository.ts:115` | facade `execCommandAsync('docker', ['inspect', ...])` | `runtime.getStatus` | D4 | |
| 18 | shared `WorldRepository.ts:299` | facade `getContainerStatus` | `runtime.getStatus` | D4 | |
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

## Alignment with #715 (Script Removal)

#715 says it will not add new ports and will use the M2 ports. Coverage check:

| Script | What it does | Covered by D1 ports | Deferred (reason) |
|--------|--------------|---------------------|-------------------|
| `logs.sh` (removed in #731) | tail, follow, `--since`, `--timestamps` | `getLogs`, `followLogs({ tail, follow })`, `readLogs` | `--file`/`--json` formatting is CLI presentation, not a port. The avahi `journalctl` view was dropped; run `journalctl -u avahi-daemon` directly. `followLogs` gained optional `tail` (default 0) and `follow` (default true), so existing callers are unchanged. "Last N lines, then follow" is one stream, and `follow: false` prints the last N lines from stdout and stderr, and `onExit` lets a caller turn a failed `docker logs` into a non-zero exit code |
| `mcctl.sh` | start/stop/status, `docker exec -i rcon-cli` console | `start`, `stop`, `getStatus`; console via `getEndpoint` + the existing TCP client (`rcon-client`) | an interactive `attach()` with TTY passthrough; use TCP instead |
| `delete-server.sh` | stop, remove container, remove compose include, avahi unregister, keep world (D-2) | `stop` | `remove({ purgeData })`, `IHostnameRegistrarPort.unregister`, `IServerSpecRepository.delete`. No TS caller yet; D5/#715 |
| `lock.sh` | world locks | — | `IWorldAssignmentPort` (A4) |
| `player.sh` | Mojang API lookup | — | removed in #730 (`mcctl player info` covers it) |
| `backup.sh` | git backup of worlds | flush via `console.command`: `save-off`, `save-all flush`, `save-on` | git storage is `IWorldBackupPort`, not runtime ([Backup Port](#backup-port-732-s3)) |
| `render-map.sh` (removed in #733) | `docker image build`, `docker run --rm` BlueMap | — | moved into the Docker `IMapRenderer` adapter, `BlueMapCliRenderer` (k8s: Job) |
| `create-server.sh` | compose generation, include, avahi register, `compose up` | `start` | `apply(spec)`, `IHostnameRegistrarPort.register`, `IServerSpecRepository.save` (D5) |
| `init.sh` | network, platform setup | — | removed in #729; `mcctl init` is TS and platform install is not a runtime port |

Nothing in this table needs a method added to the D1 ports now. Every deferred method has no TypeScript caller today.

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

1. **Reserved ports** (resolved 2026-10-23): created as two type-only files with the sketched signatures and a placeholder `ServerSpec` that D5 will replace (decision 3).
2. **API stop semantics**: moving `executeServerAction('stop')` (`docker compose stop`) to `runtime.stop` (`docker stop`) is a small behaviour change. The two differ only for containers that are not in the compose project. Option A (recommended): accept it in D2 as a separate, labelled commit. Option B: make `stop` compose-based and change `mcctl.sh`-parity callers instead.
3. **Owner of the composites**: none of D2, D4, or #667 names the 12 facade composites. D2's acceptance criterion "route tests with a fake container" needs them injectable. Recommendation: add "turn the composites into an application query service built from ports" to D4 (shared, core-agent), and land it before D2's route migration.
4. **Order of signature changes**: D2, D3, and D4 run in parallel (P3), but D4 changes port parameters to `ServerName`. Option A (recommended): land D4's signature change first, then D2/D3. Option B: run them in parallel and let the compiler-driven fix-ups happen at merge.
5. **Scope of the error flip**: rows 8, 15, 16, and 19 (script, git, npm, and pm2 runners) are not runtime work. Confirm they belong to D2/D3/D4, or else the rule stays a warning for that package.

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
