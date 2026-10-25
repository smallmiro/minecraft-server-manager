# Command Reference

Complete reference for all mcctl commands.

## Platform Commands

### mcctl init

Initialize the platform directory structure.

```bash
mcctl init [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--root <path>` | Custom data directory |
| `--skip-validation` | Skip the prerequisite checks (Node.js, Docker, Docker Compose, avahi) |
| `--skip-docker` | Do not create the `minecraft-net` Docker network |
| `--reconfigure` | Change the settings of an initialized platform, such as the host IP address(es), timezone and RCON password |
| `--playit-key <key>` | Enable playit.gg with this `PLAYIT_SECRET_KEY` (no question) |
| `--no-playit` | Do not enable playit.gg (no question) |
| `--upgrade` | Run [`mcctl upgrade`](#mcctl-upgrade) instead |

**Example:**

```bash
# Initialize in default location (~/minecraft-servers)
mcctl init

# Initialize in custom location
mcctl --root /opt/minecraft init
```

**What it creates:**

```text
~/minecraft-servers/
├── docker-compose.yml
├── .env
├── .gitignore
├── .mcctl.json
├── servers/
│   ├── compose.yml
│   ├── global.env
│   └── _template/
├── worlds/
├── shared/
│   ├── plugins/
│   └── mods/
└── backups/
```

`mcctl init` asks which host IP address(es) to use (`HOST_IP`, `HOST_IPS` in `.env`) and whether to enable playit.gg. It writes a random 24-character `RCON_PASSWORD` to `.env`. On a platform that is already initialized it changes nothing and points to `mcctl init --reconfigure`.

---

### mcctl up

Start all infrastructure (mc-router and all Minecraft servers).

```bash
mcctl up
```

**Example:**

```bash
mcctl up
```

Equivalent to `docker compose up -d`.

---

### mcctl down

Stop all infrastructure (mc-router and all Minecraft servers).

```bash
mcctl down
```

**Example:**

```bash
mcctl down
```

Stops all mc-* containers and runs `docker compose down`, which removes the containers. The `minecraft-net` network is declared `external` and is kept.

---

### mcctl router

Manage mc-router independently from Minecraft servers.

```bash
mcctl router <action>
```

**Actions:**

| Action | Description |
|--------|-------------|
| `start` | Start mc-router only |
| `stop` | Stop mc-router only |
| `restart` | Restart mc-router |

**Examples:**

```bash
# Start mc-router
mcctl router start

# Stop mc-router
mcctl router stop

# Restart mc-router (the container keeps its current settings)
mcctl router restart
```

mc-router handles hostname-based routing for all Minecraft servers. It must be running for clients to connect to any server.

**Configuration:**

The auto-scale settings are in the `environment:` of the `router` service in `<root>/docker-compose.yml`:

```yaml
  router:
    environment:
      AUTO_SCALE_UP: "true"            # Start a stopped server when a player connects
      AUTO_SCALE_DOWN: "true"          # Stop idle servers
      AUTO_SCALE_DOWN_AFTER: "10m"     # Idle timeout (1m, 5m, 10m, 30m, 1h)
      DOCKER_TIMEOUT: "120s"           # Container start timeout (Go time.Duration: 120s, 2m)
      AUTO_SCALE_ASLEEP_MOTD: "§e§lServer is sleeping§r\n§7Connect to wake up!"   # MOTD of a stopped server
```

Apply a change with `mcctl router start` (`docker compose up -d router` recreates the container). `mcctl router restart` keeps the old values. `mcctl upgrade` patches only the router `image` and `group_add`, so these edits survive an upgrade.

---

### mcctl status

Show status of all servers with various display options.

```bash
mcctl status [options]
mcctl status <server>
mcctl status router
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--detail` | `-d` | Show detailed info (memory, CPU, players, uptime) |
| `--watch` | `-W` | Real-time monitoring mode |
| `--interval <sec>` | | Watch refresh interval (default: 5) |
| `--json` | | Output in JSON format |

**Examples:**

=== "Basic Status"
    ```bash
    mcctl status
    ```

    **Output:**
    ```
    === Server Status (mc-router Managed) ===

    INFRASTRUCTURE
    SERVICE              STATUS       HEALTH     PORT/INFO
    -------              ------       ------     ---------
    mc-router            running      healthy    :25565 (hostname routing)
    avahi-daemon         running      (system)   mDNS broadcast

    MINECRAFT SERVERS
    SERVER               STATUS       HEALTH     HOSTNAME
    ------               ------       ------     --------
    survival             running      healthy    survival.local,survival.192.168.1.100.nip.io
    ```

=== "Detailed Status"
    ```bash
    mcctl status --detail
    ```

    **Output:**
    ```
    === Detailed Server Status ===

    INFRASTRUCTURE

      mc-router
        Status:    running (healthy)
        Port:      25565
        Mode:      --in-docker (auto-discovery)
        Uptime:    1d 1h 27m
        Routes:    2 configured
          - survival.local → mc-survival:25565
          - survival.192.168.1.100.nip.io → mc-survival:25565

      avahi-daemon
        Status:    running
        Type:      system

    MINECRAFT SERVERS

      survival
        Container: mc-survival
        Status:    running (healthy)
        Hostname:  survival.local,survival.192.168.1.100.nip.io
        Type:      PAPER
        Version:   1.21.1
        Memory:    4G
        Uptime:    1d 1h 16m
        Resources: 3.1 GB / 8.0 GB (38.8%) | CPU: 15.2%
        Players:   2/20 - Steve, Alex
    ```

=== "JSON Output"
    ```bash
    mcctl status --json
    ```

    **Output:**
    ```json
    {
      "router": {
        "name": "mc-router",
        "status": "running",
        "health": "healthy",
        "port": 25565
      },
      "avahi_daemon": {
        "name": "avahi-daemon",
        "status": "running",
        "type": "system"
      },
      "servers": [
        {
          "name": "survival",
          "container": "mc-survival",
          "status": "running",
          "health": "healthy",
          "hostname": "survival.local,survival.192.168.1.100.nip.io"
        }
      ]
    }
    ```

=== "Single Server"
    ```bash
    mcctl status survival
    ```

    **Output:**
    ```
    === Server: survival ===

      survival
        Container: mc-survival
        Status:    running (healthy)
        Hostname:  survival.local,survival.192.168.1.100.nip.io
        Type:      PAPER
        Version:   1.21.1
        Memory:    4G
        Uptime:    1d 1h 16m
        Resources: 3.1 GB / 8.0 GB (38.8%) | CPU: 18.2%
        Players:   2/20 - Steve, Alex
    ```

=== "Router Status"
    ```bash
    mcctl status router
    ```

    **Output:**
    ```
    === mc-router Status ===

      Status:    running (healthy)
      Port:      25565
      Mode:      --in-docker (auto-discovery)
      Uptime:    1d 1h 27m

    ROUTING TABLE

      HOSTNAME                                 TARGET                    STATUS
      --------                                 ------                    ------
      survival.local                           mc-survival:25565         running
      survival.192.168.1.100.nip.io            mc-survival:25565         running
    ```

=== "Real-time Monitoring"
    ```bash
    # Default 5 second refresh
    mcctl status --watch

    # Custom 2 second refresh
    mcctl status --watch --interval 2
    ```

---

### mcctl update

> Full release upgrade procedure with post-upgrade verification: [Upgrade Runbook](../advanced/upgrade-runbook.md).

Check for updates and update mcctl CLI and services to the latest version.

```bash
mcctl update [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--cli-only` | Update only the mcctl CLI binary (opt out of the full update) |
| `--check` | Show the available updates for the CLI and the installed services; install nothing |
| `--yes` | Do not ask before updating, and do not recreate stopped servers (see **Stopped servers** below) |
| `--all` | Deprecated alias — same as the default (kept for backward compatibility) |

By default `mcctl update` updates the CLI, the installed services (mcctl-api, mcctl-console, `shared`) and the server images. `--cli-only` updates just the CLI binary.

A server's image tag follows its `VERSION` (for example `java21` for 1.21.1). A release tag such as `itzg/minecraft-server:2026.10.0-java21` or a digest (`java21@sha256:…`) in `server.yaml` is a pin and is kept, so a server can stay on a known-good image while an upstream regression is open. If the pinned Java is older than `VERSION` needs, `mcctl update` warns and still keeps it. Once the fix is released, set the tag back to the one for its `VERSION`.

**Examples:**

=== "Check for Updates"
    ```bash
    mcctl update --check
    ```

    **Output (update available):**
    ```
    mcctl Version Info

      Installed: 3.0.1
      Latest:    3.0.2

      Update available: 3.0.1 → 3.0.2
    ```

    **Output (up to date):**
    ```
    mcctl Version Info

      Installed: 3.0.2
      Latest:    3.0.2

      You are using the latest version.
    ```

    Without `--cli-only`, the services are listed after it (for example `Update available` or `Up to date`).

=== "Update CLI Only"
    ```bash
    mcctl update --cli-only
    ```

    After the version info it asks `Update mcctl to 3.0.2?` (unless `--yes`), then prints:

    ```
    ✓ mcctl updated successfully!
    ```

=== "Update Everything (default)"
    ```bash
    mcctl update
    ```

    **Output (after the CLI update):**
    ```
    Updating services...

      mcctl-api        3.0.1 → 3.0.2  ✓ Updated & restarted
      mcctl-console    3.0.1 → 3.0.2  ✓ Updated & restarted

    Checking server image compatibility...
      ✓ survival: java21 (VERSION=1.21.1 - compatible)

    Updating Docker images...

      ✓ itzg/minecraft-server:java21

    Applying new images to stopped servers...
      ✓ survival: up to date

      Completed in 41.8s
    ```

=== "Auto-confirm (CI/CD)"
    ```bash
    mcctl update --yes
    ```

**Behavior Details:**

- **Update check before each command**: Before every command except `--help` and `--version`, mcctl checks npm for a newer CLI version and prints a notice when there is one. The result is cached for 24 hours in `~/.mcctl-update-check.json`; without a fresh cache entry the command waits up to 2 seconds for npm.
- **`--check` exit codes**: Exit code `1` if a newer CLI version is available or npm cannot be reached, `0` if the CLI is up to date. Service updates do not change the exit code. Useful for scripting.
- **Default (full update)**: After updating the CLI (also when the CLI is already up to date):
    - `mcctl-api` and `mcctl-console`: Installs latest version and restarts the PM2 service
    - `shared` library: Installs latest version (no restart needed)
    - Each server's image tag is set to the tag recommended for its `VERSION` through `server.yaml` (pinned tags are kept, see above), then the servers' Docker images are pulled
- **Stopped servers**: mc-router auto-scale starts the existing container, so a stopped server keeps its old image until its container is recreated. After pulling, `mcctl update` lists the stopped (`exited` or `created`) servers whose container does not use the pulled image; servers already on it are shown as `up to date`. In a terminal it asks `Recreate the stopped servers now so they use the new image?` (default No). Yes runs `docker compose up --no-start --no-deps mc-<server>` for each of them and prints a rollback command (`docker tag <old image ID> <image> && docker compose up --no-start --no-deps mc-<server>`). With `--yes`, or without a terminal, nothing is recreated and the `docker compose up --no-start --no-deps` command is printed for each server. Running servers keep their image until you run `mcctl stop <server> && mcctl start <server>`.
- **`--cli-only` flag**: Updates only the mcctl CLI binary and skips services/images.

!!! tip "Scripting with --check"
    Use `--check` in scripts to conditionally trigger updates:

    ```bash
    if ! mcctl update --check > /dev/null 2>&1; then
      mcctl update --yes
    fi
    ```

!!! note "update vs upgrade"
    `mcctl update` updates the CLI and service **packages** from npm.
    `mcctl upgrade` migrates platform **configuration files** and templates to a new version.

### mcctl upgrade

> Full release upgrade procedure with post-upgrade verification: [Upgrade Runbook](../advanced/upgrade-runbook.md).

Migrate platform configuration files to the installed mcctl version.

```bash
mcctl upgrade [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without modifying files |
| `--non-interactive` | Apply without prompting |
| `--root <path>` | Custom data directory |

**What it does:**

1. Appends new variables from the bundled `.env.example` to `.env` (existing values are never changed). In a terminal it asks for a value for each new variable (Enter keeps the default); `--non-interactive` writes the defaults
2. Detects the Docker socket group ID and writes `DOCKER_GID` to `.env` (needed by non-root mc-router 1.46+)
3. Patches the `router` service in the root `docker-compose.yml` (see below)
4. Updates `servers/_template/` files and records `templateVersion` in `.mcctl.json`
5. Creates `servers/global.env` if it is missing and points each server's `docker-compose.yml` at it instead of the platform `.env`, so platform secrets no longer reach the servers. Existing containers keep the old environment until they are recreated: run `mcctl stop <server> && mcctl start <server>` for each server it lists
6. Moves `BETTER_AUTH_SECRET` and `BETTER_AUTH_BASE_URL` from `ecosystem.config.cjs` into `.env` (backup: `ecosystem.config.cjs.bak-<timestamp>`); apply with `mcctl console service restart --console`
7. Lists the servers that have no `server.yaml` yet and writes nothing; they are imported on their next change, or with [`mcctl migrate spec`](#mcctl-migrate-spec)
8. Adds `installId` to `.mcctl.json` if it is missing (an existing value is kept)
9. (v3.0.0+) If `<root>/scripts` exists, prints its path, a warning that it is unused since v3.0.0 and may hold files you edited yourself, and the link to the [script to mcctl table](../advanced/upgrade-runbook.md#v300-scripts). In a terminal it asks `Remove <path>?` (default `N`) and deletes only on `y`. With `--non-interactive` or without a terminal it prints a hint (`rm -r <path>`) and deletes nothing. With `--dry-run` it only prints `Would ask before removing <path>.`. A symbolic link is unlinked, never followed. There is no option to skip the question.

**docker-compose.yml router patch:** only the `router` service's `image` tag and `group_add` entry are aligned with the bundled template. Other services, ports, comments, and line endings are kept.

- A line diff is shown, then you are asked to confirm (`--non-interactive` applies without asking, `--dry-run` shows the diff only)
- The original file is backed up as `docker-compose.yml.bak-<timestamp>` and restored if writing fails
- After a successful patch, mc-router is recreated with `docker compose up -d router` (running servers are not affected)
- If the file cannot be patched automatically, a warning shows the lines to add by hand
- If the compose update fails, the remaining steps still run and the command exits with code `1`

```bash
mcctl upgrade --dry-run
mcctl upgrade
mcctl upgrade --non-interactive
```

---

## Server Commands

### mcctl create

Create a new Minecraft server.

```bash
mcctl create [name] [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `name` | Server name (optional, prompts if not provided) |

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--type` | `-t` | Server type (default `PAPER`): PAPER, VANILLA, FORGE, NEOFORGE, FABRIC, SPIGOT, BUKKIT, PURPUR, QUILT, LEAF, FOLIA, PUFFERFISH, MODRINTH, AUTO_CURSEFORGE |
| `--version` | `-v` | Minecraft version: `-v 1.21.1`, `--version 1.21.1` or `--version=1.21.1` (default `LATEST`; modpack types use the modpack's version) |
| `--seed` | `-s` | World seed for generation. A negative seed works (`-s -123`); `--seed=<value>` takes any value |
| `--world-url` | `-u` | Download world from ZIP URL |
| `--world` | `-w` | Use existing world from worlds/ directory |
| `--modpack <slug>` | | Modpack slug; required with `-t MODRINTH` or `-t AUTO_CURSEFORGE` |
| `--modpack-version <version>` | | Modpack version (default: latest) |
| `--mod-loader <loader>` | | Mod loader of the modpack, e.g. `fabric`, `forge`, `neoforge`, `quilt` (omit to detect it from the modpack) |
| `--exclude-files <list>` | | Comma-separated files to leave out of the modpack, e.g. client-only mods |
| `--no-start` | | Create without starting |
| `--whitelist` | | Enable whitelist and add initial players (comma-separated, e.g. `Steve,Alex`) |
| `--enable-whitelist` | | Enable whitelist without initial players |
| `--no-whitelist` | | Disable whitelist (default; overrides the two options above) |
| `--playit-domain <domain>` | | playit.gg external domain of the server (e.g. `aa.example.com`) |
| `--sudo-password` | | Sudo password for mDNS registration (automation) |

New servers get 4G of memory (6G for modpack types) and the `itzg/minecraft-server` tag their `VERSION` needs, for example `java8` for 1.16.5 and `java21` for 1.21.1 (`java25` for `LATEST`, a modpack without `-v` and snapshots; see [Java Versions and Image Tags](../configuration/server-types.md#java-versions-and-image-tags)). Interactive `mcctl create` asks for the memory; afterwards change it with `mcctl config <name> MEMORY <size>`. For modpack details see [Modpacks](../mods-and-plugins/modpacks.md).

!!! info "One world, one server"
    `--world` (and the default world `<name>` of a new server) is refused when another server already uses that world. See [World Assignment Rules](#world-assignment-rules).

!!! info "What create writes"
    `mcctl create` writes `servers/<name>/server.yaml` and renders `config.env`, `docker-compose.yml` and the `servers/compose.yml` entry from it ([Server Definition](../configuration/server-yaml.md)). If anything fails before the server exists, nothing is left behind, so the same command can be run again. If the server is created but does not start, it stays created and the command exits 1 with the cause; start it with `mcctl start <name>`.

!!! note "Whitelist is off by default"
    Servers created without a whitelist option have the whitelist **disabled**, so anyone with a premium (online-mode) account can join. Use `--whitelist` or `--enable-whitelist` to restrict access, or turn it on later with `mcctl whitelist <server> on`. In interactive mode you are asked "Enable whitelist?" (default No) and only asked for players when you answer Yes. Servers created from the Web Console are also created with the whitelist off.

    Premium account authentication (`ONLINE_MODE=TRUE`) is unchanged and stays on. Servers created before this change keep their existing whitelist setting.

!!! tip "Automation with Sudo Password"
    When automating server creation in CI/CD pipelines, you can provide the sudo password for mDNS registration:

    - Environment variable: `MCCTL_SUDO_PASSWORD`
    - CLI option: `--sudo-password`

    If avahi-daemon is installed and no password is provided, you will be prompted interactively.

**Examples:**

=== "Interactive Mode"
    ```bash
    mcctl create
    # Prompts for all options
    ```

=== "CLI Mode"
    ```bash
    # Basic Paper server
    mcctl create myserver

    # Forge server with specific version
    mcctl create modded -t FORGE -v 1.20.4

    # Server with world seed
    mcctl create survival -t PAPER -v 1.21.1 -s 12345

    # Using existing world
    mcctl create legacy -w old-world -v 1.20.4

    # Create without starting
    mcctl create myserver --no-start

    # Whitelist on with initial players
    mcctl create private --whitelist Steve,Alex

    # Whitelist on, add players later
    mcctl create private --enable-whitelist
    ```

=== "Modpack"
    ```bash
    # Modrinth modpack by slug
    mcctl create cobblemon -t MODRINTH --modpack cobblemon

    # Pin the modpack version and loader, leave out client-only mods
    mcctl create mypack -t MODRINTH --modpack <slug> --modpack-version <version> --mod-loader fabric --exclude-files <file1>,<file2>

    # CurseForge modpack by slug
    mcctl create mypack -t AUTO_CURSEFORGE --modpack <slug>
    ```

    For a guided setup, run `mcctl create` without a name and choose **Modrinth Modpack** or **CurseForge Modpack** under "Modpack Platforms". It then asks for the modpack slug, the mod loader, the modpack version and the files to exclude.

=== "Automation (CI/CD)"
    ```bash
    # Using environment variable for sudo password
    export MCCTL_SUDO_PASSWORD="your-password"
    mcctl create myserver -t PAPER -v 1.21.1

    # Using --sudo-password option
    mcctl create myserver --sudo-password "your-password"
    ```

**Server Types:**

| Type | Description | Plugins | Mods |
|------|-------------|---------|------|
| `PAPER` | High performance (Recommended) | Yes | No |
| `VANILLA` | Official Minecraft server | No | No |
| `FORGE` | Modded server for Forge mods | No | Yes |
| `NEOFORGE` | Modern Forge fork (1.20.1+) | No | Yes |
| `FABRIC` | Lightweight modded server | No | Yes |
| `SPIGOT` | Modified Bukkit server | Yes | No |
| `BUKKIT` | Classic plugin server | Yes | No |
| `PURPUR` | Paper fork with more features | Yes | No |
| `QUILT` | Modern modding toolchain | No | Yes |
| `LEAF` | Lightweight Paper fork | Yes | No |
| `FOLIA` | Multi-threaded Paper server for large worlds | Yes | No |
| `PUFFERFISH` | Paper fork for large servers | Yes | No |
| `MODRINTH` | Modrinth modpack server | No | Yes |
| `AUTO_CURSEFORGE` | CurseForge modpack server | No | Yes |

---

### mcctl delete

Delete a server.

```bash
mcctl delete [name] [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `name` | Server name (optional, shows list if not provided) |

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--yes` | `-y` | Skip confirmation |
| `--force` | | Delete even if players are online (implies `--yes`) |
| `--delete-world` | | Delete the world inside the server instead of moving it to `worlds/` |
| `--sudo-password` | | Sudo password for mDNS deregistration (automation) |

`mcctl delete` asks for confirmation. Without a terminal (scripts, CI) it refuses to delete unless you pass `--yes` or `--force`.

!!! info "Worlds outlive their server"
    - A world in `worlds/` is kept. It is only no longer assigned to the deleted server.
    - A world inside the server (`servers/<name>/data/<LEVEL>`, plus `<LEVEL>_nether` and `<LEVEL>_the_end`) is moved to `worlds/<LEVEL>` before the server directory is removed. You can assign it to another server afterwards.
    - If `worlds/` already has a folder with the same name, the delete stops and nothing is removed. Rename the folder in `worlds/`, or pass `--delete-world`.
    - `--delete-world` deletes the world inside the server. It never deletes worlds in `worlds/`; use [`mcctl world delete`](#mcctl-world-delete) for those.

Without `--delete-world`, the delete also stops before removing anything when the world cannot be kept with certainty:

- The server's world cannot be determined from `config.env`. `LEVEL` is read the way Docker Compose reads the file (quotes, a trailing comment and spaces around `=` are fine; the last `LEVEL` line wins), and the delete stops when the value is not a world name (letters, digits, `-`, `_`), uses `$` interpolation, or `EXTRA_ARGS` puts `--universe` somewhere mcctl does not support. These are the rules of [World Assignment Rules](#world-assignment-rules). Without any `LEVEL` line the world is `world`.
- `servers/<name>/` or its `data/` is a symlink, or only `<LEVEL>_nether`/`<LEVEL>_the_end` exist without `data/<LEVEL>`.
- Another world folder (one with `level.dat`, `level.dat_old`, `region/` or `*.mca` files, such as an old world from a previous `LEVEL`) would be deleted, or a symlink inside the server points to something inside the server. The message lists them.

If `worlds/` resolves to a folder inside the server (for example a symlink into `servers/<name>/`), the delete stops even with `--delete-world`. If the server's container cannot be stopped, or Docker cannot be queried, the delete stops and nothing is removed. If the server is running and its online players cannot be read over RCON, `mcctl delete <name>` refuses unless you pass `--force`.

No backup runs before the delete: the world is kept in `worlds/` (unless `--delete-world`). Only one delete of a server runs at a time: a second `mcctl delete` (or API delete) of the same server fails while the first one runs. Delete handles only the `servers/compose.yml` entry mcctl writes (`<name>/docker-compose.yml`); if you wrote another include entry for the server by hand (long form, extra compose files), the delete stops before changing anything and asks you to remove that entry first. The mDNS hostname `<name>.local` is removed from `/etc/avahi/hosts` after the server files are gone, with `sudo sed -i … /etc/avahi/hosts`, the command the README's sudoers `NOPASSWD` lines allow. The sudo password comes from `--sudo-password`, [`MCCTL_SUDO_PASSWORD`](#mcctl_sudo_password) or the prompt. If the removal fails (no password and no `NOPASSWD` rule, for example), the server is still deleted and `mcctl delete` prints a warning; remove the `<name>.local` line by hand. Files `mcctl delete` cannot remove from `servers/<name>/` (files the container wrote as root, for example) are a warning too, after the server is out of `servers/compose.yml`; remove them with the printed `sudo rm -rf` command.

**Examples:**

```bash
# Interactive - shows server list
mcctl delete

# Delete specific server with confirmation
mcctl delete myserver

# Delete without confirmation
mcctl delete myserver --yes

# Delete the server and the world inside it
mcctl delete myserver --yes --delete-world

# Automation with sudo password
MCCTL_SUDO_PASSWORD="your-password" mcctl delete myserver --yes
```

---

### mcctl start

Start a stopped server or all servers.

```bash
mcctl start <name>
mcctl start --all
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--all` | `-a` | Start all Minecraft servers (not router) |

**Examples:**

```bash
# Start single server
mcctl start myserver

# Start all servers
mcctl start --all
```

`mcctl start <name>` creates the container if needed and starts it (`docker compose up -d mc-<name>`). It exits with code 2 and a warning when the server is already running, and with code 1 when `servers/<name>/docker-compose.yml` does not exist.

!!! tip "Auto-Start"
    With mc-router, servers automatically start when a player connects.

---

### mcctl stop

Stop a running server or all servers.

```bash
mcctl stop <name>
mcctl stop --all
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--all` | `-a` | Stop all Minecraft servers (not router) |

**Examples:**

```bash
# Stop single server
mcctl stop myserver

# Stop all servers
mcctl stop --all
```

`mcctl stop <name>` exits with code 2 and a warning when the server is not running. `start` and `stop` exit with code 1 when Docker cannot be queried.

With `BACKUP_AUTO_ON_STOP=true` and a configured backup, `mcctl stop <name>` backs up the worlds after the server has stopped, the same way as [`mcctl backup push --auto`](#mcctl-backup-push): it never prompts and waits up to 10 minutes for a running backup. A failed backup prints a warning; the stop still succeeds (exit code 0). Stopping from the web console or the API (`POST /api/servers/<name>/stop`) runs the same backup in the background. `mcctl stop --all` does not back up.

---

### mcctl logs

View server logs.

```bash
mcctl logs <name|router> [options]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--follow` | `-f` | Follow log output |
| `--lines` | `-n` | Number of lines to show (default 50). With `-f`, shows the last N lines, then keeps following |
| `--json` | | Print the lines as a JSON array (not combinable with `-f`) |

**Examples:**

```bash
# Show last 50 lines
mcctl logs survival

# Follow logs in real-time
mcctl logs survival -f

# Show last 10 lines
mcctl logs survival -n 10

# mc-router logs
mcctl logs router
```

> Press Ctrl+C to end `-f`; the exit code is 0. `mcctl logs` does not cover avahi-daemon; run `journalctl -u avahi-daemon` yourself if needed.

**Output Example:**
```
[22:09:48] [Server thread/INFO]: Steve joined the game
[22:10:15] [Server thread/INFO]: Alex joined the game
[22:15:30] [Server thread/INFO]: <Steve> Hello everyone!
[22:15:45] [Server thread/INFO]: <Alex> Hi Steve!
[22:20:00] [Server thread/INFO]: Steve has made the advancement [Getting Wood]
[22:25:12] [Server thread/INFO]: Saving the game (this may take a moment!)
[22:25:12] [Server thread/INFO]: Saved the game
[22:30:00] [Server thread/INFO]: Alex left the game
[22:35:15] [RCON Listener #1/INFO]: Thread RCON Client started
[22:35:15] [RCON Client #1/INFO]: Thread RCON Client shutting down
```

---

### mcctl console

Connect to server RCON console. This is the same interactive session as [`mcctl rcon`](#mcctl-rcon).

```bash
mcctl console <name>
```

The subcommands `mcctl console init`, `service`, `user`, `api` and `remove` manage the Management Console instead; see [Console CLI Commands](../console/cli-commands.md). `mcctl admin <subcommand>` is a deprecated alias for them. A server with one of these names is reached with `mcctl rcon <name>`.

!!! note "Since v3.0.0: TCP RCON instead of `docker exec`"
    `mcctl console` connects to the server's RCON port over TCP (the container address, `RCON_PORT` and `RCON_PASSWORD`), like `mcctl rcon`. It used to run `docker exec -i mc-<name> rcon-cli`. The server must be running and its RCON port reachable from the host running `mcctl`. Type `exit` or `quit`, or press `Ctrl+C`/`Ctrl+D`, to leave. Piped input runs line by line (`printf 'list\n' | mcctl console myserver`). The session ends when the server closes the connection (for example after `stop`); a connection error exits with code 1.

**Example:**

```bash
mcctl console myserver
```

```
> list
There are 2 of a max of 20 players online: Steve, Alex
> say Hello everyone!
> tp Steve Alex
```

Press `Ctrl+C` to exit.

---

### mcctl rcon

Connect to an interactive RCON console for a Minecraft server. This opens a persistent session where you can execute multiple commands.

```bash
mcctl rcon <server>
```

**Example:**

```bash
$ mcctl rcon survival
[INFO] Connecting to RCON console for 'survival'...
[INFO] Connected! Type "help" for commands, "exit" or Ctrl+C to quit.

> list
There are 2 of a max of 20 players online: Steve, Alex
> say Server maintenance in 10 minutes!
[Server: Server maintenance in 10 minutes!]
> tp Steve 0 100 0
Teleported Steve to 0.0, 100.0, 0.0
> exit
```

**When to use `rcon` vs `exec`:**

| Command | Mode | Use Case |
|---------|------|----------|
| `mcctl rcon <server>` | Interactive | Manual administration, debugging, multiple commands |
| `mcctl exec <server> <cmd>` | Non-interactive | Scripts, automation, CI/CD, single commands |

For a complete list of available RCON commands, see [RCON Commands Reference](rcon-commands.md).

---

### mcctl exec

Execute a single RCON command on a server. This is the non-interactive alternative to `mcctl rcon`, useful for scripts and automation.

```bash
mcctl exec <server> <command...>
```

Negative numbers are passed as they are (`mcctl exec myserver tp Steve -1 64 -5`). Put a command with other arguments that start with `-` after `--`: `mcctl exec myserver -- say -h`.

**Examples:**

```bash
# Say message to all players
mcctl exec myserver say "Hello everyone!"

# Give items to player
mcctl exec myserver give Steve diamond 64

# List online players
mcctl exec myserver list

# Change weather
mcctl exec myserver weather clear

# Set time
mcctl exec myserver time set day

# Use in scripts
PLAYERS=$(mcctl exec myserver list)
if echo "$PLAYERS" | grep -q "There are 0 of"; then
  mcctl stop myserver
fi
```

---

### mcctl config

View or modify server configuration.

```bash
mcctl config <server> [key] [value] [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `server` | Server name |
| `key` | Configuration key (optional) |
| `value` | New value (optional). An empty value (`""`) removes the key, so the image default applies again |

**Shortcut Options:**

| Option | Description |
|--------|-------------|
| `--cheats` | Enable cheats (ALLOW_CHEATS=true) |
| `--no-cheats` | Disable cheats |
| `--pvp` | Enable PvP |
| `--no-pvp` | Disable PvP |
| `--command-block` | Enable command blocks |
| `--no-command-block` | Disable command blocks |

`--json` prints the values, or the change (`server`, `key`, `oldValue`, `newValue`), as JSON.

**Examples:**

=== "View All Config"
    ```bash
    mcctl config survival
    ```

    **Output:**
    ```
    Configuration for survival:

      TYPE=PAPER
      VERSION=1.21.1
      MEMORY=4G
      MODE=survival
      DIFFICULTY=normal
      MAX_PLAYERS=20
      VIEW_DISTANCE=10
      PVP=true
      SPAWN_PROTECTION=0
      LEVEL=survival-world
      ENABLE_RCON=true
      MOTD=Welcome to survival! Your adventure begins here.
      ALLOW_CHEATS=false
      ENABLE_COMMAND_BLOCK=true
      OPS=Steve
    ```

=== "View Single Key"
    ```bash
    mcctl config survival MOTD
    ```

=== "Set Value"
    ```bash
    mcctl config survival MOTD "Welcome to my server!"
    mcctl config survival MAX_PLAYERS 50
    ```

=== "Use Shortcuts"
    ```bash
    mcctl config survival --cheats
    mcctl config survival --no-pvp
    mcctl config survival --command-block
    ```

!!! note "Restart Required"
    Some configuration changes require a server restart to take effect.

!!! note "Removing a key"
    `mcctl config <server> MOTD ""` removes `MOTD` from the server's config and says so; a key that is not set is reported and nothing changes. `LEVEL` and `WORLD_NAME` cannot be removed this way: set a world name instead.

!!! warning "Changing `LEVEL`"
    `LEVEL` is the world the server uses (see [World Assignment Rules](#world-assignment-rules)). `mcctl config <server> LEVEL <world>` is refused while the server is running and when another server uses `<world>`. The same applies to `EXTRA_ARGS` when the new value moves the world between `worlds/` and `servers/<server>/data` (`--universe`).

---

## Server Backup & Restore

### mcctl server-backup

Back up a server's configuration files to `backups/servers/<server>/<id>.tar.gz`: `config.env`, `docker-compose.yml` and, when present, `server.yaml`, `data/ops.json`, `data/whitelist.json`, `data/banned-players.json`, `data/banned-ips.json` and `data/server.properties`. The ID is the creation time (`20260120-203357`).

```bash
mcctl server-backup <server> [options]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--message` | `-m` | Backup description |
| `--list` | | List all backups for server |
| `--json` | | Output in JSON format |

**Examples:**

```bash
# Backup with message
mcctl server-backup survival -m "Before upgrade"

# List all backups
mcctl server-backup survival --list
```

**Output Example (--list):**
```
Backups for survival:

  20260120-203357
    Created: 1/20/2026, 8:33:57 PM
    Size: 3 KB, Files: 7
    Description: Before upgrade

  20260118-150000
    Created: 1/18/2026, 3:00:00 PM
    Size: 3 KB, Files: 7
    Description: Initial setup
```

---

### mcctl server-restore

Restore server configuration from backup.

```bash
mcctl server-restore <server> [backup-id] [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation |
| `--dry-run` | Show what would be restored |
| `--json` | Output in JSON format |

**Examples:**

```bash
# Interactive - shows backup list
mcctl server-restore myserver

# Restore specific backup
mcctl server-restore myserver 20260120-203357

# Preview restoration
mcctl server-restore myserver 20260120-203357 --dry-run
```

It asks before restoring unless `--force` or `--json` is given. The current files are copied to `backups/servers/<server>/.pre-restore/` first. Restart the server to apply the restored files.

---

## Config Snapshots

### mcctl config-snapshot

Save and restore copies of a server's configuration files. A snapshot holds the files in `servers/<server>/` itself (not `data/`): `server.yaml`, `config.env`, `docker-compose.yml` and any other `.yml`, `.yaml`, `.json` or `.properties` file up to 1 MB. Snapshots are stored in `backups/meta/config-snapshots.db` and `backups/meta/config-snapshot-storage/`.

```bash
mcctl config-snapshot <list|create|show|diff|restore|delete> [args] [options]
```

| Command | Description |
|---------|-------------|
| `list [server]` | List snapshots, newest first (`--limit <n>`, default 20; `--json`) |
| `create <server>` | Create a snapshot (`--description "..."`; `--json`) |
| `show <id>` | Show a snapshot (`--files` lists its files; `--json`) |
| `diff <id1> <id2>` | Show what changed between two snapshots (`--files-only`; `--json`) |
| `restore <id>` | Write the snapshot's files back to `servers/<server>/`; asks first unless `--force` |
| `delete <id>` | Delete a snapshot; asks first unless `--force` |

The other commands need the full snapshot ID, which `list`, `create` and `list --json` print. A restore that changes the server's world follows the [World Assignment Rules](#world-assignment-rules). Restart the server to apply restored files.

**Examples:**

```bash
mcctl config-snapshot create survival --description "Before mod update"
mcctl config-snapshot list survival
mcctl config-snapshot diff <id1> <id2> --files-only
mcctl config-snapshot restore <id>
```

### mcctl config-snapshot schedule

Create snapshots on a schedule. The schedules are run by mcctl-api, which checks them every minute: a change made here applies within a minute.

| Command | Description |
|---------|-------------|
| `schedule list` | List schedules (`--server <name>`; `--json`) |
| `schedule add` | Add a schedule: `--server <name>`, `--cron "<expression>"` and `--name "<name>"` are required; `--retention <n>` keeps the newest n snapshots of this schedule (default 10); `--json` |
| `schedule remove <id>` | Remove a schedule; asks first unless `--force` |
| `schedule enable <id>` | Enable a schedule |
| `schedule disable <id>` | Disable a schedule |

```bash
mcctl config-snapshot schedule add --server survival --cron "0 3 * * *" --name "Daily"
```

---

## Player Management

### mcctl op

Manage server operators.

```bash
mcctl op <server> <action> [player] [level]
```

**Actions:**

| Action | Description |
|--------|-------------|
| `list` | Show operators with their level and role (read from `data/ops.json`) |
| `add <player> [level]` | Add operator: `OPS` in `config.env`, and over RCON when the server is running (the level is then written to `data/ops.json`). Without a level it asks in a terminal; with `--json` it uses 4 |
| `remove <player>` | Remove operator |
| `set-level <player> <level>` | Change an operator's level in `data/ops.json`. The server must be running; restart it to apply |

Levels: `1` Moderator, `2` Gamemaster, `3` Admin, `4` Owner. `--json` prints the result as JSON.

**Examples:**

```bash
# List operators
mcctl op survival list

# Add operator (asks for the level)
mcctl op survival add Steve

# Add operator with level 2
mcctl op survival add Alex 2

# Change the level
mcctl op survival set-level Alex 3

# Remove operator
mcctl op survival remove Steve
```

**Output Example (list):**
```
Operators for survival:

  Player       Level             Role
  ------------------------------------------------------------
  Steve                4   Owner
  Alex                 2   Gamemaster
```

---

### mcctl whitelist

Manage server whitelist.

```bash
mcctl whitelist <server> <action> [player]
```

**Actions:**

| Action | Description |
|--------|-------------|
| `list` | Show whitelisted players |
| `add <player>` | Add to whitelist |
| `remove <player>` | Remove from whitelist |
| `on` | Enable whitelist |
| `off` | Disable whitelist |
| `status` | Show whitelist status |

`--json` prints the result as JSON.

**Examples:**

```bash
# List whitelisted players
mcctl whitelist survival list

# Add player
mcctl whitelist survival add Steve

# Enable whitelist
mcctl whitelist survival on

# Check status
mcctl whitelist survival status
```

**Output Example (list):**
```
Whitelist for survival:

  Steve
  Alex
  Notch
```

**Output Example (status):**
```
Whitelist Status for survival:

  Enabled: Yes
  Players: 3
  Running: Yes
```

---

### mcctl ban

Manage player and IP bans.

```bash
mcctl ban <server> <action> [target] [reason]
mcctl ban <server> ip <action> [ip] [reason]
```

**Player Ban Actions:**

| Action | Description |
|--------|-------------|
| `list` | Show banned players |
| `add <player> [reason]` | Ban player |
| `remove <player>` | Unban player |

**IP Ban Actions:**

| Action | Description |
|--------|-------------|
| `ip list` | Show banned IPs |
| `ip add <ip> [reason]` | Ban IP address |
| `ip remove <ip>` | Unban IP address |

`--json` prints the result as JSON.

**Examples:**

```bash
# List banned players
mcctl ban survival list

# Ban player with reason
mcctl ban survival add Griefer "Griefing spawn area"

# Unban player
mcctl ban survival remove Griefer

# List banned IPs
mcctl ban survival ip list

# Ban IP
mcctl ban survival ip add 192.168.1.100 "Spam"
```

**Output Example (list):**
```
Banned Players for survival:

  Griefer - Griefing spawn area
```

---

### mcctl kick

Kick a player from the server.

```bash
mcctl kick <server> <player> [reason]
```

The server must be running. `--json` prints the result as JSON.

**Examples:**

```bash
# Kick player
mcctl kick myserver Steve

# Kick with reason
mcctl kick myserver Steve "AFK too long"
```

---

### mcctl player online

Show online players on servers.

```bash
mcctl player online <server>
mcctl player online --all
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--all` | `-a` | Show players on all servers |
| `--json` | | Output in JSON format |

**Examples:**

=== "Single Server"
    ```bash
    mcctl player online survival
    ```

    **Output:**
    ```
    Online Players for survival:

      Status: Running (2/20)

      Steve
      Alex
    ```

=== "All Servers"
    ```bash
    mcctl player online --all
    ```

    **Output:**
    ```
    Online Players (All Servers):

      Total: 2 players

      survival (2/20):
        Steve
        Alex
    ```

    Running servers with no players online are left out.

---

## World Management

### World Assignment Rules

A world is assigned to a server by the server's `LEVEL` in `servers/<name>/config.env`. If `LEVEL` is unset, the legacy `WORLD_NAME` is read; if both are unset the server uses itzg's default `world`.

- **No lock file.** `worlds/.locks` is no longer read, written or created (`mcctl init` does not create it). An existing `worlds/.locks` directory is harmless; `rm -rf worlds/.locks` is safe. The `lock.sh` and `mcctl.sh` scripts were removed (#670, #734).
- **One world, one server.** A world and its `<world>_nether` / `<world>_the_end` folders count as one world. A world used by another server cannot be assigned: `mcctl world assign`, `mcctl create --world`, a new server's default world `<name>`, and `mcctl config <server> LEVEL <world>` are refused. Deleting a server frees its world for reuse.
- **Stopped server only.** `world assign`, `world release`, `world new --server` and `config LEVEL` are refused while the server's container is running, paused, restarting or created. Nothing is stopped automatically (`world new --server` used to try to stop the server; it now refuses).
- **Fail-closed.** If any server's `config.env` cannot be read, or its `LEVEL` cannot be interpreted safely, every assignment change and world delete/reset is refused until it is fixed. Unsafe values are path separators, `.` or `..`, quotes, control characters, Compose interpolation such as `${VAR}` outside single quotes, and an unsupported `--universe` location. Legacy names such as `My World` are still accepted as existing values; new names must be letters, digits, `-` or `_`.
- **Older installs.** Duplicate assignments are reported, not fixed: see [`mcctl world list`](#mcctl-world-list).

---

### mcctl world new

Create a new world directory with optional seed configuration. The command never starts a server: with `--server` it only assigns the world (sets `LEVEL`); run `mcctl start <server>` afterwards. Only the interactive form asks whether to start the server.

```bash
mcctl world new [name] [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `name` | World name (optional, prompts if not provided) |

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--seed` | `-s` | World seed for generation. A negative seed works (`-s -123`); `--seed=<value>` takes any value |
| `--server` | | Server to assign world to (sets `LEVEL`, and `SEED` if given). The server must be stopped |
| `--no-start` | | Interactive mode: do not ask whether to start the server, and do not start it |
| `--json` | | Print the result as JSON |

**Examples:**

=== "Interactive Mode"
    ```bash
    mcctl world new
    # Prompts for:
    # 1. World name
    # 2. Optional seed
    # 3. Server to assign the world to (must be stopped)
    # 4. Whether to start the server
    ```

=== "CLI Mode"
    ```bash
    # Create empty world directory
    mcctl world new myworld

    # Create world with specific seed
    mcctl world new myworld --seed 12345

    # Create and assign to server
    mcctl world new myworld --server myserver

    # Create with seed and assign to server
    mcctl world new myworld --seed 12345 --server myserver
    ```

    With a world name the server is not started; start it with `mcctl start <server>`.

**What it does:**

1. Creates world directory in `worlds/<name>/` with a `.meta` file (name, seed, creation time)
2. If server assigned:
   - Refuses if the server is running or the world is used by another server (the server is not stopped for you)
   - Updates server's `config.env` with `LEVEL=<world-name>`
   - Sets `SEED=<seed>` if provided
   - In interactive mode, starts the server if you answer yes

`mcctl world new` needs at least one server; without any it stops with `No servers available. Create a server first.`

!!! tip "Seed Behavior"
    The seed is applied via the server's `SEED` environment variable.
    The world is generated with this seed when the server first starts.

---

### mcctl world list

List all worlds with the servers they are assigned to.

```bash
mcctl world list [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Examples:**

=== "Default Output"
    ```bash
    mcctl world list
    ```

    **Output:**
    ```
    Worlds:

      survival-world
        Status: assigned: survival
        Size: 514.0MB
        Path: /home/myuser/minecraft-servers/worlds/survival-world

      creative-world
        Status: unassigned
        Size: 128.5MB
        Path: /home/myuser/minecraft-servers/worlds/creative-world
    ```

=== "JSON Output"
    ```bash
    mcctl world list --json
    ```

    **Output:**
    ```json
    [
      {
        "name": "survival-world",
        "path": "/home/myuser/minecraft-servers/worlds/survival-world",
        "isLocked": true,
        "lockedBy": "survival",
        "size": "514.0MB",
        "lastModified": "2026-01-21T13:19:48.853Z",
        "servers": ["survival"],
        "dimensions": { "nether": true, "end": true }
      },
      {
        "name": "creative-world",
        "path": "/home/myuser/minecraft-servers/worlds/creative-world",
        "isLocked": false,
        "size": "128.5MB",
        "lastModified": "2026-01-20T10:30:00.000Z",
        "servers": [],
        "dimensions": { "nether": false, "end": false }
      }
    ]
    ```

!!! info "Duplicate assignments"
    If an older install has two servers on the same world, `mcctl world list` shows `assigned: a, b` and prints a warning for each duplicate (and for each server whose `config.env` cannot be read). Nothing is fixed automatically: assign another world to all but one of the servers. `isLocked` and `lockedBy` remain in the JSON output as aliases for "assigned".

---

### mcctl world assign

Assign a world to a server (sets the server's `LEVEL`).

```bash
mcctl world assign [world] [server]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `world` | World name (optional, prompts if not provided) |
| `server` | Server name (optional, prompts if not provided) |

**Examples:**

=== "Interactive Mode"
    ```bash
    mcctl world assign
    # Shows world list, then server list
    ```

=== "CLI Mode"
    ```bash
    mcctl world assign survival myserver
    ```

!!! info "One world, one server"
    A world used by another server cannot be assigned, and the target server must be stopped. This prevents data corruption from simultaneous access. A server that keeps its world inside `servers/<name>/data` is refused too: run `mcctl migrate worlds` first. See [World Assignment Rules](#world-assignment-rules).

---

### mcctl world release

Switch the server that uses a world back to its own default world `<server>`.

```bash
mcctl world release [world] [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `world` | World name (optional, prompts if not provided) |

**Options:**

| Option | Description |
|--------|-------------|

**Examples:**

```bash
# Interactive - shows assigned worlds
mcctl world release

# Release specific world
mcctl world release survival
```

The server using the world gets `LEVEL=<server>`: an existing free `worlds/<server>` is adopted, otherwise the world is created on the next start. The world itself is kept in `worlds/`.

Release is refused when the server is running, when the server already uses its own default world, when the world is assigned to more than one server, when the server keeps its world inside `servers/<name>/data`, and when no server uses the world.

---

### mcctl world delete

Permanently delete a world and all its data.

```bash
mcctl world delete [world] [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `world` | World name (optional, prompts if not provided) |

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--force` | | Skip the confirmation (does not delete a world a server uses) |
| `--yes` | `-y` | Same as `--force` for the confirmation |
| `--json` | | Output in JSON format (still needs `--force` or `-y` to delete) |

`-f` is `--follow`, not `--force`.

!!! danger "Permanent Deletion"
    This command permanently deletes all world data including:

    - World files (level.dat, region data, etc.)
    - Nether and End dimensions
    - Player data for that world

    **This action cannot be undone.** Make sure to backup important worlds before deletion.

**Examples:**

=== "Interactive Mode"
    ```bash
    mcctl world delete
    # Shows world list for selection
    # Asks for confirmation before deletion
    ```

=== "CLI Mode"
    ```bash
    # Delete with confirmation prompt (default No; needs a terminal)
    mcctl world delete old-world

    # Delete without confirmation (scripts, CI)
    mcctl world delete old-world --force
    mcctl world delete old-world -y
    ```

**Safety Features:**

- **Assignment Check**: Cannot delete a world that any server uses, running or not; `--force` does not override this. Assign another world to the server first. Servers that keep their world inside `servers/<name>/data` (no `EXTRA_ARGS=--universe /worlds/`) do not block deleting `worlds/<world>`
- **Fail-closed**: Refused while any server's `config.env` cannot be read or interpreted (see [World Assignment Rules](#world-assignment-rules))
- **Confirmation Prompt**: Asks for confirmation (yes/no, default No) before deleting, unless `--force` or `-y`. Without a terminal (a script, a pipe) and without `--force`/`-y`, the command refuses and exits 1; `--json` alone does not delete either. The REST API `DELETE /api/worlds/:name` is not affected
- **Size**: The confirmation shows the world name and size; after deleting, the freed size is printed

---

## Backup Management

### mcctl backup init

Set up the GitHub world backup interactively.

```bash
mcctl backup init [--force]
```

It asks for a GitHub personal access token, the repository (`username/repo`), the branch and whether to back up when a server stops. After testing access to the repository it writes `BACKUP_GITHUB_TOKEN`, `BACKUP_GITHUB_REPO`, `BACKUP_GITHUB_BRANCH` and `BACKUP_AUTO_ON_STOP` to `.env`. If a backup is already configured it asks before overwriting; `--force` skips that question. Creating the repository and the token is described in the [Backup Guide](../advanced/backup.md).

---

### mcctl backup status

Show backup configuration status. `mcctl backup` without a subcommand does the same.

```bash
mcctl backup status [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Example:**

```bash
mcctl backup status
```

**Output (configured):**

```
Backup Configuration:

  Status: Configured
  Repository: myuser/minecraft-backup-repo
  Branch: main
  Last backup: 1/20/2026, 9:06:35 PM
  Auto backup: enabled
```

**Output (not configured):**

```
Backup Configuration:

  Status: Not configured

  To enable backups, set in .env:
    BACKUP_GITHUB_TOKEN=your-token
    BACKUP_GITHUB_REPO=username/repo
```

[`mcctl backup init`](#mcctl-backup-init) writes these settings for you.

---

### mcctl backup push

Push world data to GitHub repository.

```bash
mcctl backup push [options]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--message` | `-m` | Commit message |
| `--auto` | | No prompt; timestamp message; waits up to 10 min for a running backup (the same rules as the auto-backup on stop) |
| `--allow-missing` | | Drop worlds from the backup that were deleted on purpose (see [Backup Guide](../advanced/backup.md#deleted-worlds)) |

Running servers are flushed (`save-off`, `save-all flush`, `save-on`) before the copy. "No changes" is a success.

**Examples:**

=== "Interactive Mode"
    ```bash
    mcctl backup push
    # Prompts for commit message
    ```

=== "CLI Mode"
    ```bash
    mcctl backup push -m "Before server upgrade"
    ```

---

### mcctl backup history

Show backup history.

```bash
mcctl backup history [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Examples:**

=== "Default Output"
    ```bash
    mcctl backup history
    ```

    **Output:**
    ```
    Backup History:

      fd8633b  Backup: 2026-01-20 21:06:30       2026-01-20
      19a7a4d  Backup: 2026-01-20 20:21:06       2026-01-20
      7c2ad14  Manual backup                     2026-01-19
      ddeda27  Initial backup                    2026-01-17
    ```

=== "JSON Output"
    ```bash
    mcctl backup history --json
    ```

    **Output:**
    ```json
    [
      {
        "commitHash": "fd8633b2c1e4a7d9b0f3e6a5c8d1b4e7f0a3c6d9",
        "message": "Backup: 2026-01-20 21:06:30",
        "date": "2026-01-20T12:06:35.000Z",
        "author": "Minecraft Backup"
      }
    ]
    ```

---

### mcctl backup restore

Restore world data from a backup.

```bash
mcctl backup restore [commit] [--force]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `commit` | Commit hash (optional, shows list if not provided) |
| `--force` | Do not ask for confirmation |

Every server must be stopped. The result is exactly the commit, `worlds/.locks` is kept, and the replaced data is kept in `backups/restore-previous/<timestamp>/`. See the [Backup Guide](../advanced/backup.md#restore-from-backup).

**Examples:**

=== "Interactive Mode"
    ```bash
    mcctl backup restore
    # Shows backup history for selection
    ```

=== "CLI Mode"
    ```bash
    mcctl backup restore abc1234
    ```

!!! danger "Data Overwrite"
    Restore will overwrite current world data. Make sure to backup before restoring.

---

### mcctl backup schedule

Back up the worlds on a schedule. The schedules are run by mcctl-api, which checks them every minute: a change made here applies within a minute.

| Command | Description |
|---------|-------------|
| `backup schedule list` | List schedules (`--json`) |
| `backup schedule add` | Add a schedule: `--cron <expression or preset>` (required; presets `hourly`, `daily`, `every-6h`, `every-12h`, `weekly`), `--name <name>` (default `Backup Schedule`), `--max-count <n>`, `--max-age-days <n>`, `--json` |
| `backup schedule remove <id>` | Remove a schedule |
| `backup schedule enable <id>` | Enable a schedule |
| `backup schedule disable <id>` | Disable a schedule |

After each scheduled backup, backups beyond the newest `--max-count` and backups older than `--max-age-days` are removed from the repository history (the latest backup is always kept). See [Scheduled Backups](../advanced/backup.md#scheduled-backups).

```bash
mcctl backup schedule add --cron daily --name "Daily Backup" --max-count 30
```

---

## Player Utilities

### mcctl player (Interactive Mode)

Unified player management with interactive workflow.

```bash
mcctl player
mcctl player <server>
```

**Examples:**

=== "Full Interactive"
    ```bash
    mcctl player
    # 1. Select server from list
    # 2. Select online player or enter name
    # 3. Select action (op/deop, whitelist, ban, kick, info)
    ```

=== "Server-Specific"
    ```bash
    mcctl player myserver
    # 1. Select online player or enter name
    # 2. Select action
    ```

The interactive mode provides:

- Server selection (running servers only; the actions run over RCON)
- Online player list with easy selection
- Action menu (op/deop, whitelist add/remove, ban/unban, kick, view info)

---

### mcctl player info

Look up player information from Mojang API with encrypted local caching.

```bash
mcctl player info <name> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--offline` | Calculate offline-mode UUID instead of Mojang lookup |
| `--json` | Output in JSON format |

**Examples:**

```bash
# Look up player info (UUID, skin URL)
mcctl player info Notch

# Offline UUID calculation
mcctl player info Steve --offline

# JSON output for scripting
mcctl player info Notch --json
```

**Output:**

```
Player: Notch
  UUID: 069a79f4-44e9-4726-a5be-fca90e38aaf5
  Skin: http://textures.minecraft.net/texture/292009a4925b58f02c77dadc3ecef07ea4c7472f64e0fdc32ce5522489362680
  Source: mojang
```

**JSON Output:**

```json
{
  "name": "Notch",
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "uuidNoDashes": "069a79f444e94726a5befca90e38aaf5",
  "skinUrl": "https://textures.minecraft.net/texture/...",
  "source": "mojang"
}
```

!!! info "Player Cache"
    Player data is cached locally with AES-256-GCM encryption:

    - **UUID**: Cached permanently (never changes)
    - **Username**: Cached for 30 days (can change)
    - **Skin URL**: Cached for 1 day (changes frequently)

    Cache location: `~/.mcctl/.player-cache`

---

### mcctl player cache

Manage the encrypted player data cache.

```bash
mcctl player cache <action>
```

**Actions:**

| Action | Description |
|--------|-------------|
| `stats` | Show cache statistics |
| `clear` | Clear all cached player data |

**Examples:**

```bash
# View cache statistics
mcctl player cache stats

# Clear all cached data
mcctl player cache clear
```

**Stats Output:**

```
Player Cache Statistics
  Players cached: 5
  Cache size: 2.1 KB
```

---

`mcctl player online` is described under [Player Management](#mcctl-player-online).

---

!!! note "Removed"
    `mcctl player lookup` and `mcctl player uuid` were removed. Use `mcctl player info <name>` (add `--offline` for the offline UUID).
    The old `player.sh` computed a wrong offline UUID for some names (for example Steve and Alex) because of a variant-bit bug; `mcctl player info --offline` matches Minecraft.

---

## Migration Commands

### mcctl migrate status

Check migration status for all servers.

```bash
mcctl migrate status [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Example:**

```bash
mcctl migrate status
```

**Output:**

```
Migration Status:

  survival: needs migration
    Missing EXTRA_ARGS=--universe /worlds/
  creative: up to date

1 server(s) need migration.
Run: mcctl migrate worlds to migrate.
```

---

### mcctl migrate worlds

Migrate worlds to the shared `/worlds/` directory structure.

```bash
mcctl migrate worlds [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--all` | Migrate all servers without selection |
| `--server <name>` | Migrate only this server |
| `--dry-run` | Preview changes without applying |
| `--backup` | Create backup before migration |
| `--force` | Skip confirmation prompts |

**Examples:**

=== "Interactive Mode"
    ```bash
    mcctl migrate worlds
    # Shows servers needing migration, select one or all
    ```

=== "Migrate All"
    ```bash
    mcctl migrate worlds --all
    ```

=== "Dry Run"
    ```bash
    mcctl migrate worlds --dry-run
    ```

    **Output:**
    ```
    DRY RUN - No changes will be made

    Would migrate: survival
      1. Stop server if running
      2. Move world: servers/survival/data/world → worlds/survival
      3. Update config.env:
         - Add: EXTRA_ARGS=--universe /worlds/
         - Set: LEVEL=survival
    ```

=== "With Backup"
    ```bash
    mcctl migrate worlds --all --backup
    ```

**What Migration Does:**

1. **Stops server** if running
2. **Moves world data** from `servers/<name>/data/world` to `worlds/<server-name>/`
3. **Updates config.env**:
   - Adds `EXTRA_ARGS=--universe /worlds/`
   - Sets `LEVEL=<server-name>`
4. **Detects existing worlds** with case-insensitive matching

If the resulting `LEVEL` is used by another server, or a server's assignment cannot be determined, the migration of that server is refused before any data is moved (see [World Assignment Rules](#world-assignment-rules)).

!!! info "World Storage Change"
    New servers created with `mcctl create` already use the `/worlds/` directory structure.
    This migration command is for existing servers created before this change.

---

### mcctl migrate spec

Import servers into their definition file `servers/<name>/server.yaml` and write the files rendered from it (`config.env`, `docker-compose.yml`, the `servers/compose.yml` entry). See [Server Definition](../configuration/server-yaml.md).

```bash
mcctl migrate spec <server> [options]
mcctl migrate spec --all [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--all` | Every server |
| `--dry-run` | Report what would be imported; write nothing |
| `--force` | Re-render from `server.yaml` over hand edits of the generated files (keeps `.bak` copies) |
| `--json` | Print the per-server report as JSON |

Running it again is safe: a server that is in sync is reported as `synced` and nothing is rewritten. A server is `refused` (exit 1) when its world or image cannot be determined, for example a `${...}` value in `config.env`. A changed `world.level` is checked against the [World Assignment Rules](#world-assignment-rules) and needs the server to be stopped.

You do not have to run this: a server without `server.yaml` is imported the first time mcctl changes it, and `mcctl upgrade` lists the servers not imported yet.

---

## Mod Management

Manage mods and plugins for your Minecraft servers. mcctl integrates with multiple mod sources including Modrinth, CurseForge, Spiget (SpigotMC), and direct URL downloads.

### mcctl mod search

Search for mods on Modrinth.

```bash
mcctl mod search <query> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `query` | Search query (mod name, description keywords) |

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Examples:**

```bash
# Search for optimization mods
mcctl mod search sodium

# Search for world generation mods
mcctl mod search "world generation"

# JSON output for scripting
mcctl mod search lithium --json
```

**Output Example:**

```
Search results for "sodium" on Modrinth (25 total):

  sodium (12.5M downloads)
    Sodium server client
    A modern rendering engine for Minecraft

  sodium-extra (2.1M downloads)
    Sodium Extra server? client
    Extra options for Sodium

Use: mcctl mod add <server> <mod-slug> to install
```

The output shows:

- **Mod slug** (used for installation)
- **Download count** (popularity indicator)
- **Side requirements** (server/client/both)
- **Description** (truncated)

---

### mcctl mod add

Add mods to a server configuration.

```bash
mcctl mod add <server> <mod...> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `server` | Server name |
| `mod...` | One or more mod slugs/IDs |

**Options:**

| Option | Description |
|--------|-------------|
| `--modrinth` | Use Modrinth (default) |
| `--curseforge` | Use CurseForge (CF_API_KEY optional on Java 17+) |
| `--spiget` | Use Spiget (SpigotMC plugins) |
| `--url` | Direct JAR URL download |
| `--force` | Add even if mod not found or server type mismatch |
| `--json` | Output in JSON format |

**Examples:**

=== "Modrinth (Default)"
    ```bash
    # Add single mod
    mcctl mod add myserver sodium

    # Add multiple mods at once
    mcctl mod add myserver sodium lithium phosphor

    # Add to Fabric server
    mcctl mod add fabric-server fabric-api sodium lithium
    ```

=== "CurseForge"
    ```bash
    # CF_API_KEY in .env is optional on Java 17+ images
    mcctl mod add myserver --curseforge jei journeymap

    # Add popular modpack mods
    mcctl mod add myserver --curseforge create applied-energistics-2
    ```

=== "Spiget (SpigotMC)"
    ```bash
    # Use resource IDs from SpigotMC
    mcctl mod add myserver --spiget 9089 1649

    # EssentialsX example (resource ID: 9089)
    mcctl mod add paper-server --spiget 9089
    ```

=== "Direct URL"
    ```bash
    # Download JAR directly from URL
    mcctl mod add myserver --url https://example.com/mod.jar

    # Multiple URLs
    mcctl mod add myserver --url https://example.com/mod1.jar https://example.com/mod2.jar
    ```

**How It Works:**

1. **Validation**: Verifies mod exists on Modrinth (if using Modrinth source)
2. **Server Type Check**: Refuses server types without mod or plugin support (for example VANILLA) unless `--force`
3. **Config Update**: Adds mod to appropriate environment variable in `config.env`
4. **Restart Required**: Server must be restarted to apply changes

**Environment Variables Used:**

| Source | Environment Variable | Server Types |
|--------|---------------------|--------------|
| Modrinth | `MODRINTH_PROJECTS` | All |
| CurseForge | `CURSEFORGE_FILES` | All (CF_API_KEY optional on Java 17+) |
| Spiget | `SPIGET_RESOURCES` | Paper, Spigot, Bukkit |
| URL | `MODS` | Forge, NeoForge, Fabric, Quilt |
| URL | `PLUGINS` | Paper, Spigot, Bukkit |

!!! warning "⚠️ Automatic Dependency Download"
    Mods often require other mods as dependencies (e.g., Iris requires Sodium).

    **By default, dependencies are automatically downloaded** via the `MODRINTH_DOWNLOAD_DEPENDENCIES=required` setting in `config.env`.

    | Setting | Behavior |
    |---------|----------|
    | `required` | Download required dependencies automatically **(DEFAULT, RECOMMENDED)** |
    | `optional` | Download required + optional dependencies |
    | `none` | Don't download dependencies (manual management) |

    **Example**: When you add `iris`, it automatically downloads `sodium` (required dependency).

    ```bash
    mcctl mod add myserver iris
    # ✓ iris added
    # ✓ sodium automatically downloaded on server start (required dependency)
    ```

**Output Example:**

```
Validating mods on Modrinth...
  ✓ Sodium (sodium)
  ✓ Lithium (lithium)

✓ Added 2 mod(s) to myserver

  sodium
  lithium

Config: MODRINTH_PROJECTS=sodium,lithium

Restart the server to apply changes:
  mcctl stop myserver && mcctl start myserver
```

---

### mcctl mod list

List configured mods for a server.

```bash
mcctl mod list <server> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `server` | Server name |

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Examples:**

```bash
# List mods for server
mcctl mod list myserver

# JSON output
mcctl mod list myserver --json
```

**Output Example:**

```
Mods for myserver (FABRIC):

  Modrinth:
    - sodium
    - lithium
    - phosphor

  CurseForge:
    - jei
    - journeymap

Total: 5 mod(s)
```

**JSON Output:**

```json
{
  "serverType": "FABRIC",
  "sources": [
    {"key": "MODRINTH_PROJECTS", "name": "Modrinth", "mods": ["sodium", "lithium"]},
    {"key": "CURSEFORGE_FILES", "name": "CurseForge", "mods": ["jei"]}
  ],
  "total": 3
}
```

---

### mcctl mod remove

Remove mods from a server configuration.

```bash
mcctl mod remove <server> <mod...> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `server` | Server name |
| `mod...` | One or more mod slugs/IDs to remove |

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Examples:**

```bash
# Remove single mod
mcctl mod remove myserver sodium

# Remove multiple mods
mcctl mod remove myserver sodium lithium phosphor
```

**Output Example:**

```
  ✓ Removed sodium from MODRINTH_PROJECTS
  ✓ Removed lithium from MODRINTH_PROJECTS

✓ Removed 2 mod(s) from myserver

Restart the server to apply changes:
  mcctl stop myserver && mcctl start myserver
```

!!! note "Restart Required"
    Removed mods will still be present in the server's mods folder until the server is restarted. On restart, the itzg/minecraft-server image will sync the mods folder with the configuration.

---

### mcctl mod sources

Display available mod sources and their configuration.

```bash
mcctl mod sources [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Examples:**

```bash
mcctl mod sources
```

**Output:**

```
Available Mod Sources:

  Modrinth --modrinth (default)
    Free, open-source mod platform. No API key required.
    Config: MODRINTH_PROJECTS
    mcctl mod add myserver sodium lithium

  CurseForge --curseforge
    Popular mod platform. Java 17+ images include a built-in CF_API_KEY; set it in .env only for java8 or pre-17 tags or your own key
    Config: CURSEFORGE_FILES
    mcctl mod add myserver --curseforge jei journeymap

  Spiget (SpigotMC) --spiget
    SpigotMC plugin repository. Use resource IDs.
    Config: SPIGET_RESOURCES
    mcctl mod add myserver --spiget 9089

  URL --url
    Direct JAR file download URLs.
    Config: MODS / PLUGINS
    mcctl mod add myserver --url https://example.com/mod.jar
```

---

### Mod Management Workflows

#### Setting Up a Modded Server

Complete workflow for creating and configuring a modded Fabric server:

```bash
# 1. Create a Fabric server
mcctl create modded-server -t FABRIC -v 1.20.4

# 2. Search for mods
mcctl mod search "optimization"

# 3. Add essential mods
mcctl mod add modded-server fabric-api sodium lithium phosphor

# 4. List configured mods
mcctl mod list modded-server

# 5. Restart to apply
mcctl stop modded-server && mcctl start modded-server
```

#### Setting Up a Plugin Server

Complete workflow for a Paper server with plugins:

```bash
# 1. Create a Paper server
mcctl create plugin-server -t PAPER -v 1.21.1

# 2. Add plugins from Modrinth
mcctl mod add plugin-server luckperms

# 3. Add plugins from Spiget (SpigotMC)
mcctl mod add plugin-server --spiget 9089  # EssentialsX

# 4. Restart to apply
mcctl stop plugin-server && mcctl start plugin-server
```

#### CurseForge Configuration

Java 17+ images include a built-in CF_API_KEY; set it only for java8/pre-17 tags or to use your own key. To set your own key:

1. Get an API key from [CurseForge for Studios](https://console.curseforge.com/)
2. Add to your `.env` file:

```bash
CF_API_KEY=your-api-key-here
```

3. Now you can add CurseForge mods:

```bash
mcctl mod add myserver --curseforge jei journeymap
```

---

## External Access (playit.gg)

### mcctl playit

Manage the playit.gg agent and the servers' external domains. Setting up playit.gg is described in [External Access (playit.gg)](../advanced/external-access.md).

```bash
mcctl playit <start|stop|status|setup|domain> [args]
```

| Command | Description |
|---------|-------------|
| `start` | Start the `playit-agent` container (needs `PLAYIT_SECRET_KEY` and playit.gg enabled) |
| `stop` | Stop the agent |
| `status` | Show the agent state, whether `PLAYIT_SECRET_KEY` is set and the servers with a playit.gg domain (`--json`) |
| `setup` | Ask for the `PLAYIT_SECRET_KEY`, save it to `.env`, enable playit.gg and add the `playit` service to `docker-compose.yml` if it is missing |
| `domain <server> <domain>` | Set a server's playit.gg domain (`PLAYIT_DOMAIN`) |
| `domain <server> --remove` | Remove a server's playit.gg domain |

Without arguments, `mcctl playit domain` asks for the server and the domain. A domain change takes effect after `mcctl stop <server> && mcctl start <server>`; restarting the container does not apply it.

---

## Audit Log

### mcctl audit

Show and clean up the audit log of actions taken with the CLI, the API and the web console. Details, action names and settings: [Audit Log](audit-log.md).

```bash
mcctl audit <list|stats|purge> [options]
```

| Command | Description |
|---------|-------------|
| `list` | Show entries, newest first: `--limit <n>` (default 50), `--action`, `--actor`, `--target`, `--status <status>` (`success` or `failure`), `--from <date>`, `--to <date>` |
| `stats` | Count the entries by status, action and actor |
| `purge` | Delete entries older than `--days <n>` (default 90) or before `--before <date>`; asks first unless `--force`; `--dry-run` only counts |

---

## Global Options Reference

| Option | Description | Example |
|--------|-------------|---------|
| `--root <path>` | Data directory (default: `MCCTL_ROOT` or `~/minecraft-servers`) | `mcctl --root /opt/mc status` |
| `--json` | JSON output, for the commands that support it (listed with each command) | `mcctl status --json` |
| `--sudo-password <pwd>` | Sudo password for the mDNS entry of `create` and `delete` (or [`MCCTL_SUDO_PASSWORD`](#mcctl_sudo_password)) | `mcctl delete myserver --yes --sudo-password "..."` |
| `-h, --help` | Show help (the same page for every command) | `mcctl --help` |
| `--version` | Show version | `mcctl --version` |

An option that needs a value takes it from the next word (`--seed 123`) or after `=` (`--seed=123`). Switches such as `--force`, `--json` and `--yes` also accept `=true` or `=false`. Everything after `--` is passed on unchanged (`mcctl exec myserver -- say -h`).

---

## Environment Variables

Environment variables for automation and CI/CD pipelines.

### MCCTL_SUDO_PASSWORD

Provides sudo password for operations requiring root access (mDNS registration/deregistration).

```bash
export MCCTL_SUDO_PASSWORD="your-password"
```

**Used by:**

- `mcctl create` - For registering mDNS hostname with avahi-daemon
- `mcctl delete` - For deregistering mDNS hostname

**Example (CI/CD):**

```bash
# GitHub Actions example
- name: Create Minecraft Server
  env:
    MCCTL_SUDO_PASSWORD: ${{ secrets.SUDO_PASSWORD }}
  run: |
    mcctl create myserver -t PAPER -v 1.21.1
```

!!! warning "Security"
    Store sudo passwords securely using CI/CD secrets. Never commit passwords to version control.

**Alternative:** Use `--sudo-password` option directly:

```bash
mcctl create myserver --sudo-password "your-password"
```

### MCCTL_ROOT

Data directory used when `--root` is not given (default: `~/minecraft-servers`).

```bash
export MCCTL_ROOT=/opt/minecraft
```
