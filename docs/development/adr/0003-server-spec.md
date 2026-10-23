# ADR-0003: ServerSpec, the Single Server Definition

| | |
|---|---|
| **Status** | Proposed (2026-10-23) |
| **Issue** | [#675](https://github.com/smallmiro/minecraft-server-manager/issues/675) (Hardening D5, milestone M4 #645), includes #715 S8 (replace `create-server.sh`) |
| **Changes** | [ADR-0001](0001-container-runtime-ports.md): `IServerSpecRepository` final shape, `IHostnameRegistrarPort.register`/`unregister` |
| **Builds on** | [ADR-0002](0002-world-server-assignment.md) (#670, `LEVEL` is the assignment; on `feature/670-world-server-assignment` until merged), PR #749 (#656: env codec, `atomicWriteFile`, API create/delete queue), #651 (single template), #649 (names), #654 (runtime ports) |
| **Related** | #735 (S7 delete), #657 (create cleanup), #658 (progress), #736 (S9, v3.0.0), #641 (k8s), #655 (migrate worlds), #737, #726 |

## Context

- One server is defined in seven places: `config.env`, the server `docker-compose.yml` (image tag, router labels), the `servers/compose.yml` include list, `.env` (`HOST_IPS`), `.mcctl.json`, `/etc/avahi/hosts`, and lock files (gone since ADR-0002).
- More than ten code paths write them (table in [Write paths](#6-write-paths-stage-3)); four edit compose YAML with regexes (B4).
- `create-server.sh` (789 lines) builds a server with `cp` + `sed`, leaves `servers/<n>` behind on failure (#657), and prints progress the API cannot parse (#658).
- The k8s adapter (#641) needs one runtime-neutral definition to render manifests from (plan §12, condition 3).

## Decision Summary

1. **`servers/<n>/server.yaml` is the definition.** `config.env`, the server `docker-compose.yml` and the include entry are **generated** from it. Platform files (`.env`, main compose, `.mcctl.json`) stay out of the spec.
2. **Small typed core + `env` pass-through.** Typed fields only for what mcctl reasons about or a renderer must translate (type, version, memory, image, world, routing). Every other `config.env` key lives in `env` unchanged, so import is lossless.
3. **Readers do not change in v2.x.** Generated files are always rewritten on save, so existing readers (`ServerRepository`, status, API config) keep reading `config.env`/compose. Only writers move.
4. **`config.env` stays hand-editable.** A hand edit is detected (header hash) and absorbed into the spec before the next write. Hand edits of compose are protected: never overwritten silently.
5. **No new port** (#715). `IServerSpecRepository` (ADR-0001, reserved) becomes real; rendering is an infrastructure detail of its adapter. `IHostnameRegistrarPort` gains `register` (+ `unregister` for #735).
6. **No lock file.** Create claims the directory with `mkdir`; updates use an optimistic revision (sha256 of `server.yaml`). The in-process API queue from #749 stays.
7. **Import is lazy and idempotent.** A server without `server.yaml` is imported in memory on first write; `mcctl migrate spec` imports explicitly; `mcctl upgrade` imports all (stage 4). A server that is never imported keeps working as today.
8. **Provision replaces `create-server.sh`** inside `CreateServerUseCase`, with progress events named as the API SSE already expects and all-or-nothing cleanup so a retry works.

## 1. Schema

```ts
// shared/src/domain/server-spec/ServerSpec.ts (pure, no I/O)
export interface ServerSpec {
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

**Validation** (`validateServerSpec`, pure). *Create* uses the strict value objects; *import* accepts what works today and reports what the strict rules reject (C1 #7: unknown `TYPE` and snapshot `VERSION` must not make a server disappear).

| Field | Create | Import / save of an imported spec |
|-------|--------|-----------------------------------|
| `name` | `ServerName` (DNS-1123, reserved words, #649); equals the directory | `EXISTING_SERVER_NAME_PATTERN` |
| `world.level` | `WORLD_NAME_PATTERN`, not `*_nether`/`*_the_end` (ADR-0002) | `EXISTING_WORLD_NAME_PATTERN` |
| `type`, `version`, `memory` | `ServerType`, `McVersion`, `Memory` | env value rule |
| `routing.*Hostnames`, `playitDomain` | hostname rule (moved from `HostnameService` to domain) | same |
| `env` keys / values | `ENV_KEY_RE` / `assertEnvFileValue` (#726) | same |

- **Managed keys** cannot appear in `env`: `TYPE`, `VERSION`, `MEMORY`, `LEVEL`, `PLAYIT_DOMAIN`. `env.EXTRA_ARGS` is allowed but must not contain `--universe` (that is `world.storage`).
- **Strict file**: unknown top-level keys and non-string scalars are rejected with the path (`version: 1.21` is a float in YAML; the error says to quote it). mcctl itself writes with `js-yaml` `dump`, which quotes as needed.
- **`specVersion`**: optional fields are added without a bump. A breaking change bumps it and the repository upgrades older files in memory on read (written on the next save). A file with a higher version is refused (`unsupported_spec_version`: upgrade mcctl).
- **Secrets**: no `secretRefs` in version 1 (no per-server secret exists; RCON and tokens stay in `.env`, passed through `global.env`). A secret a user put in `config.env` (e.g. `CF_API_KEY`) lands in `env`: `server.yaml` gets `config.env`'s file mode, is collected by config snapshots like `config.env`, and is never returned by the API. #641 adds `secretRefs` as an optional field.
- **Deviations from plan §9.2** (see open question 6): `world.source`, `modpack` and `whitelist` are plain `env` keys (`SEED`/`WORLD`, `MODRINTH_*`/`CF_*`, `ENABLE_WHITELIST`/`WHITELIST`); `image` replaces `imageTag` (lossless for custom images); `stopGraceSec` and `resources` wait for A2/C3.

## 2. Storage and Concurrency

- **File**: `servers/<n>/server.yaml`, fixed key order, written with `atomicWriteFile` (#749).
- **Create**: `mkdir servers/<n>` (not recursive) is the claim; `EEXIST` → `already_exists`. Works across CLI and API processes.
- **Update**: `get` returns `revision` = sha256 of the bytes it read. `save` re-reads and compares just before the rename; a mismatch is `conflict`. `updateServerSpec(repo, name, mutate)` (application helper) retries once with a fresh `get`. `ponytail:` compare-then-rename leaves a microsecond window; add a `mkdir` lock only if lost updates are ever observed.
- **Write order on save**: `server.yaml` first, then the generated files. A crash in between leaves generated files with a valid hash but an old `spec=` (§3), which the next save or `mcctl migrate spec` re-renders, completing the interrupted save.

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
  render(spec: ServerSpec, ctx: RenderContext): RenderedFile[];
  renderRemoval(name: string, ctx: RenderContext): RenderedFile[];   // #735
}
```

`FileServerSpecRepository` (the `IServerSpecRepository` adapter) takes a renderer in its constructor. Application code never calls a renderer, so it is not a port: switching runtime means constructing the repository with another renderer in the composition root. `DockerComposeRenderer` is implemented now. `KubernetesManifestRenderer` (StatefulSet, Service, PVC from `world.storage`) is only this interface until #641; for k8s, `save` renders and applies, so ADR-0001's `apply(spec)` is not needed.

**Docker outputs**

| File | How | Guarded |
|------|-----|---------|
| `config.env` | `applyEnvChanges(current ?? bundled _template/config.env, diff, { raw: true })`: set keys whose value differs, remove keys the spec lacks. Untouched lines (comments, quoted values) stay byte-identical. | yes |
| `docker-compose.yml` | Bundled `_template/docker-compose.yml` loaded with `js-yaml`; service key and `container_name` → `mc-<n>`, `image`, router labels set; `dump`. | yes |
| `servers/compose.yml` | `js-yaml` load, add `<n>/docker-compose.yml` if no entry equals it, keep all other entries (long form `- path:` too), dump with a static header. | no (merge) |
| `data/`, `logs/`, `servers/global.env` | `mkdir -p`; copy `global.env` from the template if missing (as the script does). | — |

- **Env projection**: `TYPE`, `VERSION` (omitted when absent), `MEMORY`, `LEVEL`, `PLAYIT_DOMAIN`, `EXTRA_ARGS`, then `env`. `EXTRA_ARGS` = `--universe /worlds/` plus `env.EXTRA_ARGS` for `universe`; `env.EXTRA_ARGS ?? ''` for `data` (an empty value still overrides `global.env`, ADR-0002).
- **Router hosts**: `<n>.local`, `<n>.<ip>.nip.io` for each `hostIps`, `playitDomain`, `customHostnames` (deduplicated, in this order). This one generator replaces `build_hostnames`, `init.ts` `buildHostnames`/`mergeHostnames`, and the system part of `HostnameService` (B4). `hostIps`: `.env` `HOST_IPS`, else `HOST_IP` (comma list), else the first non-internal IPv4 (`ip-select.ts`), read with the env codec.
- **Header** (first line of guarded files):
  `# Generated by mcctl from server.yaml; edits are detected (ADR-0003). mcctl:sha256=<64 hex> spec=<12 hex>`
  `sha256` hashes the rest of the file; `spec` is the prefix of the `server.yaml` revision it was rendered from. No other state file.
- **Idempotent**: rendering twice gives the same bytes; a save that changes nothing writes nothing (no mtime churn, no needless container recreation).

**Edit detection** (on `get`):

| `config.env` | Meaning | Action |
|--------------|---------|--------|
| hash ok, `spec=` current | in sync | — |
| hash ok, `spec=` old | `server.yaml` edited by hand | next save renders it |
| hash bad or no header, `spec=` current or none | `config.env` edited (or never rendered) | absorb into the spec (as import, step 1) |
| hash bad, `spec=` old | both edited | `edit_conflict`; `mcctl migrate spec <n> --force` re-renders from `server.yaml` after writing `config.env.bak` |

| `docker-compose.yml` | Action |
|----------------------|--------|
| hash ok | overwrite freely (also picks up template changes from a newer mcctl) |
| no header, semantically equal to `render(spec)` after known legacy variants (env_file `../../.env` #685, missing loading-MOTD label) | adopt and overwrite |
| anything else (hand edit) | a save that changes the rendered compose fails with `compose_edited` and the differing YAML paths; other saves leave the file untouched; `--force` overwrites after `docker-compose.yml.bak` |

## 4. Import of Existing Installs

`importDockerServer(name, ctx)` (infrastructure, next to the renderer):

1. **`config.env`** via `parseEnvDocument`: `TYPE`, `VERSION`, `MEMORY`, `PLAYIT_DOMAIN` → typed fields. `world.level` = `resolveWorldName(env)` (`LEVEL`, else legacy `WORLD_NAME`, else `world`; `WORLD_NAME` stays in `env`). Every other key → `env` in file order (unknown keys preserved).
2. **Storage** from the *effective* `EXTRA_ARGS`, with ADR-0002's resolution reused (config.env wins even when empty, else `global.env`, whose bare key takes the `.env` value): `--universe /worlds[/]` → `universe`; no `--universe`, `/data` or `.` → `data`. The `--universe` token is stripped and the rest goes to `env.EXTRA_ARGS`. The directories are only cross-checked (warning when `worlds/<level>` is missing but `servers/<n>/data/<level>` exists).
3. **Fail-closed** (R7 style): an interpolated managed value (`${...}` unquoted or double-quoted) or another `--universe` location is `undetermined`: the import is refused for that server, it keeps running, and writes to it fail with the reason until the file is fixed.
4. **Compose**: one service `mc-<n>` expected. `image`, router labels → `routing`; hostnames are classified as system (`<n>.local`, `<n>.<IPv4>.nip.io`, the playit domain) or custom. `environment` entries other than `EULA` move to `env` (effective value unchanged: both beat `global.env`). Then the compose rule of §3 decides between adopt and protect.
5. **Report** per server (`imported` | `compose protected` | `refused`) with warnings: `EXTRA_ARGS` pinned from `global.env`, stale nip.io hosts re-derived from the current `HOST_IPS`, values the strict create rules would reject.

**When it runs**

- **Lazy**: `get` imports in memory when `server.yaml` is missing; the first save writes it. Reads never write.
- **`mcctl migrate spec [<name>|--all] [--dry-run] [--force]`**: import or absorb, render, print the report. Idempotent. Same command family as `migrate worlds`.
- **`mcctl upgrade`** runs `migrate spec --all` from stage 4.
- **Never imported (v2.x)**: works exactly as today, because readers still read the files. Nothing in v2.x requires `server.yaml`; a server directory copied in by hand is adopted on its first write.

## 5. Provision (replaces `create-server.sh`)

`CreateServerUseCase` gains optional trailing constructor parameters `specRepo?`, `hostnames?`, `runtime?` (after #670's `assignments?`) and `executeWithConfig(config, options?: { onProgress?, onLog? })`. Without `specRepo` it keeps the deprecated shell path. Both `execute` (interactive) and `executeWithConfig` use the same flow; the API route calls the use case instead of spawning the script.

| # | `create-server.sh` | TS provision | Progress |
|---|--------------------|--------------|----------|
| 0 | parse flags, validate names, world exclusivity, env values, modpack slug | `buildCreateSpec(config, templateEnv)` (pure) + `validateServerSpec`; #670 `checkAssign(..., { newServer: true })`. No I/O before this passes. | `initializing` (API) |
| 1–4 | `cp -RL _template`, `sed` compose and `config.env`, add include, `docker compose config --quiet`, restore `.bak` on failure | one call, `specRepo.save(spec, { create: true })`: `mkdir` claim, `server.yaml`, render, include entry, then `docker compose config --quiet` (only when an include entry is added; Docker adapter code) | `creating` |
| 5 | avahi `<n>.local` → first IP, best effort | `hostnames.register('<n>.local', hostIps[0])`; a skip is a warning | `configuring` |
| 6 | `docker compose up -d mc-<n>` unless `--no-start`, `sleep 2`, `ps` | `runtime.start('mc-<n>')` unless `autoStart === false`; no sleep | `starting` |

- **Events**: `onProgress(stage, message)` uses the statuses the API `server-create` SSE event and the console `CreateServerStatus` already define (`creating`, `configuring`, `starting`); `onLog(line)` becomes `server-create-log`. The API sends `initializing` first and `completed`/`error` from the result, never from stderr text (#658: a server named `error-test` succeeds). A client disconnect stops events, not provisioning (today it kills the script mid-way).
- **Cleanup (#657)**: `save({ create: true })` is all-or-nothing. On any failure after the claim it removes the include entry it added and the directory it created, then rethrows, so the same create can be retried at once. It never touches `worlds/` (itzg creates the world on first start). Hostname registration is best effort as today. Start failure: open question 1. A process killed mid-create can leave `servers/<n>`; `mcctl delete <n>` removes it (`ponytail:` no marker file).
- **Avahi adapter** runs the commands the `README.md` sudoers lines allow: `sudo -n tee -a /etc/avahi/hosts` (stdin `<ip> <host>`), then `sudo -n systemctl restart avahi-daemon`. With `MCCTL_SUDO_PASSWORD`, `sudo -S -p '' -v` authenticates first and the password never reaches the command (#682). Without it: inherited stdio when stdin is a TTY (the CLI prompts as today), else `sudo -n` (the API fails fast instead of hanging). Exact-match check (#660), IPv4 check, avahi presence via `getStatus`. The API builds the adapter per request with the body's `sudoPassword` in its `env`.

**Option parity** (every flag the CLI and API pass today)

| Script | CLI / API | ServerSpec |
|--------|-----------|------------|
| `<name>` | name | `name` |
| `-t` (default `PAPER`); bare `PAPER` positional | `--type` / `type` | `type`; the positional form is dropped (no caller) |
| `-v` | `--version` / `version` | `version`; modpack type without version → no `VERSION`, otherwise the template default |
| `-m` | `--memory` / `memory` | `memory` (closes #737 if still open) |
| `-s`, `-u` (exclusive with `-w`) | `--seed`, `--world-url` / `seed`, `worldUrl` | `env.SEED`, `env.WORLD` |
| `-w` | `--world` / `worldName` | `world.level`; missing world: warning (CLI), 400 (API), as today |
| `--modpack`, `--modpack-version`, `--mod-loader`, `--exclude-files` | same / `modpack`, `modpackVersion`, `modLoader`, `excludeFiles` | `MODRINTH_MODPACK/_VERSION/_LOADER/_EXCLUDE_FILES` or `CF_SLUG`, `CF_VERSION`, `CF_LOADER`, `CF_EXCLUDE_MODS` in `env` |
| `--whitelist P`, `--enable-whitelist`, `--no-whitelist` (wins) | CLI only | `env.ENABLE_WHITELIST=TRUE` (+ `WHITELIST`); template whitelist lines dropped |
| `--playit-domain` / `--no-playit-domain` | CLI only | `routing.playitDomain` / no-op (the script ignores it too) |
| `--no-start` | `--no-start` / `autoStart: false` | skip `start` |
| `MCCTL_SUDO_PASSWORD` | `--sudo-password` / `sudoPassword` | avahi adapter `env` |
| defaults `MOTD=Welcome to <n>!…`, `LEVEL=<n>` | — | `env.MOTD`, `world.level` |

**bats → vitest**: `get_host_ip` ×4 → `resolveHostIps`; `register_avahi_hostname` ×5 → avahi adapter with fake `sudo`/`avahi-daemon` on `PATH` (as `docker-shell-injection.test.ts`); create writes dir/config/include, compose-config failure aborts, seed/modpack-version rejection, text seed → provision tests on a temp root (plus "retry after failure succeeds"); symlinked `_template` → "the renderer never writes `templatesDir`"; whitelist ×3 → render tests with the bundled template and a legacy one with `ENABLE_WHITELIST=TRUE`. `sudo-password.bats` stays until #735 (delete still uses `common.sh`).

## 6. Write Paths (stage 3)

Every writer goes through `updateServerSpec(repo, name, mutate)`. `setEnvKey(spec, key, value)` maps managed keys to typed fields, so the generic config writers need no key list.

| Writer today | Writes | Stage 3 |
|--------------|--------|---------|
| CLI `config`, `whitelist`, `op` (`ShellExecutor.writeConfigValue`) | any `config.env` key | `setEnvKey` (`LEVEL`/`WORLD_NAME` keep #670's assign path) |
| API PATCH config (`ConfigService`), `PlayerFileService.writeConfigEnv`, `ModConfigService`; CLI `mod` | `config.env` keys | `setEnvKey` |
| `setServerPlayitDomain` (CLI and API playit) | `PLAYIT_DOMAIN` + host label | `routing.playitDomain`; body delegates, `@deprecated` |
| API `HostnameService.update` | host label (regex) | `routing.customHostnames` |
| CLI `init --reconfigure` (new `HOST_IP`) | every host label (regex) | re-render every server, no spec change |
| CLI `update` | image tag, loading-MOTD label | `spec.image`; the label comes from the template |
| CLI upgrade `server-env-migration` | `env_file` repoint | handled as a legacy variant by render (removed in stage 4) |
| `ConfigEnvWorldAssignmentAdapter.assign/release` (#670) | `LEVEL` | `world.level` through the repository |
| `WorldManagementUseCase` → `shell.setServerConfig` (`SEED`, `LEVEL`) | `config.env` | `setEnvKey` |
| `mcctl migrate worlds` (#655) | `EXTRA_ARGS`, `LEVEL` | `world.storage = 'universe'` |
| config snapshot restore | `config.env`, compose | restore `server.yaml` and render when the snapshot has it (add it to `KNOWN_CONFIG_FILES`); older snapshots: write the files, then absorb |
| `create-server.sh` / `delete-server.sh` | everything | provision (§5) / #735 via `repo.delete` |

Out of scope: platform files (main compose and its playit service, `.env`, `ecosystem.config.js`, `.mcctl.json`).

**One source of truth with #670.** `server.yaml` is the only thing writers change; `LEVEL` in `config.env` is its projection. ADR-0002's adapter keeps *reading* `config.env`, which is right: it is exactly what the container uses, including a hand edit not yet absorbed. Its *writes* go through the repository, so `assign`/`release` never write `config.env` directly. The pure rules in `worldAssignment.ts` do not change, and `world.storage === 'data'` is ADR-0002's `internal: true`.

## 7. Stages

| PR | Content | Behaviour change |
|----|---------|------------------|
| 1 schema + import | domain `ServerSpec`, validation, `buildCreateSpec`; final `IServerSpecRepository` types (the exported `ServerSpec` keeps its name, v2.x rule); `FileServerSpecRepository.get/list` + importer (read only); `mcctl migrate spec --dry-run`; golden outputs of today's `create-server.sh` for each option combination (captured in its bats harness) as the PR 3 parity oracle | none |
| 2 renderer + save | `ServerSpecRenderer`, `DockerComposeRenderer`, header and edit detection, `save` (revision, create claim, rollback), `mcctl migrate spec` writes | only `migrate spec` writes |
| 3 write paths (#715 S8) | `IHostnameRegistrarPort.register` + avahi adapter; provision; CLI and API create (SSE events); every writer in §6; delete `create-server.sh` and its 3 bats files; `@deprecated` on `IShellPort.createServer`, `ShellAdapter.createServer`, `Server.toCliArgs`, `WorldOptions.toCliArgs`, `setServerPlayitDomain`, `replaceRouterHosts`; `test:scripts` and `verify:package` pass. May split into 3a (create) and 3b (other writers). | yes |
| 4 end of old-format support (v2.x) | `mcctl upgrade` imports all servers and prints the report; delete code that only exists to patch the old format (`server-env-migration`, the label patch in `update`, the regexes in `init` and `HostnameService`); a test fails when anything outside the repository adapter writes `config.env` or a server compose; docs EN/KO | servers get `server.yaml` on upgrade |

"End of old-format support" in v2.x means **no code path writes the old way any more**. It does **not** refuse servers without `server.yaml`: lazy import stays permanently (it is also how a hand-copied server is adopted), so nothing breaks and #675 closes after PR 4. **Deferred to #736 (v3.0.0)**: removing the `@deprecated` exports above and `IShellPort`/`ShellAdapter`. No ServerSpec behaviour changes in v3.0.0.

Order: PR 1–2 after #749 (#656) merges; PR 3 after #670 merges; #735 follows PR 3.

## 8. Tests (TDD, failing test first in each PR)

- **Domain**: validation tables (create vs import rules, managed keys in `env`, `--universe` in `env.EXTRA_ARGS`, non-string scalars, `specVersion`), `buildCreateSpec` for every row of the parity table, host generator.
- **Import** on temp roots: template-created server, legacy template variants, quoted/commented/duplicate keys, `WORLD_NAME`, `global.env`/`.env` inheritance and every `--universe` form (shared fixtures with ADR-0002), interpolation → refused, compose `environment` → `env`, hand-edited compose → protected; report text.
- **Render**: idempotent bytes, unchanged spec writes nothing, comment preservation, header hash, both edit-detection tables, include add/remove by exact name with long-form entries kept, `atomicWriteFile` failure leaves old files.
- **Repository**: revision conflict + one retry, create claim against an existing directory, rollback on render/include/compose-config failure followed by a successful retry.
- **Provision and API**: golden parity (parsed `config.env` and compose equal to the PR 1 fixtures except the header, explicit `LEVEL` and `EXTRA_ARGS`); event order; `--no-start`; SSE `creating → configuring → starting → completed`, `error` with the cause, name containing `error`; avahi argv exactly as the sudoers lines, password only on `-S -v`.
- **Writers**: one test per row of §6 through the spec; #670's assignment tests keep passing with the repository-backed writes.

## Consequences

- **+** One definition per server; compose files become output, so the k8s renderer is an addition (#641).
- **+** Host generation, env writing and YAML editing each have one implementation; no regex edits YAML.
- **+** Create cleans up after itself, reports real progress, and works without bash.
- **−** Comments are lost in rendered compose files (header explains) and in `servers/compose.yml`.
- **−** A hand-edited compose blocks compose-changing writes for that server until the user reverts it or forces a re-render.
- **−** Two derived states (header hash, revision) must stay correct; the edit-detection tables are the test contract.

## Open Questions

1. **Start failure after a successful create**: (A, recommended) the server stays created, the CLI exits 1 and the API sends `error` saying "created, but failed to start; run `mcctl start <n>`"; (B) roll back everything, which needs `IContainerRuntimePort.remove` from #735 first.
2. **Hand-edited compose**: (A, recommended) protect + `--force` with `.bak`; (B) also support a user-owned `docker-compose.override.yml` included with the generated file (can be added later).
3. **`EXTRA_ARGS` inherited from `global.env`/`.env`**: (A, recommended) import pins the effective value into `config.env` and reports it; (B) keep inheritance, which needs a third storage value (`inherit`).
4. **`mcctl upgrade` in stage 4**: (A, recommended) writes `server.yaml` for every server; (B) report only and leave import lazy.
5. **Template for API creates**: today the API uses `<root>/servers/_template` and the CLI the bundled template. (A, recommended) bundled only (#651); (B) prefer the user's copy when present.
6. **Deviations from plan §9.2 and the issue text**: `world.source`/`modpack`/`whitelist` as `env` keys, `image` instead of `imageTag`, `secretRefs`/`stopGraceSec`/`resources` deferred, optimistic revision instead of a per-server lock. Confirm.
7. **`.mcctl.json` `avahiEnabled: false`**: the script ignores it; (A, recommended) keep parity; (B) skip registration.
8. **Sudoers shape for `unregister` (#735)**: `README.md` allows `sed -i * /etc/avahi/hosts`, while the #660 bash uses `cp`/`tee`/`mv`. #735 must pick the command the documented sudoers line allows.
