# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Console: sudo password when deleting a server** (#761) - The server delete dialog has the same optional **Sudo Password** field as the create dialog. When filled in, it is sent in the `DELETE /api/servers/:name` body so the API can remove the server's `<name>.local` entry from `/etc/avahi/hosts` on hosts without passwordless sudo; left empty, no body is sent and the API tries `sudo -n`. If the hostname could not be removed, the dialog shows the API's warning before going back to the server list. The password is kept only in the dialog and cleared when it closes.

### Fixed
- **CLI argument parsing** (#824) - `mcctl audit list|stats|purge` printed usage and exited 1; they run now. `mcctl mod add <srv> --curseforge a b` added only `b`, and `--spiget 9089` failed; the source flags (`--modrinth`, `--curseforge`, `--spiget`, `--url`) no longer take a value, so every name after them is a mod. `mcctl create x --version 1.21.1` only printed the mcctl version; after a command `--version` takes a value (`mcctl --version` is unchanged). `mcctl op <srv> add <player> --level 2` failed with `Invalid OP level`; `--level` is read as an integer and a bad value is an error. `mcctl config <srv> KEY ""` now removes the key from the server's config (`LEVEL` and `WORLD_NAME` are refused) instead of printing it. `--root` is honored by `mcctl console user`, `console api` and `audit`. `config-snapshot restore --no-safety`, which did nothing, is gone. `mcctl --help` shows the real init path `~/minecraft-servers`, LEVEL assignment instead of world locks, the real `console api` actions, and lists Mod Management once.
- **`mcctl world delete <world>` deleted without asking** (#823) - With a world name the command deleted the world at once; only the interactive form (no name) asked. It now asks in a terminal (default No, showing the world name and size). Without a terminal it refuses and exits 1 unless `--force` or `-y`/`--yes` is given, and `--json` alone does not delete either. The REST API `DELETE /api/worlds/:name` is unchanged. The help text no longer lists `[-f]`, which is `--follow`.
- **`mcctl update` replaced a pinned image tag** (#798) - `mcctl update` moved every `itzg/minecraft-server` tag to the one recommended for the server's `VERSION`, so a server held on a release tag such as `2026.10.0-java21` went back to `java21` on the next update. A tag that starts with a release version, or a digest (`java21@sha256:…`), is now kept (`pinned tag, keeping`). The tag is read from `server.yaml` (with hand edits absorbed), so a pin there counts before it is rendered. If the pinned Java is older than `VERSION` needs, it warns and still keeps it. The loading MOTD label is still added. Use it to keep a NeoForge server with `MODRINTH_PROJECTS` on `2026.10.0-java21` while the upstream image resolves Modrinth mods with the Forge loader ([itzg/docker-minecraft-server#4357](https://github.com/itzg/docker-minecraft-server/issues/4357)), and set it back to `java21` once the fix ships.
- **Arguments starting with `-` were read as options** (#728) - `rcon-cli` reads `-x` anywhere in its arguments as an option, so `mcctl exec <server> tp Steve -100 64 200` failed with `unknown shorthand flag`, and a console or API exec command starting with `-`, such as `--port 1`, changed the RCON connection. mcctl now runs `rcon-cli -- <command>`. The CLI also keeps negative numbers: `mcctl create <name> -s -123` (seed `-123`) and `mcctl exec <server> tp Steve -1 64 -5` no longer treat `-123`, `-1` or `-5` as flags. `--seed=<value>` takes any value, `--force=true` / `--json=false` work for on/off flags, and everything after `--` is passed as is (`mcctl exec <server> -- say -h`).
- **Worlds with legacy names could not be deleted** (#728) - A world such as `My World` (allowed as an existing `LEVEL`) was listed but `DELETE /api/worlds/:name` answered `Invalid world name`. It is now deleted with its `_nether` / `_the_end` folders; a world a server uses is still refused (409). World lookups and deletes by name accept only a directory right under `worlds/`: `..`, `a/b` or a plain file such as `worlds/notes.txt` is not found, so it is never deleted.

### Docs
- **README and docs checked against the code** (#822) - Every page was compared with the source and fixed in English and Korean. Among the fixes: mc-router settings live in the `router` service of `docker-compose.yml` and are applied with `mcctl router start` (they were described as `.env` keys applied by `mcctl router restart`); getting started now starts mc-router; `AUDIT_AUTO_CLEANUP` is off unless set to `true`; worlds are assigned by server name, not `mc-<name>`; `MODE`, not `GAMEMODE`, sets the game mode; of the platform `.env` only `TZ`, `EXTRA_ARGS`, `RCON_PASSWORD` and `RCON_PORT` reach servers, so `CF_API_KEY` is set per server. The two REST API references are merged into **REST API**, which now documents all 105 mcctl-api routes. The web console pages describe the v3 dashboard, server detail and Routing page, and the audit log page is rewritten from the UI. `mcctl config-snapshot`, `backup init`, `backup schedule`, `playit` and `audit` are documented. `docs/usage/cli-usage-examples.md` and `docs/server-configuration-reference.md` were removed; their remaining content is in the CLI reference and `configuration/server-types.md`.

## [3.0.2] - 2026-10-24

> **Upgrade notes (v3.0.2).** From v3.0.x run `mcctl update`; from v2.x use `upgrade-v3.sh` (served from `main`).

### Fixed
- **Stopped servers already on the current image were offered for recreation** (#810) - `mcctl update` and step 7b of `upgrade-v3.sh` listed every stopped server as "still using the old image" and asked to recreate it, even when its container already ran the local image its compose service names. They now compare the container's image with that local image and report a match as `up to date` without asking; only servers whose image differs are offered. If the image cannot be looked up, the server is still offered.

## [3.0.1] - 2026-10-24

> **Upgrade notes (v3.0.1).**
> - **From v2.x:** use the fixed `upgrade-v3.sh` (served from `main`, see the [upgrade script](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/#v300-upgrade-script)).
> - **From v3.0.0:** `mcctl update` runs to the end in the CLI that started it (3.0.0), so the offer to recreate stopped servers appears only when you run `mcctl update` once more in a terminal, or use the manual command in runbook step 5.
> - Router image, `.env` variables and map rendering are unchanged.

### Changed
- **Routing Table grouped by server** (#799) - The console Routing page shows one row per server instead of one per hostname. A row shows the primary address with its type and a copy button, how many more hostnames there are, and an **N not routed** warning; **Wake/Start** and the links appear once per server. Click a row to list all its hostnames; **Expand all** / **Collapse all** toggles every server. Searching a hostname opens its server and highlights the match. The page header counts servers and hostnames.
- **Developer: root `pnpm test` no longer runs e2e, and e2e needs explicit targets** (#797) - `pnpm test` is now `pnpm -r --filter '!e2e' test` (same as CI). The e2e suite no longer defaults to `localhost:5000/5001` (often a live mcctl-api on a dev host); set both `E2E_BASE_URL` and `E2E_API_URL` or it fails before sending any request. `platform-settings.spec.ts` skips unless `E2E_PLATFORM_ENV` is set (it no longer falls back to the host's platform `.env`). `.github/workflows/e2e.yml` now sets `E2E_BASE_URL`.

### Fixed
- **`mcctl console service` without a terminal** (#795) - `start`, `stop`, `restart` and `logs` no longer crash with `TTY initialization failed: uv_tty_init returned EINVAL` when both services are installed and neither `--api` nor `--console` is given. They exit 1 with `No terminal to ask which services to <action>. Pass --console (API + Console) or --api.` and choose nothing. Prompts in a terminal are unchanged.
- **`mcctl update` offers to apply pulled server images to stopped servers** (#796) - mc-router auto-scale only runs `docker start` on the existing container, so a stopped server wakes up on the old image until its container is recreated. From v3.0.1, after pulling, `mcctl update` lists the stopped (`exited`/`created`) servers and, in a terminal, asks whether to recreate them (default No, because a new image can be a regression). If you answer yes it runs `docker compose up --no-start --no-deps mc-<server>` per server, reports `recreated` (with the previous image ID), `up to date` or the failure (a failure does not fail the update), and prints the command to roll back (`docker tag <old image ID> <image> && docker compose up --no-start --no-deps mc-<server>`). With `--yes` or without a terminal nothing is recreated; the servers and the manual command are printed. Running servers, and servers whose container cannot be inspected, are not touched; restart running ones at a quiet time with `mcctl stop <server> && mcctl start <server>`. The update runs in the CLI that started it, so when updating from v3.0.0 run `mcctl update` again in a terminal (or see the runbook step 5).
- **`upgrade-v3.sh` fixes from a real host upgrade** (#794) - Step 5 restarted with `mcctl console service restart --force`, which asks which services to restart and always failed in the script on hosts with both mcctl-api and the console, so PM2 kept the old `kill_timeout`. It now uses `--console --force`, and a failed restart is listed under "Still to do by hand". Step 8 compares PM2's `kill_timeout` for mcctl-api with `ecosystem.config.cjs` and fails on a difference. The summary rollback now follows runbook step 8: the files backed up in this run, the CLI, the mcctl-api, console and shared packages in `.services/` (or the root), and the restart. New step 7b asks whether to recreate stopped servers with `docker compose up --no-start --no-deps mc-<server>`, because auto-scale starts the old container with its old image. The default is no, so a regression in a new image does not reach servers unasked (`--yes` keeps it, `--dry-run` only shows the plan); the summary then lists that command per stopped server. After recreating, it prints how to go back to each old image. Step 0 stops before any change when the first `mcctl` on `PATH` is not under `npm prefix -g` (the update would land in another install), and the summary shows how to update installs left on the old version. Warnings in the summary keep their details (paths, cron lines), the step 2 question says that server images are pulled, and `upgrade.log` no longer contains escape sequences.

## [3.0.0] - 2026-10-24

> **Upgrade notes (v3.0.0, BREAKING).** Follow the [upgrade runbook](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/#v300-scripts). All Bash scripts are gone (#715, #736).
> - **Upgrade script.** `curl -fsSL https://raw.githubusercontent.com/smallmiro/minecraft-server-manager/main/scripts/upgrade-v3.sh | bash -s -- --dry-run` checks your host and shows the plan; run it without `--dry-run` to back up, update, run `mcctl upgrade` and handle the steps below with a question each ([upgrade script](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/#v300-upgrade-script)).
> - **`<root>/scripts` is no longer used.** `mcctl upgrade` shows the folder and, in a terminal, deletes it only after you answer `y` (default `N`); with `--non-interactive` or without a terminal it only prints `rm -r <path>`. Copy any script you edited first. If cron jobs or your own scripts called `<root>/scripts/*.sh`, switch them to `mcctl`: see the [script to mcctl table](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/#v300-scripts).
> - **`MCCTL_SCRIPTS` is ignored.**
> - **`@minecraft-docker/shared` API (breaking for code that imports it).** The script-based exports are removed (`IShellPort`, `ShellAdapter`, `execScript`, `execScriptInteractive`, `Paths.scripts` and more) and the use case constructors lose their shell argument (`CreateServerUseCase` now requires `provision`, `DeleteServerUseCase` requires `runtime` and `deprovisionDeps`). The replacement for each symbol is in [Removed](#removed).
> - **npm packages.** The CLI and mcctl-api packages no longer contain `scripts/` (`sync-scripts` became `sync-docker`; only `docker/bluemap/Dockerfile` is bundled).
> - **First write adds `server.yaml`.** The first command that changes an existing server (`mcctl config`, whitelist, ops, mods, playit, the console) writes `servers/<name>/server.yaml` and rewrites that server's `config.env` and `compose.yml` with a header; see [server.yaml](https://minecraft-server-manager.readthedocs.io/en/latest/configuration/server-yaml/). Comments in `servers/compose.yml` are lost on its first rewrite.
> - **Auto-backup on stop now also runs for API and console stops.** Hosts with `BACKUP_AUTO_ON_STOP=true` should add `kill_timeout: 130000` to the mcctl-api app in `ecosystem.config.cjs` (runbook step 4-2).
> - Existing installs are not changed otherwise: servers keep their `config.env`, including world location (#651).

### Added
- **v3.0.0 upgrade script** (#787) - `scripts/upgrade-v3.sh` guides a v2.x host through pre-flight checks, backup, `mcctl update`, `mcctl upgrade`, the `<root>/scripts` folder, `kill_timeout`, `server.yaml` import, a world check and verification. Safe for `curl | bash` (questions from the terminal, no command reads the script), `--dry-run` changes nothing, and without a terminal and `--yes` it skips every changing step. Options `--root`, `--yes`, `--dry-run`, `--skip-update`, `--remove-scripts`. See the [upgrade script](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/#v300-upgrade-script).
- **`server.yaml` (ServerSpec)** (#675) - Each server can have `servers/<name>/server.yaml`, the single description from which `config.env` and the server `compose.yml` are generated. `mcctl migrate spec <name>|--all [--dry-run] [--force] [--json]` imports an existing server. A hand edit of `config.env` is absorbed; a hand edit of the generated `compose.yml` is protected (`compose_edited`, `--force` keeps a `.bak`); both at once stop with `edit_conflict`. `mcctl upgrade` tells you which servers are not imported yet and writes nothing. A write that fails part way puts back the files it already changed; a file another process changed meanwhile is left and named in the error. A `config.env` value with `$`, `#` or surrounding blanks is refused if it contains `'` or ends with `\`, because the file cannot hold it. Snapshots and server backups include `server.yaml`. See [server.yaml](https://minecraft-server-manager.readthedocs.io/en/latest/configuration/server-yaml/).
- **`mcctl delete` options** (#652) - A confirmation prompt (`-y/--yes` skips it, `--force` also ignores connected players; without a terminal and without `--yes` it refuses) and `--delete-world`. The web console delete dialog lets you keep the world (default, moved to `worlds/`) or delete the one inside the server too; `DELETE /api/servers/:name?deleteWorld=<bool>`.
- **`mcctl backup push --allow-missing`** (#732) - Accepts that worlds present in the last backup were deleted on purpose (the web console push dialog has a matching checkbox). `mcctl backup restore <commit>` asks for confirmation unless `--force`.
- **World assignment in listings** (#670) - `mcctl world list` shows which servers use each world and warns about duplicates; `GET /api/worlds` returns `servers` and `assignmentWarnings`; the console shows an "Assigned to N servers" chip.
- **Hostname removal that works without `MCCTL_SUDO_PASSWORD`** (#735) - `DELETE /api/servers/:name` accepts an optional JSON body `{ "sudoPassword": "..." }` (write-only, never logged) for removing the `.local` entry, and returns an optional `warning` when the entry could not be removed or files were left in `servers/<name>/`.
- **Router live log and status stream** (#769) - `GET /api/router/logs/stream?tail=N` (SSE, `tail` 1 to 500, default 100) follows the mc-router log and sends `router-log` events with `kind` `connect`, `wake`, `error` or `info`, plus hostname, target and player name when the line has them. `GET /api/router/status/stream` (SSE) sends the same payload as `GET /api/router/status` only when it changes (`router-status`, or `router-status-error` when the lookup fails). The console uses it for the router status, with 30 second polling as fallback, and the Routing page gets a **Live Router Log** panel (last 500 lines, auto-scroll, clear) and a **Routing Flow** diagram of the real routes. The console's SSE proxy now requires a session and ends the upstream request when the browser disconnects.
- **Router details and restart** (#768) - `GET /api/router/status` also returns, when available, the router `image`, `autoScale` (`up`, `down`, `downAfter`, `asleepMotd`), `resolver` (`hostIp`, `hostIps`) and per route `autoScaleUp`, `autoScaleDown` and `discoveredByRouter`. `POST /api/router/restart` (admin only, audited as `router.restart`) runs `docker compose restart router`; the Routing page has a **Restart mc-router** button with a confirmation. Route rows show **Sleeping** for stopped servers that wake on connect, a **Wake/Start** action, **Edit hostnames**, and **Not routed** when mc-router does not know the route.
- **Server list summary** (#764) - `GET /api/servers?include=summary` adds `type`, `version` and `memory` per server, `players` and `stats` (memory use) for running servers, and `totals` (`playersOnline`, `playersMax`, `running`). Probes run in parallel with timeouts and a 10 second cache; a server that does not answer gets `players: null`. Without `include` the response is unchanged; other values return `400`. The dashboard shows the total player count and per-server players, memory and type/version.
- **Dashboard quick actions** (#765) - **Create Server** in the hero (opens the create dialog), an **mc-router** card replacing Online Servers, a status filter (All / Running / Stopped) in the server list, Console, Restart, Stop and Start buttons per server (Stop and Restart ask first), a hostname copy button, an **External Access** list of servers with a playit address, and colored activity categories.
- **Server detail tab badges and switcher** (#771) - Tabs have icons, the Players tab shows the online count, the Mods tab shows a count when the installed mods are already loaded, the player list shows OP and Whitelisted badges and opens the player detail, and a server switcher next to the title jumps to another server.

### Changed
- **One template source** (#651) - `platform/services/cli/templates/` is the only copy. The root `templates/` directory is removed and `platform/docker-compose.yml`, `platform/.env.example` and `platform/servers/{_template,global.env}` are symlinks to it. CI fails if they diverge. Template defaults now agree with the docs: `AUTO_SCALE_DOWN_AFTER=10m`, `DOCKER_TIMEOUT=120s`, console/API ports 5000/5001 in `ecosystem.config.js`.
- **Existing installs are not changed.** Servers you already created keep their current `config.env` (including world location). `mcctl upgrade` refreshes `servers/_template`, so servers you create afterwards get the shared `/worlds` layout. Migrating existing servers is a later hardening item.
- **Creating a server needs no bash** (#675, #737) - `mcctl create` and the console create the server in TypeScript. The chosen memory is applied now. If the first start fails, the server is kept (CLI exits 1; API answers 201 with `status: "created"` and a `warning`, which the console shows). The first `compose up` may take up to 30 minutes (image pull); the plain JSON API call stops waiting after 120 seconds and the start continues in the background. Input the server files cannot hold (an invalid memory value, a seed `config.env` cannot store) is refused with `400` before anything is written, also for the streaming create (`follow`). A modpack type without a version no longer writes `VERSION=LATEST`; an explicit `LATEST` is still written. Turning on the whitelist in the console for a directory without `config.env` is refused (`not_found`) instead of creating the file.
- **Deleting a server** (#735, #652) - Done in TypeScript. The world is kept: a world inside the server folder is moved to `worlds/` before the folder is deleted (it stops with nothing deleted if `worlds/` already has that name), and `--delete-world` is the only way to delete it. `LEVEL` is read the way Compose reads it, so quoted values and trailing comments work. Only one delete of a server runs at a time: a second `mcctl delete` or API delete of it fails. Delete handles only the `servers/compose.yml` entry mcctl writes (`<name>/docker-compose.yml`); a hand-written include entry for the server (long form, extra compose files) stops the delete before anything changes. The entry is removed before the world moves, so the server cannot be started meanwhile, and a failed move puts it back. Files that cannot be removed from `servers/<name>/` (written by the container as root, for example) are a warning with a `sudo rm -rf` command; the server counts as deleted. The API answers `409` for these refusals and for a world it cannot move, and `500` when Docker cannot be queried or the container cannot be stopped. Deleting no longer runs `docker compose config`. The `.local` entry is removed with the README sudoers command shape (`sudo -n sed -i ... /etc/avahi/hosts`).
- **`mcctl console <server>` uses TCP RCON** (#734) - Same session as `mcctl rcon` instead of `docker exec ... rcon-cli`. The server must be running and its RCON port reachable from the host where you run `mcctl`. Leave with `exit`, `quit`, Ctrl+C or Ctrl+D.
- **Backups** (#732) - Run in TypeScript (git 2.31 or later). A running server is saved before the copy (`save-off`, `save-all flush`, copy, `save-on`); if RCON does not answer, the backup fails instead of copying a world being written. Server-internal worlds (`servers/<name>/data/<LEVEL>`) are included. The backup stops if a world from the last backup is gone (`--allow-missing` accepts it). "Nothing changed" counts as success. Restore refuses while a server runs, restores exactly that commit, keeps `worlds/.locks`, and puts the previous data in `backups/restore-previous/<timestamp>/` (last 3 kept). The token never appears in process arguments. Concurrent backups are serialized with `backups/.backup.lock`.
- **Auto-backup on stop** (#734, #732) - `BACKUP_AUTO_ON_STOP=true` now also backs up when you stop a server from the API or the web console (in the background; the result is in the API log; a failed backup never fails the stop). When mcctl-api shuts down it waits up to 2 minutes for a running backup so servers get `save-on` back. `mcctl stop --all` still does not back up.
- **World assignment follows `LEVEL`** (#670) - A world belongs to one server, taken from that server's `LEVEL` in `config.env` (dimension folders count as the same world). `world assign`, `create --world`, `config LEVEL`, API `PATCH level`, snapshot restore and `migrate` refuse a world another server uses. World changes are accepted only for a stopped server (`world new --server` no longer stops it for you), and only when the runtime state can be read: if Docker cannot be reached, reassigning is refused. If any server's `config.env` cannot be interpreted, assignment changes and world delete/reset are refused. `world release` returns the server to its default world `<server-name>` instead of unlocking; `world delete --force` never deletes a world a server uses. API conflicts are `409` instead of `400`. `worlds/.locks` is no longer read, written or created (`rm -rf worlds/.locks` is safe).
- **Config files are written atomically** (#656) - compose, `config.env`, `.env`, `.mcctl.json`, `ops.json`, whitelist, users, ecosystem and snapshot restores are written to a temporary file and renamed, so an interrupted write cannot truncate them. Every env reader follows the Docker Compose rules (quotes, ` #` comments, `export`, last duplicate wins), so a value like `Hi #1` in an unquoted MOTD is cut at ` #`, as Compose already did. `mcctl mod add/remove` keeps the comments in `config.env`. `POST /api/servers` and `DELETE /api/servers/:name` run one at a time inside the API process.
- **Stricter names on create** (#649, #722) - The API now applies the CLI rules: 2 to 32 characters, lowercase start, no trailing hyphen, no `--`, and `router` is reserved. Existing servers with older names keep working (the CLI only warns). World names accept letters, digits, `-` and `_`. `PLATFORM_PATH` is no longer read; the root is `MCCTL_ROOT` or the default.
- **BlueMap rendering runs from TypeScript** (#733) - The render container gets `--memory 2g` and a Java heap limit; exit code 137 is reported as a possible out-of-memory. A render ended by a signal is now a failure. The API package ships `docker/bluemap/Dockerfile`, so an npm-installed API can build the render image.
- **`mcctl logs`** (#731) - Shows stdout and stderr; `-f` ends with exit code 0 on Ctrl+C; `--json` with `-f` is rejected.
- **`mcctl playit domain` and the console hostname editor keep both places in sync** (#708) - `PLAYIT_DOMAIN` and the `mc-router.host` label change together; restarting a server does not apply a new host, stop and start it. `mcctl init` keeps custom and playit hostnames when it resets the host IP.
- **Routing page is a routing table** (#767, #768, #769) - One row per hostname with copy button, type (WAN, mDNS, nip.io, Custom), target server and status, searchable by hostname or server name. The mc-router card replaces the platform info and network cards and also shows the resolver host IPs and Avahi status. This replaces the collapsed hostname lists from 2.33.0.
- **Dashboard on Bento** (#763, #765) - The dashboard widgets use the Bento panels and page hero. The Online Players card shows `—` when no player data is available instead of `0`.
- **Dashboard update notice** (#766) - The changelog widget no longer calls `api.github.com` from the browser. The console reads `CHANGELOG.md` from `main` through `GET /api/changelog` (session required, cached for 1 hour, last good value kept on failure), shows the latest version and an **Update available** chip when it is newer than the installed one.
- **Server detail on Bento** (#770, #771, #781) - The hero, metric cards, overview console and all tab contents use Bento panels instead of nested cards. CPU shows one decimal, memory shows `used / allocated` with a **High** or **Critical** mark from 70% or 90%, world size has no fixed cap, and the overview console has a prompt, quick-command chips and a toolbar (jump to latest, download, clear, expand).

### Removed
- **All Bash scripts** (#715, #729-#735) - `mcctl.sh`, `create-server.sh`, `delete-server.sh`, `backup.sh`, `lock.sh`, `player.sh`, `logs.sh`, `init.sh`, `render-map.sh`, `migrate-nip-io.sh` and `lib/common.sh`. See the [script to mcctl table](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/#v300-scripts).
- **`@minecraft-docker/shared` exports** (#736) - Breaking for code that imports the package. The replacement for each symbol:

  | Removed | Use instead |
  |---|---|
  | `IShellPort`, `ShellResult`, `LogsOptions`, `ShellAdapter`, `ShellAdapterOptions` | The port for the task: `IContainerRuntimePort`, `IServerConsolePort`, `IWorldBackupPort`, `IWorldAssignmentPort`, `IServerSpecRepository` |
  | `CreateServerOptions` (type) | `CreateServerConfig` and `executeWithConfig` |
  | `execScript`, `execScriptInteractive` (package root and `./docker`) | Nothing; use `execCommand` / `execCommandAsync` for ordinary processes |
  | `Paths.scripts`, `MCCTL_SCRIPTS` | Nothing |
  | `Paths.locks`, `Paths.lockFile` | Nothing |
  | `PlayerLookupUseCase`, `IPlayerLookupUseCase`, `PlayerLookupResult`, `PlayerNameHistory`, `PlayerUuidResult` | `mcctl player info <name> [--offline]` |
  | `ServerStatusUseCase`, `IServerStatusUseCase`, `ServerStatusResult` | `mcctl status`, `IServerRepository` |
  | `ServerName.containerName` / `hostname`, `Server.containerName` / `hostname` | Pass the `ServerName` to the port, or use `containerNameOf` / `serverHostnameOf` |
  | `Server.toCreateArgs()`, `WorldOptions.toCliArgs()` | `buildCreateSpec`, `executeWithConfig` |
  | `setServerPlayitDomain` | `updateServerSpec` with `setEnvKeys({ set: { PLAYIT_DOMAIN } })` |
  | `replaceRouterHosts` | ServerSpec `routing` |
  | `IServerSpecRepository.get`, `FileServerSpecRepository.get` | `load(name)` |
  | `IWorldAssignmentPort.getAssignment`, `IWorldRepository.getLockStatus`, `WorldLockData` | `snapshot()` and `holdersOf` |
  | `new BlueMapCliRenderer(scriptPath, run?, options?)`, `RenderSpawn`, `RenderSpawnOptions`, `parseResultJson` | `new BlueMapCliRenderer({ worldsDir, mapsDir, dockerDir })` |
  | `executeWithName(name)`, `executeWithName(name, boolean)` | `executeWithName(name, { force, yes, deleteWorld })` |

  Constructors lose the shell argument. `CreateServerUseCase` requires `provision`, `DeleteServerUseCase` requires `runtime` and `deprovisionDeps`, `WorldManagementUseCase` takes `runtime` as an optional argument, and `BackupUseCase` only drops the shell argument:
  - `new CreateServerUseCase(prompt, serverRepo, settings: IPlatformSettingsPort, provision, worldRepo?, auditLog?, modSource?, assignments?)`
  - `new DeleteServerUseCase(prompt, serverRepo, runtime, deprovisionDeps, auditLog?, serverConsole?)`
  - `new WorldManagementUseCase(prompt, worldRepo, serverRepo, assignments?, runtime?)`
  - `new BackupUseCase(prompt, port: IWorldBackupPort)`

  The string (container-name) parameter of the runtime ports is not narrowed in v3.0.0 (#667, #641).
- **`mcctl player lookup` and `mcctl player uuid`** (#730) - Use `mcctl player info <name> [--offline]`. The removed commands print this and exit with 1. `mcctl player info --offline` now matches Minecraft; the old script computed a wrong offline UUID for some names (for example Steve and Alex).
- **avahi log view in `mcctl logs`** (#731) - Run `journalctl -u avahi-daemon` yourself.
- **`mcctl backup diff`** (#732) - It had no entry point in the CLI, API or console.

### Security
- **Line breaks in `config.env` values** (#726) - A value with a line break could add an arbitrary `KEY=value` line (API config fields, `POST /api/worlds` seed, `POST /api/servers/:name/mods`, `mcctl config`). `mcctl.sh config` also put the value into a `sed` expression, which let an authenticated user run commands on the host. Control characters are now rejected at the schema and at every write.
- **Shell and path injection** (#720) - Docker helpers and the API's create, delete and action routes run `docker` with an argument array instead of a shell string; a container name starting with `-` is no longer read as an option. World name path parameters reject separators, control characters and leading `.`.

### Fixed
- **New servers created their world inside the server folder** (#651) - `mcctl create` copies the template bundled in the CLI package, which never received the `EXTRA_ARGS=--universe /worlds/` fix from #165, so worlds ended up in `servers/<name>/data/<LEVEL>` instead of the shared `worlds/<LEVEL>`. The template now has the line again.
- **Deleting a server deleted its world** (#652) - The old delete removed a world inside the server folder while printing "preserved".
- **Deleting a server removed another server's lines** (#660) - Server names were compared as substrings in `servers/compose.yml` and `/etc/avahi/hosts`, so deleting `wood` could also remove `ironwood`. Names are compared exactly now.
- **`.local` entries stayed after delete** (#751, #735) - Installs that rely on the README sudoers rules instead of a sudo password kept the `<name>.local` line, and an API delete never passed the sudo password on.
- **`mcctl logs <server>` failed without options** (#731) and **`mcctl console <server>` read the server name as a subcommand** (#734).
- **A server created from a world URL was missing from the server list, and `mcctl delete` failed for it** (#649); a server with only config files showed the wrong world (#649).
- **Created servers had no Start button, and the log panel reconnected every 3 seconds** (#706) - A created server counts as stopped in the console; the log stream stops reconnecting once the API ends it.
- **Backups from an npm install did nothing useful** (#732) - The API looked for `<root>/scripts/backup.sh`, which an npm install does not have, so backups did not sync the worlds; `backup init`, `backup history` and `backup status` now show real values.
- **`mcctl init` kept an old host address as a custom hostname** (#710) - Hostnames are matched case-insensitively.

## [2.33.0] - 2026-10-18

> **Upgrade notes.** Follow the [upgrade runbook](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/): run `mcctl upgrade`, then `mcctl console service restart --console`. Coming from 2.31.x or earlier, this is the version to upgrade to: it includes all of 2.32.0 without the console sign-out (#699). If you are on 2.32.0 and were signed out, this restores the previous secret and base URL, so you are signed out once more.

### Changed
- **Create Server dialog** (#700) - Leaving **Sudo Password** empty now asks **Continue without a sudo password?** before creating (for hosts where sudo needs no password) instead of submitting silently; **Enter password** returns to the field. A whitespace-only password counts as empty. Server Type now defaults to **VANILLA** and Minecraft Version to **LATEST** (the CLI default); other types with `LATEST` show a hint to pin a version, because `LATEST` follows new Minecraft releases on every start.
- **Routing table starts collapsed** - In **Routing → MC-Router Status → Routing Table**, each server's hostname list is collapsed by default; click a server to expand it.

### Fixed
- **Upgrading to 2.32.0 signed console users out** (#699) - On installs whose platform `.env` still held older `BETTER_AUTH_SECRET` / `BETTER_AUTH_BASE_URL` copies that differed from `ecosystem.config.cjs`, 2.32.0 switched to the `.env` values: every session became invalid and sign-in could fail (e.g. an old base URL). The console now uses the `.env` values only when `ecosystem.config.cjs` no longer defines the key; while it does, the ecosystem value wins and the console logs a warning if `.env` differs. `mcctl upgrade` moves both keys from `ecosystem.config.cjs` into `.env` (the secret is kept, so sessions stay valid), saves `ecosystem.config.cjs.bak-<timestamp>`, and tells you to run `mcctl console service restart --console`; `--dry-run` only shows it, and a second run changes nothing. Platform Settings shows these two keys read-only while the ecosystem defines them and rejects a change with a hint to run `mcctl upgrade`.
- **`mcctl console init` kept a stale `.env` secret** (#699) - When `.env` held an older `BETTER_AUTH_SECRET` that differed from the one in `ecosystem.config.cjs`, re-running `mcctl console init` kept the `.env` copy and signed everyone out. It now moves the ecosystem secret (the one the running console uses) into `.env`.

## [2.32.0] - 2026-10-18

> **Upgrade notes** (also includes the unreleased 2.31.1 hotfix). Follow the [upgrade runbook](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/):
> - Run `mcctl upgrade`, then **stop and start every server** (`mcctl stop <name> && mcctl start <name>`). This moves servers to `servers/global.env` so platform secrets no longer reach Minecraft containers (#685).
> - Hosts that ran `mcctl console init` on v2.31.0 or earlier: check `AUTH_MODE` in `ecosystem.config.cjs` (runbook step 4-1, #633).
> - Upgrading to 2.32.0 can sign console users out on hosts whose `.env` holds older `BETTER_AUTH_*` values; go straight to 2.33.0 (#699).
> - If you created servers with a sudo password, check `/etc/avahi/hosts` for a plain-text password line ([Troubleshooting](https://minecraft-server-manager.readthedocs.io/en/latest/troubleshooting/), #682).

### Added
- **Platform Settings in the Web Console** (#683) - Admins can view and edit the platform `.env` from **Settings**. Keys are grouped into typed cards; secrets are write-only and shown only as "configured"; legacy and unknown keys are listed with warnings; values injected by PM2 are shown read-only. Saving keeps comments and key order, writes the file atomically (mode `0600`), refuses to overwrite a file that changed since it was loaded (reload dialog), and tells you what to restart for each change. Changes are recorded in the audit log by key name only, never by value. Non-admins see only their account settings. Details: [Platform Settings](https://minecraft-server-manager.readthedocs.io/en/latest/console/web-console/#platform-settings-admin)
- **Console auth settings live in the platform `.env`** (#686) - `BETTER_AUTH_SECRET` and `BETTER_AUTH_BASE_URL` are read from `<MCCTL_ROOT>/.env`, where a non-empty value wins over `ecosystem.config.cjs`. They can be edited in Platform Settings and applied with `mcctl console service restart --console`. `mcctl console init` now writes the secret to `.env` (keeping an existing value or moving the old ecosystem secret, so sessions stay valid) instead of into the ecosystem file. Installs whose `.env` held older `BETTER_AUTH_*` copies were switched to them (users signed out, sign-in possibly broken); fixed in 2.33.0 (#699).
- **Random RCON password on `mcctl init`** (#680) - New installs get a random 24-character `RCON_PASSWORD` instead of `changeme`. Existing `.env` files are not changed.
- **`mcctl create --enable-whitelist`** (#679) - Enables the whitelist without adding players.
- **All connection addresses in the server Connection card** (#681) - Every address is listed with its kind (e.g. LAN, Tailscale / VPN, mDNS) and a copy button.

### Changed
- **Whitelist is off by default for new servers** (#679) - Use `--whitelist a,b` or `--enable-whitelist`, or answer **Yes** to "Enable whitelist?" in interactive mode. Existing servers are not changed.
- **LAN address first** (#681) - Connection addresses are ordered LAN nip.io → Tailscale/VPN → other nip.io → external domain → `.local`, and the LAN address is the primary address everywhere in the console.
- **`mcctl console init` access modes** (#633) - The chosen mode is written as a value mcctl-api recognizes: `internal` → `ip-whitelist` (loopback only), `api-key-ip` → `combined`, `open` → `disabled`. Before, those three silently fell back to `api-key` in production. `mcctl console api` commands now say they only update `api-config.json`.
- **`.env.example` cleanup** (#687) - Removed keys nothing reads (`API_ACCESS_MODE`, `MCCTL_*_IMAGE`, `MCCTL_JWT_*`, `NEXTAUTH_*`, `DEFAULT_MEMORY`, `DEFAULT_VERSION`, ...).

### Fixed
- **Platform secrets leaked into server containers** (#685) - Server compose files loaded the whole platform `.env`, so keys like `BACKUP_GITHUB_TOKEN` and `PLAYIT_SECRET_KEY` reached every Minecraft container. Servers now load `servers/global.env`, which passes only `TZ`, `EXTRA_ARGS`, `RCON_PASSWORD` and `RCON_PORT`. `mcctl upgrade` creates it and repoints existing servers; restart each server to apply. To pass another key to all servers, add its name to `servers/global.env`.
- **sudo password written to `/etc/avahi/hosts`** (#682) - When sudo credentials were cached or `NOPASSWD` was set, the password supplied through `MCCTL_SUDO_PASSWORD` / `--sudo-password` / the console was appended to `/etc/avahi/hosts` in plain text. The password is now used only to authenticate. A comma-separated `HOST_IP` uses the first address, and a non-IPv4 value is skipped with a warning. Existing files are not cleaned automatically.
- **`DELETE /api/audit-logs` without a role** (#689) - A request with no role header could purge audit logs; it now requires admin.
- **`.env` writes from the CLI** (#688) - `mcctl init --reconfigure`, backup settings and `mcctl playit setup` now write `.env` atomically and quote values safely, so values with spaces or `$` no longer break `backup.sh`.
- **Copy buttons over plain HTTP** (#681) - Copying failed silently when the console was opened as `http://<LAN IP>:5000`; it now works, or shows an error.
- **Fake `[0m` player in the Players tab** (#600) - ANSI codes in the RCON `list` reply are stripped, and no names are reported when 0 players are online.
- **Minecraft 26.x worlds** (#601) - The world info panel and player data read the new 26.x locations (seed, time, spawn, difficulty, game rules, weather, world border, `players/`), falling back to the old layout.
- **CLI exit code when the audit log is unavailable** (#602) - A command that succeeded no longer exits with 1 because the audit log could not be written (e.g. `better-sqlite3` ABI mismatch); a one-time warning is printed instead.
- **`mcctl console service status`** (#677) - Uptime is shown correctly (was e.g. `20744d`), health is checked over HTTP, and a native-module (`NODE_MODULE_VERSION`) failure prints recovery steps.

### Docs
- Console docs corrected where they differed from the source (#629); upgrade runbook step for `AUTH_MODE` (#633); environment page explains which `.env` keys reach servers and the setting classification (#683, #685)

## [2.31.0] - 2026-10-11

### Added
- **Anonymous usage analytics for the web console (GA4)** (#631) - The console sends a `page_view` for each page so the project can see which screens are used.
  - **Sent**: a random per-installation `installId` (UUID, stored in `.mcctl.json`) used as the GA `user_id`; the normalized page path (e.g. `/servers/:name`); the console version.
  - **Never sent**: hostname or IP, server or world names, query strings, account information.
  - **Opt out**: add `"telemetry": false` to `.mcctl.json` (no restart needed) or set `DO_NOT_TRACK=1`. Nothing is sent in development mode.
  - `installId` is written by `mcctl init`, added by `mcctl upgrade` when missing, or created on the console's first request if you only ran `mcctl update`. `mcctl console init` and `mcctl update` print a notice about it.
  - Details: [Usage Analytics](https://minecraft-server-manager.readthedocs.io/en/latest/console/web-console/#usage-analytics)

### Fixed
- **`mcctl console user` / `mcctl console api` dropped options** (#628) - `--role`, `--password`, `--json` and `--force` were discarded before reaching Commander; they are now passed through.

## [2.30.0] - 2026-10-11

> **No product behavior changes in this release.** v2.30.0 consists of documentation and contributor/development-workflow changes only; the CLI, API, console, and runtime are functionally identical to v2.29.1.

### Added
- **Upgrade runbook** - A release-common upgrade runbook with post-upgrade verification steps, linked from the Advanced docs index and CLI command docs (#577), and backup guidance moved out of `servers/` with `--non-interactive` usage (#579)
- **`DEVELOPMENT.md`** - Contributor guide for open-source contributors: issues on the upstream repo, work on a fork, PRs back to upstream (#587)

### Changed
- **README refreshed to v2.29.1** and `create-server.sh` instructions replaced with `mcctl create` (#581, #583)
- **Development workflow (`/work`)** - Completion conditions are enforced by a Stop hook (#585); new contributor (fork) mode that completes at PR creation and review (#589); responsible-agent routing and difficulty tiers for single-issue mode (#591); work state is stored per session so concurrent `/work` runs no longer collide (#593)

### Internal
- Claude configuration prompt audit; release-manager agent aligned with the actual release flow (#585)

## [2.29.1] - 2026-10-10

### Fixed
- **World map render no longer fails on worlds with an empty Nether/End** - On worlds where a dimension (e.g. `the_nether`, `the_end`) had no region (`.mca`) data, `render-map.sh` exited with code 1 ("Map render failed: exit code 1") instead of skipping that dimension, so the #564 `sorting` change was never written either. Dimensions without region data are now skipped with a warning and the render completes (#575, #576)
- **World map opens on the Overworld** - BlueMap's `settings.json` lists maps alphabetically and ignores per-map `sorting`, so the viewer still opened on the End. After rendering, the map list is rewritten overworld → nether → end. Existing worlds pick this up on the next **Re-render** (#575, #576)

### Internal
- Added a test that a dimension with no region data does not abort the script under `set -e` (#575)
- Documentation: `mcctl upgrade` / `DOCKER_GID`, console world map default view, and Ore & Block Stats (#572); v2.29.0 upgrade guide and local host runbook (#573)
- Removed the project-level `statusLine` setting from `.claude/settings.json` (#574)

## [2.29.0] - 2026-10-10

### Added
- **`mcctl upgrade` updates the router in your root `docker-compose.yml`** - Previously `mcctl upgrade` only synced `.env` and `servers/_template/`, so router changes reached new `mcctl init` users only. It now patches just the `router` service's `image` tag and `group_add` entry to match the bundled template, leaving any other customization (extra services, ports, playit profile, comments, CRLF line endings) untouched. It shows a diff and asks for confirmation, writes a timestamped `docker-compose.yml.bak-<timestamp>` backup, restores the backup if the patched file fails validation, and recreates the router with `docker compose up -d router`. `--dry-run` shows the diff only; `--non-interactive` applies without asking (#562, #569)
- **Ore & Block Stats visualization** - The world map's **Ore & Block Stats** panel now shows summary KPIs, a donut chart of block composition, and category bars, instead of a flat list of identical progress bars (#567, #568)

### Changed
- **mc-router 1.43.1 → 1.47.1** - Brings upstream auto-scale and MOTD fixes. mc-router 1.46+ runs as a non-root user, so the router service now gets `group_add: ["${DOCKER_GID:-999}"]` to keep read access to the Docker socket. `mcctl init` and `mcctl upgrade` detect the socket's group ID (including a custom `DOCKER_HOST` socket path) and write `DOCKER_GID` to `.env`. Existing installs: run `mcctl upgrade` to apply both the new image and `group_add` (#549, #559)
- **CurseForge `CF_API_KEY` is no longer described as required** - itzg images for Java 17+ ship with a built-in key, so `CF_API_KEY` is only needed for Java 8 / pre-17 image tags or to use your own key. CLI messages (`mcctl mod`, `--curseforge` help) and EN/KO docs are corrected (#561, #566)
- **itzg reference docs synced to 2026.9.2** - New variables (`PRE_START_SCRIPT`, `STOP_SERVER_DELAY_COMMAND`, `PREFER_IPV6`, `REMOVE_OLD_CONFIGS`, `HARDCORE`, ...), `NEOFORGE_VERSION`, GraalVM tags, and riscv64 (#548, #560)

### Fixed
- **World map opens on the Overworld** - The BlueMap viewer sorted maps by id and opened the End first. Rendered maps now set `sorting` (overworld → nether → end). Existing worlds pick this up on the next **Re-render** (#564, #565)

### Internal
- CLI tests now run in CI; 15 test files that vitest could not load (`node:test`-based suites and `child_process` mocks missing `execFile`) were fixed (#570, #571)
- `shared` package tests now run in CI, and the empty `DIM-1`/`DIM1` test fixture directories are tracked so dimension tests pass on a fresh checkout (#555, #558)

## [2.28.0] - 2026-10-01

### Changed
- **Bento layout across the Web Console** - Every `mcctl-console` screen now uses a consistent "Bento" layout: a page hero with the page's key status, summary metrics, and primary action at the top, followed by bounded panels for the detailed content. Applied to the dashboard, servers list, server detail, server console, worlds, player management, backups, routing, audit logs, settings, login/signup, and user administration. Dense views (tables, tabs, file browser, terminal output) keep their existing layout inside a panel, and all existing actions, permissions, and navigation are unchanged. Layouts are validated from 375px mobile to wide desktop, and hover motion is disabled when `prefers-reduced-motion` is set
  - The server list hero shows total / running / needs-attention counts with a **Live** / **Reconnecting** indicator
  - The server detail hero shows status, health, hostname, uptime, and lifecycle actions, with CPU / memory / world size as a metric row
  - Shared layout components (`BentoGrid`, `BentoPanel`, `PageHero`, `BentoMetricCard`) replace page-local styling; the server detail `ResourceStatCard` is replaced by `BentoMetricCard`

### Fixed
- **Dashboard health and live state** - The dashboard "needs attention" count now includes servers that are `unhealthy`, not only stopped ones, and the status chip shows **Reconnecting** instead of always showing **Live** when the real-time (SSE) connection is down. Stale SSE status is no longer overlaid while disconnected
- **Honest status when data fails to load** - Console pages (dashboard, servers, worlds, players, backups, audit logs, user administration) now show **Unavailable** or an error message when their data cannot be loaded, instead of showing `0` or an empty state that looks like real data. The backup **Push** button is disabled while backup status is unknown
- **Cached data kept on refetch errors** - If a background refresh fails after data was already loaded, the console keeps showing the last loaded data (backups show e.g. "Configured (cached)") instead of switching the whole page to **Unavailable**
- **`mcctl console user` / `mcctl console api` subcommands** - Running any `mcctl console user ...` or `mcctl console api ...` subcommand failed with `error: unknown command 'node'`. The CLI now passes the arguments to Commander with the correct `from: 'node'` convention (#556, #557)

## [2.27.0] - 2026-09-27

### Added
- **Server Player Panel** - A new **Players** tab in the server detail screen shows every player who has ever joined, with detailed per-player views. Delivered across four phases under #528:
  - **Players tab: online/offline roster + management** - Merges live online players (RCON) with offline players known from `usercache.json`, `playerdata`, and `ops`/`whitelist`/`banned-players.json`. Shows avatars and Online/OP/Banned/Whitelisted badges, with kick/ban/unban/op/deop/whitelist actions. Works even while the server is stopped; live updates via SSE (#550)
  - **Player statistics** - A player detail modal with play time, deaths, mob/player kills, distance traveled, blocks mined, items crafted, and completed advancements, parsed from vanilla `stats/` and `advancements/` files (#551)
  - **Position & status** - Last saved position, dimension, health, food, XP level, game mode, and inventory summary from `playerdata` NBT, plus a live position (refreshed every 5s) for online players via RCON (#552)
  - **Session & visit history** - Visit count, total playtime, last seen, and recent sessions. A background collector reads join/leave events from container logs every 30s and stores them in a new SQLite database (`data/players.db`), so history persists across restarts. History is collected from this version onward (the first run looks back 24h of container logs) (#553)

### API
- `GET /api/servers/:name/players` now returns the merged online+offline roster and no longer returns `400` for a stopped server. The response is a superset of the previous shape (`online`, `max`, `players` kept; `serverName`, `running`, `roster` added) (#550)
- New `GET /api/servers/:name/players/:uuid` with `?include=stats,nbt,sessions` (#550, #551, #552, #553)

### Changed
- The `playerdata` NBT parser from the World Info Panel (#525) is extracted into a shared adapter and reused by both the world panel and player details. `prismarine-nbt` (already a `shared` dependency) is added to `mcctl-api` as a dev dependency for test fixtures only (#552)

## [2.26.3] - 2026-06-28

### Fixed
- **Maps, block statistics & structure markers now work on latest Minecraft (`dimensions/` world layout)** - The newest Minecraft versions (Vanilla `VERSION=LATEST`, MC 26.x) store every dimension — including the overworld — under `dimensions/minecraft/<dimension>/region`. The manager only recognized the legacy paths (`region`, `DIM-1`, `DIM1` plus Paper satellite folders), so map rendering, block statistics, structure scanning, and dimension detection all failed on these worlds. Added this third layout to `render-map.sh`, `dimensionRegions.ts`, and `PrismarineWorldDataReader`, and generalized dimension-path resolution so the active layout is selected by newest region (`.mca`) data mtime across all three layouts (#546, #547)

## [2.26.2] - 2026-06-28

### Fixed
- **Nether/End maps, block stats & structure markers no longer render from stale data on layout-switched worlds** - When a world was moved from a server software that uses separate dimension folders (e.g. Paper: `<world>_nether`, `<world>_the_end`) to one that uses a single combined folder (e.g. NeoForge: `<world>/DIM-1`, `<world>/DIM1`), the old satellite folders were left behind empty. Dimension resolution preferred those stale satellite folders, so BlueMap rendered blank Nether/End maps and block statistics/structure markers read empty data. Both the `render-map.sh` `resolve_dimension_root` (#542) and the TypeScript `dimensionRegions.ts` `resolveRegionDirs` (#544) now select the active layout by newest region (`.mca`) data mtime (#542, #543, #544, #545)

## [2.26.1] - 2026-06-28

### Fixed
- **Server World tab now shows live player locations** - The World tab reported "No players online" and only last-known offline positions even when players were online. The console had no BFF proxy route for `GET /api/servers/:name/players/live`, so the live query 404'd; the route is now added (#538)
- **World map dimension switching / textures now load** - Switching the embedded BlueMap viewer to another dimension failed with "Failed to load map" and high-res tiles/textures were missing, because BlueMap stores map data gzip-compressed (`textures.json.gz`, `*.prbm.gz`) while the webapp requests the uncompressed name. The map static-serving endpoint now transparently decompresses `.gz` files (no re-render needed) (#540)

## [2.26.0] - 2026-06-28

### Added
- **World Info Panel** - A new world-detail view, reachable from the world management screen and the server "World" tab, surfaces what's inside a world. Delivered across four phases under #525:
  - **World info & player locations** - Parsed `level.dat` metadata (seed, spawn, game mode, difficulty, day/weather, version, world border, data packs), on-disk dimension presence, size and region count, plus last-known offline player locations from `playerdata` and live player positions via RCON (#525, #532, #533)
  - **Full map (BlueMap)** - Renders a static, pan/zoom-able web map of the world with the BlueMap CLI (offline, no running server required) and embeds BlueMap's viewer in the console. Manual render with live SSE progress; the rendered webroot is served with path-traversal protection (#529, #535)
  - **Village & structure markers** - Extracts generated structures (villages, fortresses, temples, outposts, end cities, …) from region structure data and overlays them on the map as native BlueMap markers with per-category toggle and click popups (#530, #536)
  - **Ore & block statistics** - A full region scan decodes every chunk's block-state palette to count ores and blocks; runs as a cancellable analysis with live progress and a cached bar-chart visualization (#531, #537)
- **Auto-detect client-only mods in modpacks** - Modpack server creation now detects and excludes client-only mods using official metadata, preventing the `invalid dist DEDICATED_SERVER` crash on dedicated servers (#524, #527)
- **Installed modpack jar listing + Exclude toggle** - View the jars bundled in an installed modpack and toggle excluded mods directly (#523, #526)

## [2.25.1] - 2026-06-21

### Fixed
- **Server list now refreshes after creating a server** - The Create Server dialog used a creation flow that never refreshed the list, so a newly created server only appeared after a manual page reload. The list now updates automatically on completion (#521, #522)
- **Modpack search no longer floods the console with errors** - Typing in the modpack search fired a compatibility lookup for every partial keystroke, each returning a 500 for the not-yet-complete slug. The lookup is now debounced, and unknown modpacks return a clean 404 instead of a 500 (#519, #520)

## [2.25.0] - 2026-06-21

### Added
- **Exclude client-only mods from modpacks** - Some modpacks bundle client-only mods (HUD/UI mods such as Status Effect Bars) that crash a dedicated server with an `invalid dist DEDICATED_SERVER` error. You can now exclude such mods by (partial) file name when creating a modpack server — use the new `--exclude-files` flag on `mcctl create`, or the **Exclude mods** field in the Create Server dialog. The values map to `MODRINTH_EXCLUDE_FILES` / `CF_EXCLUDE_MODS` in the server config (#515, #518)
- **Richer modpack search results** - The modpack search dropdown in the Create Server dialog now shows each modpack's icon, description, download count, and author, making it much easier to pick the right pack (#516, #517)

## [2.24.0] - 2026-06-21

### Added
- **Modpack Loader/Version Compatibility** - The create-server modpack flow now resolves compatible `(loader, Minecraft version)` combinations via Modrinth and blocks incompatible ones, fixing the root cause of the "No files available" error. Adds a `buildModpackCompatibilityMatrix`/`isModpackCompatible` domain utility, a new `GET /api/mods/:slug/versions` endpoint, a `type=modpack` filter on mod search, server-creation compatibility validation (incompatible combos rejected with 400, fail-open on metadata lookup failure), and a `CreateServerDialog` search Autocomplete with loader/version comboboxes (#511, #514)

### Fixed
- **Create Server VERSION Leak** - `create-server.sh` no longer leaks the `_template` default `VERSION` into MODRINTH modpack servers, which previously produced incompatible combos (#511, #514)
- **Create World Dialog Localization** - Replace the hardcoded Korean text in the Create World dialog with English (zip guidance, labels, helper text, dropzone, seed) (#512, #513)

## [2.23.0] - 2026-06-21

> This release also ships features that were merged after v2.22.0 was tagged but had not yet been published (#480–#502), hence the minor version bump.

### Added
- **Create World from ZIP** - Import a world from a ZIP upload with loader-specific guidance; auto-detect flat/wrapper/split layouts and group split-dimension worlds (`_nether`/`_the_end`) under their parent for unified management (#490, #492)
- **Flexible World Selection on Create Server** - Choose an unmapped existing world, a seed, a world URL, or no world when creating a server, with mutually-exclusive validation (400/409 instead of opaque 500s) (#491, #493)
- **Per-World Server Usage** - Worlds now expose the list of servers using them (reverse LEVEL mapping) across shared, API, and console (#487, #488)

### Fixed
- **World Lock on Reassign** - Release a superseded world lock when a world is reassigned (#501, #502)
- **World Assign LEVEL** - World assign now updates the server's LEVEL config (#489, #496)
- **ServerDetail Tab & Players BFF** - Repair the stale ServerDetail tab and fix players BFF tests (#499, #500)
- **Whitelist Fallback** - Serve the whitelist from file when the container is absent or RCON returns empty (#485, #486)
- **Version-Matched Scripts** - Run version-matched create/delete scripts instead of a stale deployed copy (#483, #484)
- **PWA Safe Area** - Apply `safe-area-inset-top` so the PWA AppBar clears the status bar (#480, #481)

### Changed
- **itzg Image Pins** - Update `itzg/mc-router` from `1.42.0` to `1.43.1`, pin two previously unpinned `mc-router` templates, and unify the server `_template` `itzg/minecraft-server` tag from `java21` to `java25` for consistency (#503, #504)

### Maintenance
- **CLI ESLint Config** - Restore the missing ESLint configuration in the `cli` package and clean up lint violations (#505, #506)
- **shared/api ESLint** - Add ESLint configs to restore `pnpm lint` (#498)
- **Test Suite** - Green the mcctl-api test suite and fix a ConfigSnapshot type error (#494, #482, #495)
- **Agent Workflow** - Tidy `/plan-work` workflow docs and gitignore artifacts (#497)

### Documentation
- **itzg Version References** - Sync manuals and references for the itzg image changes above (#507, #508)

## [2.22.0] - 2026-05-30

### Added
- **Installable Standalone PWA** - Make the web console an installable standalone PWA so iOS home-screen shortcuts open without the Safari chrome (✕/URL bar). Adds web app manifest, `appleWebApp` meta, viewport config, and a Creeper apple-touch-icon (generated via `ImageResponse`) (#478, #479)

## [2.21.0] - 2026-05-30

### Added
- **Compact Dashboard StatCards** - Replace dashboard StatCards with a compact, information-rich variant (progress bar + computed subline) for higher information density (#474, #475)

### Fixed
- **Mobile Drawer Backdrop** - Prevent the mobile hamburger drawer backdrop from lingering after navigation (removed `keepMounted`), which previously blocked tab interaction on iPhone/iPad (#476, #477)

## [2.20.3] - 2026-05-03

### Fixed
- **mc-router DOCKER_TIMEOUT Format** - Correct DOCKER_TIMEOUT to Go time.Duration format (`120` → `120s`) so mc-router can parse it properly

### Changed
- **mc-router Image Pin** - Pin `itzg/mc-router` image to explicit version `1.42.0` for reproducible deployments (#472, #473)

## [2.20.2] - 2026-04-03

### Added
- **Loading MOTD Label** - Add `mc-router` loading MOTD label (`auto-scale-loading-motd`) to server templates (#471)
- **Auto Loading MOTD** - Auto-add loading MOTD label to existing servers during `mcctl update` (#471)

### Fixed
- **MC 26.x Defaults** - Update CLI defaults and docs for MC 26.x / Java 25 (`init`/`upgrade` defaultVersion → 26.1.1, common versions list)

## [2.20.1] - 2026-04-03

### Added
- **Docker Image Auto-Pull** - `mcctl update` now automatically pulls the latest Docker image (#465)
- **Auto Image Tag Upgrade** - `mcctl update` checks VERSION vs image tag compatibility and auto-upgrades server Docker image tags (#468)

### Fixed
- **Java 25 Default Image** - MC 26.1.1+ requires Java 25; update default image tag to `java25`, McVersion supports 26.x versioning (#467)
- **CLI Defaults Update** - Update `init`/`upgrade` defaultVersion from 1.21.1 to 26.1.1 and docs for MC 26.x / Java 25
- **Merge Artifacts** - Resolve merge artifacts from parallel PR merges (vitest conversion, fieldConfigs syntax, sectionConfigs, IMcctlApiClient)

## [2.20.0] - 2026-04-03

### Added
- **Java 25 Support** - McVersion.recommendedImageTag and DocsAdapter java25 support (#444)
- **New Server Types** - Add LEAF, FOLIA, PUFFERFISH server types (#445)
- **Native AutoPause** - PAUSE_WHEN_EMPTY_SECONDS config support for MC 1.21.2+ (#446)
- **WebSocket & SSH Console** - WebSocket Console and SSH Console config support (#447)
- **Config Repository** - Configuration Repository settings (PAPER_CONFIG_REPO etc.) (#448)

### Fixed
- **DocsAdapter Path** - Fix DocsAdapter file path to include itzg-reference subdirectory (#449)

### Changed
- **Test Runner Migration** - Migrate shared package test runner from node:test to vitest (#450)
- **TypeScript Types** - Unify @types/node to ^22.x across all packages (#451)

### Documentation
- **Java Versions** - GraalVM deprecated, Java 25 tags added (#439)
- **AutoPause** - Native AutoPause (PAUSE_WHEN_EMPTY_SECONDS) for MC 1.21.2+ (#440)
- **Server Types** - Leaf, Config Repos, Fabric mirror (#441)
- **Mods & Plugins** - Auto-removal, VERSION_FROM_MODRINTH, new env vars (#442)
- **Console Features** - WebSocket Console, SSH Console, Autoscale documentation (#443)

## [2.19.0] - 2026-03-01

### Added
- **Console Community Links** - Add Q&A and Ideas community links to Footer component (#434, #438)

### Fixed
- **Console Snapshot Null Guard** - Add null guards to `getNextPageParam` and `flatMap` in `useServerConfigSnapshots` to prevent TypeError (#431, #435)
- **Console View History Button** - Disable View History button when less than 2 snapshots available (#432, #437)

### Documentation
- **npm README** - Add Q&A and Ideas discussion links to README for community engagement (#433, #436)

## [2.18.0] - 2026-02-24

### Changed
- **Backup Storage Paths** - Relocate backup storage paths to `<MCCTL_ROOT>/backups/` (#429, #430)
  - World backup cache: `$HOME/.minecraft-backup` -> `<MCCTL_ROOT>/backups/worlds/`
  - Backup schedule DB: `data/` -> `backups/meta/`
  - Config snapshot DB/storage: `data/` -> `backups/meta/`
  - Consolidates all backup-related data under a single `backups/` directory

### Documentation
- **CLAUDE.md** - Simplify Project Structure to high-level table (606 -> 393 lines, 35% reduction)
- **Orchestrator Agent** - Add Orchestrator Agent to Multi-Agent Collaboration and enforce orchestrator-first workflow

## [2.17.1] - 2026-02-24

### Changed
- **Console Backup Sub-tabs** - Reorder server backup sub-tabs to show Config Snapshots first, World Backups second

## [2.17.0] - 2026-02-24

### Added
- **Server Detail Backups Tab** - Implement Backups tab in Server Detail page (#427, #428)
  - **World Backups sub-tab**: Reuses existing backup components (BackupStatus, BackupHistory, BackupPushButton, BackupScheduleList) scoped to the selected server
  - **Config Snapshots sub-tab**: Server-scoped config snapshot management with schedule filtering
  - Fix ConfigSnapshotSchedulePanel to filter schedules by server when `filterServerName` prop is provided
  - Fix onViewHistory condition to require >= 2 snapshots for diff dialog

### Fixed
- **Console Dependencies** - Add missing `react-diff-viewer-continued` dependency (#4c453f5)
- **Lock file sync** - Sync pnpm-lock.yaml with react-diff-viewer-continued dependency (#75515f2)

## [2.16.0] - 2026-02-23

### Added
- **Config Snapshot** - Full-stack configuration snapshot system for server config versioning (#397~#406, #414~#424)
  - **Domain Layer**: `ConfigSnapshot`, `ConfigSnapshotSchedule` entities with `SnapshotId`, `SnapshotType`, `SnapshotStatus` value objects (#397, #414)
  - **Infrastructure**: `SqliteConfigSnapshotRepository` adapter with SQLite persistence (#398)
  - **API**: RESTful Config Snapshot endpoints - CRUD, diff, restore, schedule management (#399, #400, #416)
    - `ConfigSnapshotSchedulerService` with `node-cron` integration for automated snapshots (#405)
    - Audit logging for all snapshot mutations
  - **CLI**: `mcctl config-snapshot` commands for snapshot management (#401)
  - **Console**: Config Snapshots tab on Backup page with full UI (#402)
    - Config History tab on Server Detail page (#403)
    - ConfigDiff viewer and ConfigRestore dialog components (#404)
    - BFF proxy routes, React Query hooks, and TypeScript types
  - **E2E Tests**: Config Snapshot E2E test fixtures and test files (#406)

- **Backup Retention Policy Pruning** - Implement `applyRetentionPolicy()` for automated backup cleanup (#396, #426)
  - Git history truncation logic for old backups
  - Integration with backup scheduler for automatic pruning

### Fixed
- **Backup Git Path** - Fix git repository path and prevent shell injection (#423, #425)
  - Replace `exec()` with `execFile()` to prevent shell injection vulnerabilities
  - Correct git repository path resolution in backup routes
  - Added test coverage for backup routes

## [2.15.3] - 2026-02-22

### Changed
- **README.md** - Major update with Management Console section, Architecture diagram, and Quick Start guide (#412, #413)
  - Added Management Console section with setup instructions and feature overview
  - Updated Architecture diagram with Console components (mcctl-api, mcctl-console)
  - Added Console Setup to Quick Start guide
  - Updated Documentation table with Console and API docs links

## [2.15.2] - 2026-02-22

### Changed
- **Web Console Documentation** - Added server Overview/Mods tab screenshots with detailed descriptions (#409)
  - Server Overview tab screenshot and feature walkthrough
  - Server Mods tab screenshot with mod management UI description
- **Integrated Setup Guide** - New comprehensive guide for mcctl init to console init flow (#410)
  - Step-by-step installation guide covering mcctl CLI setup through console initialization
  - Bilingual documentation (English/Korean)

## [2.15.1] - 2026-02-22

### Changed
- **Web Console Documentation** - Comprehensive update with screenshots and detailed feature descriptions (#407, #408)
  - Added screenshots for all major console features (Dashboard, Server Management, World Management, etc.)
  - Updated feature descriptions with step-by-step usage guides
  - Enhanced documentation structure for better readability

### Fixed
- **pnpm-lock.yaml** - Sync lockfile with mcctl-api package.json for node-cron dependency

## [2.15.0] - 2026-02-22

### Added
- **Automated Backup Scheduling** - Cron-based backup scheduler with full-stack implementation (#394, #395)
  - **Domain Layer**: `CronExpression` and `BackupRetentionPolicy` value objects, `BackupSchedule` entity with validation
  - **Use Cases**: `BackupScheduleUseCase` with CRUD operations and `IBackupScheduleRepository` port
  - **Infrastructure**: `SqliteBackupScheduleRepository` adapter with SQLite persistence
  - **CLI**: `mcctl backup schedule` subcommand with `list`, `add`, `remove`, `enable`, `disable` operations
    - Cron preset support (hourly, daily, weekly, monthly) and custom expressions
    - Optional retention policy configuration (maxCount, maxAgeDays)
  - **API**: RESTful backup schedule endpoints (GET/POST/PUT/PATCH/DELETE `/api/backup/schedules`)
    - `BackupSchedulerService` with `node-cron` integration for automated backup execution
    - Typebox validation schemas for request/response
    - Audit logging for all schedule mutations
  - **Console**: Backup Schedule management UI with CRUD and toggle
    - `BackupScheduleList` component with enable/disable toggle
    - `BackupScheduleDialog` for creating and editing schedules
    - BFF proxy routes and React Query hooks
  - **Security**: Shell injection prevention using `execFile()` instead of `exec()`
  - **Tests**: 54+ tests across CLI (24), API routes (14), and scheduler service (16)

### Note
- Retention policy pruning deferred to separate implementation (#396)
- Domain layer (`BackupRetentionPolicy`, `shouldPrune`) remains intact for future use

## [2.14.0] - 2026-02-21

### Added
- **Console Mod Detail Cards** - Enhanced installed mods display with rich card UI in Server Detail Mods tab
  - Replace simple slug Chip display with card UI showing mod icon, title, description, download count, author, and Modrinth link
  - Batch API endpoint using Modrinth `GET /v2/projects?ids=[]` for efficient metadata retrieval
  - 3-state rendering: Skeleton (loading), Detail Card (full info), Fallback Card (slug only on API failure)
  - React Query caching with staleTime 5min, gcTime 30min for mod metadata
  - BFF proxy route for mod projects API

### Changed
- **Modrinth Adapter** - Add `getProjects()` batch method with parallel team member resolution
- **IModSourcePort** - Add optional `getProjects?()` method to mod source port interface

## [2.13.0] - 2026-02-21

### Added
- **Console Server Activity Tab Redesign** - Improve Server Activity tab to match Audit Logs page UI (#391, #392)
  - Convert Server Activity tab from simple List to reusable `AuditLogTable` component
  - Add Action/Status inline filters for activity filtering
  - Add pagination support with configurable rows per page (25/50)
  - Add `hideTargetColumn` and `rowsPerPageOptions` props to `AuditLogTable` for reusability

### Documentation
- **mcctl update Command** - Add documentation for `mcctl update` command usage

## [2.12.1] - 2026-02-20

### Added
- **Server Management Guide** - New bilingual (EN/KO) documentation for server start/stop operations
  - Comprehensive guide covering `mcctl start`, `mcctl stop`, `mcctl up`, `mcctl down` commands
  - Server lifecycle management with auto-scaling behavior
  - Added to MkDocs navigation under Usage section

### Removed
- **World Storage Bug Warning** - Remove obsolete v1.6.8~v1.6.11 bug warning from documentation
  - Issue was fully resolved in v1.6.12; warning no longer relevant

## [2.12.0] - 2026-02-20

### Changed
- **Console File Editors Inline Redesign** - Convert TextEditor and PlayerEditorDialog from fullScreen Dialog overlays to inline Card-based views (#389, #390)
  - All file editors now use consistent inline replacement rendering pattern
  - Shared header pattern with back button, icon, title, and actions
  - Matches ServerPropertiesView inline design for unified UX
  - Eliminates modal overlays in favor of in-page navigation

## [2.11.0] - 2026-02-19

### Added
- **Console Tab-Specific Console Section** - Show Console section only on Overview tab (#387, #388)
  - Console section now appears exclusively in the Overview tab for cleaner UX
  - Console open state resets automatically when leaving Overview tab
  - Unit tests added for console visibility on tab switch

### Changed
- **Console server.properties Editor Redesign** - Replace modal dialog with inline view
  - `ServerPropertiesDialog` (modal overlay) replaced with `ServerPropertiesView` (inline full-page view)
  - New `RawPropertiesEditor` component for raw properties editing
  - Properties editor now renders within the Files tab instead of as a dialog overlay
  - Improved UX with back navigation instead of dialog close

## [2.10.0] - 2026-02-19

### Added
- **Console File Upload/Download** - Phase 5: Streaming file transfers with drag-and-drop support (#379, #386)
  - File upload with streaming proxy via `@fastify/multipart`
  - Drag-and-drop file upload interface
  - File download with streaming response
  - Progress indicators for upload/download operations
- **Console File Operations** - Phase 6: File management actions (delete, rename, new folder) (#380, #385)
  - Delete confirmation dialog with safety checks
  - Rename dialog for files and directories
  - New folder creation dialog
  - Contextual file operation menus

## [2.9.0] - 2026-02-18

### Added
- **Console File Browser** - Phase 1: Directory navigation and file listing for server files management (#375, #381)
  - Browse server file system with directory tree navigation
  - File listing with name, size, and modification date
  - Breadcrumb navigation for directory path
- **Console Text Editor** - Phase 2: Read and write text files directly from the web console (#376, #382)
  - View and edit server configuration files (server.properties, config files, etc.)
  - Syntax-aware text editing with save functionality
- **Console Player Editor Smart Routing** - Phase 3: Smart routing for player management files (#377, #383)
  - Automatic detection and routing for whitelist.json, ops.json, banned-players.json
  - Dedicated player editor UI for player management files
  - Smart file type detection with specialized editing interfaces
- **Console server.properties Form Editor** - Phase 4: Visual form-based editor for server.properties (#378, #384)
  - Form-based editing with field descriptions and validation
  - Grouped settings by category (gameplay, world, network, etc.)
  - Type-safe inputs (boolean toggles, number fields, dropdowns)

### Changed
- **Console Font Cleanup** - Remove Roboto Mono font, use MUI default font stack (#373, #374)
  - Cleaner typography using Material UI default fonts
  - Reduced bundle size by removing custom font dependency

## [2.8.1] - 2026-02-18

### Changed
- **Console Responsive Design Overhaul** - Improve responsive design across 14 components for mobile, tablet, and desktop (#371, #372)
  - **P0 Critical**: ServerCard/WorldCard responsive height, page headers responsive flexDirection, NetworkSettings/PlayitSection table mobile scroll
  - **P1 Important**: ServerDetail responsive tabs and console height, CreateServerDialog fullScreen on mobile, ServerConsole responsive header, StickyActionBar responsive padding
  - **P2 Nice to have**: Dashboard responsive breakpoints, ServerOverview chip flex-wrap, ConnectionInfoCard word-break, UserList table overflow
  - Accessibility: Add aria-label to console close button, fullScreen close button for dialogs

## [2.8.0] - 2026-02-18

### Added
- **Console HostnameDisplay Common Component** - Reusable hostname display with popover for multiple hostnames (#369, #370)
  - Shows primary hostname with (+N) Chip for servers with multiple hostnames
  - Clicking Chip opens Popover with all hostnames and copy buttons
  - Applied to 5 locations: ServerCard, ServerOverview, ServerDetailPage header, ServerDetail InfoRow, ConnectionInfoCard LAN Address
  - Extracted `parseHostnames` and `getPrimaryHostname` utilities into `src/utils/hostname.ts`
  - Extracted `CopyButton` into shared common component with configurable icon size

### Fixed
- **Console DOM Nesting Warning** - Change InfoRow value wrapper to `component="div"` to prevent invalid DOM nesting with HostnameDisplay
- **Console InfoRow Null Behavior** - Preserve undefined hostname handling for hidden InfoRow display

### Tests
- **HostnameDisplay Component Tests** - Cover all render paths, Popover interaction, copy-to-clipboard, port suffix formatting, and event propagation prevention

## [2.7.0] - 2026-02-18

### Changed
- **Console Font Overhaul** - Replace Ubuntu font with Roboto Mono (Google Fonts) across all console components
  - Layout: Switch from `Ubuntu` to `Roboto_Mono` with CSS variable support
  - MUI Theme: Update global fontFamily to Roboto Mono
  - 11 components: Unify monospace/code font references from mixed (JetBrains Mono, Fira Code, generic monospace) to Roboto Mono
  - Minecraft font preserved for game-related branding elements

## [2.6.1] - 2026-02-17

### Fixed
- **Console Restart Badge UX** - Remove individual Restart badges from each settings field and consolidate restart information in StickyActionBar
  - Reduces visual clutter in Server Properties tab
  - StickyActionBar now shows specific field names requiring restart (e.g., "difficulty, pvp require restart")

## [2.6.0] - 2026-02-17

### Added
- **Console Server Properties Full UI** - Complete server configuration management with 6 sections and ~40 fields using Progressive Disclosure pattern (#365, #366)
  - General section: server name, MOTD, max players, difficulty, game mode, hardcore
  - World section: level name, seed, level type, world generation settings
  - Performance section: view distance, simulation distance, max tick time, network compression
  - Network section: server port, enable query, enable RCON, connection settings
  - Advanced section: spawn protection, max world size, entity limits, function permission level
  - Operators section: enforce whitelist, enforce secure profile, OP permission level
  - Collapsible sections with Progressive Disclosure for reduced cognitive load
  - Real-time config updates via ConfigService REST API

### Tests
- **ConfigService Field Tests** - Add 22 unit tests for new ConfigService fields and 6 API integration tests (#367, #368)
  - Full coverage for all ~40 config fields across 6 sections
  - GET/PUT API endpoint tests for server configuration

## [2.5.0] - 2026-02-17

### Added
- **Console Security Settings UI** - Online Mode and Whitelist settings in server detail page (#357, #358, #362)
  - Toggle Online Mode on/off with safety confirmation dialog
  - Toggle Whitelist on/off directly from server settings
  - Real-time config updates via REST API

### Fixed
- **API Memory Parameter** - Pass `--memory` parameter to `create-server.sh` when creating servers via REST API (#356, #360)
- **Console Player List Field** - Align player list field name (`players` to `list`) with backend API response format (#359, #361)
- **API Whitelist Remove RCON Fallback** - Detect RCON error in whitelist remove and fall back to direct file editing (#363, #364)
  - RCON `whitelist remove` sometimes fails silently; now detects error response and edits whitelist.json directly

### Infrastructure
- **Scripts**: Add `--memory` option support to `create-server.sh`
- **Template**: Add `ONLINE_MODE` section to server `config.env` template

## [2.4.1] - 2026-02-14

### Fixed
- **CI/CD**: Fix `mcctl-api` npm publish missing `workspace:*` replacement for `@minecraft-docker/mod-source-modrinth` dependency

## [2.4.0] - 2026-02-14

### Added
- **CLI `mcctl upgrade` Command** - Upgrade mcctl and all services to latest version with automatic restart (#326, #355)
  - Replaces manual npm update workflow with single command
  - Automatically restarts PM2 services after upgrade
  - Supports `--check` flag to preview available updates without installing
- **CLI Creeper ASCII Banner** - Display creeper ASCII art with version check on `mcctl init` (#353, #354)
  - Visual branding during platform initialization
  - Automatic latest version check with update notification
- **CLI `mcctl playit domain` Subcommand** - Manage playit.gg domain assignments per server (#347, #348)
  - Add, remove, and list playit.gg domain mappings for servers
  - Interactive server and domain selection

### Changed
- **Console Mods Tab** - Rename 'Content' tab to 'Mods' in server detail page (#349, #350)
  - Clearer tab naming that directly reflects functionality
- **Console Mods Tab Functionality** - Implement full Mods tab with mod listing and management (#351, #352)
  - View installed mods per server
  - Mod search and installation from Modrinth

### Documentation
- Update documentation for v2.4.0 with upgrade command and playit.gg guides

## [2.3.5] - 2026-02-12

### Fixed
- **Playit.gg Container Name** - Use correct container name `playit-agent` in `getPlayitAgentStatus()` (#345, #346)
  - Previously used incorrect container name when checking playit agent status
  - Now correctly references the `playit-agent` container for status checks
- **Console Playit Error Feedback** - Add error feedback for playit start/stop actions (#343)
  - Previously, playit start/stop failures were silent in the web console
  - Now displays error messages when playit operations fail
- **Console Playit Layout** - Improve playit section header layout and server domains display (#343, #344)
  - Better visual alignment of playit section headers
  - Improved server domains display in playit configuration

## [2.3.4] - 2026-02-12

### Fixed
- **Playit.gg Docker Compose Setup** - Add playit service to docker-compose.yml during setup (#341, #342)
  - Previously, `mcctl init` and `mcctl playit setup` did not add the playit-agent service to docker-compose.yml
  - Now properly injects the playit service definition into docker-compose.yml during platform setup
  - Ensures playit.gg tunneling works immediately after initial setup

## [2.3.3] - 2026-02-12

### Fixed
- **Playit.gg Docker Compose CWD** - Pass `cwd` to docker compose commands in playit start/stop (#339, #340)
  - Previously, `docker compose --profile playit start/stop` commands did not receive the correct working directory
  - Now passes `cwd` parameter to ensure docker compose runs in the platform root directory
  - Fixes playit-agent start/stop failures when CLI is invoked from a different directory

## [2.3.2] - 2026-02-12

### Fixed
- **Playit.gg Status Detection** - Check `.mcctl.json` for playit enabled state instead of container existence (#337, #338)
  - Previously relied on Docker container inspection to determine playit status
  - Now reads `playit.enabled` flag from `.mcctl.json` configuration file
  - More reliable detection that works even when containers are not running

## [2.3.1] - 2026-02-12

### Fixed
- **API TypeScript Build Error** - Resolve TypeScript build error in audit-logs purge catch block
- **CLI Init Reconfigure** - Handle missing `.mcctl.json` in `mcctl init --reconfigure` (#335, #336)
  - Previously crashed when `.mcctl.json` file was not present
  - Now gracefully handles missing config file during reconfiguration

### Documentation
- Update documentation for v2.3.0 release

## [2.3.0] - 2026-02-12

### Added
- **playit.gg External Access** - Allow external players to join without port forwarding using [playit.gg](https://playit.gg) tunneling (Milestone 9)
  - **Domain Model & Docker Helpers** - `PlayitConfig` type and Docker Compose profile support in shared package (#291, #328)
  - **Docker Compose Templates** - playit-agent service with `network_mode: host` and `profiles: [playit]` (#270, #327)
  - **CLI `mcctl init --playit-key`** - Interactive playit.gg setup during platform initialization (#271, #329)
  - **CLI `mcctl create --playit-domain`** - Register playit.gg domain when creating servers (#272, #330)
  - **CLI `mcctl playit` subcommand** - start/stop/status/setup commands for playit-agent management (#273, #331)
  - **API Endpoints** - `GET /api/playit/status`, `POST /api/playit/start`, `POST /api/playit/stop` (#292, #332)
  - **Console UI** - PlayitSummaryCard on dashboard, ConnectionInfoCard with external domain, PlayitSection on routing page (#274, #333)
  - **Documentation** - Comprehensive playit.gg integration guide in English and Korean (#275, #334)
- **Comprehensive API Audit Logging** - Add audit logging to all mutating API routes (#324, #325)
  - Player management routes (whitelist, ban, op, kick)
  - Server config and hostname routes
  - World management routes
  - New audit action types for config and hostname changes

### Fixed
- **Console Whitelist Button Sizes** - Unify Add and Bulk button sizes in WhitelistManager (#322, #323)

## [2.2.0] - 2026-02-11

### Added
- **Whitelist Console UI** - Full whitelist management in Web Console (#283, #321)
  - Whitelist ON/OFF toggle switch for enabling/disabling whitelist per server
  - Bulk player add functionality for adding multiple players at once
  - Search and filter for quick player lookup in whitelist
  - Whitelist status API endpoint (`GET /api/servers/:name/whitelist/status`)
  - WhitelistStatusAdapter, BFF route, and React Query hooks
  - Comprehensive test coverage for whitelist status endpoints
- **Whitelist Default on Create** - Enable whitelist by default when creating servers via `mcctl create` (#282, #320)
- **Hostname/Domain Management** - Server hostname and domain management in Options tab (#314, #315)
  - HostnameSection component for viewing and managing server hostnames
  - API endpoints for hostname configuration
  - HostnameService for hostname operations

### Fixed
- **Console Unit Tests** - Fix 23 pre-existing failing unit tests (#296, #316)
- **Console Navigation** - Rename "Audit Log" to "Audit" in navigation menu

### Documentation
- **Upstream Docs Update** - Update itzg reference docs for itzg 2026.2.0 and mc-router v1.39.1 (#317, #318)

### Chore
- Restore workspace:* dependencies after release merge

## [2.1.3] - 2026-02-09

### Fixed
- **API Whitelist RCON UUID Enrichment** - Enrich whitelist RCON response with UUIDs from whitelist.json file (#312, #313)
  - RCON `whitelist list` command returns only player names without UUIDs
  - API now supplements RCON response with UUID data from server's whitelist.json file
  - Enables Console UI to display accurate player UUIDs in whitelist management

## [2.1.2] - 2026-02-09

### Added
- **CLI Update Loading Indicator** - Improve mcctl update command with loading indicator for better UX (#306, #307)

### Fixed
- **Console Admin/Users Route Group** - Move admin/users page to (main) route group for proper GNB/Footer layout (#308, #309)

### Changed
- **Console Settings Responsive Layout** - Apply responsive grid layout to Settings page (#310, #311)

## [2.1.1] - 2026-02-09

### Fixed
- **Console GNB Admin Menu Cleanup** - Remove admin menu from GNB, rename UserMenu "Admin Panel" to "Users" (#302, #304)
  - Admin menu in GNB was redundant with UserMenu admin link
  - Simplified navigation by consolidating admin access to UserMenu
- **API Whitelist/Banned-Players UUID Display** - Return UUID in whitelist and ban API responses (#303, #305)
  - UUID was missing from player list API responses for whitelist and banned-players
  - PlayerFileService now returns full player objects including UUID
- **API PlayerFileService Test Assertions** - Update test assertions for object return types (#303)

## [2.1.0] - 2026-02-09

### Added
- **Modrinth Modpack CLI/API Support** - Full modpack server creation and management (#244, #245)
  - CLI `mcctl create --modpack` with Modrinth modpack search, version selection, and loader detection
  - API endpoints for modpack server creation with validation
  - MODRINTH modpack server validation in CLI
- **Admin User Management Console UI** - Web-based admin user management (#189)
  - Admin user list page with search and filtering
  - User detail dialog with role and status management
  - Admin menu in GNB for admin users
  - Admin layout with UserMenu admin panel link
- **OP Level Domain Model** - Structured OP level support across all layers (#284)
  - `OpLevel` value object in shared domain layer
  - OP level semantics: 1 (bypass spawn), 2 (cheat commands), 3 (multiplayer management), 4 (server management)
- **OP Level CLI Commands** - Interactive OP level management (#285)
  - `mcctl op set <player> --level <1-4>` for setting OP levels
  - Interactive OP level selection with level descriptions
  - `OpsJsonAdapter` for direct ops.json file management
- **OP Level API Endpoints** - REST API for OP level management (#286)
  - `PUT /api/servers/:name/ops/:player/level` endpoint
  - OP level infrastructure with validation
- **OP Level Console Web UI** - Web interface for OP level management (#287)
  - `OpLevelBadge` component for visual OP level display
  - `OpLevelSelector` component for interactive level selection
  - OP level management integrated into OpManager

### Fixed
- **Console Sign-out 403 LAN IP Bug** - Fix typed `getServerSession` wrapper and allow private network origins (#300, #301)
  - Sign-out was failing with 403 error when accessing from LAN IP addresses
  - Added private network IP ranges to trusted origins
- **Offline Player Management** - Support for managing players who are not currently online (#288, #289)

### Changed
- **User Profile Settings** - Add password change functionality to user profile page (#265, #266)
- **Service Isolation** - Isolate service node_modules into `.services/` directory (#262, #267)
- **Template Path Resolution** - Fix MCCTL_TEMPLATES path resolution and console modLoader validation (#263, #264)

## [1.15.5] - 2026-02-08

### Fixed
- **CLI Better Auth Password Hashing** - Fix scrypt salt to use hex string instead of raw bytes in console-db.ts
  - Better Auth uses hex-encoded salt STRING as the scrypt salt parameter, not raw bytes
  - Previously, CLI-created passwords were incompatible with Better Auth's verification
  - Now matches Better Auth's exact hashing behavior for cross-system password compatibility
- **CLI ecosystem.config.cjs MCCTL_API_KEY** - Add `MCCTL_API_KEY` environment variable to mcctl-console PM2 config (#261)
  - Console service now receives the API key for authenticated API communication
  - Only added when API key is configured during `mcctl console init`

## [1.15.4] - 2026-02-08

### Fixed
- **Console Better Auth Config** - Explicitly pass `baseURL` and `secret` to Better Auth configuration
  - Better Auth was not auto-detecting environment variables in some deployment scenarios
  - Now reads `BETTER_AUTH_BASE_URL` and `BETTER_AUTH_SECRET` explicitly in config
- **Console HTTP Session Persistence** - Fix login redirect loop in HTTP environments
  - Added `advanced.useSecureCookies` toggle based on protocol detection
  - Previously, production mode defaulted to Secure cookies, causing browsers to reject cookies over HTTP (e.g., `http://192.168.x.x:5000`)
  - Resolves 307 redirect loop after successful login on HTTP deployments
- **Console trustedOrigins Dedup** - Remove duplicate `localhost:5000` entry from trustedOrigins
  - Only add `baseURL` to trustedOrigins when it differs from the default `http://localhost:5000`

## [1.15.3] - 2026-02-08

### Fixed
- **CLI BETTER_AUTH_BASE_URL** - Fix environment variable name from `BETTER_AUTH_URL` to `BETTER_AUTH_BASE_URL` in ecosystem.config.cjs generation
  - Better Auth reads `BETTER_AUTH_BASE_URL`, not `BETTER_AUTH_URL`
  - Resolves authentication failures in Management Console when deployed via PM2
- **Console trustedOrigins Env Var** - Fix `process.env.BETTER_AUTH_URL` to `process.env.BETTER_AUTH_BASE_URL` in auth.ts trustedOrigins
  - Ensures production-deployed console correctly includes the base URL in trusted origins
- **Console DB Path with MCCTL_ROOT** - Use `MCCTL_ROOT` environment variable for database path resolution in db.ts
  - `process.cwd()` fallback preserved when MCCTL_ROOT is not set
  - Fixes DB path issues in standalone Next.js where cwd may differ from expected
- **Console user_servers Table Missing** - Add `user_servers` table to auto-creation DDL in db.ts
  - Previously only 4 of 5 required tables were auto-created (users, accounts, sessions, verifications)
  - Now creates all 5 tables including user_servers with proper index
- **Audit DB Path** - Move audit.db from `MCCTL_ROOT/audit.db` to `MCCTL_ROOT/data/audit.db`
  - Aligns with mcctl.db location in the same `data/` directory
  - Applied to both CLI (container.ts) and API (audit-log-service.ts)
- **Console .env.example Sync** - Update `BETTER_AUTH_URL` to `BETTER_AUTH_BASE_URL` in .env.example and auth.test.ts

## [1.15.2] - 2026-02-08

### Fixed
- **CLI ecosystem.config.cjs Environment Variables** - Replace `NEXTAUTH_SECRET`/`NEXTAUTH_URL` with `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` in `generateEcosystemConfig()`
  - Better Auth reads `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, not NEXTAUTH variants
  - Resolves 500 Internal Server Error when accessing Management Console after `mcctl console init`
- **Console SQLite Table Auto-Creation** - Add `CREATE TABLE IF NOT EXISTS` for Better Auth core tables on app startup
  - Auto-creates `users`, `accounts`, `sessions`, `verifications` tables when DB file is empty or tables are missing
  - Prevents crash on first run or when DB is recreated
  - Enables `foreign_keys` pragma for referential integrity

## [1.15.1] - 2026-02-08

### Fixed
- **Console Auth BaseURL** - Change Better Auth client baseURL default from `http://localhost:5000` to empty string for production deployment
  - Browser previously sent auth requests to `localhost:5000` instead of the deployed host
  - Now uses relative URLs that correctly match the deployed server address
- **Console Trusted Origins** - Add `NEXT_PUBLIC_APP_URL` environment variable support to trustedOrigins
  - Enables flexible production origin configuration for cross-origin auth requests

## [1.15.0] - 2026-02-08

### Added
- **Console Auto-Install in Console Init** - `mcctl console init` now automatically installs `@minecraft-docker/mcctl-console` package if not already present (#dbfeb38)
  - Detects missing mcctl-console package during initialization
  - Prompts user for auto-installation with npm
  - Streamlines Management Console setup to a single command

### Fixed
- **Service Script Path Resolution** - Resolve service script paths independently for each service (#4243391)
  - Previously, service scripts shared a single path resolution, causing errors when services were installed in different locations
  - Each service now resolves its own script path independently
- **Modpack Version Prompt Trim Error** - Add defaultValue to modpack version prompt to prevent trim error on undefined values (#62c9068)
  - Fix crash when modpack version selection returned undefined
  - Add safe default value handling for version prompt

## [1.14.0] - 2026-02-08

### Added
- **MODRINTH Modpack Server Creation (CLI)** - Create servers from Modrinth modpacks with interactive search (#244)
  - `mcctl create --modpack` flag enables modpack server creation flow
  - Modrinth API integration for modpack search, version listing, and loader detection
  - Dynamic mod loader filtering: only show loaders the modpack actually supports
  - Automatic environment variable configuration (TYPE=MODRINTH, MODRINTH_MODPACK, etc.)
- **MODRINTH Modpack Server Creation (Web Console)** - Modpack server creation UI in Management Console (#246)
  - Modpack search with debounced input in CreateServerDialog
  - Version and loader selection with dynamic filtering
  - Extended `CreateServerRequest` type with modpack fields (modpackSlug, modpackVersion, modpackLoader)
- **NeoForge Mod Loader Option** - NeoForge added to mod loader selection in CLI, API, and Web Console
  - Available as mod loader choice when creating modpack servers
  - Filtered dynamically based on modpack support via Modrinth API

## [1.13.0] - 2026-02-07

### Added
- **Unified Prerequisite Checker** - Consolidated dependency validation for `mcctl init` and `mcctl console init` (#241)
  - `PrerequisiteChecker` in shared package with `checkPlatformPrerequisites()` and `checkConsolePrerequisites()`
  - `getDockerVersion()` and `getDockerComposeVersion()` version parsing functions
  - `satisfiesMinVersion()` semver comparison utility
  - `displayPrerequisiteReport()` CLI display helper with color-coded output
  - 20 unit tests added, total 120 tests passing
- **Console npm Publishing** - `@minecraft-docker/mcctl-console` now published to npm as standalone package
  - `bin/start.js` entry script supporting monorepo and flat standalone builds
  - Release workflow updated with mcctl-console publish step
- **Console --force Option** - `mcctl console service stop/restart --force` for forceful PM2 process termination (#238)
- **Console Routing Page** - Settings renamed to Routing with Avahi mDNS monitoring (#240)

### Fixed
- **Console Build** - Add `export const dynamic = 'force-dynamic'` to all 22 API routes to prevent `SQLITE_BUSY` error during Next.js static page data collection at build time

### Changed
- **init Command** - Replace inline Docker/Compose/avahi checks with unified `checkPlatformPrerequisites()`
- **console init Command** - Replace inline Node.js/PM2 checks with unified `checkConsolePrerequisites()`
- **System Requirements** - CLAUDE.md updated with runtime/development separation, PM2 requirement, port table

### Infrastructure
- **E2E Workflow** - Add mcctl-console to PM2 config, health checks, and error log collection
- **DevContainer** - Forward port 5000 for console access

## [1.12.1] - 2026-02-07

### Fixed
- **Console TypeScript Types** - Add `not_created` status to all SSE and API interface type definitions
  - `useServerStatus` hook status union type
  - `useServersSSE` hook `ServerStatusMap` and `onStatusChange` callback
  - `IMcctlApiClient` `ServerSummary` interface
  - `ServerStatusEvent` type in events.ts

## [1.12.0] - 2026-02-06

### Added
- **All-Servers SSE Status Endpoint** - `GET /api/servers-status` for streaming all server statuses via Server-Sent Events
- **Server Detail Delete Menu** - MoreVert button with delete option and confirmation dialog on server detail page
- **API Audit Logging** - Automatic audit log recording for server create, delete, start, stop, and restart actions via REST API
  - `writeAuditLog()` helper function in audit-log-service for consistent logging
  - Audit events logged in server actions endpoint (start/stop/restart)

### Fixed
- **SSE URL Path** - Update SSE URL to `/api/sse/servers-status` in useServersSSE hook
- **Not Created Status Handling** - Handle `not_created` server status in card, list, and detail page views
- **Assign World Dialog** - Show all non-running servers in assign world dialog

### Refactored
- Extract `mapContainerStatus()` and `mapHealthStatus()` to module-level functions in servers route

## [1.11.0] - 2026-02-06

### Added
- **World Management UI** - Full world management interface in Web Console (#175)
  - World list page with size, lock status, and server assignment display
  - World reset functionality with safety confirmation dialog
  - Integration with server detail page for per-server world operations
- **Server Options Tab** - Configuration management UI in Web Console (#229)
  - Server config viewing and editing through web interface
  - Real-time config updates via REST API
- **SSE Real-time Server Status** - Replace polling with Server-Sent Events for live server status updates (#223)
  - Efficient real-time updates without polling overhead
  - Automatic reconnection on connection loss
- **Server Config & World Reset API** - New REST endpoints for server configuration and world management (#229)
  - `GET/PUT /api/servers/:name/config` - Server configuration endpoints
  - `POST /api/servers/:name/world/reset` - World reset endpoint with safety checks
- **Shared Package in Update** - Add `@minecraft-docker/shared` to `mcctl update --all` scope

### Fixed
- **Path Traversal Prevention** - Security fix to prevent path traversal attacks in world reset endpoint
- **Container Status Checks** - Verify container is stopped before allowing world reset operations
- **Force Update Check** - Always perform update check when running `mcctl update` (bypass cache)

### Tests
- Add tests for ConfigService, config routes, and useServersSSE hook

## [1.10.0] - 2026-02-05

### Added
- **Audit Log System** - Comprehensive activity tracking across CLI, API, and Web Console (#234, #235)
  - **Domain**: `AuditLog` entity with `AuditActionEnum` value object supporting 13 action types (server lifecycle, player management, audit purge)
  - **Infrastructure**: `SqliteAuditLogRepository` adapter with better-sqlite3, WAL mode, auto-migration, and configurable auto-cleanup
  - **CLI**: `mcctl audit` command with `list`, `purge`, and `stats` subcommands, supporting filtering by action, actor, target, status, and date range
  - **API**: 5 REST endpoints - list (GET /api/audit), stats (GET /api/audit/stats), detail (GET /api/audit/:id), purge (DELETE /api/audit), and SSE stream (GET /api/audit/stream)
  - **Web UI**: Full audit log page with `AuditLogTable`, `AuditLogFilters`, `AuditLogStats`, `AuditLogDetail`, and `AuditLogExport` components
  - **Dashboard**: `RecentActivityFeed` widget showing latest audit events
  - **Server Detail**: Activity tab with per-server audit log view
  - **Audit Integration**: Automatic logging in CreateServerUseCase, DeleteServerUseCase, start/stop commands, and all player management commands (whitelist, ban, op, kick)
  - **Configuration**: `AUDIT_AUTO_CLEANUP` (default: true) and `AUDIT_RETENTION_DAYS` (default: 90) environment variables
  - **Tests**: 29 CLI tests + 16 domain/infrastructure tests for comprehensive coverage

## [1.9.0] - 2026-02-05

### Added
- **`mcctl update --all` flag** - Update CLI and all installed services (mcctl-api, mcctl-console) in a single command
  - Automatically runs `npm install <package>@latest` for each installed service
  - Restarts PM2 processes after successful update
  - Supports `--check --all` to view available service updates without installing
  - Shows version comparison and update status for each service

## [1.8.0] - 2026-02-05

### Added
- **Web Console sudo password support** - Pass sudo password from CreateServerDialog to server creation API for mDNS hostname registration (#230)
- **Dashboard ChangelogFeed** - Replace placeholder ActivityFeed with real ChangelogFeed component that fetches CHANGELOG.md from GitHub

### Changed
- **CreateServerRequest schema** - Add optional `sudoPassword` field (writeOnly) to server creation API
- **Dashboard layout** - Replace ActivityFeed with ChangelogFeed showing recent project updates

## [1.7.12] - 2026-02-05

### Fixed
- **TEMPLATE_DIR path duplication** - Correct TEMPLATE_DIR path in create-server.sh that caused duplicate directory segments (#230)
- **API error reporting** - Improve error reporting for server creation script failures with stderr capture (#230)

## [1.7.11] - 2026-02-04

### Fixed
- **World size calculation** - Check LEVEL config before WORLD_NAME for correct world directory resolution
  - itzg/minecraft-server uses LEVEL to specify the world directory name
  - Servers configured with LEVEL (like Wild-Deity) were showing "0 B" for world size
  - Now properly checks LEVEL first, then falls back to WORLD_NAME

## [1.7.10] - 2026-02-04

### Added
- **Console UI ANSI color support** - Display colored log output using ansi-to-html library
- **Loading indicator** - nprogress loading bar for page navigation
- **Console UX improvements** - Hide RCON toggle, fullscreen console dialog, Ubuntu font
- **SSE streaming for server creation** - Real-time progress updates during server creation (#227, #228)

### Fixed
- **MCCTL_ROOT path resolution** - Fix relative path '.' to absolute path
- **Player list parsing** - Remove ANSI escape codes from RCON response for correct parsing

## [1.7.9] - 2026-02-03

### Fixed
- Fix YAML syntax error in E2E workflow configuration
- Resolve CI pipeline failure due to malformed YAML

## [1.7.8] - 2026-01-31

### Added
- **Selective console service support** - Choose which services to start (api/console/all) during `mcctl console init` (#203)
- Improved service selection prompts for Management Console setup

### Fixed
- Correct environment variable names for mcctl-api authentication (`MCCTL_*` prefix) (#203)
- Fix PM2 service management with selective service control

## [1.7.7] - 2026-01-31

### Added
- **Auto-install mcctl-api on console init** - When running `mcctl console init`, mcctl-api package is now automatically installed if not already present
- Streamlined Management Console setup process

## [1.7.6] - 2026-01-31

### Added
- **mcctl-api npm publishing support** - First npm release of REST API package
- Add @minecraft-docker/mcctl-api package to npm registry
- Update release workflow to include mcctl-api in npm publish step

## [1.7.5] - 2026-01-31

### Fixed
- Fix Edge runtime error in mcctl-console middleware (#201)
- Resolve `@better-auth/*` package compatibility issue with Next.js Edge runtime
- Move middleware to use Node.js runtime instead of Edge runtime

## [1.7.4] - 2026-01-31

### Fixed
- Add CHANGELOG.md with v1.7.1-1.7.3 hotfix history

## [1.7.3] - 2026-01-31

### Fixed
- Fix Docker network warning when running `mcctl up` (#199)
- Mark `minecraft-net` as external network in docker-compose.yml

## [1.7.2] - 2026-01-31

### Fixed
- Fix "Unknown error occurred" when avahi-daemon is not installed (#197)
- Add `|| true` to prevent script exit on optional avahi registration

## [1.7.1] - 2026-01-31

### Fixed
- Fix "Script not found: create-server.sh" error when mcctl installed via npm (#195)
- Bundle scripts/ and templates/ directories with CLI npm package
- Add `getCliPackageRoot()` function for correct path resolution

## [1.7.0] - 2026-01-31

### Added
- **Router Status API** (`GET /api/router/status`) - Real-time mc-router status (#157, #171)
- **Server Create/Delete API** (`POST/DELETE /api/servers/:name`) - REST API for server management (#154, #172)
- **Player Management API** - Whitelist, ban, op, kick operations via REST (#155, #173)
- **Backup API** (`POST /api/backup/:name`) - Trigger backups via REST (#156, #173)
- **mcctl init --reconfigure** - Reconfigure existing installation (#170)
- **E2E Tests** - Comprehensive API tests for router, players, backup, server create/delete
- **CLI E2E Tests** - Vitest-based e2e tests for CLI commands

### Changed
- Update XP methodology documentation in PRD
- Improve /work command with context mode and e2e test requirements
- Add issue checkbox update instructions to /work command
- Agent documentation updates for multi-agent collaboration

### Documentation
- Add mcctl-console implementation plan with GitHub issues #174-#190
- Update Management Console documentation for new API endpoints

## [1.6.16] - 2026-01-31

### Changed
- Add README Changelog sync instructions to release-manager and technical-writer agents
- Ensure npm package page displays latest changelog entries in README.md

## [1.6.15] - 2026-01-31

### Added
- New `mcctl backup init` command for interactive GitHub backup setup (#167)
  - Guided prompts for GitHub token, repository, and branch configuration
  - Automatic `.env` file update with backup settings
  - Token validation and repository existence check

### Fixed
- Include `scripts/` directory in npm package for template initialization

### Tests
- Add comprehensive tests for BackupUseCase.init() (12 test cases)

## [1.6.14] - 2026-01-31

### Fixed
- Sync all package versions to tag version before npm publish
- CI workflow now automatically updates all monorepo package versions to match Git tag

### Changed
- Split CLAUDE.md into modular files for better performance

## [1.6.13] - 2026-01-31

### Fixed
- Sync CHANGELOG.md to CLI package for npm page display
- Add automatic CHANGELOG sync to release workflow

## [1.6.12] - 2026-01-31

### Fixed
- **Critical**: Add missing `EXTRA_ARGS=--universe /worlds/` to npm package template (#165)
  - **Problem**: Servers created with `mcctl create` stored worlds in `/data/` instead of shared `/worlds/` directory
  - **Impact**: Shared world storage feature was non-functional; worlds were recreated on server restart
  - **Affected versions**: 1.6.8 ~ 1.6.11 (npm package users only)

### Migration Guide for Affected Users

If you created servers with mcctl versions 1.6.8 ~ 1.6.11, follow these steps:

#### Option 1: Use Migration Command (Recommended)

```bash
# Check which servers need migration
mcctl migrate status

# Migrate all servers (moves world data and updates config)
mcctl migrate worlds --all

# Or migrate specific server
mcctl migrate worlds myserver
```

#### Option 2: Manual Fix

**Step 1**: Add `EXTRA_ARGS` to server's config.env:

```bash
# For each affected server
echo 'EXTRA_ARGS=--universe /worlds/' >> ~/minecraft-servers/servers/<server-name>/config.env
```

Or add to global `.env` (applies to all servers):

```bash
echo 'EXTRA_ARGS=--universe /worlds/' >> ~/minecraft-servers/.env
```

**Step 2**: Move existing world data:

```bash
cd ~/minecraft-servers

# Stop server first
mcctl stop <server-name>

# Move world from data/ to worlds/
mv servers/<server-name>/data/<level-name> worlds/<level-name>

# Start server
mcctl start <server-name>
```

**Step 3**: Verify world is loading correctly:

```bash
mcctl logs <server-name> -f
# Should NOT see "No existing world data, creating new world"
```

#### How to Check if Affected

Your server is affected if:

1. Created with `mcctl create` (versions 1.6.8 ~ 1.6.11)
2. World data exists in `servers/<name>/data/<world>/` instead of `worlds/<world>/`
3. Server logs show "No existing world data, creating new world" on restart

```bash
# Quick check: If this shows world folders, you're affected
ls ~/minecraft-servers/servers/*/data/*/level.dat 2>/dev/null
```

## [1.6.11] - 2026-01-31

### Fixed
- Include CHANGELOG.md in npm package for proper changelog display on npmjs.com

## [1.6.10] - 2026-01-30

### Added
- System Requirements section in README.md
- Management Console (Web Console + REST API) in Features list
- AI Assistant link for user support
- CHANGELOG.md with version history

### Changed
- Reorganized README.md Documentation section with Read the Docs links
- Updated External Links to include project-specific resources

### Fixed
- Broken documentation links in README.md

## [1.6.9] - 2026-01-30

### Fixed
- Fix template file naming for npm compatibility (`.gitignore` → `gitignore.template`)
- Fix `-v` flag conflict with `--version` in CLI argument parsing

### Changed
- Sync shared package version for release consistency

## [1.6.8] - 2026-01-30

### Fixed
- Add missing template files to npm package distribution
- Include `templates/` directory in package.json files array

## [1.6.7] - 2026-01-29

### Added
- Version update check with 24-hour cache (#160, #161)
- Display notification when newer version available on npm

## [1.6.6] - 2026-01-29

### Fixed
- Correct system architecture diagram in documentation
- Convert ASCII diagrams to Mermaid for proper rendering

### Changed
- Rename NotebookLM to AI Assistant chatbot
- Simplify mcctl-api Internal Architecture diagram

## [1.6.5] - 2026-01-28

### Added
- REST API reference documentation
- AI Assistant help section to homepage
- NotebookLM AI Assistant link to navigation

### Fixed
- Remove mcctl-console from E2E tests (not yet implemented)

## [1.6.4] - 2026-01-27

### Fixed
- Skip already published npm packages in release workflow
- Add mod-source-modrinth package to release workflow (#158, #159)

## [1.6.3] - 2026-01-27

### Added
- Comprehensive LLM knowledge base update for ChatGPT integration

### Fixed
- World new command to create directory and .meta file correctly

## [1.6.2] - 2026-01-26

### Added
- API documentation with implementation status and SSE streaming
- Admin service documentation for native PM2 services (#142, #153)
- E2E tests using PM2 instead of Docker (#141, #152)
- Console init for native PM2 execution (#137, #151)
- PM2 service management types (#135, #144)
- PM2 ecosystem template (#139, #143)
- Console remove command
- Port configuration to console init

### Changed
- Optimize console for native PM2 execution (#140, #150)
- Remove Docker configs from API and Console (#147, #148, #149)
- Remove Docker dependencies from API for native execution (#138, #145)
- Migrate console service commands to PM2 (#146)

### Fixed
- Auto-build Docker images from source when missing

## [1.6.1] - 2026-01-25

### Changed
- Major refactoring for PM2 native service execution
- Remove Docker dependency for Management Console

## [1.6.0] - 2026-01-24

### Added
- Management Console: REST API (mcctl-api) + Web Console (mcctl-console)
- `mcctl console` commands for admin service management
- User management with role-based access
- API key authentication support

### Changed
- Deprecated `mcctl admin` commands (use `mcctl console` instead)

## [1.5.0] - 2026-01-20

### Added
- Mod management commands (`mcctl mod search/add/remove/list/sources`)
- Modrinth, CurseForge, Spiget, and direct URL mod sources
- Server backup/restore commands (`mcctl server-backup`, `mcctl server-restore`)

## [1.4.0] - 2026-01-15

### Added
- Player management commands (whitelist, ban, op, kick)
- World management improvements with `.meta` file support
- Interactive world selection in `mcctl create`

## [1.3.0] - 2026-01-10

### Added
- nip.io magic DNS support for hostname routing
- VPN mesh network support (Tailscale, ZeroTier)
- Migration script for existing servers to nip.io

### Changed
- Dual hostname generation: `.local` and `.nip.io`

---

For older versions, see [GitHub Releases](https://github.com/smallmiro/minecraft-server-manager/releases).
