# ADR-0003: ServerSpec, the Single Server Definition

| | |
|---|---|
| **Status** | Accepted with changes after system-architect review (2026-10-23); implemented in PR 1 (#754), PR 2 (#754) and PR 3 (`feature/675-provision`) |
| **Issue** | [#675](https://github.com/smallmiro/minecraft-server-manager/issues/675) (Hardening D5, milestone M4 #645), includes #715 S8 (replace `create-server.sh`) |
| **Changes** | [ADR-0001](0001-container-runtime-ports.md): `IServerSpecRepository` gains `load`/`write` (v2 methods kept), `IHostnameRegistrarPort.register`/`unregister` |
| **Builds on** | [ADR-0002](0002-world-server-assignment.md) (#670, `LEVEL` is the assignment; merged in PR #750), PR #749 (#656: env codec, `atomicWriteFile`, API create/delete queue), #651 (single template), #649 (names), #654 (runtime ports), #751 (avahi sudoers shape) |
| **Related** | #735 (S7 delete), #657 (create cleanup), #658 (progress), #736 (S9, v3.0.0), #641 (k8s), #655 (migrate worlds), #737, #726 |

## Context

- One server is defined in seven places: `config.env`, the server `docker-compose.yml` (image tag, router labels), the `servers/compose.yml` include list, `.env` (`HOST_IPS`), `.mcctl.json`, `/etc/avahi/hosts`, and lock files (gone since ADR-0002).
- More than ten code paths write them (table in [Write paths](#6-write-paths)); four edit compose YAML with regexes (B4).
- `create-server.sh` (789 lines) builds a server with `cp` + `sed`, leaves `servers/<n>` behind on failure (#657), and prints progress the API cannot parse (#658).
- The k8s adapter (#641) needs one runtime-neutral definition to render manifests from (plan §12, condition 3).

## Decision Summary

1. **`servers/<n>/server.yaml` is the definition.** `config.env`, the server `docker-compose.yml` and the include entry are **generated** from it. Platform files (`.env`, main compose, `.mcctl.json`) stay out of the spec.
2. **Small typed core + `env` pass-through.** Typed fields only for what mcctl reasons about or a renderer must translate (type, version, memory, image, world, routing). Every other `config.env` key lives in `env` unchanged, so import is lossless.
3. **Readers do not change in v2.x.** Generated files are rewritten on every save, so existing readers (`ServerRepository`, status, API config) keep reading `config.env`/compose. Only writers move.
4. **Hand edits are absorbed, not lost.** A header hash detects them. `config.env` edits and edits of spec-owned compose fields (`image`, `mc-router.*` labels) are absorbed into the spec before the next write. Any other compose difference is protected: never overwritten silently.
5. **No new port, no broken export** (#715, v2.x rule). `IServerSpecRepository` and `ServerSpec` keep their v2 shape; the full type is the new `ServerSpecDocument`, and the new behaviour comes from added methods (`load`, `write`), as #670 did for `IWorldAssignmentPort`. Rendering is an infrastructure detail of the repository adapter. `IHostnameRegistrarPort` gains `register`; `unregister` is added with delete in #735.
6. **No lock file.** Create claims the directory with `mkdir`; updates use an optimistic revision (sha256 of `server.yaml`). The in-process API queue from #749 stays.
7. **Import is lazy or explicit, never bulk.** A server without `server.yaml` is imported in memory on its first write; `mcctl migrate spec` imports on request. `mcctl upgrade` only reports which servers are not imported yet. A server that is never imported keeps working as today.
8. **Provision replaces `create-server.sh`** inside `CreateServerUseCase`, with progress events named as the API SSE already expects and all-or-nothing cleanup so a retry works.

### Resolved questions (2026-10-23)

| # | Question | Decision |
|---|----------|----------|
| 1 | Start fails after a successful create | The server stays created. CLI prints the cause and exits 1. The API answers success with `server.status: 'created'` and a `warning` (SSE `completed`), so the console does not offer a retry that would hit "already exists". |
| 2 | Hand-edited compose | Absorb spec-owned fields, protect the rest, `--force` overwrites after a `.bak`. An override file can be added later. |
| 3 | `EXTRA_ARGS` inherited from `global.env`/`.env` | Import pins the effective value into `config.env` and reports it. |
| 4 | Bulk import in `mcctl upgrade` | No. `upgrade` reports; import is lazy or via `mcctl migrate spec`. |
| 5 | Template for creates | The bundled template only (#651); the API stops reading `<root>/servers/_template`. |
| 6 | Deviations from plan §9.2 | Accepted (see §1). |
| 7 | `.mcctl.json` `avahiEnabled: false` | Ignored, as the script does. |
| 8 | Sudoers shape for `unregister` | `sudo -n sed -i <expr> /etc/avahi/hosts`, the README shape #751 restored (ADR-0001). |

## 1. Schema

```ts
// shared/src/domain/server-spec/ServerSpecDocument.ts (pure, no I/O)
// ServerSpec ({ name: string }) stays the v2 export; the document extends it.
export interface ServerSpecDocument extends ServerSpec {
  specVersion: 1;
  name: string;                      // directory name, mc-<name> container
  type: string;                      // TYPE
  version?: string;                  // VERSION; absent = itzg/modpack decides
  memory?: string;                   // MEMORY
  image: string;                     // compose image, e.g. itzg/minecraft-server:java25
  world: {
    level: string;                   // LEVEL (ADR-0002 resolveWorldName)
    storage: 'universe' | 'data';    // worlds/<level> | servers/<n>/data/<level> (D-1)
  };
  routing: {
    customHostnames: string[];       // user-added mc-router hostnames
    playitDomain?: string;           // PLAYIT_DOMAIN and a router hostname
    autoScale: { up: boolean; down: boolean };
    asleepMotd?: string;             // mc-router.auto-scale-asleep-motd
    loadingMotd?: string;            // mc-router.auto-scale-loading-motd
  };
  env: Record<string, string>;       // every other config.env key, file order kept
}
```

```yaml
specVersion: 1
name: survival
type: PAPER
version: "1.21.1"
memory: 4G
image: itzg/minecraft-server:java25
world: { level: survival, storage: universe }
routing:
  customHostnames: [mc.example.com]
  playitDomain: aa.example.com
  autoScale: { up: true, down: true }
  asleepMotd: "§e§lServer is sleeping§r\n§7Connect to wake up!"
  loadingMotd: "§a§lServer is starting...§r\n§7Please wait!"
env:
  GAMEMODE: survival
  ENABLE_RCON: "true"
  MOTD: Welcome to survival! Your adventure begins here.
  SEED: "12345"
  MODRINTH_PROJECTS: fabric-api,lithium
```

**Validation** (`validateServerSpecDocument`, pure). *Create* uses the strict value objects; *import* accepts what works today and reports what the strict rules reject (C1 #7: unknown `TYPE` and snapshot `VERSION` must not make a server disappear).

| Field | Create | Import / save of an imported spec |
|-------|--------|-----------------------------------|
| `name` | `ServerName` (DNS-1123, reserved words, #649); equals the directory | `EXISTING_SERVER_NAME_PATTERN` |
| `world.level` | `WORLD_NAME_PATTERN`, not `*_nether`/`*_the_end` (ADR-0002) | `EXISTING_WORLD_NAME_PATTERN` |
| `type`, `version`, `memory` | `ServerType`, `MC_VERSION_INPUT_PATTERN` (releases, `LATEST`, snapshots and pre-releases, the API create rule), `Memory` | env value rule |
| `routing.*Hostnames`, `playitDomain` | hostname rule (moved from `HostnameService` to domain) | same |
| `env` keys / values | `ENV_KEY_RE` / `assertEnvFileValue` (#726), and a value the `config.env` writer can write (PR 3 review) | `ENV_KEY_RE` / `assertEnvFileValue` |

- **Managed keys** cannot appear in `env`: `TYPE`, `VERSION`, `MEMORY`, `LEVEL`, `PLAYIT_DOMAIN`. `env.EXTRA_ARGS` is allowed but must not contain `--universe` (that is `world.storage`).
- **Strict file**: unknown top-level keys and non-string scalars are rejected with the path (`version: 1.21` is a float in YAML; the error says to quote it). mcctl itself writes with `js-yaml` `dump`, which quotes as needed.
- **Errors are actionable**: every `ServerSpecError` names the server, the file and the field, and the next step (`quote the value`, `run mcctl migrate spec <n> --force`, `upgrade mcctl`). Saving a bare v2 `{ name }` through `save` fails with `invalid_spec` listing the missing fields.
- **`specVersion`**: optional fields are added without a bump. A breaking change bumps it and the repository upgrades older files in memory on read (written on the next save). A higher version is refused (`unsupported_spec_version`).
- **Hand edits of `server.yaml`** are allowed. They take effect on the next mcctl write to that server or on `mcctl migrate spec <n>`; `mcctl start` does not render.
- **Secrets**: no `secretRefs` in version 1 (no per-server secret exists; RCON and tokens stay in `.env`, passed through `global.env`). A secret a user put in `config.env` (e.g. `CF_API_KEY`) lands in `env`: `server.yaml` gets `config.env`'s file mode, is collected by config snapshots like `config.env`, and is never returned by the API. #641 adds `secretRefs` as an optional field.
- **Deviations from plan §9.2** (accepted): `world.source`, `modpack` and `whitelist` are plain `env` keys (`SEED`/`WORLD`, `MODRINTH_*`/`CF_*`, `ENABLE_WHITELIST`/`WHITELIST`); `image` replaces `imageTag` (lossless for custom images); `stopGraceSec` and `resources` wait for A2/C3; an optimistic revision replaces the per-server lock.

## 2. Repository, Storage and Concurrency

```ts
// IServerSpecRepository: v2 methods unchanged, #675 adds load/write (full text in ADR-0001)
list(): Promise<ServerSpec[]>;                       // { name } per server dir with server.yaml or config.env
/** @deprecated Use load(). Removed in v3.0.0 (#736). */
get(name: string): Promise<ServerSpec | null>;       // the document, typed as the v2 ServerSpec
save(spec: ServerSpec): Promise<void>;               // = write(spec) after validating it is a document
delete(name: string): Promise<void>;                 // #735
load(name: string): Promise<LoadedServerSpec | null>;               // { document, revision, warnings }
write(doc: ServerSpecDocument, options?: WriteServerSpecOptions): Promise<void>; // { expectedRevision?, create?, force?, allowStorageChange? }
```

- **File**: `servers/<n>/server.yaml`, fixed key order, written with `atomicWriteFile` (#749).
- **Create**: `mkdir servers/<n>` (not recursive) is the claim; `EEXIST` → `already_exists`. Works across CLI and API processes.
- **Update**: `load` returns `revision` = sha256 of the bytes it read. `write` compares it when it starts and again right before its first write, after every awaited check (host addresses, import, world snapshot); the generated files it planned against are re-read at the same point. A mismatch is `conflict` and nothing is written. `updateServerSpec(repo, name, mutate)` (application helper) retries once with a fresh `load`. `ponytail:` the remaining window is the temp-file write and fsync of `atomicWriteFile` (milliseconds); add a per-server lock only if lost updates are ever observed.
- **World guard (R1, R7)**: when the rendered `LEVEL` or storage differs from the current `config.env`, `write` runs ADR-0002's pure `checkProposed` on a snapshot with the rendered `config.env`. It uses the same snapshot reader as `IWorldAssignmentPort.preview` directly, not the port, because the assignment adapter itself writes through this repository. A storage change is refused (`storage_change`) unless `allowStorageChange` is set, which only `mcctl migrate worlds` does. The same write also refuses a server that is not stopped (`checkServerStopped` with the runtime the adapter is built with; no runtime or an unreadable state is undetermined), so a hand edit of `world.level` rendered by `mcctl migrate spec` cannot bypass ADR-0002 decision 5. Use cases keep their own stop checks.
- **Write order**: `server.yaml` first, then the generated files. A crash in between leaves generated files with a valid hash but an old `spec=` (§3), which the next write or `mcctl migrate spec` re-renders, completing the interrupted write.

## 3. Rendering

**Seam** (infrastructure, not a port):

```ts
// shared/src/infrastructure/adapters/server-spec/ServerSpecRenderer.ts
export interface RenderContext {
  root: string; templatesDir: string; hostIps: string[];
  read(path: string): string | undefined;   // current file content
}
export interface RenderedFile { path: string; content: string; guarded: boolean }
export interface ServerSpecRenderer {
  render(doc: ServerSpecDocument, ctx: RenderContext): RenderedFile[];
}
```

`FileServerSpecRepository` (the `IServerSpecRepository` adapter) takes a renderer in its constructor. Application code never calls a renderer, so it is not a port. `DockerComposeRenderer` is implemented now. `KubernetesManifestRenderer` (StatefulSet, Service, PVC from `world.storage`) is only this interface until #641, which adds the renderer plus whatever storing the spec and applying manifests need in a k8s repository adapter; ADR-0001's `apply(spec)` is not needed. What removal renders (include entry) is decided in #735.

**Docker outputs**

| File | How | Guarded |
|------|-----|---------|
| `config.env` | `applyEnvChanges(current ?? bundled _template/config.env, diff, { raw: true })`: set keys whose value differs, remove keys the spec lacks. Untouched lines (comments, quoted values) stay byte-identical. | yes |
| `docker-compose.yml` | Bundled `_template/docker-compose.yml` loaded with `js-yaml`; service key and `container_name` → `mc-<n>`, `image`, router labels set; `dump`. | yes |
| `servers/compose.yml` | `js-yaml` load, add `<n>/docker-compose.yml` if no entry equals it, keep all other entries (long form `- path:` too), dump with a static header. The whole read-merge-write runs under `servers/.compose.yml.lock` (`acquireFileLock`, shared with the backup lock: link-based, a holder that provably died on this host is taken over, about 10 s wait, then `locked`), because CLI and API processes add servers to the same file. Inside the lock the file is read fresh, written, read back and checked for every entry it had plus the new one; retry once on mismatch. A file that fails to load is never overwritten: the write stops with an error before anything is written. | no (merge) |
| `data/`, `logs/`, `servers/global.env` | `mkdir -p`; copy `global.env` from the template if missing (as the script does). | — |

- **Env projection**: `TYPE`, `VERSION` (omitted when absent, `VERSION=` when `''`), `MEMORY`, `LEVEL`, `PLAYIT_DOMAIN`, `EXTRA_ARGS`, then `env`. `EXTRA_ARGS` = `--universe /worlds/` plus `env.EXTRA_ARGS` for `universe`; `env.EXTRA_ARGS ?? ''` for `data` (an empty value still overrides `global.env`, ADR-0002).
- **Router hosts**: `<n>.local`, `<n>.<ip>.nip.io` for each `hostIps`, `playitDomain`, `customHostnames` (deduplicated, in this order). This one generator replaces `build_hostnames`, `init.ts` `buildHostnames`/`mergeHostnames`, and the system part of `HostnameService` (B4).
- **Host IPs** (`resolveHostIps`, shared infrastructure, the script's order): `.env` `HOST_IPS`, else `HOST_IP` (comma list), read with the env codec; else the `src` address of `ip route get 1`; else the first address of `hostname -I`; else (macOS) the first non-internal IPv4 from `os.networkInterfaces()`. Addresses on `docker0`, `br-*`, `veth*` are skipped in every probe. Avahi gets the first address.
- **Header** (first line of guarded files):
  `# Generated by mcctl from server.yaml; edits are detected (ADR-0003). mcctl:sha256=<64 hex> spec=<12 hex>`
  `sha256` hashes the rest of the file; `spec` is the prefix of the `server.yaml` revision it was rendered from. No other state file.
- **Idempotent**: rendering twice gives the same bytes; an unchanged spec means no writes (no mtime churn, no needless container recreation).
- **Who does what** (PR 2): the renderer returns file bodies and reads bodies through `ctx.read`; the repository adds and checks the header, so the renderer never sees it. Every check (revision, storage, edit detection, an unreadable `servers/compose.yml`) runs before the first write. A write that fails part way puts back every file it already changed (a new file is removed) before the error is thrown, but only while the file still holds what it wrote: a file another writer changed meanwhile (e.g. during the include lock wait) is left and named. `server.yaml`, the definition, is put back only when every generated file was; otherwise it keeps the new spec, so what is left is all earlier content or the new spec with some new generated files, and `mcctl migrate spec` renders the new spec again. The files it could not put back are on the error (`unrestoredFiles(error)`); `mcctl migrate worlds` then places the world where the spec `mcctl migrate spec` would render (`load()`) puts it (new: it stays in `worlds/`; earlier: moved back; otherwise left, with what to check) and says to run `mcctl migrate spec` before the next start (PR 3 review). `FileServerSpecRepository.loadFile(name)` (adapter only, not the port) reads `server.yaml` without absorbing; `mcctl migrate spec --force` uses it to re-render from `server.yaml`. With `server.yaml` present, compose `environment` entries are not spec-owned: they count as edits outside the spec (import still moves them, §4).

**Edit detection** (on `load`):

| `config.env` | Meaning | Action |
|--------------|---------|--------|
| hash ok, `spec=` current | in sync | — |
| hash ok, `spec=` old | `server.yaml` edited by hand, or an interrupted write | next write renders it |
| hash bad or no header, `spec=` current or none | `config.env` edited (or never rendered) | absorb into the spec (as import, step 1) |
| hash bad, `spec=` old | both edited | `edit_conflict`; `mcctl migrate spec <n> --force` re-renders from `server.yaml` after writing `config.env.bak` |

| `docker-compose.yml` | Action |
|----------------------|--------|
| hash ok | overwrite freely (also picks up template changes from a newer mcctl) |
| hash bad or no header | 1. absorb spec-owned fields (`image`, `mc-router.*` labels) into the spec, as import step 4; 2. normalize known legacy variants (env_file `../../.env` #685, missing loading-MOTD label); 3. compare the rest semantically with `render(spec)`. Equal → overwrite. Different → protected: a write that would change the rendered compose fails with `compose_edited` and the differing YAML paths, other writes leave the file untouched, `--force` overwrites after `docker-compose.yml.bak`. |

## 4. Import of Existing Installs

`importDockerServer(name, ctx)` (infrastructure, next to the renderer):

1. **`config.env`** via `parseEnvDocument`: `TYPE`, `VERSION`, `MEMORY`, `PLAYIT_DOMAIN` → typed fields; an empty `VERSION`, `MEMORY` or `PLAYIT_DOMAIN` stays `''`, so the rendered `KEY=` keeps overriding `global.env` (PR 3 review). `world.level` = `resolveWorldName(env)` (`LEVEL`, else legacy `WORLD_NAME`, else `world`; `WORLD_NAME` stays in `env`). Every other key → `env` in file order (unknown keys preserved).
2. **Storage** from the *effective* `EXTRA_ARGS`, with ADR-0002's resolution reused (config.env wins even when empty, else `global.env`, whose bare key takes the `.env` value): `--universe /worlds[/]` → `universe`; no `--universe`, `/data` or `.` → `data`. The `--universe` token is stripped and the rest goes to `env.EXTRA_ARGS` (pinned, reported when it came from `global.env`). The directories are only cross-checked (warning when `worlds/<level>` is missing but `servers/<n>/data/<level>` exists).
3. **Fail-closed** (R7 style): an interpolated managed value (`${...}` unquoted or double-quoted) or another `--universe` location is `undetermined`: the import is refused for that server, it keeps running, and writes to it fail with the reason until the file is fixed.
4. **Compose**: one service `mc-<n>` expected. `image` and router labels → `routing`; hostnames are classified as system (`<n>.local`, `<n>.<IPv4>.nip.io`, the playit domain) or custom. `environment` entries other than `EULA` move to `env`; Compose gives `environment` precedence over `env_file`, so on a key clash the compose value wins and the clash is reported. `${...}` in a spec-owned field or a moved `environment` entry → `undetermined`; elsewhere → protected. `$$` is Compose's literal `$` and is read as `$`; the renderer writes every `$` it puts in the compose as `$$`, and the `config.env` writer single-quotes a value with `$`, refusing one that ends with `\` (Compose reads `\'` as an escaped quote; PR 3 review). The semantic comparison of §3 runs on the compose with the moved and absorbed items removed.
5. **Report** per server (`imported` | `refused`; a protected compose is a warning) with warnings: pinned `EXTRA_ARGS`, `environment` clashes, stale nip.io hosts re-derived from the current `HOST_IPS`, values the strict create rules would reject.

**When it runs**

- **Lazy**: `load` imports in memory when `server.yaml` is missing; the first write saves it. Reads never write.
- **`mcctl migrate spec [<name>|--all] [--dry-run] [--force]`**: import or absorb, render, print the report. Idempotent. Same command family as `migrate worlds`.
- **`mcctl upgrade`**: prints which servers have no `server.yaml` yet (and the `migrate spec --dry-run` findings); it writes nothing.
- **Never imported (v2.x)**: works exactly as today, because readers still read the files. A server directory copied in by hand is adopted on its first write.

## 5. Provision (replaces `create-server.sh`)

`CreateServerUseCase` gains one optional trailing constructor parameter `provision?: ServerProvisionDeps` (`{ specRepo, hostnames?, runtime?, hostIps? }`, after #670's `assignments?`; one object keeps the constructor change small next to #665) and `executeWithConfig(config, options?: CreateServerRunOptions)` (`{ onProgress?, onLog? }`). Without it, since the script is deleted, that path and `ShellAdapter.createServer` fail with a clear error instead of ENOENT: `create-server.sh was removed in #675; pass specRepo / use ServerSpec provision`. Both `execute` (interactive) and `executeWithConfig` use the same flow; the API route calls the use case instead of spawning the script.

| # | `create-server.sh` | TS provision | Progress |
|---|--------------------|--------------|----------|
| 0 | parse flags, validate names, world exclusivity, env values, modpack slug | `buildCreateSpec(input)` (pure; the repository adds the bundled template's other `config.env` keys under the document's values on `create`, so the use case needs no template) + validation (`parseCreateServerConfig`, pure: an input the value objects refuse, or a spec the create rules refuse, such as a seed `config.env` cannot hold, is `invalid_spec`; the API runs it before it opens the SSE stream, so JSON and SSE both answer 400); #670 `checkAssign(..., { newServer: true })` (reads the assignment snapshot). No writes before this passes. | `initializing` (API) |
| 1–4 | `cp -RL _template`, `sed` compose and `config.env`, add include, `docker compose config --quiet`, restore `.bak` on failure | one call, `specRepo.write(doc, { create: true })`: `mkdir` claim, `server.yaml`, render, include entry (read back, §3). `docker compose config` is dropped: the files are generated by `js-yaml`, and `start` reports a broken project. | `creating` |
| 5 | avahi `<n>.local` → first IP, best effort | `hostnames.register('<n>.local', hostIps[0])`; a skip is a warning | `configuring` |
| 6 | `docker compose up -d mc-<n>` unless `--no-start`, `sleep 2`, `ps` | `runtime.start('mc-<n>')` unless `autoStart === false`; no sleep | `starting` |

- **Events**: `onProgress(stage, message)` uses the statuses the API `server-create` SSE event and the console `CreateServerStatus` already define (`creating`, `configuring`, `starting`); `onLog(line)` becomes `server-create-log`. The API sends `initializing` first and `completed`/`error` from the result, never from stderr text (#658: a server named `error-test` succeeds). A client disconnect stops events, not provisioning (today it kills the script mid-way).
- **Start failure** (decision 1): CLI exit 1 with the cause and `mcctl start <n>`; API `201`/SSE `completed` with `server.status: 'created'` and `warning`. PR 3 checks how the console's `CreateServerStatus` handling shows that warning (a warning dialog). JSON `POST /api/servers` (no `follow`) waits for the container start at most `createTimeoutMs` (120 s) once the files are written; past that it gives the same answer with a warning that the start goes on in the background, and the create/delete queue moves on with the reply. SSE and the CLI keep the 30-minute start limit.
- **Cleanup (#657)**: `write({ create: true })` is all-or-nothing. On any failure after the claim it removes the include entry it added and the directory it created, then rethrows, so the same create can be retried at once. It never touches `worlds/` (itzg creates the world on first start). Hostname registration is best effort as today. A process killed mid-create can leave `servers/<n>`; `mcctl delete <n>` removes it (`ponytail:` no marker file).
- **Avahi adapter** runs the commands the `README.md` sudoers lines allow, as argv without a shell: `sudo -n tee -a /etc/avahi/hosts` (stdin `<ip> <host>`), then `sudo -n systemctl restart avahi-daemon`. The sudo password is an adapter option, not an environment variable: the CLI passes `--sudo-password`, `MCCTL_SUDO_PASSWORD`, or what `promptSudoPasswordIfNeeded` asked for (mcctl prompts, not sudo); the API passes the request's `sudoPassword`. With a password, `sudo -S -p '' -v` reads it on stdin first and the command never sees it (#682). Without one, `sudo -n` relies on NOPASSWD or cached credentials and a failure becomes a warning. Exact-match check (#660), IPv4 check, avahi presence via `getStatus`.

**Option parity** (every flag the CLI and API pass today)

| Script | CLI / API | ServerSpec |
|--------|-----------|------------|
| `<name>` | name | `name` |
| `-t` (default `PAPER`); bare `PAPER` positional | `--type` / `type` | `type`; the positional form is dropped (no caller) |
| `-v` | `--version` / `version` | `version`; modpack type without version → no `VERSION` (a given `LATEST` is written), otherwise the template default |
| `-m` | `--memory` / `memory` | `memory` (closes #737 if still open) |
| `-s`, `-u` (exclusive with `-w`) | `--seed`, `--world-url` / `seed`, `worldUrl` | `env.SEED`, `env.WORLD` |
| `-w` | `--world` / `worldName` | `world.level`; missing world: warning (CLI), 400 (API), as today |
| `--modpack` | same / `modpack` | `MODRINTH`: `env.MODRINTH_MODPACK`; `AUTO_CURSEFORGE`: `env.CF_SLUG` |
| `--modpack-version` | same / `modpackVersion` | `env.MODRINTH_VERSION` / `env.CF_VERSION` |
| `--mod-loader` | same / `modLoader` | `env.MODRINTH_LOADER` / `env.CF_LOADER` |
| `--exclude-files` | same / `excludeFiles` | `env.MODRINTH_EXCLUDE_FILES` / `env.CF_EXCLUDE_MODS` |
| `--whitelist P`, `--enable-whitelist`, `--no-whitelist` (wins) | CLI only | `env.ENABLE_WHITELIST=TRUE` (+ `WHITELIST`); template whitelist lines dropped |
| `--playit-domain D` | CLI only | `routing.playitDomain`. **Intended difference**: the script added `D` to the router hosts only when a host IP was found; TS always adds it. |
| `--no-playit-domain` | CLI only | no-op (the script ignores it too) |
| `--start` | — | no-op (default) |
| `--no-start` | `--no-start` / `autoStart: false` | skip `start` |
| `MCCTL_SUDO_PASSWORD` | `--sudo-password` / `sudoPassword` | avahi adapter option |
| defaults `MOTD=Welcome to <n>!…`, `LEVEL=<n>` | — | `env.MOTD`, `world.level` |

**bats → vitest**: `get_host_ip` ×4 → `resolveHostIps`; `register_avahi_hostname` ×5 → avahi adapter with fake `sudo`/`avahi-daemon` on `PATH` (as `docker-shell-injection.test.ts`); create writes dir/config/include, seed/modpack-version rejection, text seed → provision tests on a temp root (plus "retry after failure succeeds"); "aborts when compose config fails" → "aborts and writes nothing when `servers/compose.yml` fails to load"; symlinked `_template` → "the renderer never writes `templatesDir`"; whitelist ×3 → render tests with the bundled template and a legacy one with `ENABLE_WHITELIST=TRUE`. `sudo-password.bats` stays until #735 (delete still uses `common.sh`).

## 6. Write Paths

All in PR 3. Every writer goes through `updateServerSpec(repo, name, mutate)`. `setEnvKey(doc, key, value)` maps managed keys to typed fields, so the generic config writers need no key list.

| Writer today | Writes | PR 3 |
|--------------|--------|------|
| CLI `config`, `whitelist`, `op` (`ShellExecutor.writeConfigValue`) | any `config.env` key | `setEnvKey` (`LEVEL`/`WORLD_NAME` keep #670's assign path) |
| API PATCH config (`ConfigService`), `PlayerFileService.writeConfigEnv`, `ModConfigService`; CLI `mod` | `config.env` keys | `setEnvKey` |
| `setServerPlayitDomain` (CLI and API playit) | `PLAYIT_DOMAIN` + host label | `routing.playitDomain`; body delegates, `@deprecated` |
| API `HostnameService.update` | host label (regex) | `routing.customHostnames` |
| CLI `init --reconfigure` (new `HOST_IP`) | every host label (regex) | re-render every server, no spec change |
| CLI `update` | image tag, loading-MOTD label | `doc.image`; the label comes from the template |
| CLI upgrade `server-env-migration` | `env_file` repoint | **kept until #736**: servers that were never imported still need it (decision 4) |
| `ConfigEnvWorldAssignmentAdapter.assign/release` (#670) | `LEVEL` | `world.level` through the repository |
| `WorldManagementUseCase` → `shell.setServerConfig` (`SEED`, `LEVEL`); since #734 `assign(world, server, { seed })` | `config.env` | `env.SEED` in the same write as `world.level` (row above) |
| `mcctl migrate worlds` (#655) | `EXTRA_ARGS`, `LEVEL` | `world.storage = 'universe'` with `allowStorageChange` |
| config snapshot restore | `config.env`, compose | restore `server.yaml` and render when the snapshot has it (add it to `KNOWN_CONFIG_FILES`); older snapshots: write the files, then absorb |
| `create-server.sh` / `delete-server.sh` | everything | provision (§5) / #735 via `repo.delete` |

Out of scope: platform files (main compose and its playit service, `.env`, `ecosystem.config.js`, `.mcctl.json`).

**One source of truth with #670.** `server.yaml` is the only thing writers change; `LEVEL` in `config.env` is its projection. ADR-0002's adapter keeps *reading* `config.env`, which is right: it is exactly what the container uses, including a hand edit not yet absorbed. Its *writes* go through the repository, so `assign`/`release` never write `config.env` directly. The pure rules in `worldAssignment.ts` do not change, and `world.storage === 'data'` is ADR-0002's `internal: true`.

## 7. Stages

| PR | Content | Behaviour change |
|----|---------|------------------|
| 1 schema + import | `ServerSpecDocument`, validation; `IServerSpecRepository.load`/`write` on `server.yaml` only (revision check, no rendering yet) and the v2 `list`/`get`/`save`; the importer, which reads world storage through the same `effectiveExtraArgs.ts` rules as the #670 assignment adapter; `mcctl migrate spec` (dry run, or write `server.yaml` only) | none: only `migrate spec` writes, and nothing reads `server.yaml` yet |
| 2 renderer + write | `ServerSpecRenderer`, `DockerComposeRenderer`, header and edit detection, `write` renders (`force` with `.bak`, storage guard, the R1/R7 world guard with the stopped check, include read-back), `mcctl migrate spec` renders | only `migrate spec` writes |
| 3 write paths (#715 S8) | golden outputs of today's `create-server.sh` for each option combination (captured in its bats harness before it is deleted) as the parity oracle; `buildCreateSpec`; `write({ create: true })` (claim, rollback, `data/`, `logs/`, `global.env`); the `mcctl upgrade` report; `IHostnameRegistrarPort.register` + avahi adapter; provision; CLI and API create (SSE events, start-failure warning, console check); every writer in §6; delete `create-server.sh` and its 3 bats files; `@deprecated` on `IShellPort.createServer`, `ShellAdapter.createServer`, `Server.toCliArgs`, `WorldOptions.toCliArgs`, `setServerPlayitDomain`, `replaceRouterHosts`, `IServerSpecRepository.get`; the shell create path fails with the clear "removed in #675" error; a test that fails when code outside the repository adapter writes `config.env` or a server compose (allow-list: `server-env-migration`); docs EN/KO; `test:scripts` and `verify:package` pass. May split into 3a (create) and 3b (other writers). | yes |

All eight acceptance criteria of #675 are met by PR 3, so **#675 closes after PR 3**. The former stage 4 ("end of old-format support") is folded into PR 3 as the write guard test and the docs: from PR 3 on, no code path writes the old way except `server-env-migration`. Servers without `server.yaml` stay supported through lazy import (also how a hand-copied server is adopted). **Deferred to #736 (v3.0.0)**: removing the `@deprecated` exports above, `IShellPort`/`ShellAdapter`, and `server-env-migration`. No ServerSpec behaviour changes in v3.0.0.

Order: PR 1–2 after #749 (#656) merges; PR 3 after #670 (merged in PR #750); #735 follows PR 3. A server whose `server.yaml` was written by PR 1's `migrate spec` and whose `config.env` was later changed by a v2 writer has no header, so PR 2 absorbs the `config.env` change on the next load (§3).

**PR 3 notes** (as built):

- The rendered server compose quotes every string, because the v2 label readers (`parseRouterHosts`, `HostnameService`) match `mc-router.host: "..."`.
- Every writer of §6 goes through `updateServerSpec`/`setEnvKeys` except: `setServerPlayitDomain` (deprecated v2 export, no longer called by mcctl), `server-env-migration` (until #736) and config snapshot restore, which writes a consistent set: snapshots and `mcctl server-backup` now include `server.yaml`, and a pre-#675 set without it is absorbed on the next load. The write-guard test lists each exception with its reason.
- `ConfigEnvWorldAssignmentAdapter` takes the repository in its constructor; without one that has a runtime, a `LEVEL` change is refused (R7). A new world's `SEED` goes in the same write: `WorldManagementUseCase` passes it to `assign` (#734).
- The CLI and API build their repositories through small factories (`serverSpecRepositories`, `serverProvision`) that tests replace; no test runs docker, sudo or the real platform root.
- Provisioning starts the server with a 30-minute `docker compose up` timeout (`DockerComposeRuntimeAdapter` `startTimeoutMs`): the first start can pull the image, and the script had no timeout.
- A modpack type without a version writes no `VERSION` (the CLI used to pass `LATEST`); an explicit `LATEST` is written. Snapshot and pre-release versions the API accepts are written as given.

## 8. Tests (TDD, failing test first in each PR)

- **v2 compatibility**: a type test written against the v2 contract still compiles (`const s: ServerSpec = { name: 'a' }`; `repo.list()`, `repo.get(n)`, `repo.save(s)`, `repo.delete(n)` with v2 types) and the package root still exports `ServerSpec` and `IServerSpecRepository`; `save({ name })` fails with `invalid_spec` naming the missing fields.
- **Domain**: validation tables (create vs import rules, managed keys in `env`, `--universe` in `env.EXTRA_ARGS`, non-string scalars, `specVersion`), `buildCreateSpec` for every row of the parity table, host generator.
- **Import** on temp roots: template-created server, legacy template variants, quoted/commented/duplicate keys, `WORLD_NAME`, `global.env`/`.env` inheritance and every `--universe` form (shared fixtures with ADR-0002), interpolation → refused, compose `environment` → `env` with a clash report, `${...}` in compose, hand-edited compose image/labels absorbed, other compose edits protected; report text.
- **Render**: idempotent bytes, unchanged spec means no writes, comment preservation, header hash, both edit-detection tables, include add/remove by exact name with long-form entries kept, read-back retry, unloadable `servers/compose.yml` left untouched, `atomicWriteFile` failure leaves old files.
- **Repository**: revision conflict + one retry, create claim against an existing directory, rollback on render/include failure followed by a successful retry, world guard (`conflict` from `checkProposed`, `storage_change` without the option).
- **Host IPs**: `.env` precedence and trimming; `ip route get 1` → `hostname -I` → interfaces order with fake binaries; `docker0`/`br-*` skipped.
- **Provision and API**: golden parity (parsed `config.env` and compose equal to the PR 3 fixtures except the header, explicit `LEVEL`, `EXTRA_ARGS` and the playit host); event order; `--no-start`; SSE `creating → configuring → starting → completed`, start failure → `completed` + `status: 'created'` + `warning`, `error` with the cause, name containing `error`; avahi argv exactly as the sudoers lines, password only on `-S -v`, never in the child environment.
- **Removed script**: `CreateServerUseCase` built without `specRepo` and `ShellAdapter.createServer` reject with the "create-server.sh was removed in #675" message, not ENOENT.
- **Writers**: one test per row of §6 through the spec; #670's assignment tests keep passing with the repository-backed writes.

## Consequences

- **+** One definition per server; compose files become output, so the k8s work (#641) adds a renderer instead of editing call sites.
- **+** Host generation, env writing and YAML editing each have one implementation; no regex edits YAML.
- **+** Create cleans up after itself, reports real progress, and works without bash.
- **+** v2 consumers of `IServerSpecRepository`/`ServerSpec` keep compiling.
- **−** Comments are lost in rendered compose files (header explains) and in `servers/compose.yml`.
- **−** A compose edit outside the spec-owned fields blocks compose-changing writes for that server until the user reverts it or forces a re-render.
- **−** Two derived states (header hash, revision) must stay correct; the edit-detection tables are the test contract.
- **−** Until v3.0.0 the repository carries the v2 `get`/`save` alongside `load`/`write`.
