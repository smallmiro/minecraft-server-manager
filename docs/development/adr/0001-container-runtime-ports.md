# ADR-0001: Container Runtime Ports and the Docker Adapter

| | |
|---|---|
| **Status** | Proposed (2026-10-23) |
| **Issue** | [#654](https://github.com/smallmiro/minecraft-server-manager/issues/654) (Hardening D1), milestone M2 (#643), epic #640 |
| **Follow-ups that change this ADR** | #665 (D4), #669 (A7), C2, #675 (D5), #641 (k8s adapter) |
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
| 8 | api `routes/servers.ts:61,858` (create and delete routes), `routes/backup.ts`, `services/backup-scheduler.ts` | `create-server.sh`, `delete-server.sh`, `backup.sh`, `git` | not a runtime port; move under `mcctl-api/src/infrastructure/` | D2 (or A3b/#715) | needed before the rule becomes an error |
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
| `backup.sh` | git backup of worlds | flush via `command(['save-all'])`, or `stop` | git storage is a backup adapter, not runtime |
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
