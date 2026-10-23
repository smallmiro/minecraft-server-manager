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
  list(options?: { running?: boolean }): string[];
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
  /** Streams new output only. Resolves when the stream ends or `signal` aborts. */
  followLogs(name: string, onChunk: (chunk: string) => void, signal: AbortSignal): Promise<void>;
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
  /** Runs one RCON command. Never rejects (spawn error → exitCode 1, stderr = message). */
  command(name: string, args: string[]): Promise<ConsoleCommandResult>;
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
| `logs.sh` | tail, follow, `--since`, `--timestamps` | `getLogs`, `followLogs`, `readLogs` | `--file`/`--json` formatting is CLI presentation, not a port |
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

Status: Proposed (2026-10-23), awaiting system-architect review. Absorbs #653, #664, #727. Fixed by the issue (not reopened here): split `IShellPort.backup*` into one backup port (no new feature port); RCON is used only for the flush; git runs through `execFile` argv arrays, copies through `fs.cp`, config through the env codec (`utils/env-file.ts`); the token never appears in any argv; `mcctl.sh` calls `mcctl backup push` until #734.

### B1. Port, adapter, composition

File `application/ports/outbound/IWorldBackupPort.ts`. New code, so it is async and **never rejects**: every failure is a result (unexpected exceptions map to `git_failed`/`io_failed`).

```ts
import type { BackupRetentionPolicy } from '../../../domain/index.js';

export type WorldBackupErrorCode =
  | 'not_configured'   // BACKUP_GITHUB_TOKEN or BACKUP_GITHUB_REPO empty
  | 'locked'           // another backup/restore/prune holds the lock (after lockWaitMs)
  | 'servers_running'  // restore refused; `servers` lists them
  | 'flush_failed'     // save-off / save-all flush failed; nothing was copied
  | 'commit_not_found'
  | 'empty_source'     // the copy source is empty (push: no worlds; restore: commit has no worlds/)
  | 'auth_failed' | 'repo_not_found' | 'git_too_old' | 'timeout'
  | 'git_failed' | 'io_failed';
export interface WorldBackupError { code: WorldBackupErrorCode; message: string; servers?: string[]; holder?: BackupLockHolder }
export type WorldBackupResult<T> = { ok: true; value: T } | { ok: false; error: WorldBackupError };
export interface BackupLockHolder { pid: number; hostname: string; op: 'push' | 'restore' | 'prune'; startedAt: string }
export interface LockOptions { lockWaitMs?: number }  // default 0 = fail fast

export interface WorldBackupStatus {
  configured: boolean;        // token AND repo non-empty (fixes #13)
  repository?: string;
  branch: string;             // BACKUP_GITHUB_BRANCH || 'main'
  autoOnStop: boolean;        // BACKUP_AUTO_ON_STOP === 'true'
  lastBackup?: { commit: string; date: Date };  // tip of the local cache, if any
}
export interface WorldBackupCommit { hash: string; date: Date; author: string; message: string }

export interface IWorldBackupPort {
  status(): Promise<WorldBackupStatus>;
  /** Newest first, at most `limit` (default 20). [] when the cache does not exist. */
  history(limit?: number): Promise<WorldBackupResult<WorldBackupCommit[]>>;
  /** "No changes" is ok: { changed: false }. `flushed` = servers that got save-off/flush/save-on. */
  push(options?: { message?: string } & LockOptions): Promise<WorldBackupResult<{ changed: boolean; commit?: string; flushed: string[] }>>;
  restore(commit: string, options?: LockOptions): Promise<WorldBackupResult<{ commit: string; previousDir: string; skipped: string[] }>>;
  prune(policy: BackupRetentionPolicy, options?: LockOptions): Promise<WorldBackupResult<{ removed: number }>>;
  /** Does not read .env and does not lock. */
  testConnection(credentials: { token: string; repository: string }): Promise<WorldBackupResult<void>>;
}
```

- **Adapter**: `infrastructure/adapters/GitWorldBackupAdapter.ts`, `class GitWorldBackupAdapter implements IWorldBackupPort`, constructor `{ root: string; runtime: IContainerRuntimePort; console: IServerConsolePort; remoteBase?: string /* 'https://github.com/'; tests pass a file:// dir */ }`. The lock helper lives next to it (`infrastructure/backup-lock.ts`, not exported). Config is read from `<root>/.env` with `parseEnvDocument` **on every call**, falling back to `process.env` for keys the file lacks. This fixes the API reading a stale `process.env` after `mcctl backup init`.
- **Why the policy (lock, flush, running check) sits in the adapter**: four callers must share it, and the API has no use-case layer yet (D2). The adapter is the one place every caller routes through. Runtime and console are injected ports, so the policy is testable with fakes. Moving it to an application service is open question B-Q1.
- **Composition roots** (construct with `new`; no singleton, decision 10):
  - CLI `Container.worldBackupPort` → `new GitWorldBackupAdapter({ root: paths.root, runtime: new DockerComposeRuntimeAdapter({ root }), console: new DockerServerConsoleAdapter() })`. `backupUseCase` becomes `new BackupUseCase(promptPort, worldBackupPort)`.
  - API: `routes/backup.ts` and `routes/backup-schedule.ts` each build one (runtime gets `env: () => childProcessEnv()`). `BackupSchedulerService` takes `IWorldBackupPort` instead of `mcctlRoot`. Both move to the D2 `container` plugin when it exists. Two instances are fine because the lock is a file.
- **`BackupUseCase`**: its second constructor parameter changes from `IShellPort` to `IWorldBackupPort` (only caller: CLI `Container`; see B-Q2). `status`/`history`/`pushWithMessage`/`restoreFromCommit`/`testGitHubConnection` map the port results to the existing inbound types (`hash → commitHash`, `autoOnStop → autoBackupEnabled`). Prompts stay in the use case. The port never prompts.
- **Deprecated, not deleted (until #736)**: `IShellPort.backupPush`, `backupStatus`, `backupHistory`, `backupRestore`, and the same four `ShellAdapter` methods. After PR3 they return `Script not found: backup.sh`. They have no caller left. `exec`/`execInteractive` are #665's; S3 only stops using `exec('git', …)`. The adapter takes a plain `root`, so #665's `Paths` replacement does not touch it.

### B2. Lock (push, restore, prune; CLI, API manual, API scheduled, auto-on-stop)

- File `<root>/backups/.backup.lock`. It sits outside the cache work tree (`backups/worlds/`) and outside `worlds/.locks`.
- **Acquire**: `open(path, 'wx', 0o600)` (O_CREAT|O_EXCL, works on macOS), then write `BackupLockHolder` as JSON. On `EEXIST`, read the holder. It is **stale** if (same `hostname` and `process.kill(pid, 0)` throws `ESRCH`), or `startedAt` is older than 6 h (longer than every timeout; covers pid reuse and other hosts), or the content does not parse and the mtime is older than 60 s. A stale lock is unlinked and the open is retried once. Otherwise poll every 1 s until `lockWaitMs`, then return `locked` with `holder`.
- **Release**: in `finally`, unlink only if the file still holds our `pid` and `startedAt`.
- **Who waits**: interactive CLI, API manual push, restore → `lockWaitMs: 0` (API answers 409 with the holder). `mcctl backup push --auto` (auto-on-stop) and the scheduler (push and prune) → 10 min. Otherwise, servers stopped in sequence would skip each other's backups.
- `status` and `history` do not lock (read-only git).
- `ponytail:` two processes taking over the same stale lock within the same millisecond can both win. Accepted for a single-host tool. Upgrade path: a lease that renews the mtime.

### B3. Token passing

- The remote URL is always `https://github.com/<repo>.git` with no credentials. Every run sets `git remote set-url origin <url>`, which also scrubs tokens that `backup.sh` left in `backups/worlds/.git/config`.
- Network commands (`ls-remote`, `clone`, `fetch`, `push`) get the token through the **environment only**: `GIT_CONFIG_COUNT=1`, `GIT_CONFIG_KEY_0=http.https://github.com/.extraHeader`, `GIT_CONFIG_VALUE_0=Authorization: Basic <base64("x-access-token:" + token)>`. The key is scoped to github.com. Local commands get no token.
- Every git child also gets `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never` (no prompt can block the API), and `LC_ALL=C` (stderr matching).
- `GIT_CONFIG_COUNT` needs git ≥ 2.31. The adapter checks `git --version` once and returns `git_too_old` otherwise (B-Q3). `GIT_ASKPASS` was rejected because it needs a helper file on disk.
- `repository` must match `^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$` before any call.

### B4. Push

Scope and layout of the backup repository (existing repositories hold only `worlds/`, so they stay compatible):

```
README.md                      created on first init (as backup.sh)
worlds/<world>/…               mirror of <root>/worlds/, excluding .locks
servers/<server>/<LEVEL>/…     server-internal world, plus <LEVEL>_nether and <LEVEL>_the_end when present
```

A server has an internal world when `servers/<n>/data/<LEVEL>/level.dat` is a regular file and `data/<LEVEL>` is not a symlink. `LEVEL` comes from `servers/<n>/config.env` through `resolveWorldName` and the env codec. `_template` is skipped.

1. Check the config (`not_configured`), then acquire the lock.
2. **Prepare the cache** `<root>/backups/worlds`. No `.git`: run `ls-remote --heads <url> <branch>` (auth or 404 errors map to `auth_failed`/`repo_not_found`). If the branch exists, `clone --depth 50 --branch <b>` (as today). If not, `init` + `checkout -b <b>` + README commit + `remote add`. If `.git` exists: `remote set-url`, `fetch origin <b>`, `reset --hard origin/<b>` when the remote branch exists. Local commits that were never pushed are dropped; the tree is rebuilt from the source in the next step anyway.
3. **Flush and copy**: `running = runtime.list({ running: true })`. For each server, `console.command(name, ['save-off'])`, then `['save-all', 'flush']` (60 s timeout each; non-zero exit → `flush_failed`, no copy). Then, for `worlds/` and `servers/`, `fs.rm(cacheDir, { recursive: true, force: true })` + `fs.cp(src, cacheDir, { recursive: true, filter: skip .locks })`. **`finally`**: `save-on` for every server that was sent `save-off`, even on failure. git work happens after `save-on`, so servers resume as soon as the copy ends.
4. **Empty-source guard**: if nothing was copied while `HEAD` still tracks `worlds/` or `servers/`, return `empty_source` before `git add`. A missing mount must not commit "delete everything".
5. `add -A`. If `diff --cached --quiet` exits 0, return `{ changed: false }` (**"no changes" = success**, fixes #8). Otherwise `commit -m <message>` (default `Backup: YYYY-MM-DD HH:MM:SS`; author `Minecraft Backup <minecraft-backup@localhost>` via `GIT_AUTHOR_*`/`GIT_COMMITTER_*`), then `push origin HEAD:refs/heads/<b>` (never `--force`).
6. Timeouts: local git 2 min; `ls-remote` 30 s; clone/fetch/push 15 min. A timeout returns `timeout`.

`ponytail:` rm + cp rewrites every file, so git re-hashes the whole tree on each backup. Correct but slow on very large worlds. Upgrade path: skip files whose size and mtime are unchanged.

### B5. Restore

1. Acquire the lock (`lockWaitMs: 0`). Validate `commit` against `^[0-9a-f]{4,40}$`. `fetch` (offline is fine; the local cache is used). `rev-parse --verify <c>^{commit}` → `commit_not_found`.
2. **Refuse when any server is running** (`runtime.list({ running: true })` non-empty → `servers_running`). The check covers every server, not only those using affected worlds. A restore replaces all of `worlds/` plus the internal worlds in the commit, and the world → server map is not reliable until #670. The rule is simple and fails safe.
3. `worktree add --detach <root>/backups/.restore-staging <c>`. This is an exact tree of the commit: no files from other commits, and the cache's own `HEAD`, index and work tree stay untouched (fixes #3). Then check that staging has a non-empty `worlds/`; otherwise return `empty_source` and change nothing.
4. **Swap** (`rename`; on `EXDEV`, `cp` + `rm`):
   - Delete the previous slot `<root>/backups/restore-previous/`. Only one slot is kept, so `.bak` copies do not pile up.
   - Move every entry of `worlds/` **except `.locks`** into `restore-previous/worlds/`, then move staging `worlds/*` into `worlds/`. `.locks` is never moved or deleted.
   - For each `servers/<n>/` **present in the commit**: move that server's current `data/<LEVEL>{,_nether,_the_end}` aside and move the commit's ones in. Servers not in the commit are untouched (old `worlds/`-only commits do not wipe internal worlds). If `servers/<n>/` no longer exists, the server is reported in `skipped`.
   - If any move fails, move `restore-previous` back (best effort) and return `io_failed` with the path.
5. `finally`: `worktree remove --force` + `worktree prune`, then release the lock.
6. **Never prompts.** Confirmation is a CLI concern: `BackupUseCase.restore()` (interactive) confirms as today, and `mcctl backup restore <commit>` now confirms unless `--force`. Without the script's `read -p`, a direct CLI restore would otherwise lose its confirmation. Legacy `worlds.bak.<ts>` directories are not deleted (B-Q5).

### B6. History, status, diff, connection test

- `history`: `git log -n <limit> --format=%H%x00%aI%x00%an%x00%s%x1e`, split on NUL/RS, so `|` and `"` in messages are safe. Hashes are returned in full; callers shorten them for display. The use case maps this list. Today it parses `{history:[…]}` as an array and always gets `[]` (#12).
- `status`: read from the env codec and `git log -1 --format=%H%x00%aI` in the cache. `configured` comes from the keys, not from a process exit code (#13). No label parsing.
- `diff`: **not ported.** It has no TypeScript caller and is reachable only through `mcctl.sh backup diff`, which #734 removes (B-Q4). If it is kept, the contract is `diff(commit = 'HEAD', LockOptions): WorldBackupResult<{ status: 'A'|'M'|'D'; path: string }[]>`, computed under the lock with a temporary `GIT_INDEX_FILE`.
- `testConnection` (#10): `git ls-remote --heads https://github.com/<repo>.git` with B3's env, 30 s. Exit 0 → ok. stderr `Repository not found`/`404` → `repo_not_found`; `Authentication failed`/`401`/`403` → `auth_failed`. It runs the real `git` binary, not a `<scripts>/git` lookup through `ShellAdapter.exec`.

### B7. Retention rewrite (#9)

`prune(policy)` replaces `BackupSchedulerService.truncateHistory`/`applyRetentionPolicy`. The scheduler calls it after a successful push. A prune failure is audited but does not fail the run (as today).

1. Acquire the lock and check config.
2. `log --first-parent --format=%H%x00%aI` on the local branch. Keep the newest `maxCount` and, separately, commits with author date ≥ `now − maxAgeDays × 86 400 000 ms`. The kept set is the intersection, with at least 1 commit. If nothing would be dropped, return `{ removed: 0 }`. This fixes the `--reverse -1` "oldest" bug (it returns the newest commit). Author dates are used because the commits are rebuilt below with their original author and committer dates, so ages stay correct after a prune. Cherry-pick resets committer dates to "now".
3. **Rebuild without touching any ref, index or work tree**: oldest kept → newest, `commit-tree <c>^{tree} [-p <prev>] -m <msg>` with the original `GIT_AUTHOR_*`/`GIT_COMMITTER_*` (name, email, date). Snapshots are trees, so this cannot conflict.
4. `push --force-with-lease=refs/heads/<b>:<oldTip> origin <newTip>:refs/heads/<b>` (15 min timeout). On success, `update-ref refs/heads/<b> <newTip> <oldTip>`.
5. **Failure safety**: before step 4 succeeds, nothing visible has changed. The new commits are unreachable objects (removed by gc), the local ref is untouched, and the lease refuses to overwrite a remote that moved. If step 4 times out, the remote is either old or new, never partial. The next push runs `fetch` + `reset --hard origin/<b>` and converges either way.

### B8. Bug → design → proving test

Test files are under `platform/services/<pkg>/tests/`. "repo" means a real git with a local bare remote (`remoteBase` = `file://…`) and a temporary `<root>`.

| # | Bug | Fixed by | Test (red first) |
|---|-----|----------|------------------|
| 1 | copy without flush | B4.3 | `GitWorldBackupAdapter.flush.test.ts` (fake runtime/console, fake copy): order `save-off`×n → `save-all flush`×n → copy → `save-on`×n. `save-on` is still sent when flush fails or the copy throws; `flush_failed` → no commit |
| 2 | restore over running servers; `.locks` deleted | B5.2, B5.4 | repo: running fake → `servers_running`, tree unchanged; after a restore, `worlds/.locks/*` is byte-identical |
| 3 | mixed-commit restore | B5.3 | repo: commit A {x}, commit B {x, y}; restore A → `y` absent, `x` = A's bytes |
| 4 | restore waits on stdin | B5.6, B3 | the port has no prompt dependency; every spawned git env has `GIT_TERMINAL_PROMPT=0`; API `backup-routes.test.ts` restore resolves |
| 5 | no lock | B2 | `backup-lock.test.ts`: two adapters on one root → one gets `locked`; a child process holding the lock → `locked`; a dead pid or > 6 h → taken over; `lockWaitMs` waits and then succeeds |
| 6 | internal worlds missing | B4 layout | repo: `servers/a/data/w/level.dat` + `w_nether` → in `servers/a/w*`; restore puts them back; a `worlds/`-only commit leaves them alone |
| 7 | npm install: commit without sync | B1 (no script path) | repo: root without `scripts/` → the push commits world content; API route and scheduler tests use a fake port, and the code has no `scripts/backup.sh` lookup |
| 8 | "no changes" = failure | B4.5 | repo: second push → `{ ok: true, changed: false }`; route 200 "No changes"; scheduler `recordRun('success', 'No changes to backup')` |
| 9 | unsafe retention rewrite | B7, B2 | repo with set author dates: maxAgeDays keeps the right count; a pre-receive hook that rejects or sleeps past the timeout → local ref and remote tip unchanged; lock held → `locked` |
| 10 | connection test always fails; token in argv | B6, B3 | `GitWorldBackupAdapter.auth.test.ts`: fake `git` on `PATH` records argv and env → argv has no token, env has the header; exit/stderr mapping; `BackupUseCase.test.ts` init succeeds |
| 11 | token in the backup.sh URL | B3 | a `PATH` wrapper logs argv and then runs the real git through clone/fetch/push → no argv contains the token; cache `.git/config` has no token (legacy URL scrubbed) |
| 12 | history always empty | B6 | repo: 2 commits with `\|` and `"` in messages → 2 entries, newest first; `BackupUseCase.history` maps them |
| 13 | status labels/`configured` | B6 | `.env` without keys → `configured: false`; with keys → repository, branch `main`, `autoOnStop`, `lastBackup` from the cache |

### B9. Test plan and PR split

- **Real git, not a fake git, for behaviour**: a local bare repository proves exact trees, history, rewrite and push outcomes, which a fake would only assert. A fake `git` on `PATH` is used only where argv and env must be observed (#10, #11). CI runners and macOS ship git ≥ 2.31.
- Characterize the kept behaviour first: cache path `backups/worlds`, default branch `main`, README on first init, default message format, author identity, `.locks` excluded, `--depth 50` clone.
- **PR1 (core)**: port, adapter, lock, all shared tests above, deprecations, ADR. No call sites change, so the public API grows only.
- **PR2 (core + cli + backend; CLI and API can be parallel commits)**: `BackupUseCase` on the port; CLI `Container`, `mcctl backup push --auto` becomes non-interactive with a 10 min lock wait (today `--auto` is ignored and falls into the prompt), restore confirmation; API route (error code → 400/404/409/500) and scheduler on the port (its git and retention code deleted); `mcctl.sh` auto-on-stop runs `mcctl backup push --auto --root "$PLATFORM_DIR"` when `command -v mcctl` succeeds, else it warns.
- **PR3**: delete `backup.sh`, `mcctl.sh cmd_backup`, the unused CLI `lib/shell.ts backup()`; fix the `env-file.ts` comment and the EN/KO docs; `test:scripts` and `verify:package` pass.

### B10. Open questions

1. **B-Q1 Policy location**: lock, flush and running check sit in the adapter (B1). Alternative: an application `WorldBackupService` over a storage-only port, introduced when D2 gives the API a use-case layer. Recommendation: adapter now, revisit in D2.
2. **B-Q2 `BackupUseCase` constructor**: changing parameter 2 to `IWorldBackupPort` breaks external constructors of a published export. The only known caller is the CLI. Recommendation: accept it in v2.x and note it in the CHANGELOG. Alternative: accept both until #736.
3. **B-Q3 git ≥ 2.31**: required by `GIT_CONFIG_COUNT`. Hosts with older git get `git_too_old`. Alternative: `GIT_ASKPASS` with a 0700 helper script that echoes an env var (works on any git, but needs a file).
4. **B-Q4 `diff`**: drop it (recommended; no TypeScript caller), or port it with the B6 contract.
5. **B-Q5 Legacy `worlds.bak.<ts>`**: leave them and document manual removal (recommended), or delete them on the first TS restore.
6. **B-Q6 Flush failure**: B4.3 fails the whole push when one running server's RCON fails, for example while it is starting. The alternative is to back up and report that server as unflushed. Choose consistency (recommended) or availability.
7. **B-Q7 Auto-scale during restore**: mc-router can wake a server mid-restore. The B5.2 check runs once. Options: document "disable auto-scale or stop mc-router first" (recommended for S3), or have restore stop mc-router and restart it in `finally`.
8. **B-Q8 Stuck `save-off`**: if the process dies between `save-off` and `save-on`, autosave stays off until that server's next flushed push or a restart. Recommendation: accept and document it.
9. **B-Q9 API stop path**: `BACKUP_AUTO_ON_STOP` fires only from `mcctl.sh stop`. API and console stops never back up, before and after S3. Confirm that #734 owns this.
