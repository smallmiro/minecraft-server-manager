# mcctl - Docker Minecraft Server Management CLI

> **Version**: 3.0.2
> **Last Updated**: 2026-10-25
> **Purpose**: Comprehensive knowledge base for LLM agents (ChatGPT, Gemini, Claude, NotebookLM) to answer all mcctl questions

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Requirements](#2-system-requirements)
3. [Installation & Quick Start](#3-installation--quick-start)
4. [Architecture](#4-architecture)
5. [Complete CLI Command Reference](#5-complete-cli-command-reference)
6. [Server Types](#6-server-types)
7. [Configuration](#7-configuration)
8. [REST API Reference](#8-rest-api-reference)
9. [Web Console (mcctl-console)](#9-web-console-mcctl-console)
10. [itzg/minecraft-server Reference](#10-itzgminecraft-server-reference)
11. [mc-router Reference](#11-mc-router-reference)
12. [docker-compose.yml Examples](#12-docker-composeyml-examples)
13. [Common Use Cases](#13-common-use-cases)
14. [Troubleshooting](#14-troubleshooting)
15. [FAQ](#15-faq)
16. [Version History](#16-version-history)
17. [Glossary](#17-glossary)
18. [External Resources & Links](#18-external-resources--links)

---

## 1. Overview

### What is mcctl?

**mcctl** (Minecraft Control) is a command-line tool for managing multiple Docker-based Minecraft Java Edition servers. It uses `itzg/minecraft-server` Docker images for running servers and `itzg/mc-router` for hostname-based routing with auto-scaling.

### Key Features

| Feature | Description |
|---------|-------------|
| **Multi-Server** | Run unlimited Minecraft servers simultaneously |
| **Single Port** | All servers accessible via port 25565 with hostname routing |
| **Auto-Scale** | Servers start on client connect, stop after idle timeout |
| **nip.io Magic DNS** | Connect via `server.<ip>.nip.io` - no client setup needed |
| **mDNS Discovery** | Clients auto-discover servers via Bonjour/Zeroconf (.local hostnames) |
| **Idle Servers Stop** | When nobody plays, only mc-router (and the console services, if installed) keep running |
| **Interactive CLI** | Guided prompts for most operations (`mcctl create`, `mcctl delete`, `mcctl world ...`, `mcctl player`) |
| **Management Console** | Web Console (port 5000) + REST API (port 5001) |
| **Player Management** | Unified player command with Mojang API integration |
| **Mod Management** | Search, add, remove mods from Modrinth, CurseForge, Spiget, direct URLs |
| **World Management** | Shared world storage (`worlds/`), world-server assignment via `LEVEL` (one world, one server) |
| **Server Definition** | `servers/<name>/server.yaml` describes each server; `config.env` and the server compose file are generated from it |
| **GitHub Backup** | World backup to a private GitHub repository: manual, scheduled, or when a server stops |
| **Config Snapshots** | Snapshot, compare and restore a server's configuration files (`mcctl config-snapshot`) |
| **Audit Logs** | Activity tracking with SQLite storage, optional auto-cleanup, and web UI |
| **External Access** | playit.gg tunneling for internet access without port forwarding |
| **Self Update** | `mcctl update` updates the CLI, the installed services and the server images |

### npm Packages (5 packages)

| Package | Description | Port |
|---------|-------------|------|
| `@minecraft-docker/mcctl` | CLI tool (main package) | - |
| `@minecraft-docker/shared` | Shared domain entities, value objects, use cases | - |
| `@minecraft-docker/mod-source-modrinth` | Modrinth API adapter | - |
| `@minecraft-docker/mcctl-api` | REST API server (Fastify) | 5001 |
| `@minecraft-docker/mcctl-console` | Web Management UI (Next.js) | 5000 |

---

## 2. System Requirements

### Runtime (Production)

| Component | Minimum Version | Recommended | Notes |
|-----------|-----------------|-------------|-------|
| **Node.js** | >= 18.0.0 | 20 LTS | Required for mcctl CLI |
| **Docker Engine** | >= 24.0.0 | Latest | Container runtime |
| **Docker Compose** | >= 2.20.0 | Latest | `include` feature required |
| **PM2** | >= 6.0.0 | Latest | Web console only: `mcctl console init` checks for `pm2` on `PATH` (`npm install -g pm2`) |
| **git** | >= 2.31 | Latest | GitHub world backups only |
| **OS** | Linux, macOS | Ubuntu 22.04+ | Windows via WSL2 only |

### Ports

| Service | Default Port | Description |
|---------|-------------|-------------|
| mcctl-api | 5001 | REST API server |
| mcctl-console | 5000 | Web Management UI |
| mc-router | 25565 | Minecraft connection router |

### Development Only

| Component | Minimum Version | Notes |
|-----------|-----------------|-------|
| **pnpm** | >= 8.0.0 | Monorepo workspace management |
| **TypeScript** | >= 5.3.0 | Build time |

---

## 3. Installation & Quick Start

### Installation

```bash
# Install globally via npm
npm install -g @minecraft-docker/mcctl

# Or via pnpm (note: `mcctl update` reinstalls with npm, so prefer npm)
pnpm add -g @minecraft-docker/mcctl

# Verify installation
mcctl --version
```

`mcctl init` checks Node.js, Docker Engine and Docker Compose and stops if one is missing or too old.

### Quick Start

```bash
# Step 1: Initialize platform (creates ~/minecraft-servers/, asks for host IPs and playit.gg)
mcctl init

# Step 2: Start mc-router once (mcctl init does not start it; it has restart: unless-stopped)
mcctl router start

# Step 3: Create your first server (creates and starts only this server)
mcctl create myserver -t PAPER -v 1.21.1

# Step 4: Check status (HOSTNAME column lists the server's addresses)
mcctl status
```

`mcctl up` starts mc-router and every server. `mcctl create` prints only `Connect via: <name>.local:25565`; the nip.io addresses are in the HOSTNAME column of `mcctl status`.

### Connection Methods

| Method | Address | Requirements |
|--------|---------|--------------|
| **nip.io** (Recommended) | `myserver.192.168.1.100.nip.io:25565` | DNS lookup of nip.io; the IP in the name must be reachable (LAN, or a VPN address in `HOST_IPS`) |
| **mDNS** | `myserver.local:25565` | avahi-daemon/Bonjour |
| **playit.gg** (External) | `xx-xx.craft.playit.gg` | playit.gg account + SECRET_KEY |

Replace `192.168.1.100` with your `HOST_IP` (one nip.io name per address in `HOST_IPS`). A bare IP (`192.168.1.100:25565`) does not work: mc-router picks the server by the hostname the client sends, and mcctl configures no default route.
For external access via playit.gg, see `mcctl playit setup`.

### Platform Directory Structure

```
~/minecraft-servers/
├── docker-compose.yml      # Main orchestration (mc-router + server includes)
├── .env                    # Platform settings (HOST_IP, RCON_PASSWORD, ...)
├── .mcctl.json             # mcctl settings (template version, playit, install ID)
├── .gitignore
├── servers/                # Server configurations
│   ├── compose.yml         # Server include list (auto-generated)
│   ├── global.env          # .env keys passed to every server
│   └── _template/          # Template for new servers
├── worlds/                 # Shared world storage
├── shared/                 # Shared resources
│   ├── plugins/            # Mounted read-only into every server (/plugins)
│   └── mods/               # Created, but not mounted by the server template
└── backups/                # Backup storage
```

The root is `~/minecraft-servers` unless `MCCTL_ROOT` is set; `--root <path>` must be passed to every command (it is not stored).

---

## 4. Architecture

### System Overview

```
+-------------------------------------------------------------+
|                     mc-router (:25565)                        |
|                  hostname-based routing                       |
|                  auto-scale up/down                           |
+------------------------------+------------------------------+
                               |
    +--------------------------+----------------------------+
    |                          |                            |
+--------+              +--------+                   +--------+
|mc-srv1 |              |mc-srv2 |                   |mc-srv3 |
| :25565 |              | :25565 |                   | :25565 |
+---+----+              +---+----+                   +---+----+
    |                       |                            |
    +-----------+-----------+----------------------------+
                |
     +----------v----------+
     |     worlds/          |
     |  (shared storage)    |
     +----------------------+
```

Server containers publish no host ports; each listens on 25565 inside the Docker network `minecraft-net`, and mc-router forwards to `mc-<name>:25565`. mc-router finds servers through their `mc-router.host` labels, reading the Docker socket read-only. The router's management API is published on `127.0.0.1:25580` only (used by `mcctl status` for health).

### Management Console Layer

```
+-----------------------------------------------------------+
|                   Management Console                       |
|                                                            |
|  +-------------------+      +-------------------+          |
|  |  mcctl-console    | ---> |    mcctl-api      |          |
|  |  (Next.js BFF)    |      |  (Fastify REST)   |          |
|  |  :5000             |      |  :5001             |          |
|  +-------------------+      +-------------------+          |
|         |                           |                      |
|    Better Auth               Docker CLI (docker compose)    |
|    Session Auth              files under MCCTL_ROOT         |
+-----------------------------------------------------------+
```

### Key Components

| Component | Purpose |
|-----------|---------|
| **mc-router** | Routes connections by hostname, handles auto-scaling |
| **avahi-daemon** | System mDNS service for .local hostname discovery |
| **itzg/minecraft-server** | Docker image running Minecraft servers |
| **mcctl** | CLI tool for all management operations |
| **mcctl-api** | REST API service (Fastify, port 5001) |
| **mcctl-console** | Web Management Console (Next.js, port 5000) |
| **PM2** | Process manager for Management Console services |
| **playit-agent** | Optional tunneling agent for external access via playit.gg |

### Platform Directory Structure

After running `mcctl init`, the following directory structure is created:

```
~/minecraft-servers/                  # Platform root (MCCTL_ROOT)
├── .env                              # Global environment variables
├── .mcctl.json                       # mcctl settings (templateVersion, playitEnabled, installId)
├── .gitignore
├── docker-compose.yml                # Main orchestration (mc-router; playit service after `mcctl init` with playit or `mcctl playit setup`)
├── .mcctl-admin.yml                  # Management Console config (after console init)
├── api-config.json                   # Written by `mcctl console api ...` (not read by the running mcctl-api)
├── ecosystem.config.cjs              # PM2 process config (after console init)
├── data/
│   ├── audit.db                      # SQLite audit log database
│   ├── mcctl.db                      # Console users, sessions, per-user server permissions (Better Auth SQLite, after console init with mcctl-console)
│   └── players.db                    # SQLite player session history (mcctl-api, v2.27.0+)
│
├── servers/
│   ├── compose.yml                   # Auto-generated server include list
│   ├── global.env                    # .env keys passed to every server (TZ, EXTRA_ARGS, RCON_PASSWORD, RCON_PORT)
│   ├── _template/                    # Template for new servers
│   │   ├── docker-compose.yml
│   │   └── config.env
│   └── <server-name>/               # Per-server directory
│       ├── server.yaml               # Server definition (config.env and docker-compose.yml are generated from it)
│       ├── docker-compose.yml        # Server-specific compose (generated)
│       ├── config.env                # Server configuration (generated)
│       └── data/                     # Server container data mount
│
├── worlds/                           # Shared world storage
│   └── <world-name>/                 # World directories
│       ├── .meta                     # World metadata (seed, createdAt)
│       ├── level.dat                 # Minecraft world data
│       ├── region/                   # Overworld chunks
│       ├── DIM-1/                    # Nether dimension
│       └── DIM1/                     # End dimension
│
├── shared/
│   ├── plugins/                      # Mounted read-only into every server (/plugins)
│   └── mods/                         # Created by init, not mounted by the server template
│
├── backups/
│   ├── worlds/                       # Git working copy of the GitHub world backup
│   ├── restore-previous/             # Data replaced by `mcctl backup restore` (last 3 kept)
│   ├── servers/<server>/             # `mcctl server-backup` archives (<id>.tar.gz)
│   └── meta/                         # backup-schedules.db, config-snapshots.db, config-snapshot-storage/
│
└── .services/                        # Service packages installed by console init (older installs: node_modules/ in the platform root)
    └── node_modules/
        └── @minecraft-docker/
            ├── mcctl-api/            # REST API package
            ├── mcctl-console/        # Web Console package
            └── shared/               # Shared domain package
```

There are no Bash management scripts (removed in v3.0.0, #715). Every `mcctl` command is TypeScript. `MCCTL_SCRIPTS` is ignored, and `mcctl upgrade` offers to delete a leftover `<root>/scripts` folder; see the script to mcctl table in `docs/advanced/upgrade-runbook.md` (section 3-1).

### Connection Flow (LAN)

```
1. Player opens Minecraft → Add Server → survival.192.168.1.100.nip.io:25565
2. DNS: nip.io resolves to 192.168.1.100
3. TCP connects to mc-router on port 25565
4. mc-router reads hostname from Minecraft handshake packet
5. mc-router looks up Docker container with matching label
6. If container stopped + AUTO_SCALE_UP: mc-router starts the container
7. mc-router proxies connection to the backend server container
8. Player connects to the Minecraft server
9. When all players leave + AUTO_SCALE_DOWN_AFTER timeout: mc-router stops container
```

### Connection Flow (External via playit.gg)

```
1. External player connects to xx-xx.craft.playit.gg
2. playit.gg cloud relays TCP connection to playit-agent on host
3. playit-agent forwards to localhost:25565 (network_mode: host)
4. mc-router receives connection, reads hostname from Minecraft handshake
5. mc-router routes to the correct server container
6. Same auto-scale behavior as LAN connections
```

### playit.gg External Access (Optional)

playit.gg enables external players to connect without port forwarding. The playit-agent runs as a Docker container with `network_mode: host` and forwards tunneled traffic to mc-router.

**Architecture:**

```
External Players → playit.gg cloud → playit-agent (host) → localhost:25565 → mc-router → server
```

**CLI Commands:**

| Command | Description |
|---------|-------------|
| `mcctl playit start` | Start the playit-agent container |
| `mcctl playit stop` | Stop the playit-agent container |
| `mcctl playit status` | Show agent status and registered servers |
| `mcctl playit setup` | Ask for the SECRET_KEY, save it to `.env`, enable playit.gg, and add the `playit` service to `docker-compose.yml` if missing |
| `mcctl playit domain <server> [domain]` | Set a server's playit.gg domain (`--remove` removes it; no arguments: prompts) |

**Setup:**

1. Create agent at https://playit.gg/account/agents/new-docker → get SECRET_KEY
2. `mcctl playit setup` → enter SECRET_KEY (not needed after `mcctl init --playit-key` or answering Yes in `mcctl init`: init saves the key and adds the `playit` service)
3. `mcctl playit start` → start agent
4. Create tunnel at https://playit.gg/account/tunnels → Minecraft Java → localhost:25565
5. `mcctl create myserver --playit-domain xx-xx.craft.playit.gg`, or for an existing server `mcctl playit domain myserver xx-xx.craft.playit.gg` then `mcctl stop myserver && mcctl start myserver`

**Docker Configuration** (added by `mcctl playit setup`):

```yaml
services:
  playit:
    image: ghcr.io/playit-cloud/playit-agent:0.16
    container_name: playit-agent
    network_mode: host
    environment:
      - SECRET_KEY=${PLAYIT_SECRET_KEY:?PLAYIT_SECRET_KEY must be set in .env}
    restart: unless-stopped
    profiles:
      - playit
```

**Environment Variable:** `PLAYIT_SECRET_KEY` in `.env`

#### mcctl playit domain

Set the playit.gg tunnel domain of an existing server. It sets `PLAYIT_DOMAIN` for the server (in `server.yaml` / `config.env`) and adds the domain to its `mc-router.host` label.

```bash
mcctl playit domain <server> <domain>
mcctl playit domain <server> --remove
mcctl playit domain                     # prompts for server and domain
```

**Example:**
```bash
mcctl playit domain survival xx-xx.craft.playit.gg
mcctl stop survival && mcctl start survival   # or `mcctl start survival` if it is stopped
```

A container keeps the hostnames it was created with, so the domain applies only after the container is recreated; a restart does not apply it. A domain added to the label by hand counts as a custom hostname, not as the playit domain.

### playit.gg External Access - Complete Setup Guide

playit.gg enables external players to connect to your Minecraft servers without port forwarding, static IP, or router configuration.

#### Prerequisites
- A free playit.gg account (https://playit.gg)
- mcctl platform initialized (`mcctl init`)

#### Step-by-Step Setup

**Step 1: Create a playit.gg agent**
1. Go to https://playit.gg/account/agents/new-docker
2. Create a new Docker agent
3. Copy the SECRET_KEY (a long string like `agt_xxxxxxxx...`)

**Step 2: Configure mcctl with playit.gg**
```bash
mcctl playit setup
# Enter your SECRET_KEY when prompted

# Or during initial setup (`mcctl init`, answer Yes, or `mcctl init --playit-key <key>`):
# init saves the key and adds the playit service
```

**Step 3: Start the playit agent**
```bash
mcctl playit start

# Verify it's running:
mcctl playit status
```

**Step 4: Create a tunnel on playit.gg**
1. Go to https://playit.gg/account/tunnels
2. Click "Add Tunnel"
3. Select: Game -> Minecraft Java
4. Set local address: localhost:25565
5. Save - you'll get an address like `xx-xx.craft.playit.gg`

**Step 5: Register the domain with your server**
```bash
# For a new server:
mcctl create survival --playit-domain xx-xx.craft.playit.gg

# For an existing server (then recreate it):
mcctl playit domain survival xx-xx.craft.playit.gg
mcctl stop survival && mcctl start survival
```

New servers have the whitelist off; turn it on before sharing the domain (`mcctl whitelist survival on`).

**Step 6: Share with friends**

External players connect with: `xx-xx.craft.playit.gg` (no port needed, default 25565)

#### Multiple Servers with playit.gg

Each server needs its own tunnel on playit.gg:

```bash
# Server 1: survival
mcctl playit domain survival ab-cd.craft.playit.gg

# Server 2: creative
mcctl playit domain creative ef-gh.craft.playit.gg
```

mc-router routes based on the hostname in the Minecraft handshake packet, so each tunnel domain maps to the correct server.

#### Troubleshooting playit.gg

| Problem | Cause | Solution |
|---------|-------|----------|
| Agent won't start | Invalid SECRET_KEY, or `no such service: playit` | Run `mcctl playit setup` again (it also adds the missing `playit` service) |
| Can't connect externally | Tunnel not created | Create tunnel at playit.gg/account/tunnels |
| Wrong server reached | Domain not registered | Run `mcctl playit domain <server> <domain>`, then `mcctl stop <server> && mcctl start <server>` |
| Agent status "stopped" | Container crashed | Check logs with `docker logs playit-agent` |
| "Connection refused" | mc-router not running | Run `mcctl router start` (or `mcctl up`, which also starts every server) |

#### playit.gg Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `PLAYIT_SECRET_KEY` | `.env` | Agent authentication key from playit.gg |

#### playit.gg Docker Configuration

The playit-agent runs as a Docker container with `network_mode: host`:

```yaml
services:
  playit:
    image: ghcr.io/playit-cloud/playit-agent:0.16
    container_name: playit-agent
    network_mode: host
    environment:
      - SECRET_KEY=${PLAYIT_SECRET_KEY:?PLAYIT_SECRET_KEY must be set in .env}
    restart: unless-stopped
    profiles:
      - playit
```

Key points:
- `network_mode: host` allows the agent to forward traffic to localhost:25565
- `profiles: [playit]` means it only starts when explicitly requested
- The agent connects to playit.gg cloud and establishes a tunnel

**Connection Methods Summary:**

| Method | Address | Scope |
|--------|---------|-------|
| nip.io | `server.<ip>.nip.io:25565` | LAN / same network |
| mDNS | `server.local:25565` | LAN only |
| playit.gg | `xx-xx.craft.playit.gg` | Internet (external) |
| VPN mesh | `server.<vpn-ip>.nip.io:25565` | VPN network |

---

## 5. Complete CLI Command Reference

### Global Options

| Option | Description |
|--------|-------------|
| `--root <path>` | Data directory (default: `MCCTL_ROOT` or `~/minecraft-servers`); not stored, so pass it to every command |
| `--json` | JSON output, for the commands that support it |
| `--help` / `-h` | Show help (the same page for every command; there is no per-command help) |
| `--version` | Show version |
| `--sudo-password <pwd>` | Sudo password for the mDNS entry of `create` and `delete` |

**Environment Variables**: `MCCTL_ROOT` (data directory), `MCCTL_SUDO_PASSWORD` (alternative to `--sudo-password`).

**Argument parsing**: an option that needs a value takes it from the next word (`--seed 123`) or after `=` (`--seed=123`); a negative number is a value (`-s -123`). Switches such as `--force`, `--json` and `--yes` also accept `=true`/`=false`. Everything after `--` is passed through unchanged (`mcctl exec myserver -- say -h`). Short flags: `-t` type, `-v` version, `-s` seed, `-u` world-url, `-w` world, `-f` follow, `-n` lines, `-m` message, `-y` yes, `-a` all, `-d` detail, `-W` watch, `-h` help. Write the Minecraft version as `-v 1.21.1` or `--version=1.21.1`.

**Exit codes**: `0` success, `1` error, `2` for `mcctl start`/`mcctl stop` when the server is already running/stopped. `mcctl update --check` exits 1 when a newer CLI exists; `mcctl exec` returns the RCON command's exit code.

---

### Platform Management

```bash
mcctl init                       # Initialize platform (asks for host IPs and playit.gg)
mcctl init --reconfigure         # Change host IPs, timezone, RCON password, ... of an initialized platform
mcctl init --playit-key <key>    # Enable playit.gg without asking
mcctl init --no-playit           # Do not enable playit.gg, without asking
mcctl init --skip-validation     # Skip the prerequisite checks
mcctl init --skip-docker         # Do not create the minecraft-net network
mcctl init --upgrade             # Run `mcctl upgrade` instead
mcctl up                         # docker compose up -d: mc-router and every server
mcctl down                       # Stop all mc-* containers, then docker compose down (removes containers; the external minecraft-net network is kept)
mcctl router start               # docker compose up -d router (also recreates it after docker-compose.yml changes)
mcctl router stop                # docker compose stop router
mcctl router restart             # docker compose restart router (keeps the container's current settings)
```

`mcctl init` writes `.env` (random 24-character `RCON_PASSWORD`, `HOST_IP`/`HOST_IPS`, `DOCKER_GID`), `.mcctl.json`, `.gitignore`, `docker-compose.yml`, `servers/compose.yml`, `servers/global.env` and `servers/_template/`, and creates the `minecraft-net` network. It does not start mc-router. On an initialized platform it changes nothing. In `--reconfigure`, choosing "Host IP(s)" and answering yes to "Update existing servers with new IP hostnames?" re-renders every server; each container keeps its old hostnames until it is recreated (`mcctl stop <s> && mcctl start <s>`).

### Platform Upgrade

```bash
mcctl upgrade                       # Upgrade platform config (.env, templates)
mcctl upgrade --dry-run             # Preview changes without applying
mcctl upgrade --non-interactive     # Apply defaults without prompting
mcctl init --upgrade                # Run upgrade via init command
```

#### mcctl upgrade

Upgrade platform configuration files when updating mcctl to a new version. Compares the bundled `.env.example` template with your existing `.env` file and adds any new environment variables.

**Key principle**: Existing `.env` values are kept (new keys are appended), except `DOCKER_GID` when it is missing or the default, and the `BETTER_AUTH_*` keys moved from `ecosystem.config.cjs`.

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without modifying files |
| `--non-interactive` | Use default values without prompting |
| `--root <path>` | Custom data directory |

**What happens during upgrade:**
1. Compares bundled `.env.example` with your `.env` file and lists the new variables
2. In interactive mode, prompts for a value for each new variable (Enter keeps the default); `--non-interactive` writes the defaults
3. Appends new variables to your `.env` file (grouped by section)
4. Detects the Docker socket group ID and writes `DOCKER_GID` to `.env` when it is missing or the default (needed by non-root mc-router 1.46+)
5. Patches the root `docker-compose.yml` `router` service (since 2.29.0): only the `image` tag and the `group_add` entry are aligned with the bundled template; other services, ports, profiles, comments, router `environment:` edits and CRLF line endings are kept. Shows a line diff and asks for confirmation (skipped with `--non-interactive`, diff only with `--dry-run`), writes a `docker-compose.yml.bak-<timestamp>` backup, restores it if validation fails, then runs `docker compose up -d router`. If this step fails, the rest still runs and the command exits 1
6. Updates `servers/_template/` files (docker-compose.yml, config.env)
7. Creates `servers/global.env` if missing and points each server's `docker-compose.yml` at it instead of the platform `.env` (#685); existing containers keep the old environment until recreated (`mcctl stop <s> && mcctl start <s>` for each listed server)
8. Moves `BETTER_AUTH_SECRET` / `BETTER_AUTH_BASE_URL` from `ecosystem.config.cjs` into `.env` (backup `ecosystem.config.cjs.bak-<timestamp>`); apply with `mcctl console service restart --console` (#699)
9. Lists the servers that have no `server.yaml` yet and writes nothing; they are imported on their next change or with `mcctl migrate spec` (#675)
10. If `<root>/scripts` exists (unused since v3.0.0), asks `Remove <path>?` in a terminal (default `N`); with `--non-interactive` or no terminal it only prints `rm -r <path>`
11. Records `templateVersion` in `.mcctl.json` and adds `installId` if it is missing

**Examples:**

```bash
# See what would change before applying
mcctl upgrade --dry-run

# Upgrade with prompts for each new variable
mcctl upgrade

# Upgrade in CI/CD or scripts (uses defaults)
mcctl upgrade --non-interactive

# Upgrade via init command
mcctl init --upgrade
```

---

### Server Management

#### mcctl create

Create a new Minecraft server.

```bash
mcctl create [name] [options]
```

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--type` | `-t` | Server type: PAPER, VANILLA, FORGE, NEOFORGE, FABRIC, SPIGOT, BUKKIT, PURPUR, QUILT, LEAF, FOLIA, PUFFERFISH, MODRINTH, AUTO_CURSEFORGE | PAPER |
| `--version` | `-v` | Minecraft version: `-v 1.21.1` or `--version=1.21.1` (modpack types use the modpack's version) | LATEST |
| `--seed` | `-s` | World seed (negative works: `-s -123`) | Random |
| `--world-url` | `-u` | Download world from ZIP URL | - |
| `--world` | `-w` | Use existing world from worlds/ (sets `LEVEL`; refused if another server uses it) | - |
| `--modpack <slug>` | | Modpack slug; required with `-t MODRINTH` or `-t AUTO_CURSEFORGE` | - |
| `--modpack-version <v>` | | Modpack version | latest |
| `--mod-loader <loader>` | | `fabric`, `forge`, `neoforge`, `quilt` (omit to detect from the modpack) | - |
| `--exclude-files <list>` | | Comma-separated files to leave out of the modpack (e.g. client-only mods) | - |
| `--whitelist <a,b>` | | Turn on the whitelist with these players | off |
| `--enable-whitelist` | | Turn on the whitelist, empty | off |
| `--no-whitelist` | | Whitelist off (wins over the two above) | - |
| `--playit-domain <domain>` | | playit.gg external domain of the server | - |
| `--no-playit-domain` | | Do not set a playit.gg domain (also the default) | - |
| `--no-start` | | Create without starting (no container is created) | - |
| `--sudo-password <pwd>` | | Sudo password for registering `<name>.local` | - |

New servers get `MEMORY=4G` (6G for modpack types) and the image `itzg/minecraft-server:java25`; change memory later with `mcctl config <name> MEMORY 6G`. Modpack example: `mcctl create cobblemon -t MODRINTH --modpack cobblemon`.

**Interactive mode**: Run `mcctl create` without a name. Prompts: server name, server type (grouped: Standard Servers / Modpack Platforms), Minecraft version (select, default `LATEST`; skipped for modpacks), world setup (new / new with seed / existing from `worlds/` / download ZIP URL), memory (default 4G, 6G for modpacks), `Enable whitelist?` (default No; then players), and `Register external domain for playit.gg?` when playit is enabled. When `/etc/avahi/hosts` exists, it first asks for the sudo password (Enter tries sudo without a password).

**Interactive flow for modpack types** (MODRINTH / AUTO_CURSEFORGE):

1. **Server name** - lowercase letters, digits, hyphens
2. **Server type** - choose "Modrinth Modpack" or "CurseForge Modpack"
3. **Modpack slug** - text prompt `Modrinth modpack slug or URL:` (e.g., `cobblemon`); there is no search
4. **Mod loader** - Auto-detect, or Fabric / Forge / NeoForge / Quilt (filtered to the loaders the modpack's Modrinth versions support when they can be fetched)
5. **Modpack version** - leave empty for latest
6. **Exclude mods** - comma-separated files to leave out (e.g. client-only mods)
7. **World setup**, **memory** (default 6G), **whitelist**, then creation (there is no separate confirmation step)

> **Note**: Minecraft version is not prompted for modpack servers; it is determined by the modpack.

**What happens during creation:**
1. Writes `servers/<name>/server.yaml` and renders `config.env`, `docker-compose.yml` (container `mc-<name>`) and the `servers/compose.yml` entry from it; `LEVEL` is the server name (world in `worlds/<name>/`) or the `--world` name
2. Registers `<name>.local` in `/etc/avahi/hosts` with sudo when avahi-daemon is installed (first host IPv4 address; a sudo failure is only a warning)
3. The `mc-router.host` label gets `<name>.local` and one `<name>.<ip>.nip.io` per address in `HOST_IPS` (else `HOST_IP`), plus the playit domain if given
4. Starts the container with `docker compose up -d mc-<name>` (unless `--no-start`). If the start fails, the server stays created and the command exits 1 with the cause
5. Prints `Connect via: <name>.local:25565` (the nip.io names are shown by `mcctl status`)

New servers have the whitelist off unless `--whitelist`/`--enable-whitelist` is given. If anything fails before the server exists, nothing is left behind.

#### mcctl delete

```bash
mcctl delete [name] [options]
```

| Option | Short | Description |
|--------|-------|-------------|
| `--yes` | `-y` | Skip the confirmation |
| `--force` | | Delete even if players are online, or if they cannot be read over RCON (implies `--yes`) |
| `--delete-world` | | Delete the world inside the server instead of moving it to `worlds/` |
| `--sudo-password <pwd>` | | Sudo password for removing `<name>.local` from `/etc/avahi/hosts` |

`mcctl delete` asks first; without a terminal it refuses unless `--yes` or `--force` is given. The world is kept: a world in `worlds/` stays (no longer assigned), and a world inside `servers/<name>/data/<LEVEL>` (with `_nether`/`_the_end`) is moved to `worlds/<LEVEL>`. The delete stops before removing anything if `worlds/` already has that name, if the world cannot be determined from `config.env`, or if the container cannot be stopped. Files the container wrote as root are left with a `sudo rm -rf` hint. Only one delete of a server runs at a time.

#### mcctl status

```bash
mcctl status [options]          # All servers
mcctl status <server>           # Specific server
mcctl status router             # mc-router status
```

| Option | Short | Description |
|--------|-------|-------------|
| `--detail` | `-d` | Show memory, CPU, players, uptime |
| `--watch` | `-W` | Real-time monitoring mode |
| `--interval <sec>` | | Watch refresh interval (default: 5) |
| `--json` | | JSON output |

The default view prints `=== Server Status (mc-router Managed) ===` with an INFRASTRUCTURE table (mc-router, avahi-daemon) and a MINECRAFT SERVERS table (SERVER, STATUS, HEALTH, HOSTNAME = the full `mc-router.host` list). JSON: `{router:{name,status,health,port}, avahi_daemon:{name,status,type}, servers:[{name, container, status, health, hostname}]}`.

#### mcctl start / stop

```bash
mcctl start <server>            # docker compose up -d mc-<server> (creates the container if needed)
mcctl stop <server>             # Stop specific server
mcctl start --all               # Start all servers (not mc-router)
mcctl stop --all                # Stop all servers (not mc-router)
```

`start` exits 2 when the server is already running; `stop` exits 2 when it is not running (so `mcctl stop x && mcctl start x` skips the start for a stopped server). With `BACKUP_AUTO_ON_STOP=true` and a configured backup, `mcctl stop <server>` backs up the worlds afterwards (waits up to 10 minutes for a running backup; a failed backup is only a warning). `mcctl stop --all` does not back up.

#### mcctl logs

```bash
mcctl logs <server>             # Last 50 lines (stdout and stderr)
mcctl logs <server> -f          # Follow logs (Ctrl+C ends with exit code 0)
mcctl logs <server> -n 100      # Last 100 lines
mcctl logs router               # mc-router logs
mcctl logs <server> --json      # Lines as a JSON array (not with -f)
```

#### mcctl console / mcctl rcon (RCON)

```bash
mcctl console <server>          # Interactive RCON console
mcctl rcon <server>             # Same session
```

Since v3.0.0 this connects over TCP to the container's IP on the Docker network with the container's `RCON_PORT`/`RCON_PASSWORD`. The server must be running, and the host must reach the container IP (Docker Desktop on macOS may not; use `mcctl exec` there). Leave with `exit`, `quit`, Ctrl+C or Ctrl+D; piped input runs line by line. `mcctl console init|service|user|api|remove` are console-management subcommands (see Console Management), so a server named like them is reached with `mcctl rcon <name>`.

#### mcctl exec

```bash
mcctl exec <server> <command>   # Execute single RCON command (docker exec mc-<server> rcon-cli -- <command>)
mcctl exec myserver say "Hello!"
mcctl exec myserver list
mcctl exec myserver give Steve diamond 64
mcctl exec myserver tp Steve -1 64 -5   # negative numbers are passed as they are
mcctl exec myserver -- say -h           # other arguments starting with - go after --
```

Scripts: the `list` reply is `There are N of a max of M players online: ...`; test for no players with `grep -q "There are 0 of"`.

#### mcctl config

```bash
mcctl config <server>                    # View all config
mcctl config <server> MOTD               # View specific key
mcctl config <server> MOTD "Welcome!"    # Set value
mcctl config <server> --cheats           # Enable cheats (ALLOW_CHEATS=true)
mcctl config <server> --no-cheats        # Disable cheats
mcctl config <server> --pvp              # Enable PvP
mcctl config <server> --no-pvp           # Disable PvP
mcctl config <server> --command-block    # Enable command blocks
mcctl config <server> --no-command-block # Disable command blocks
mcctl config <server> --json             # JSON output (values, or {server, key, oldValue, newValue} after a change)
```

Values are written through `server.yaml` (then rendered into `config.env`). Restart the server to apply (`mcctl stop <s> && mcctl start <s>`). `LEVEL` (and an `EXTRA_ARGS` that moves the world) follows the world assignment rules: refused while the server runs or when another server uses the world. An empty value (`""`) shows the key instead of setting it.

---

### Player Management

#### mcctl op

```bash
mcctl op <server> list                       # Operators with level and role (from data/ops.json)
mcctl op <server> add <player>               # Add operator (asks for the level in a terminal; --json uses 4)
mcctl op <server> add <player> <level>       # Add with level 1-4 (positional word)
mcctl op <server> set-level <player> <level> # Change level in data/ops.json (server must be running; restart to apply)
mcctl op <server> remove <player>            # Remove operator
```

Levels: 1 Moderator, 2 Gamemaster, 3 Admin, 4 Owner. `add`/`remove` update `OPS` in `config.env`, and run `op`/`deop` over RCON when the server is running (the level is then written to `data/ops.json`). `--json` is supported.

#### mcctl whitelist

```bash
mcctl whitelist <server> list         # List whitelisted
mcctl whitelist <server> add <p>      # Add to whitelist
mcctl whitelist <server> remove <p>   # Remove from whitelist
mcctl whitelist <server> on           # Enable whitelist
mcctl whitelist <server> off          # Disable whitelist
mcctl whitelist <server> status       # Show whitelist status
```

New servers have the whitelist off. Changes apply over RCON when the server runs, otherwise on the next start. `--json` is supported.

#### mcctl ban

```bash
mcctl ban <server> list               # List banned players
mcctl ban <server> add <p> [reason]   # Ban player
mcctl ban <server> remove <p>         # Unban player
mcctl ban <server> ip list            # List banned IPs
mcctl ban <server> ip add <ip> [reason]  # Ban IP
mcctl ban <server> ip remove <ip>     # Unban IP
```

The word after the server is the action (`mcctl ban myserver add Griefer "Griefing"`). `--json` is supported.

#### mcctl kick

```bash
mcctl kick <server> <player> [reason]   # server must be running; --json supported
```

#### mcctl player

```bash
mcctl player                       # Full interactive mode (running servers only; actions run over RCON)
mcctl player <server>              # Interactive for specific server
mcctl player info <name>           # Player info (UUID, skin URL) from the Mojang API
mcctl player info <name> --offline # Offline-mode UUID (matches Minecraft)
mcctl player info <name> --json    # {name, uuid, uuidNoDashes, skinUrl, source}
mcctl player online <server>       # List online players
mcctl player online --all          # All running servers (servers with no players are left out)
mcctl player cache stats           # Cache statistics
mcctl player cache clear           # Clear cache
```

Lookups are cached AES-256-GCM encrypted in `~/.mcctl/.player-cache` (UUID permanently, username 30 days, skin 1 day). `mcctl player lookup` and `mcctl player uuid` were removed in v3.0.0: they print `'mcctl player <x>' was removed. Use: mcctl player info <name> [--offline]` and exit 1.

---

### World Management

```bash
mcctl world                                   # Same as `mcctl world list`
mcctl world list [--json]                     # List worlds with assigned servers (and duplicate warnings)
mcctl world new [name]                        # Create new world (interactive or CLI)
mcctl world new <name> --seed 12345           # Create with seed
mcctl world new <name> --server <srv>         # Create and assign to a stopped server (the server is not started)
mcctl world assign [world] [server]           # Assign world to a stopped server (sets LEVEL), e.g. `mcctl world assign survival myserver`
mcctl world release [world]                   # Switch the world's server back to its own default world
mcctl world release [world] --force           # --force is accepted and ignored
mcctl world delete [world]                    # Delete world (with confirmation)
mcctl world delete [world] --force            # Skip the prompt (does not delete a world a server uses); --json supported
```

Servers are named by their directory under `servers/` (`myserver`), not the container name (`mc-myserver`): `mcctl world assign survival mc-myserver` fails with `Server 'mc-myserver' not found`. `mcctl world list` prints `assigned: myserver`; its JSON has `name`, `path`, `isLocked`, `lockedBy`, `size`, `lastModified`, `servers` and `dimensions`. `mcctl world new` needs at least one server (`No servers available. Create a server first.`); in interactive mode it asks for a server (must be stopped) and whether to start it (`--no-start` skips that question); with a world name it never starts the server. A server whose world is inside `servers/<name>/data` is refused for assign/release until `mcctl migrate worlds` moves it; a container in the `created` state counts as not stopped (start it once, then stop it).

**World assignment rules** (#670):

- A world is assigned to a server by the server's `LEVEL` in `servers/<name>/config.env` (legacy `WORLD_NAME` is read when `LEVEL` is unset; unset means itzg's default `world`). There is no lock file: `worlds/.locks` is no longer read, written or created (`mcctl init` does not create it), and the `lock.sh` script was removed (`mcctl.sh` too, #670, #734). An existing `worlds/.locks` directory is harmless; `rm -rf worlds/.locks` is safe.
- **One world, one server (R1).** A world and its `<world>_nether` / `<world>_the_end` folders count as one world. A world used by another server cannot be assigned: `mcctl world assign`, `mcctl create --world`, a new server's default world `<name>`, `mcctl config <srv> LEVEL <w>`, API `POST /api/worlds/:name/assign`, `PATCH /api/servers/:name/config` with `level`, `POST /api/servers`, `POST /api/worlds` with `serverName`. Deleting a server frees its world for reuse.
- **Stopped server only.** assign, release, `world new --server`, config `LEVEL` and PATCH `level` are refused when the container is running, paused, restarting or created. Nothing is stopped automatically (`world new --server` used to try to stop the server; it now refuses).
- **Fail-closed.** If any server's `config.env` cannot be read, or its `LEVEL` cannot be interpreted safely (path separators, `.`/`..`, quotes, control characters, Compose interpolation like `${VAR}` outside single quotes, or an unsupported `--universe` location), every assignment change and world delete/reset is refused until it is fixed. Legacy names such as `My World` are still accepted as existing values; new names must be letters, digits, `-`, `_`.
- **Release** switches the server using the world back to its own default world `<server>` (adopting an existing free `worlds/<server>`, otherwise created on next start). `--force` is accepted and ignored. Releasing a server from its own default world, a duplicated world, or a server whose world is inside `servers/<n>/data` is refused.
- **Delete.** `mcctl world delete <w> --force` only skips the prompt; it never deletes a world a server uses. Servers keeping their world inside `servers/<n>/data` (no `EXTRA_ARGS=--universe /worlds/`) do not block deleting `worlds/<w>`. `POST /api/servers/:name/world/reset` is refused for such servers and when another server uses the same world.
- **Duplicate assignments** from older installs are reported, not fixed: `mcctl world list` shows `assigned: a, b` and prints warnings; `GET /api/worlds` adds `assignmentWarnings: string[]`; the console worlds page shows a warning alert and the card shows "Assigned to N servers". `isLocked`/`lockedBy` remain in the API as aliases for "assigned".
- **API status codes** for world assign/release/delete/create and config `level`: invalid world name 400, unknown server or world 404, everything else refused by these rules 409 (conflict, server running, undetermined config). Config snapshot restore answers 409 when the restored `config.env` would assign a world another server uses, or change the world of a running server (even with force), or when the restored `docker-compose.yml` sets world keys in `environment` or changes the `/worlds`/`/data` mapping. `mcctl config <srv> EXTRA_ARGS` that moves the world is checked the same way. `mcctl migrate worlds` refuses the same way before moving data.

**World behavior**: `mcctl world new` creates a world directory with a `.meta` file (containing seed and creation timestamp). Actual Minecraft world files are generated when a server first uses the world.

---

### Mod Management

```bash
mcctl mod search <query>                 # Search mods on Modrinth
mcctl mod add <server> <mod...>          # Add mods (Modrinth default)
mcctl mod add <server> --curseforge <mod>  # CurseForge (CF_API_KEY optional on Java 17+)
mcctl mod add <server> --spiget <id>     # SpigotMC plugin
mcctl mod add <server> --url <url>       # Direct URL
mcctl mod list <server>                  # List configured mods
mcctl mod remove <server> <mod>          # Remove mod
mcctl mod sources                        # Show mod sources
```

`mod add` validates names on Modrinth (default source), writes the source's key in `config.env` (`MODRINTH_PROJECTS`, `CURSEFORGE_FILES`, `SPIGET_RESOURCES`, or `MODS`/`PLUGINS` for URLs) and needs a restart (`mcctl stop <s> && mcctl start <s>`). Server types without mod or plugin support (e.g. VANILLA) are refused unless `--force`, which also adds names that were not found. `--json` is supported.

**Automatic Dependency Download** (via `MODRINTH_DOWNLOAD_DEPENDENCIES` in config.env):

| Setting | Behavior |
|---------|----------|
| `required` | Download required dependencies automatically **(DEFAULT)** |
| `optional` | Download required + optional dependencies |
| `none` | Don't download dependencies (manual management) |

---

### Backup Management

```bash
# World backup (GitHub, needs git >= 2.31)
mcctl backup init [--force]          # Interactive setup: token, repo, branch, auto-backup on stop -> .env
mcctl backup status                  # Show backup config (`mcctl backup` alone does the same)
mcctl backup push                    # Backup to GitHub (asks for a message)
mcctl backup push -m "message"       # With commit message
mcctl backup push --auto             # No prompt, timestamp message, waits up to 10 min for a running backup
mcctl backup push --allow-missing    # Accept that worlds in the last backup were deleted on purpose
mcctl backup history [--json]        # Show backup history (latest 10 in text)
mcctl backup restore [commit]        # Restore from backup (asks unless --force; all servers must be stopped)

# Scheduled world backups (run by mcctl-api)
mcctl backup schedule list
mcctl backup schedule add --cron daily --name "Daily Backup" --max-count 30   # presets: hourly, daily, every-6h, every-12h, weekly
mcctl backup schedule remove|enable|disable <id>

# Server config backup
mcctl server-backup <server>         # Backup server config
mcctl server-backup <server> --list  # List backups
mcctl server-backup <server> -m "msg"  # With message
mcctl server-restore <server>        # Interactive restore
mcctl server-restore <server> <id>   # Restore specific backup (asks unless --force or --json)
mcctl server-restore <server> <id> --dry-run  # Preview changes

# Config snapshots
mcctl config-snapshot list [server] [--limit 20] [--json]
mcctl config-snapshot create <server> [--description "..."]
mcctl config-snapshot show <id> [--files]
mcctl config-snapshot diff <id1> <id2> [--files-only]
mcctl config-snapshot restore <id> [--force]
mcctl config-snapshot delete <id> [--force]
mcctl config-snapshot schedule list [--server <name>]
mcctl config-snapshot schedule add --server <name> --cron "0 3 * * *" --name "Daily" [--retention 10]
mcctl config-snapshot schedule remove|enable|disable <id>
```

- **World backup** commits `worlds/` (and server-internal worlds in `servers/<name>/data/<LEVEL>`) to the repository. Running servers are flushed first (`save-off`, `save-all flush`, `save-on`); "no changes" is a success. Restore puts the replaced data in `backups/restore-previous/<timestamp>/`.
- **Backup schedules** and **config snapshot schedules** are executed by mcctl-api (`mcctl console init`), which loads them when it starts: after changing them with the CLI, run `mcctl console service restart --api`. Schedule retention: `--max-count`/`--max-age-days` prune old backups from the repository history (the latest is always kept); `--retention` keeps the newest snapshots of a snapshot schedule.
- **`server-backup`** archives `config.env`, `docker-compose.yml` and, when present, `server.yaml`, `data/ops.json`, `data/whitelist.json`, `data/banned-players.json`, `data/banned-ips.json`, `data/server.properties` to `backups/servers/<server>/<id>.tar.gz` (ID = creation time, e.g. `20260120-203357`). `server-restore` copies the current files to `backups/servers/<server>/.pre-restore/` first. No world data.
- **Config snapshots** hold the files in `servers/<server>/` itself (not `data/`): `server.yaml`, `config.env`, `docker-compose.yml` and other `.yml`/`.yaml`/`.json`/`.properties` files up to 1 MB, stored in `backups/meta/config-snapshots.db` and `backups/meta/config-snapshot-storage/`. `list` shows 8-character IDs; the other subcommands need the full ID (from `create` or `list --json`). A restore that changes the world follows the world assignment rules.

---

### Migration

```bash
mcctl migrate status              # Check which servers keep their world in servers/<name>/data
mcctl migrate worlds              # Interactive migration (`mcctl migrate` alone does the same)
mcctl migrate worlds --all        # Migrate all servers
mcctl migrate worlds --server <name>  # Migrate one server
mcctl migrate worlds --dry-run    # Preview changes
mcctl migrate worlds --backup     # Create backup before migration
mcctl migrate worlds --force      # No confirmation; stops running servers automatically
mcctl migrate spec <server>       # Import a server into server.yaml and render its files
mcctl migrate spec --all [--dry-run] [--force] [--json]
```

`migrate worlds` moves the world to `worlds/<server>`, adds `EXTRA_ARGS=--universe /worlds/` and sets `LEVEL=<server>`. `migrate spec` is idempotent (`synced` when nothing changed); `--force` re-renders from `server.yaml` over hand edits of the generated files (keeps `.bak`); a server whose world or image cannot be determined is `refused` (exit 1). Servers without `server.yaml` are also imported automatically on their first change by mcctl.

---

### Console Management (Management Console)

#### Initialization

```bash
mcctl console init                # Initialize console service (interactive)
mcctl console init --force        # Reinitialize (stops services, cleans config, replaces the admin with the same email)
mcctl console init --api-port 8001 --console-port 8000  # Custom ports
```

Before the prompts, init checks prerequisites (Node.js, Docker, Docker Compose, PM2). If the console is already initialized, it asks whether to reinitialize (skipped with `--force`); reinitializing stops the PM2 services and deletes `.mcctl-admin.yml` and `ecosystem.config.cjs`.

**Interactive init flow:**

1. Select services to install (mcctl-api, mcctl-console via multiselect)
2. Admin email, name and password (asked only if mcctl-console is selected; password min 8 chars, uppercase + lowercase + number, asked once without confirmation)
3. API access mode (internal / api-key / ip-whitelist / api-key-ip / open)
4. API key generated (if api-key or api-key-ip mode)
5. Allowed IPs (if ip-whitelist or api-key-ip mode); open mode asks for confirmation
6. Creates the admin user in `data/mcctl.db` (only if mcctl-console is selected). If a user with the same email exists, init fails with `User '<email>' already exists` unless `--force` is given; with `--force` that user is deleted and created again
7. Installs the service packages into `.services/` if they are missing
8. Writes `BETTER_AUTH_SECRET` to `.env` if missing (an older ecosystem file's secret is moved over), then generates PM2 ecosystem.config.cjs (no auth secrets in it)
9. Saves configuration (.mcctl-admin.yml)

The chosen access mode is written to `ecosystem.config.cjs` as an `AUTH_MODE` mcctl-api recognizes: `internal` → `ip-whitelist` (loopback IPs only), `api-key` → `api-key`, `ip-whitelist` → `ip-whitelist`, `api-key-ip` → `combined`, `open` → `disabled`.

**Files created after init:**

| File | Location | Description |
|------|----------|-------------|
| `.mcctl-admin.yml` | `~/minecraft-servers/` | Management Console configuration |
| `data/mcctl.db` | `~/minecraft-servers/data/` | Console users, sessions, per-user server permissions (Better Auth SQLite; only if mcctl-console is selected) |
| `ecosystem.config.cjs` | `~/minecraft-servers/` | PM2 process config |
| `.services/` | `~/minecraft-servers/` | Installed mcctl-api / mcctl-console packages |

#### Service Lifecycle (v1.13.0+ Interactive Selection)

```bash
# Start services (interactive prompt if both available)
mcctl console service start           # Prompts: "API only" or "API + Console"
mcctl console service start --api     # Start API only (no prompt)
mcctl console service start --console # Start API + Console (console needs API)

# Stop services (interactive prompt if both available)
mcctl console service stop            # Prompts: "All services" or "Console only"
mcctl console service stop --api      # Stop ALL services (console depends on API)
mcctl console service stop --console  # Stop console only
mcctl console service stop --force    # Delete PM2 processes and kill the PM2 daemon

# Restart services
mcctl console service restart         # Interactive prompt
mcctl console service restart --force # Kill PM2 daemon and restart fresh

# Status and logs
mcctl console service status          # Show PM2 process status
mcctl console service status --json   # JSON output
mcctl console service logs            # View recent logs
mcctl console service logs -f         # Follow logs in real-time
```

**Service dependency rules:**

| Action | --api flag | --console flag | No flag (interactive) |
|--------|-----------|---------------|----------------------|
| **start** | API only | API + Console (console needs API) | Prompt: "API only" / "API + Console" |
| **stop** | ALL (console can't run without API) | Console only | Prompt: "All services" / "Console only" |
| **restart** | Same as start | Same as start | Same as start |
| **logs** | API logs | API + Console logs | Prompt selection |

**Key behavior:**
- Console **always requires** API to be running
- Stopping API **always stops** Console too (dependency enforcement)
- If only one service is installed, no prompt is shown
- With both installed and no terminal (scripts, cron), `start`/`stop`/`restart`/`logs` without `--api` or `--console` exit 1 with `No terminal to ask which services to <action>. Pass --console (API + Console) or --api.`

#### User Management

```bash
mcctl console user list [--json]         # List console users
mcctl console user add [email]           # Add user (interactive prompts)
mcctl console user add operator@example.com --role user --password "Pass123"  # Non-interactive (needs email, --role and --password)
mcctl console user remove [email] [--force]    # Remove user (the last admin cannot be removed)
mcctl console user reset-password [email] [--password <pw>]  # Reset password
mcctl console user update [email] --role admin  # Change role
```

Users are identified by email address. `--role` accepts `admin` or `user`.

**User roles:**

| Role | Permissions |
|------|------------|
| `admin` | Full access: manage servers, users, settings |
| `user` | Standard access, limited to the servers granted to the account |

#### API Key Management

> **Warning**: `mcctl console api ...` only reads and writes `<root>/api-config.json`. The running mcctl-api takes its mode, key and IP whitelist from the `env` block of `<root>/ecosystem.config.cjs` (`AUTH_MODE`, `AUTH_API_KEY`, `AUTH_IP_WHITELIST`), so changes made with these commands do not affect it, and `status` shows `api-config.json`, not necessarily what the API uses. The mode and key in effect are the ones chosen during `mcctl console init`; to change them for now, run `mcctl console init --force`. Tracked in #633.

```bash
mcctl console api status               # Show api-config.json (access mode, port, masked key, whitelist)
mcctl console api key regenerate       # Regenerate API key
mcctl console api whitelist list       # List allowed IPs
mcctl console api whitelist add <ip>   # Add IP to whitelist
mcctl console api whitelist remove <ip>  # Remove from whitelist
mcctl console api mode <mode>          # Change access mode
```

#### Remove Console

```bash
mcctl console remove                  # Interactive removal
mcctl console remove --force          # Skip confirmation
mcctl console remove --keep-config    # Keep config files (PM2 processes are still removed)
```

`console remove` stops and removes the PM2 processes and deletes `.mcctl-admin.yml`, `ecosystem.config.cjs`, and the legacy `users.yaml` if it exists. It intentionally keeps `data/mcctl.db` (console users, sessions, per-user server permissions), `.services/`, and `api-config.json`. Running `mcctl console init` again with the same admin email therefore needs `--force`. To start from scratch, delete the database yourself (irreversible): `rm -f ~/minecraft-servers/data/mcctl.db*`.

---

### Audit Log Management

```bash
mcctl audit list                       # List recent 50 logs
mcctl audit list --limit 100           # List 100 logs
mcctl audit list --action server.create  # Filter by action
mcctl audit list --actor cli:local     # Filter by actor
mcctl audit list --target myserver     # Filter by target
mcctl audit list --status failure      # Show only failures
mcctl audit list --from 2026-01-01     # Date range

mcctl audit stats                      # Overview statistics
mcctl audit purge                      # Delete logs older than 90 days
mcctl audit purge --days 30            # Custom retention
mcctl audit purge --before 2026-01-01  # Delete before date
mcctl audit purge --dry-run            # Preview without deleting
mcctl audit purge --force              # Skip confirmation
```

The CLI and mcctl-api write to `<root>/data/audit.db`; `list` shows the newest first, and `--action` takes the full name (e.g. `player.whitelist.add`). Old entries are removed only by `purge` or by the optional auto-cleanup (`AUDIT_AUTO_CLEANUP=true`, off by default; see Configuration).

---

### Self Update

```bash
mcctl update                    # Update CLI + installed services + server images (default)
mcctl update --cli-only         # Update only the CLI binary
mcctl update --check            # Show available updates (CLI and services); exits 1 if a newer CLI exists or npm cannot be reached
mcctl update --force            # Accepted for compatibility; every update checks npm without the cache
mcctl update --yes              # Do not ask; also never recreates stopped servers
mcctl update --all              # Deprecated alias (same as the default)
```

By default `mcctl update` reinstalls the CLI with `npm install -g` (it asks `Update mcctl to <version>?` unless `--yes`), then, also when the CLI is already current: updates mcctl-api, mcctl-console and @minecraft-docker/shared in `~/minecraft-servers/.services/` via `npm install <pkg>@latest` and restarts their PM2 processes; sets each server's image tag to the one recommended for its `VERSION` through `server.yaml`; and pulls the servers' images. A pinned tag is kept: a tag that starts with a release version (e.g. `2026.10.0-java21`) or a digest (`java21@sha256:…`) prints `pinned tag, keeping` (with a warning if its Java is older than `VERSION` needs). `--cli-only` skips everything after the CLI. It does not run `mcctl upgrade`.

**Stopped servers** (v3.0.1+): mc-router auto-scale starts the existing container, so a stopped server keeps its old image until its container is recreated. After pulling, `mcctl update` lists stopped (`exited`/`created`) servers whose container does not use the pulled image (servers already on it show `up to date`) and, in a terminal, asks `Recreate the stopped servers now so they use the new image?` (default No). Yes runs `docker compose up --no-start --no-deps mc-<server>` per server and prints a rollback command (`docker tag <old image ID> <image> && docker compose up --no-start --no-deps mc-<server>`); a recreated server shows `created` until it starts. With `--yes` or no terminal nothing is recreated and the command is printed per server. Running servers keep their image until `mcctl stop <server> && mcctl start <server>`.

Before every other command (except `--help`/`--version`), mcctl checks npm for a newer CLI and prints a notice; the result is cached 24 hours in `~/.mcctl-update-check.json` (a stale cache makes the command wait up to 2 seconds).

---

## 6. Server Types

### mcctl Supported Types (`mcctl create -t`)

| Type | Plugins | Mods | Recommended For |
|------|:-------:|:----:|-----------------|
| **PAPER** | Yes | No | General use, best performance (default) |
| **VANILLA** | No | No | Pure vanilla experience |
| **FORGE** | No | Yes | Complex modpacks, Forge mods |
| **NEOFORGE** | No | Yes | Modern Forge mods (1.20.1+) |
| **FABRIC** | No | Yes | Performance mods, lightweight modding |
| **SPIGOT** | Yes | No | Legacy plugin compatibility |
| **BUKKIT** | Yes | No | Classic plugin API (legacy) |
| **PURPUR** | Yes | No | Advanced customization (Paper fork) |
| **QUILT** | No | Yes | Modern Fabric-compatible modding |
| **LEAF** | Yes | No | Lightweight Paper fork |
| **FOLIA** | Yes | No | Multi-threaded Paper server for large worlds |
| **PUFFERFISH** | Yes | No | Paper fork for large servers |
| **MODRINTH** | No | Yes | Modrinth modpack (`--modpack <slug>` required) |
| **AUTO_CURSEFORGE** | No | Yes | CurseForge modpack (`--modpack <slug>` required) |

### All itzg/minecraft-server Types

| Type | Category | Plugins | Mods | Description |
|------|----------|:-------:|:----:|-------------|
| `VANILLA` | Official | No | No | Official Mojang server |
| `PAPER` | Plugin | Yes | No | High-performance Spigot fork |
| `PURPUR` | Plugin | Yes | No | Paper fork with extra features |
| `PUFFERFISH` | Plugin | Yes | No | Performance-optimized for high player counts |
| `FOLIA` | Plugin | Yes | No | Multi-threaded Paper fork |
| `LEAF` | Plugin | Yes | No | Lightweight Paper fork |
| `SPIGOT` | Plugin | Yes | No | Original CraftBukkit fork |
| `BUKKIT` | Plugin | Yes | No | Original plugin API server |
| `FORGE` | Mod | No | Yes | The original Forge mod loader |
| `NEOFORGE` | Mod | No | Yes | Community Forge fork (1.20.1+) |
| `FABRIC` | Mod | No | Yes | Lightweight mod loader |
| `QUILT` | Mod | No | Yes | Fabric-compatible loader |
| `MOHIST` | Hybrid | Yes | Yes | Forge + Bukkit hybrid |
| `MAGMA_MAINTAINED` | Hybrid | Yes | Yes | Forge + Bukkit hybrid |
| `ARCLIGHT` | Hybrid | Yes | Yes | Multi-loader hybrid |
| `KETTING` | Hybrid | Yes | Yes | Forge + Bukkit hybrid |
| `SPONGEVANILLA` | Hybrid | Yes | No | Sponge API server |

`mcctl create -t` accepts only the types in the first table. For another itzg type (the hybrids, `SPONGEVANILLA`, `FTBA`, `CUSTOM`), create the server with an accepted type and `--no-start`, set `TYPE` and the type's variables with `mcctl config <name> TYPE <type>`, then `mcctl start <name>`. `mcctl config` does not check the `TYPE` value.

### Modpack Platforms

| Platform | Environment Variable | Description |
|----------|---------------------|-------------|
| `AUTO_CURSEFORGE` | `CF_SLUG` (or `CF_PAGE_URL`), `CF_EXCLUDE_MODS` | CurseForge modpack: `mcctl create <name> -t AUTO_CURSEFORGE --modpack <slug>` writes `CF_SLUG` (`--exclude-files` → `CF_EXCLUDE_MODS`) |
| `MODRINTH` | `MODRINTH_MODPACK`, `MODRINTH_VERSION`, `MODRINTH_LOADER`, `MODRINTH_EXCLUDE_FILES` | Modrinth modpack: `mcctl create <name> -t MODRINTH --modpack <slug> [--mod-loader <loader>] [--modpack-version <id>] [--exclude-files <a,b>]` |
| `FTBA` | `FTB_MODPACK_ID` | Feed The Beast modpacks (set with `mcctl config`, see above) |
| `CUSTOM` | `CUSTOM_SERVER` | Custom server JAR URL or path (set with `mcctl config`) |

`--modpack` needs `-t MODRINTH` or `-t AUTO_CURSEFORGE`. The modpack decides the Minecraft version: no `VERSION` is written unless `-v` is given. Memory defaults to `6G`.

**Interactive modpack flow**: `mcctl create` without a name asks for the name and type; for a modpack type it then asks for:

1. The **modpack slug** or URL (e.g., `cobblemon`, `adrenaserver`; no search in the CLI)
2. The **mod loader**: Auto-detect, or one of the loaders the modpack's versions list on Modrinth (all of `forge`, `neoforge`, `fabric`, `quilt` if the lookup fails)
3. The **modpack version** (empty for the latest)
4. **Mods to exclude** (comma-separated; client-only mods must be listed here in the CLI)
5. The world, memory (`6G`) and whitelist (no Minecraft version prompt)

The Web Console's Create Server dialog searches Modrinth, offers only the loader and Minecraft version pairs the modpack has, and pre-fills **Exclude mods** with the client-only mods it detects.

### Type-Specific Variables

**PAPER:**

| Variable | Description |
|----------|-------------|
| `PAPER_BUILD` | Specific Paper build number |
| `PAPER_CHANNEL` | `experimental` for experimental builds |

**FORGE:**

| Variable | Description |
|----------|-------------|
| `FORGE_VERSION` | Forge version (`latest` or specific) |
| `FORGE_INSTALLER` | Local installer path |
| `FORGE_FORCE_REINSTALL` | Force reinstall (`true`) |

**NEOFORGE:**

| Variable | Description |
|----------|-------------|
| `NEOFORGE_VERSION` | NeoForge version (`latest` or specific) |

**FABRIC:**

| Variable | Description |
|----------|-------------|
| `FABRIC_LAUNCHER_VERSION` | Launcher version |
| `FABRIC_LOADER_VERSION` | Loader version |
| `FABRIC_FORCE_REINSTALL` | Force reinstall |

**AUTO_CURSEFORGE:**

| Variable | Required | Description |
|----------|----------|-------------|
| `CF_API_KEY` | No | CurseForge API key (built in for Java 17+ images; for java8/pre-17 tags or your own key, set it per server: `mcctl config <server> CF_API_KEY '<key>'`) |
| `CF_PAGE_URL` / `CF_SLUG` | Yes (one) | Modpack URL or slug |
| `CF_FILE_ID` | No | Specific file/version ID |
| `CF_EXCLUDE_MODS` | No | Mods to exclude |

---

## 7. Configuration

### Global Configuration (.env)

Located at `~/minecraft-servers/.env`:

```bash
# Network
HOST_IP=192.168.1.100               # Your server's IP (set by mcctl init)
HOST_IPS=192.168.1.100,100.64.0.5   # Multiple IPs (VPN mesh); used instead of HOST_IP when set
MINECRAFT_NETWORK=minecraft-net
MINECRAFT_SUBNET=172.28.0.0/16      # not read by mcctl; mcctl init creates minecraft-net on this subnet
DOCKER_GID=999                      # docker.sock group for mc-router (set by mcctl init / mcctl upgrade)

# Defaults
TZ=Asia/Seoul  # mcctl init copies this from the template; set your IANA zone
RCON_PASSWORD=<random, generated by mcctl init>
RCON_PORT=25575

# mc-router settings (AUTO_SCALE_*, DOCKER_TIMEOUT) are NOT read from .env:
# they are in the `environment:` of the router service in docker-compose.yml
# (apply with `mcctl router start`; see section 11)

# Backup (GitHub)
BACKUP_GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
BACKUP_GITHUB_REPO=username/minecraft-worlds-backup
BACKUP_GITHUB_BRANCH=main
BACKUP_AUTO_ON_STOP=true

# External access and console
PLAYIT_SECRET_KEY=<written by mcctl playit setup>
LOG_LEVEL=info                      # mcctl-api
BETTER_AUTH_SECRET=<written by mcctl console init>   # console sessions; changing it signs everyone out
BETTER_AUTH_BASE_URL=https://mc.example.com          # optional; default http://localhost:<console port>

# mcctl-api options (optional; apply with `mcctl console service restart --api`)
WORLD_UPLOAD_MAX_SIZE=1073741824     # world ZIP upload, bytes (1 GiB)
WORLD_EXTRACT_MAX_SIZE=5368709120    # uncompressed size of a world ZIP, bytes (5 GiB)
WORLD_EXTRACT_MAX_ENTRIES=100000
STATS_ANALYZE_TIMEOUT_MS=600000      # ore/block statistics scan (10 min)
SWAGGER_ENABLED=true                 # serve /docs under NODE_ENV=production

# Audit Logs (read by mcctl-api from this file; the CLI reads only its shell environment)
AUDIT_AUTO_CLEANUP=true              # Default off; true deletes logs older than AUDIT_RETENTION_DAYS while logs are written
AUDIT_RETENTION_DAYS=90
```

- **What reaches servers**: only the keys named in `servers/global.env` (`TZ`, `EXTRA_ARGS`, `RCON_PASSWORD`, `RCON_PORT`); Compose fills them from `.env`. To pass another key to every server, add its name to `servers/global.env`. `EXTRA_ARGS` reaches only servers without `server.yaml`. A server's `config.env` overrides these. Apply with `mcctl stop <s> && mcctl start <s>` (a restart does not re-read `.env`).
- **CF_API_KEY** in `.env` does not reach servers. When needed (java8/pre-17 tags or your own key), set it per server with `mcctl config <server> CF_API_KEY '<key>'`, or add `CF_API_KEY` to `servers/global.env` with the value in `.env` in single quotes.
- **HOST_IP / HOST_IPS** are read whenever mcctl writes a server's files: the next create, the next mcctl change to an existing server, or `mcctl init --reconfigure` (all servers). Stop and start a server to apply.
- **Who else reads `.env`**: mcctl-api loads the whole file at startup (`mcctl console service restart --api`); mcctl-console reads only `BETTER_AUTH_SECRET` and `BETTER_AUTH_BASE_URL` (an entry in `ecosystem.config.cjs` wins until `mcctl upgrade` moves it; apply with `mcctl console service restart --console`). `DEFAULT_MEMORY` and `DEFAULT_VERSION` from older installs are not read.
- **Shell variables** (not `.env`): `MCCTL_ROOT` (platform directory, default `~/minecraft-servers`; `--root` overrides it per command) and `MCCTL_SUDO_PASSWORD` (sudo password for `/etc/avahi/hosts`).

### Server Configuration (config.env)

Each server has a `config.env` at `servers/<name>/config.env`:

```bash
# Server (EULA=TRUE is set by the server compose, not here)
TYPE=PAPER
VERSION=1.21.1

# Memory
MEMORY=4G

# Game Settings
MOTD=Welcome to my server!
MAX_PLAYERS=20
DIFFICULTY=normal
MODE=survival
PVP=true
SPAWN_PROTECTION=0
VIEW_DISTANCE=10

# World
LEVEL=myserver
SEED=12345
EXTRA_ARGS=--universe /worlds/

# Players
OPS=Steve,Alex
ENABLE_WHITELIST=false

# RCON
ENABLE_RCON=true

# Mods/Plugins
MODRINTH_PROJECTS=sodium,lithium
MODRINTH_DOWNLOAD_DEPENDENCIES=required
CURSEFORGE_FILES=jei,journeymap
SPIGET_RESOURCES=9089

# Performance
USE_AIKAR_FLAGS=true
```

mcctl writes `config.env` from `servers/<name>/server.yaml`: `TYPE`, `VERSION`, `MEMORY`, `LEVEL` and `PLAYIT_DOMAIN` from their own fields, `EXTRA_ARGS` from `world.storage` (`universe`: `--universe /worlds/`) plus `env.EXTRA_ARGS` (which must not contain `--universe`), every other key from `env`. A hand edit is taken into `server.yaml` the next time mcctl changes the server. `EULA=TRUE` comes from the server compose `environment:`, which wins over `config.env`.

**Value rules** (Docker Compose env file): one `KEY=value` per line, so a value cannot span lines (a following line without `=` is not part of it); in an unquoted value a space followed by `#` starts a comment (`MOTD=Hi #1` sets `Hi`; write `MOTD='Hi #1'` or use `mcctl config`, which quotes it); the last duplicate wins; whitespace around `=` is ignored. mcctl refuses values with control characters or a leading quote, and writes values containing `$` in single quotes, so `${VAR}` stays literal (interpolation works only in lines written by hand).

### Key Environment Variables Reference

Defaults in these tables are the itzg image's. `mcctl create` writes `TYPE=PAPER`, `VERSION=LATEST` (modpack types: none unless `-v`), `MEMORY=4G` (`6G` for modpacks) and `MOTD=Welcome to <name>! Your adventure begins here.`, and from the server template `DIFFICULTY=normal`, `MAX_PLAYERS=20`, `VIEW_DISTANCE=10`, `PVP=true`, `SPAWN_PROTECTION=0`, `ENABLE_RCON=true` and `MODRINTH_DOWNLOAD_DEPENDENCIES=required`.

#### Essential

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `EULA` | **Yes** | - | Must be `TRUE` to accept Minecraft EULA |
| `TYPE` | No | `VANILLA` | Server type |
| `VERSION` | No | `LATEST` | Minecraft version |
| `MEMORY` | No | `1G` | JVM heap memory (e.g., `4G`, `8G`) |

#### Server Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MOTD` | - | Server message of the day |
| `DIFFICULTY` | `easy` | `peaceful`, `easy`, `normal`, `hard` |
| `MODE` | `survival` | `survival`, `creative`, `adventure`, `spectator` (the image does not read `GAMEMODE`) |
| `MAX_PLAYERS` | `20` | Maximum concurrent players |
| `PVP` | `true` | Enable PvP |
| `LEVEL` | `world` | World save folder name; this is the server's world assignment (stopped server only, one world per server) |
| `SEED` | Random | World generation seed |
| `VIEW_DISTANCE` | - | Server view distance (chunks) |
| `SIMULATION_DISTANCE` | - | Simulation distance (chunks) |
| `SPAWN_PROTECTION` | `16` | Spawn protection radius (0 to disable) |
| `LEVEL_TYPE` | `default` | World type: `default`, `flat`, `largeBiomes`, `amplified` |
| `GENERATE_STRUCTURES` | `true` | Generate villages, temples, etc. |
| `SPAWN_ANIMALS` | `true` | Spawn animals |
| `SPAWN_MONSTERS` | `true` | Spawn monsters |
| `SPAWN_NPCS` | `true` | Spawn NPCs |
| `ALLOW_FLIGHT` | - | Allow flight |
| `ALLOW_CHEATS` | - | Allow cheats |
| `ENABLE_COMMAND_BLOCK` | - | Enable command blocks |
| `MAX_TICK_TIME` | - | Max tick time in ms (`-1` to disable watchdog) |
| `OVERRIDE_SERVER_PROPERTIES` | `true` | Auto-manage server.properties |
| `CUSTOM_SERVER_PROPERTIES` | - | Set multiple properties at once (multiline) |

#### Memory and JVM

| Variable | Description |
|----------|-------------|
| `MEMORY` | Sets both initial and max heap (e.g., `4G`, `75%`) |
| `INIT_MEMORY` | Initial heap size (overrides MEMORY for -Xms) |
| `MAX_MEMORY` | Maximum heap size (overrides MEMORY for -Xmx) |
| `JVM_OPTS` | General JVM options |
| `JVM_XX_OPTS` | `-XX` JVM options |
| `JVM_DD_OPTS` | System properties |

#### JVM Optimization Flags

| Variable | Description |
|----------|-------------|
| `USE_AIKAR_FLAGS` | Aikar's GC tuning (recommended for Paper/Spigot) |
| `USE_MEOWICE_FLAGS` | Updated JVM flags |
| `USE_MEOWICE_GRAALVM_FLAGS` | GraalVM-specific optimizations |
| `USE_SIMD_FLAGS` | SIMD optimization flags |
| `USE_FLARE_FLAGS` | Flare performance profiling |

#### Player Management

| Variable | Description |
|----------|-------------|
| `OPS` | Operator usernames (comma-separated) |
| `OPS_FILE` | Path/URL to ops file |
| `ENABLE_WHITELIST` | Enable whitelist |
| `WHITELIST` | Whitelisted players (comma-separated) |
| `WHITELIST_FILE` | Path/URL to whitelist file |
| `ENFORCE_WHITELIST` | Enforce for existing connections |

#### RCON

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_RCON` | `true` | Enable RCON (required for mcctl exec/console) |
| `RCON_PASSWORD` | - | RCON password (from the platform `.env` through `servers/global.env`) |
| `RCON_PASSWORD_FILE` | - | Read password from file (Docker Secrets) |
| `RCON_PORT` | `25575` | RCON port |

#### Mods and Plugins

**Modrinth:**

| Variable | Default | Description |
|----------|---------|-------------|
| `MODRINTH_PROJECTS` | - | Project slugs, comma-separated on one line |
| `MODRINTH_DOWNLOAD_DEPENDENCIES` | `none` | `required`, `optional`, `none` |
| `MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE` | `release` | `release`, `beta`, `alpha` |

**CurseForge:**

| Variable | Description |
|----------|-------------|
| `CF_API_KEY` | CurseForge API key (optional: built in for Java 17+ images; for java8/pre-17 tags or your own key, set it per server with `mcctl config <server> CF_API_KEY '<key>'`) |
| `CURSEFORGE_FILES` | Mod slugs, IDs, or URLs |

**Spiget:**

| Variable | Description |
|----------|-------------|
| `SPIGET_RESOURCES` | SpigotMC resource IDs (comma separated) |

**Direct Download:**

| Variable | Description |
|----------|-------------|
| `MODS` | Mod JAR URLs |
| `PLUGINS` | Plugin JAR URLs |
| `MODS_FILE` | File path/URL containing mod URLs |
| `PACKWIZ_URL` | URL to Packwiz `pack.toml` |

**Mod Cleanup:**

| Variable | Default | Description |
|----------|---------|-------------|
| `REMOVE_OLD_MODS` | `false` | Remove old mods before downloading |
| `REMOVE_OLD_MODS_INCLUDE` | `*.jar` | Glob pattern for files to remove |
| `REMOVE_OLD_MODS_EXCLUDE` | - | Glob pattern for files to keep |

#### Resource Pack and Icon

| Variable | Description |
|----------|-------------|
| `RESOURCE_PACK` | Resource pack download URL |
| `RESOURCE_PACK_SHA1` | Resource pack checksum |
| `RESOURCE_PACK_ENFORCE` | Enforce on clients |
| `ICON` | Server icon URL or path (64x64 PNG) |

#### Auto RCON Commands

| Variable | Description |
|----------|-------------|
| `RCON_CMDS_STARTUP` | Commands on server startup |
| `RCON_CMDS_ON_CONNECT` | Commands when any player connects |
| `RCON_CMDS_ON_DISCONNECT` | Commands when any player disconnects |
| `RCON_CMDS_FIRST_CONNECT` | Commands when first player connects |
| `RCON_CMDS_LAST_DISCONNECT` | Commands when last player disconnects |

#### Environment Variable Interpolation

| Variable | Default | Description |
|----------|---------|-------------|
| `REPLACE_ENV_IN_PLACE` | `true` | Enable `${CFG_*}` variable replacement |
| `REPLACE_ENV_VARIABLE_PREFIX` | `CFG_` | Prefix for replaceable variables |
| `REPLACE_ENV_DURING_SYNC` | `false` | Replace in synced `/plugins`, `/mods`, `/config` |

**Secret Files**: Append `_FILE` to variable name to read from mounted file (Docker Secrets).

#### Debugging

| Variable | Description |
|----------|-------------|
| `DEBUG` | Enable verbose logging |
| `DEBUG_EXEC` | Show server start command |
| `DEBUG_MEMORY` | Memory allocation debugging |
| `DUMP_SERVER_PROPERTIES` | Output server.properties at startup |

#### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `LOG_TIMESTAMP` | `false` | Add timestamps to log output |
| `GENERATE_LOG4J2_CONFIG` | `false` | Generate log4j2 configuration |

---

## 8. REST API Reference

mcctl-api is the Fastify REST API behind the Web Console: port `5001` (`PORT`), listening on `HOST` (default `0.0.0.0`), run on the host by PM2 as `mcctl-api` (not in Docker). Full reference: `docs/api/index.md` (authentication, errors, SSE, Swagger) and `docs/api/endpoints.md` (every route with bodies, responses and status codes). Paths below are complete; only the legacy `/servers/:id/console/exec` lacks `/api`. `:name` and body fields `serverName` take the server name without `mc-` (`survival`, not `mc-survival`).

### Authentication

`AUTH_MODE` and its settings are environment variables of the `mcctl-api` app in `<root>/ecosystem.config.cjs`, written by `mcctl console init`:

| `AUTH_MODE` | Requirement | Request header | `mcctl console init` mode |
|-------------|-------------|----------------|---------------------------|
| `disabled` | none | - | `open` |
| `api-key` | `AUTH_API_KEY` | `X-API-Key: <key>` | `api-key` (key printed once) |
| `ip-whitelist` | client address in `AUTH_IP_WHITELIST` (IPs or CIDR, comma-separated) | - | `internal` (default; `127.0.0.1,::1,::ffff:127.0.0.1`) or `ip-whitelist` |
| `basic` | user in `AUTH_USERS` (JSON `[{"username","passwordHash"}]`, bcrypt) | `Authorization: Basic <base64>` | not offered |
| `combined` | API key and IP whitelist | `X-API-Key: <key>` | `api-key-ip` |

```bash
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers   # api-key / combined
curl -u admin:password http://localhost:5001/api/servers            # basic
```

- Unset or unknown `AUTH_MODE`: `api-key` when `NODE_ENV=production`, else `disabled`. mcctl-api does not start when the mode's required variable is missing. `AUTH_EXCLUDE_PATHS` (default `/health,/health/`) skip authentication.
- The key is read only from `X-API-Key`; `Authorization: Bearer` gets 401. Failures: 401 `{"error":"AuthenticationError","message":"Missing X-API-Key header"}` (also `Invalid API key`, `Invalid credentials`), 403 `AuthenticationError` `IP address not allowed`.
- `X-Role: admin` is required by `DELETE /api/audit-logs`, `GET /api/platform-settings` and `PUT /api/platform-settings` (403 `Forbidden` otherwise). `X-User` becomes the audit actor `api:<user>` for the file routes and `PUT /api/platform-settings` (other routes record `api:console`) and is required by `GET /api/auth/me`. The console adds both headers when it forwards requests that need them.
- Change the mode or key with `mcctl console init --force`; `mcctl console api ...` only edits `api-config.json`, which mcctl-api does not read (#633).
- Swagger UI `/docs` and the spec `/docs/json` are served only when `NODE_ENV` is not `production` or `SWAGGER_ENABLED=true`; they need the same authentication as other routes.

### All Endpoints

105 routes, one line each (details in `docs/api/endpoints.md`).

**Health**

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | `{status: "ok", timestamp}`; always 200; no auth by default |

**Servers**

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/servers` | `servers/` dirs with `config.env` + `mc-*` containers: `{servers: [{name, container, status, health, hostname}], total}`. `?include=summary` adds `type`, `version`, `memory`, `players` (`null` on RCON failure), `stats {memoryUsage, memoryLimit}` and `totals {playersOnline, playersMax, running}` (RCON ~2 s, stats ~3 s, cached ~10 s); other `include` values → 400 |
| GET | `/api/servers/:name` | `{server}`: list fields + `type`, `version`, `memory`, `uptime`, `uptimeSeconds`, `players {online, max, players[]}`, `stats {memoryUsage, memoryLimit, memoryPercent, cpuPercent}`, `worldName`, `worldSize`, `playitDomain`; no container → `status: "not_created"` from `config.env` |
| GET | `/api/servers-status` | `[{serverName, status, health, timestamp}]` (status: running/exited/created/stopped/unknown); `?follow=true&interval=` → SSE `server-status` per server |
| GET | `/api/servers/:name/status` | Same object for one server; SSE with `follow` |
| POST | `/api/servers` | Create; 201 `{success, server {name, container, status: "starting" or "created"}, warning?}`; `?follow=true` → SSE `server-create` / `server-create-log` messages; 400 validation, 409 exists or world in use |
| DELETE | `/api/servers/:name` | Delete; world inside the server moved to `worlds/` (`?deleteWorld=true` deletes it); optional body `{sudoPassword}`; reply may add `warning`; 409 refusals, 500 Docker failures |
| POST | `/api/servers/:name/start` | `docker compose up -d mc-<name>` → `{success, server, action, timestamp, message}` (`message` = compose stdout, may be empty); failure 500 `{success: false, error, message}` |
| POST | `/api/servers/:name/stop` | `docker compose stop mc-<name>`; with `BACKUP_AUTO_ON_STOP=true` also a background world backup |
| POST | `/api/servers/:name/restart` | `docker compose restart mc-<name>` |
| POST | `/api/servers/:name/exec` | `{command}` (1-1024 chars) → `docker exec mc-<name> rcon-cli -- <command>` → `{success, output}` (stdout only; `success` is true whenever the container exists) |
| GET | `/api/servers/:name/logs` | `?lines=` (1-10000, default 100) → `{logs, lines}`; `?follow=true` → SSE `data: {"type":"server-log","data":{"log":"..."}}`, then `connection-closed`; 404 without a container |

**Server configuration**

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/servers/:name/config` | `{config}`: camelCase fields for `config.env` variables present (61 fields, e.g. `maxPlayers` = `MAX_PLAYERS`, `gameMode` = `GAMEMODE`, `motd`, `memory`, `level`) |
| PATCH | `/api/servers/:name/config` | Any subset → `{success, config, restartRequired, changedFields}`; a changed `level` is a world assignment (stopped server, R1); 409 on refused `server.yaml` writes |
| POST | `/api/servers/:name/world/reset` | Empties `worlds/<LEVEL>` (keeps `.meta`); 409 unless the container is stopped, and for internal or shared worlds |

**Hostnames**

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/servers/:name/hostnames` | `{serverName, hostnames[], systemHostnames [{hostname, type, description}], customHostnames[]}`; system = `<server>.local`, `<server>.<ip>.nip.io` |
| PUT | `/api/servers/:name/hostnames` | `{customHostnames: []}` replaces all custom hostnames; reply adds `success`, `recreateRequired: true`, `playitDomain`; applies after stop + start |

**Mods** (source `modrinth`, stored in `MODRINTH_PROJECTS`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/servers/:name/mods` | `{mods: {modrinth: [slugs]}}` |
| POST | `/api/servers/:name/mods` | `{slugs: [], source?}` → `{success, added, mods}` |
| DELETE | `/api/servers/:name/mods/:slug` | `{success, removed}`; 404 if not listed |
| GET | `/api/servers/:name/mods/installed` | `{mods: [{filename, excluded}]}` from `data/mods/*.jar` |
| PATCH | `/api/servers/:name/mods/installed/:filename/exclude` | `{excluded}` toggles the name in `MODRINTH_EXCLUDE_FILES` (`CF_EXCLUDE_MODS` for `AUTO_CURSEFORGE`) → `{success, filename, excluded, excludeList, restartRequired}` |
| GET | `/api/mods/search` | `?q=&limit=10&offset=0&type=modpack` → `{hits, totalHits, offset, limit}` |
| GET | `/api/mods/projects` | `?slugs=a,b&source=` → `{projects: {<slug>: {...} or null}}` |
| GET | `/api/mods/:slug/versions` | `{slug, loaders, byLoader: {<loader>: {gameVersions, recommended}}}`; 404 when none |
| GET | `/api/mods/:slug/client-only` | `?version=` → `{slug, clientOnly: []}` (partial file names for `excludeFiles`); 502 on failure |

**Files** (inside `servers/<name>/data`; `path` relative to it; leaving it, also via symlinks, → 403; audited as `api:<X-User>`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/servers/:name/files` | `?path=/` → `{path, files: [{name, type, size, modifiedAt}]}` (dot entries hidden) |
| GET | `/api/servers/:name/files/read` | `?path=` → `{path, content, size, modifiedAt}`; 413 over 5 MB |
| PUT | `/api/servers/:name/files/write` | `?path=` + `{content}` (5 MB max) → `{success, path, size, modifiedAt}` |
| DELETE | `/api/servers/:name/files` | `?path=` (not `/`): file or directory |
| POST | `/api/servers/:name/files/mkdir` | `?path=`; 409 if it exists |
| POST | `/api/servers/:name/files/rename` | `{oldPath, newPath}`; 409 if the target exists |
| POST | `/api/servers/:name/files/upload` | `?path=` (existing dir) + multipart; 100 MB per file (413) → `{success, path, files[]}` |
| GET | `/api/servers/:name/files/download` | `?path=` → `application/octet-stream` attachment |

**Players and access lists** (changes, ban/op lists and kick need a container, else 404)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/servers/:name/players` | `{serverName, running, online, max, players[], roster [{uuid, name, lastSeen, isOp, isBanned, isWhitelisted, online}]}`; works while stopped; `?follow=true` → SSE `players` |
| GET | `/api/servers/:name/players/:uuid` | One known player; `?include=stats,nbt,sessions` adds `stats`, `data` + `livePosition`, `sessions` (unknown value 400, unknown player 404) |
| GET | `/api/servers/:name/players/live` | `{players: [{uuid, name?, x, y, z, dimension, online, health?, food?, xpLevel?}]}` over RCON; empty when stopped; SSE `players-live` |
| GET | `/api/players/:username` | Mojang lookup → `{username, uuid, skinUrl}` |
| GET | `/api/servers/:name/whitelist` | `{players: [{name, uuid}], total, source: rcon/file/config, enabled}` |
| POST | `/api/servers/:name/whitelist` | `{player}` → `{success, message, source}`: RCON when running, else `whitelist.json` |
| DELETE | `/api/servers/:name/whitelist/:player` | Same handling as add |
| GET | `/api/servers/:name/whitelist/status` | `{enabled, source: "config"}` (`ENABLE_WHITELIST`) |
| PUT | `/api/servers/:name/whitelist/status` | `{enabled}` writes `ENABLE_WHITELIST` (+ RCON `whitelist on/off` while running) |
| GET | `/api/servers/:name/bans` | `{players: [{name, uuid, reason, created, source, expires}], total, source: "file"}` |
| POST | `/api/servers/:name/bans` | `{player, reason?}`: RCON `ban` when running, else `banned-players.json` |
| DELETE | `/api/servers/:name/bans/:player` | RCON `pardon` or the file |
| GET | `/api/servers/:name/ops` | `{operators: [{name, uuid, level, role, bypassesPlayerLimit}], count, source: "file"}` (role: Moderator 1, Gamemaster 2, Admin 3, Owner 4) |
| POST | `/api/servers/:name/ops` | `{player, level?}` (1-4, default 4) → `{success, operator, source}`; edits `ops.json` only; 404 when Mojang has no UUID |
| PATCH | `/api/servers/:name/ops/:player` | `{level}` (1-4); 404 if not an operator |
| DELETE | `/api/servers/:name/ops/:player` | Removes from `ops.json`; 404 if not an operator |
| POST | `/api/servers/:name/kick` | `{player, reason?}` via RCON; 400 when not running |

**Worlds** (World assignment rules: §5 World Management; 400 invalid name, 404 unknown server or world, 409 refused)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/worlds` | `{worlds: [{name, path, isLocked, lockedBy, servers[], size, lastModified, dimensions {nether, end}}], total, assignmentWarnings[]}`; `<w>_nether`/`<w>_the_end` folded into `<w>` |
| GET | `/api/worlds/:name` | `{world}`; any directory right under `worlds/` incl. legacy names (`My%20World`); `.`-prefixed → 400, not a directory → 404 |
| POST | `/api/worlds` | `{name, seed?, serverName?, autoStart?}` → 201 `{success, worldName, seed, serverName, started}`; creates `worlds/<name>/.meta`; 400 if no server exists at all or the name is taken |
| POST | `/api/worlds/upload` | `?name=` + multipart `.zip` containing `level.dat` → 201; 409 exists; 413 over `WORLD_UPLOAD_MAX_SIZE` (1 GiB) |
| POST | `/api/worlds/:name/assign` | `{serverName}`: sets `LEVEL` of a stopped server; 409 if another server uses the world |
| POST | `/api/worlds/:name/release` | Server goes back to its own world `<server>` → `{success, worldName, previousServer, fallbackWorld, fallbackExists}` |
| DELETE | `/api/worlds/:name` | Deletes `worlds/<name>` + `<name>_nether`/`<name>_the_end`; 409 while a server uses it |
| GET | `/api/worlds/:name/info` | `{info: {name, level {seed, spawn, gameMode, difficulty, versionName, worldBorder, gameRules, ...}, dimensions, sizeBytes, regionCount, lastModified}}` |
| GET | `/api/worlds/:name/players` | Last saved player positions from player data |
| GET | `/api/worlds/:name/map/status` | `{rendered, maps[], lastModified?}` |
| POST | `/api/worlds/:name/map/render` | BlueMap CLI in Docker (2 GB limit) → `maps/<name>/web`; `{dimensions?, force?}`; `?follow=true` → SSE `progress`, `done`, `error` |
| GET | `/api/worlds/:name/map/web/*` | Rendered map files (`<file>.gz` served decompressed) |
| POST | `/api/worlds/:name/map/markers` | Structure markers → `{counts, total}`; 409 before a render |
| GET | `/api/worlds/:name/stats` | Cached block statistics (`stats/<name>.json`); 404 before the first analysis |
| POST | `/api/worlds/:name/stats/analyze` | Full region scan; `?follow=true` → SSE `progress`, `done`, `cancelled`, `error`; stops after `STATS_ANALYZE_TIMEOUT_MS` (10 min) or on disconnect |

**Router**

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/router/status` | `{router {name, status, health, port, uptime?, uptimeSeconds?, mode: "--in-docker (auto-discovery)", routes [{hostname, target, serverStatus, serverType?, serverVersion?, autoScaleUp?, autoScaleDown?, discoveredByRouter?}], image?, autoScale? {up, down, downAfter?, asleepMotd?}, resolver? {hostIp?, hostIps}}, avahi, playit?}`; `discoveredByRouter` is absent when mc-router or its management API `127.0.0.1:25580/routes` is unreadable, and for stopped routes while global `AUTO_SCALE_UP` is off |
| GET | `/api/router/status/stream` | SSE `router-status` (on connect, then only on change; `uptimeSeconds` ignored), `router-status-error {timestamp}`; `?interval=` 1000-60000 (5000) |
| GET | `/api/router/logs/stream` | SSE `connected`, `router-log {ts?, kind: connect/wake/error/info, hostname?, target?, player?, raw}`, `end {code, error?}`; `?tail=` 1-500 (100) |
| POST | `/api/router/restart` | `docker compose restart router` → `{success, message}`; 500 `{error, message}`; audit `router.restart`; the console shows the button to admins only |

**Backups** (GitHub repo from `BACKUP_GITHUB_TOKEN`, `BACKUP_GITHUB_REPO`, `BACKUP_GITHUB_BRANCH` in `.env`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/backup/status` | `{configured, repository?, branch, lastBackup?}` (`branch` defaults to `main`) |
| POST | `/api/backup/push` | `{message?, allowMissing?}` → `{success, commitHash?, message}` (`No changes to backup` counts as success); running servers flushed via RCON first; 400 not configured or missing worlds, 409 another backup or unfinished restore, 503 Docker unreachable |
| GET | `/api/backup/history` | Last 20 commits `{commits: [{hash, message, date, author}], total}`; 400 when not configured |
| POST | `/api/backup/restore` | `{commitHash}` (7+ chars); all servers stopped; previous data kept in `backups/restore-previous/<timestamp>/` (last 3); 409 / 404 / 503 |
| GET | `/api/backup/schedules` | `{schedules: [{id, name, cronExpression, cronHumanReadable, retentionPolicy {maxCount?, maxAgeDays?}, enabled, lastRunAt, lastRunStatus, lastRunMessage, createdAt, updatedAt}], total}` |
| POST | `/api/backup/schedules` | `{name, cron, maxCount?, maxAgeDays?, enabled?}` → 201 |
| GET | `/api/backup/schedules/:id` | One schedule |
| PUT | `/api/backup/schedules/:id` | Update `name`, `cron`, `maxCount`, `maxAgeDays` |
| PATCH | `/api/backup/schedules/:id/toggle` | `{enabled}` |
| DELETE | `/api/backup/schedules/:id` | `{success, message}` |

**Config snapshots** (copies of `server.yaml`, `config.env`, `docker-compose.yml` and other `.yml`/`.yaml`/`.json`/`.properties` files directly in `servers/<name>/`, up to 1 MB each)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/servers/:name/config-snapshots` | `?limit=20&offset=0` → `{snapshots: [{id, serverName, createdAt, description, files [{path, hash, size}], scheduleId?}], total}` |
| POST | `/api/servers/:name/config-snapshots` | `{description?}` → 201 snapshot |
| GET | `/api/servers/:name/config-snapshots/:id` | One snapshot (404 if it belongs to another server) |
| DELETE | `/api/servers/:name/config-snapshots/:id` | 204 |
| POST | `/api/servers/:name/config-snapshots/:id/restore` | `{createSnapshotBeforeRestore = true, force = false}` → `{restored, safetySnapshot?}`; 409 while running (without `force`) or on a world assignment conflict |
| GET | `/api/config-snapshots/:id1/diff/:id2` | `{baseSnapshotId, compareSnapshotId, changes [{path, status: added/modified/deleted, ...}], summary, hasChanges}` |
| GET | `/api/config-snapshot-schedules` | `?serverName=` → `{schedules: []}` |
| POST | `/api/config-snapshot-schedules` | `{serverName, name, cronExpression, retentionCount? (1-100, default 10), enabled?}` → 201 |
| GET | `/api/config-snapshot-schedules/:id` | One schedule |
| PUT | `/api/config-snapshot-schedules/:id` | Update `name`, `cronExpression`, `retentionCount` |
| PATCH | `/api/config-snapshot-schedules/:id/toggle` | `{enabled}` |
| DELETE | `/api/config-snapshot-schedules/:id` | 204; its snapshots are kept |

**playit.gg**

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/playit/status` | `{enabled, agentRunning, secretKeyConfigured, containerStatus, uptime?, uptimeSeconds?, servers [{serverName, playitDomain, lanHostname}]}` |
| POST | `/api/playit/start` | Start `playit-agent` → `{success, message}`; audit `playit.start` |
| POST | `/api/playit/stop` | Stop `playit-agent`; audit `playit.stop` |

**Platform Settings** (`<root>/.env`; both need `X-Role: admin`; 404 before `mcctl init`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/platform-settings` | `{revision, settings [{key, label, group, type, status, source, editable, secret, value? or configured?, restartScope, ...}], runtime []}`; secrets return only `configured` |
| PUT | `/api/platform-settings` | `{revision, set: {}, remove: []}` → `{revision, changedKeys, removedKeys, restartScopes}`; blank secret = keep; 400 `errors[]`, 409 stale `revision` (`currentRevision`) or world-location change (`servers`); audit by key name only |

**Audit logs** (`data/audit.db`, shared with the CLI)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/audit-logs` | `?action=&actor=&targetType=&targetName=&status=&from=&to=&limit=&offset=&sort=` → `{logs, total, limit, offset, filters}`; `limit` 1-200 (50); exact-match filters; only the first of several comma-separated actions applies |
| GET | `/api/audit-logs/stats` | No parameters → `{total, byAction, byStatus, byActor (newest 1000 entries), recentActivity (10), oldestEntry, newestEntry}` |
| GET | `/api/audit-logs/:id` | `{log, relatedLogs: {sameTarget, sameActor}}` (up to 10 each) |
| GET | `/api/audit-logs/stream` | SSE `connected`, `audit-log`, `heartbeat`; only entries written by this mcctl-api process (not CLI writes); no filters |
| DELETE | `/api/audit-logs` | Needs `X-Role: admin`; body `{before, dryRun?}` → `{deleted, dryRun, message}` |

**Legacy**

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/login` | Checks `<root>/users.yaml`, which current mcctl does not create (console accounts are in the console DB, `mcctl console user`), so it answers 401 on new installs |
| GET | `/api/auth/me` | `{username, role}` from `X-User` / `X-Role` (`role` defaults to `user`); 401 without `X-User` |
| POST | `/servers/:id/console/exec` | No `/api` prefix; `{command}` → `{output, exitCode}`; does not check that the server exists |

### Conventions

- **Errors** are `{"error": "<Name>", "message": "..."}`: `BadRequest` (route) or `Bad Request` (schema; some routes add `statusCode` and `code: "FST_ERR_VALIDATION"`) 400, `AuthenticationError` 401/403, `Forbidden` 403, `NotFound` 404 (unknown route: `{"message":"Route GET:/x not found","error":"Not Found","statusCode":404}`), `Conflict` 409, `PayloadTooLarge` 413, `InternalServerError` 500, `BadGateway` 502, `ServiceUnavailable` 503. Start/stop/restart failures use `{success: false, server, action, timestamp, error, message}`.
- **Status codes**: 201 for creates (server, world, upload, snapshot, schedules), 204 for snapshot and snapshot-schedule deletes.
- **Writes through `server.yaml`**: config, whitelist on/off, hostnames, mods and world assignment update `servers/<name>/server.yaml` and render `config.env` and the compose file; a refused write (e.g. hand-edited compose) is 409. Values written to `config.env` may not contain control characters or start with a quote (400).
- **Create and delete** run one at a time inside mcctl-api.
- **SSE**: named events (`event:` + `data:`) for status, players, router, audit, map render and stats; typed messages (`data: {"type": ..., "data": {...}}`) for logs and create. `: heartbeat` every 30 s (audit: `event: heartbeat`); polling streams take `interval` 1000-60000 ms (default 5000). The browser `EventSource` cannot send `X-API-Key`: use `curl -N`, `fetch` with a stream reader, or the console, which proxies `/api/sse/<path>` to mcctl-api `/api/<path>?follow=true` for signed-in users.

### Example: List Servers

```bash
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers
curl -H "X-API-Key: mctk_xxx" "http://localhost:5001/api/servers?include=summary"
```

### Example: Execute Command

```bash
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"command": "list"}' \
  http://localhost:5001/api/servers/survival/exec
# {"success":true,"output":"There are 3 of a max of 20 players online: ..."}
```

### Example: Create Server

```bash
# Standard server
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"name": "survival", "type": "PAPER", "version": "1.21.1", "memory": "4G"}' \
  http://localhost:5001/api/servers

# MODRINTH modpack server
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"name": "cobblemon", "type": "MODRINTH", "modpack": "cobblemon-modpack", "modLoader": "fabric"}' \
  http://localhost:5001/api/servers
```

**Create Server request body fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | 2-32 chars: lowercase letter first, then lowercase letters, digits, single hyphens; `router` reserved |
| `type` | string | No | `PAPER` (default), `VANILLA`, `FORGE`, `FABRIC`, `SPIGOT`, `NEOFORGE`, `MODRINTH`, `AUTO_CURSEFORGE` |
| `version` | string | No | Default `LATEST`; for `MODRINTH`/`AUTO_CURSEFORGE` no `VERSION` is written unless given |
| `memory` | string | No | `^\d+[MG]$`; default `4G` (`6G` for modpack types) |
| `seed` / `worldUrl` / `worldName` | string | No | At most one (400 otherwise); `worldName` must exist in `worlds/` |
| `autoStart` | boolean | No | Default `true` |
| `sudoPassword` | string | No | For adding `<name>.local` to `/etc/avahi/hosts` (write-only) |
| `modpack` | string | For `MODRINTH`/`AUTO_CURSEFORGE` | Modrinth modpack slug, ID or URL |
| `modpackVersion` | string | No | Modpack version (max 128) |
| `modLoader` | string | No | `forge`, `fabric`, `neoforge`, `quilt`; with `version`, an incompatible pair is 400 when Modrinth answers |
| `excludeFiles` | string[] | No | Up to 100 mods to leave out (`MODRINTH_EXCLUDE_FILES` / `CF_EXCLUDE_MODS`) |

The JSON reply waits at most 120 s for the container start; after that, or when the first start fails, it is still 201 with `status: "created"` and a `warning`.

### Example: Start/Stop/Restart Server

```bash
curl -X POST -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers/survival/start
curl -X POST -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers/survival/stop
curl -X POST -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers/survival/restart
```

### Example: Get Server Logs

```bash
# Last N lines (JSON)
curl -H "X-API-Key: mctk_xxx" "http://localhost:5001/api/servers/survival/logs?lines=50"

# SSE streaming logs
curl -N -H "X-API-Key: mctk_xxx" "http://localhost:5001/api/servers/survival/logs?follow=true"
# data: {"type":"server-log","data":{"log":"[10:30:15] [Server thread/INFO]: Player1 joined the game"}}
```

### Example: Player Management via API

```bash
# Roster (online + known players)
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers/survival/players

# Whitelist add / remove
curl -X POST -H "X-API-Key: mctk_xxx" -H "Content-Type: application/json" \
  -d '{"player": "Steve"}' http://localhost:5001/api/servers/survival/whitelist
curl -X DELETE -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers/survival/whitelist/Steve

# Ban, kick (kick needs a running server)
curl -X POST -H "X-API-Key: mctk_xxx" -H "Content-Type: application/json" \
  -d '{"player": "Griefer", "reason": "Griefing"}' http://localhost:5001/api/servers/survival/bans
curl -X POST -H "X-API-Key: mctk_xxx" -H "Content-Type: application/json" \
  -d '{"player": "Troublemaker", "reason": "Breaking rules"}' http://localhost:5001/api/servers/survival/kick

# Operator with level (1-4, default 4), then change the level
curl -X POST -H "X-API-Key: mctk_xxx" -H "Content-Type: application/json" \
  -d '{"player": "TrustedPlayer", "level": 3}' http://localhost:5001/api/servers/survival/ops
curl -X PATCH -H "X-API-Key: mctk_xxx" -H "Content-Type: application/json" \
  -d '{"level": 2}' http://localhost:5001/api/servers/survival/ops/TrustedPlayer
```

### Example: World Management via API

```bash
# List worlds
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/worlds

# Create world
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"name": "newworld", "seed": "12345"}' \
  http://localhost:5001/api/worlds

# Assign world to the stopped server "survival"
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"serverName": "survival"}' \
  http://localhost:5001/api/worlds/newworld/assign

# Release world (its server goes back to its own default world)
curl -X POST -H "X-API-Key: mctk_xxx" \
  http://localhost:5001/api/worlds/newworld/release

# Delete world
curl -X DELETE -H "X-API-Key: mctk_xxx" \
  http://localhost:5001/api/worlds/newworld
```

### Example: SSE Real-time Status

```bash
# Stream all server statuses
curl -N -H "X-API-Key: mctk_xxx" "http://localhost:5001/api/servers-status?follow=true&interval=5000"

# Output format (one event per server every interval, plus ": heartbeat" every 30 s):
# event: server-status
# data: {"serverName":"survival","status":"running","health":"healthy","timestamp":"2026-10-25T10:30:00.000Z"}
```

### Example: Audit Logs via API

```bash
# List audit logs with filtering
curl -H "X-API-Key: mctk_xxx" \
  "http://localhost:5001/api/audit-logs?action=server.create&limit=20"

# Statistics and one entry
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/audit-logs/stats
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/audit-logs/<id>

# Stream new entries (events: connected, audit-log, heartbeat)
curl -N -H "X-API-Key: mctk_xxx" http://localhost:5001/api/audit-logs/stream

# Purge entries older than a date (admin only)
curl -X DELETE -H "X-API-Key: mctk_xxx" -H "X-Role: admin" \
  -H "Content-Type: application/json" \
  -d '{"before": "2025-11-07T00:00:00.000Z", "dryRun": true}' \
  http://localhost:5001/api/audit-logs
```

### Example: Backup via API

```bash
# Check backup status
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/backup/status

# Push backup
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"message": "Pre-upgrade backup"}' \
  http://localhost:5001/api/backup/push

# Get backup history
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/backup/history
```

### API Response Formats

**Server object** (`GET /api/servers` items; `GET /api/servers/:name` adds the detail fields):

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Server name (no `mc-` prefix) |
| `container` | string | `mc-<name>` |
| `status` | string | `running`, `exited`, `created`, `paused`, `restarting`, `dead`, `not_created` (directory without a container) |
| `health` | string | `healthy`, `unhealthy`, `starting`, `none`, `unknown` |
| `hostname` | string | The `mc-router.host` label (comma-separated when several), `-` when none |
| `type`, `version`, `memory` | string | From `config.env` (summary and detail) |
| `players` | object | `{online, max, players: string[]}` (summary: `null` when RCON fails) |
| `stats` | object | Summary: `{memoryUsage, memoryLimit}` bytes; detail adds `memoryPercent`, `cpuPercent` |
| `uptime`, `uptimeSeconds` | string, number | Detail, only while running |
| `worldName`, `worldSize`, `playitDomain` | string | Detail only |

**Audit log entry:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID |
| `action` | string | e.g. `server.create`, `player.whitelist.add` (49 actions, see the audit FAQ) |
| `actor` | string | `api:console` (most API routes), `api:<user>` (file routes, Platform Settings), `cli:local` (CLI), `scheduler` (retention cleanup after a scheduled backup) |
| `targetType` | string | `server`, `world`, `player`, `service`, `system`, `platform`, `backup`, `backup-schedule`, `config-snapshot-schedule`, `audit` |
| `targetName` | string | Server, world, service or schedule name |
| `details` | object or null | Context; fields depend on the action |
| `status` | string | `success`, `failure` |
| `errorMessage` | string or null | Error of a failed action |
| `timestamp` | string | ISO 8601 |

---

## 9. Web Console (mcctl-console)

### Overview

mcctl-console is a Next.js web application for managing servers, worlds, players, backups, routing and the audit log from a browser (default `http://localhost:5000`). It needs mcctl-api: `mcctl console service start --console` starts both under PM2.

**Key Technologies:**
- Next.js 14 (App Router)
- React 18 with MUI 5 (dark theme only)
- Better Auth: sessions stored in the console database `data/mcctl.db` (SQLite) behind a session cookie; a session lasts 7 days and is extended at most once a day while used
- React Query 5 for data fetching and caching
- SSE (Server-Sent Events) for server status, logs, players, router status and log, and audit log updates

**Roles**: **Admin** or **User**. Accounts made on the sign-up page get **User** and see only servers they were granted on a server's **Access** tab (per-server **Viewer**, **Operator**, **Owner**); a User who creates a server becomes its Owner. Admin only: Platform Settings, the Users page, **Restart mc-router**, purging audit logs (API). Users are added and changed with `mcctl console user`.

### BFF Proxy Architecture

```
+------------------+      +-----------------+      +---------------+
|   Web Browser    | ---> | mcctl-console   | ---> |   mcctl-api   |
|   (React Query)  |      | (Next.js BFF)   |      |   (Fastify)   |
+------------------+      +-----------------+      +---------------+
                              |
                              | Session-based auth (Better Auth)
                              | + X-API-Key forwarding to mcctl-api
```

**Why BFF Proxy?**
1. API keys stay server-side, never exposed to browser
2. Each BFF route checks the Better Auth session before calling mcctl-api
3. Type-safe shared TypeScript interfaces
4. React Query provides optimistic updates and caching

There is no generic `/api` pass-through: each mcctl-api call has its own App Router route under `app/api/`, except SSE (`/api/sse/<path>`, below).

### Pages and Features

**Navigation**: top bar **Dashboard** (`/dashboard`; `/` sends signed-in users there, others to `/login`), **Servers** (`/servers`), **Worlds** (`/worlds`), **Players** (`/players`), **Audit** (`/audit-logs`), **Backups** (`/backups`), **Routing** (`/routing`); user menu **Users** (`/admin/users`, admins, read-only), **Settings** (`/settings`), **Logout**. `/signup` creates a User account (no email verification).

#### Dashboard (`/dashboard`)

- Status hero: servers online, "All systems operational" or "N servers need attention", **Live** / **Reconnecting** (SSE); **Create Server** opens `/servers?create=1`
- Cards: **Total Servers** (running / stopped), **Online Players** (`online / max` over running servers), **Worlds** (assigned / free), **mc-router** (`:<port>`, status, health, routes; red when down or unhealthy)
- Servers panel: **All / Running / Stopped** filter, up to five rows with status and health chips, primary hostname (the LAN nip.io address first) with copy, players, memory, `TYPE · version`; **Console** (opens `/servers/<name>/console`), **Restart** / **Stop** (confirmed) or **Start**
- **External Access** (playit.gg agent status, up to three server addresses), **Recent Activity** (audit log; web console actions show the actor `console`), **Recent Updates** (latest release in `CHANGELOG.md` on `main`, fetched by the console server through `GET /api/changelog` and cached 1 hour; **Update available** when newer than the installed console)

**Status colors:**

| Color | Status chip | Health chip |
|-------|-------------|-------------|
| Green | running | healthy |
| Amber | created (container never started) | starting |
| Red | stopped, exited (server cards: also Not Created) | unhealthy |
| Gray | other or unknown | no health check (**Unknown**) |

#### Servers (`/servers`)

- Server cards (status, primary hostname with `+N`, container name, Start/Stop), **ALL / RUNNING / STOPPED** filter, name search
- **Create Server** dialog: name (2-32 characters of lowercase letters, digits and hyphens, starting with a letter, no trailing hyphen or `--`; `router` is reserved); **Standard Server** (VANILLA, PAPER, FABRIC, FORGE or NEOFORGE plus a Minecraft version; defaults VANILLA and `LATEST`) or **Modpack** (Modrinth search, then a loader and Minecraft version the pack supports; detected client-only mods pre-fill **Exclude mods**); world (default, seed, or an unassigned existing world); memory (`4G`, `6G` for modpacks); optional **Sudo Password** for the avahi entry; **Auto-start after creation**
- The dialog waits for `POST /api/servers`, then steps through its stages and ends with **Server Created Successfully**, **Server Created with a Warning** (the server exists but its first start failed or is still running; the reason is shown) or **Creation Failed**

#### Server Detail (`/servers/:name`)

- Header: **Switch server** menu; chips for state, health, type, version (and **Reconnecting**); hostname with copy, uptime; **Start**, or **Stop** and **Restart**; ⋮ **Delete Server** (type the name; keep the world, moved to `worlds/` (default), or delete the server's own world; optional **Sudo Password** to remove `<name>.local`; a partial failure shows **Server deleted** with the warning)
- Cards above the tabs: **CPU usage** (**High** from 70%, **Critical** from 90%), **Memory usage** (`used / allocated`, same marks), **World size**
- Ten tabs; `?tab=<Tab>` opens one (e.g. `?tab=Options`):
  - **Overview**: live log console with a `>` prompt, **Send**, chips `/list` `/tps` `/save-all` `/say` `/whitelist list`, **Jump to latest**, **Download logs**, **Clear console (screen only)**, **Expand console** (level filter, Auto-scroll, Hide RCON, quick commands, ↑/↓ history). The RCON reply is not shown, only what the server writes to its log. Panels: **Settings** (container, memory allocation, world), **Players** (online players with OP / Whitelisted badges), **Connection** (every address with port 25565, labeled LAN, Tailscale / VPN, nip.io, External or mDNS, and the playit.gg address)
  - **Players** (v2.27.0+, online count on the tab): unified online (RCON) + offline (usercache/playerdata/ops/whitelist/banned files) roster, shown even when the server is stopped; real-time via SSE. Avatars (`mc-heads.net`), badges (Online/Offline, OP, Banned, Whitelisted), per-row menu: Details, Kick, Ban/Unban, Make OP/Remove OP, Add/Remove Whitelist
    - **Player Detail Modal**: Statistics (play time, deaths, mob/player kills, distance, blocks mined, items crafted, advancements; from `stats/`+`advancements/`), Position & Status (XYZ, dimension, health, food, XP level, game mode, inventory summary; from `playerdata/<uuid>.dat`, live position via RCON polled every 5s while online), Session History (visits, total playtime, last seen, recent 20 sessions)
    - Session history exists only from when the mcctl-api v2.27.0+ collector first runs (first pass backfills up to 24h of container logs)
  - **World**: info cards (seed, spawn, game mode, difficulty, day, version, size, border, regions, weather), BlueMap **Render map** / **Re-render**, **Analyze** ore and block statistics, player positions
  - **Activity**: this server's audit entries (Action filter, status toggle, **View Full History**)
  - **Mods** (installed-jar count on the tab): search, add and remove Modrinth mods; for modpack servers, **Installed Jar Files** with an Included / Excluded switch per jar; restart the server to apply
  - **Files**: browse, upload, create folders, edit, rename, delete, download; form editor for `server.properties` (edits are lost when the container is recreated; use Options for lasting settings) and a player editor for `whitelist.json`, `ops.json`, `banned-players.json`
  - **Config History**: config snapshot timeline with diff, compare, restore (safety snapshot by default) and delete
  - **Backups**: Config Snapshots and World Backups sub-tabs
  - **Access**: grant, change or remove Viewer / Operator / Owner per user (admins and Owners; the last Owner cannot be removed)
  - **Options**: **Hostnames / Domains** (system hostnames read-only; custom domains, including the playit.gg domain; applied after **Stop** then **Start**, not Restart), settings cards with advanced fields, **Save Changes** or **Save & Restart**, **Danger Zone** › **Reset World** (server stopped, type `RESET`)
- `/servers/:name/console`: full-page console (Connected / Connecting / Disconnected (Retry N), breadcrumb, the expanded console's controls)

#### Worlds (`/worlds`)

- World cards: size with Overworld / Nether / End chips, Available or Assigned, the server using it; a warning alert and an "Assigned to N servers" chip for duplicate assignments left by older installs; ALL / AVAILABLE / ASSIGNED filter and search
- **+ Create World**: name (letters, digits, hyphens, underscores) and optional seed, or **Upload world .zip** to import one
- **Assign** (stopped servers only; sets the server's `LEVEL`), **Release** (the server goes back to its own default world), **Delete** (type the name; refused while a server uses the world); a card opens **World Details** (the World tab panel)

#### Players (`/players`)

Server dropdown; tabs **Online Players** (all servers, Kick), **Whitelist** (on/off switch, add, bulk add, remove), **Operators** (levels 1-4), **Ban List** (ban with reason, pardon). For a stopped server the lists are read from its files and changes apply on the next start.

#### Audit (`/audit-logs`)

- **Live** / **Disconnected** chip (reconnects every 3 s); new entries raise a "N new logs available - Click to refresh" banner (the list does not reload by itself)
- Cards: Total Logs, Success Rate, Failures, Active Users (refreshed every 30 s)
- Filters (applied at once, kept in the URL): From/To (UTC days), Action (Create, Delete, Start, Stop, Restart, Whitelist Add/Remove, Ban, Unban, Op, Deop, Kick, Purge, Platform Settings), Target type (All / Server / Player), Status, Target Name, Actor (exact, e.g. `api:console`)
- Table: Timestamp, Action, Actor, Target, Status; 25/50/100 rows; failed rows start expanded; a row opens a drawer with the details and **Related Logs** (same target, same actor)
- **Export** CSV or JSON with the current filters (at most 5,000 rows). No purge control: use `mcctl audit purge` or `DELETE /api/audit-logs` (Admin)
- Actor: `console` for web console actions (recorded as `api:console`), the user for Platform Settings changes and file operations (`api:<user>`), `local` for the CLI (`cli:local`). Web console player actions are recorded with the server as the target and the player in the details

#### Backups (`/backups`)

- **World Backups**: status, **Push Backup** (commit message; check **Remove worlds I deleted on purpose from the backup** when a world from the last backup is gone on purpose, like `mcctl backup push --allow-missing`), schedules (cron, retention, last run), history with restore (refused while any server runs)
- **Config Snapshots**: a card per server, **Create Snapshot**, **Manage Schedules** (cron preset or expression, retention count)

#### Routing (`/routing`)

- Header: router status, "N servers · M hostnames", admin-only **Restart mc-router** (confirmation; players connected through mc-router are disconnected, running servers keep running)
- **Routing Table**: a row per server with the primary address (type badge, copy, `+N`), status (e.g. **Sleeping · wakes on connect**), **N not routed** when mc-router lacks some of its hostnames, **Wake** / **Start**, **Edit hostnames**, **Open server**; expand a row for every hostname; search matches server names and hostnames
- **Routing Flow** diagram; **Live Router Log** (CONNECT / WAKE / ERROR / INFO lines, last 500, Auto-scroll, Clear); **mc-router Gateway** (status, health, port, active routes, container, mode, uptime, image, auto-scale values, asleep MOTD); **Hostname Resolver** (host IPs with **Primary**, a nip.io example, mDNS (Avahi) status); **External Access (playit.gg)** (start/stop the agent, server domains)

#### Settings (`/settings`)

Account cards (name, read-only email, role, password change). Admins also get **Platform Settings**, an editor for the platform `.env`: typed fields in cards (Network & Routing, Server Runtime, RCON, Backup, External Access, Console & Logging), write-only secrets (`RCON_PASSWORD`, `BACKUP_GITHUB_TOKEN`, `PLAYIT_SECRET_KEY`, `BETTER_AUTH_SECRET`), a read-only Runtime (PM2) card, Advanced Environment for unknown keys, and Legacy / Unused keys. Saving only writes `.env` (409 when the file changed since it was loaded) and then lists what to restart: servers (stop, then start), `mcctl router start`, playit (stop, then start), `mcctl console service restart --api` or `--console`.

### BFF Proxy Routes

Examples (the full list is under `platform/services/mcctl-console/src/app/api/`):

| Console Route | Method | mcctl-api Route | Description |
|---------------|--------|-----------------|-------------|
| `/api/servers` | GET/POST | `/api/servers` | List / create servers |
| `/api/servers/:name` | GET/DELETE | `/api/servers/:name` | Server details / delete |
| `/api/servers/:name/start`, `/stop`, `/restart`, `/exec` | POST | same path | Lifecycle, RCON exec |
| `/api/servers/:name/logs` | GET | `/api/servers/:name/logs` | Logs (JSON) |
| `/api/servers/:name/config` | GET/PATCH | `/api/servers/:name/config` | Config |
| `/api/servers/:name/world/reset` | POST | `/api/servers/:name/world/reset` | Reset world |
| `/api/servers/:name/players` | GET | `/api/servers/:name/players` | Player roster (JSON or SSE with `follow=true`) |
| `/api/servers/:name/players/:uuid` | GET | `/api/servers/:name/players/:uuid` | Player detail (`include` forwarded; unknown values dropped, not 400) |
| `/api/worlds` | GET/POST | `/api/worlds` | List/Create worlds |
| `/api/worlds/upload` | POST | `/api/worlds/upload` | Import a world ZIP |
| `/api/worlds/:name` | GET/DELETE | `/api/worlds/:name` | World detail/delete |
| `/api/worlds/:name/assign`, `/release` | POST | same path | Assign / release world |
| `/api/audit-logs` | GET/DELETE | `/api/audit-logs` | List / purge (purge: Admin) |
| `/api/audit-logs/stats`, `/stream`, `/:id` | GET | same path | Stats, SSE, one entry |
| `/api/audit-logs/export` | GET | `/api/audit-logs` | CSV/JSON built by the console |
| `/api/changelog` | GET | - | `CHANGELOG.md` from GitHub `main`, cached 1 hour |
| `/api/sse/<path>` | GET | `/api/<path>?follow=true` | SSE proxy: `servers-status`, `servers/:name/status`, `servers/:name/logs`, `router/status/stream`, `router/logs/stream` |

Other routes cover backups and their schedules, config snapshots and schedules, mods, files, hostnames, player lists (whitelist, ops, bans, kick), playit, router status and restart, platform settings, users and per-user server access, and world info, map and stats.

### React Query Hooks

```typescript
// Server hooks (hooks/useMcctl.ts unless noted)
useServers()                    // List servers (refetch 60s; live status comes over SSE)
useServer(name)                 // Server details (refetch 30s)
useCreateServer()               // Create server mutation
useDeleteServer()               // Delete server mutation
useStartServer()                // Start server mutation
useStopServer()                 // Stop server mutation
useRestartServer()              // Restart server mutation
useExecCommand()                // Execute RCON command (the console UI does not show the reply)
useServersSSE()                 // hooks/useServersSSE.ts: /api/sse/servers-status
useServerStatus({serverName})   // hooks/useServerStatus.ts: /api/sse/servers/:name/status
useServerLogs({serverName})     // hooks/useServerLogs.ts: /api/sse/servers/:name/logs (keeps 500 lines)
useServerPlayers({serverName})  // SSE player roster (online + offline)
usePlayerDetail(server, uuid)   // Player detail (?include=stats,nbt,sessions; refetch 5s while online)
useRouterStatus()               // /api/router/status (refetch 30s while the router status stream is down)
useRouterLogStream()            // hooks/useRouterLogStream.ts: /api/sse/router/logs/stream (last 500 events)

// World hooks
useWorlds()                     // List all worlds (refetch 30s)
useWorld(name)                  // Get world details
useCreateWorld()                // Create world mutation
useCreateWorldWithZip()         // Import a world ZIP
useAssignWorld()                // Assign world mutation
useReleaseWorld()               // Release world mutation
useDeleteWorld()                // Delete world mutation

// Audit hooks (hooks/useAuditLogs.ts)
useAuditLogs(params)            // List with filters (no polling; reloaded from the new-logs banner)
useAuditLogStats()              // Statistics (refetch 30s)
useRecentActivity(limit)        // Dashboard Recent Activity
```

### Web Console Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCCTL_API_URL` | mcctl-api URL used by the BFF | `http://localhost:<api port>` (written by `mcctl console init`) |
| `MCCTL_API_KEY` | Sent to mcctl-api as `X-API-Key` | Written by `mcctl console init` for the `api-key` and `api-key-ip` modes only |
| `BETTER_AUTH_SECRET` | Session secret, read from `<MCCTL_ROOT>/.env` at startup; while `ecosystem.config.cjs` still defines it, the ecosystem value wins (`mcctl upgrade` moves it to `.env`) | Written to `.env` by `mcctl console init` |
| `BETTER_AUTH_BASE_URL` | Console URL: a trusted sign-in origin, and secure cookies when it starts with `https://`; same source rules as the secret | `http://localhost:<PORT>` |
| `PORT` | Console listening port | `5000` (`mcctl console init --console-port`) |
| `HOSTNAME` | Console listening host | `0.0.0.0` |
| `MCCTL_ROOT` | Platform root directory | `~/minecraft-servers` |
| `DO_NOT_TRACK` | `1` or `true` turns off the anonymous usage analytics (as does `"telemetry": false` in `.mcctl.json`) | - |

Sign-in is accepted from `localhost`, `127.0.0.1`, `::1`, private addresses (`10.x`, `172.16-31.x`, `192.168.x`), `.local` names, `BETTER_AUTH_BASE_URL` and `NEXT_PUBLIC_APP_URL`. From any other origin (a Tailscale `100.x` address, a domain, an HTTPS reverse proxy), set `BETTER_AUTH_BASE_URL` to that URL in `.env` and run `mcctl console service restart --console`.

---

## 10. itzg/minecraft-server Reference

### Autopause

Pauses the server process when no players are online. Recovery is instant.

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AUTOPAUSE` | `false` | Enable autopause |
| `AUTOPAUSE_TIMEOUT_EST` | `3600` | Seconds after last player leaves |
| `AUTOPAUSE_TIMEOUT_INIT` | `600` | Seconds after start with no connections |
| `AUTOPAUSE_TIMEOUT_KN` | `120` | Seconds after port connection attempt |
| `AUTOPAUSE_PERIOD` | `10` | Status check interval |
| `AUTOPAUSE_KNOCK_INTERFACE` | `eth0` | Network interface to monitor |
| `MAX_TICK_TIME` | - | Set to `-1` to disable watchdog (recommended with autopause) |

### Autostop

Completely stops the container when idle.

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AUTOSTOP` | `false` | Enable autostop |
| `AUTOSTOP_TIMEOUT_EST` | `3600` | Seconds after last player leaves |
| `AUTOSTOP_TIMEOUT_INIT` | `1800` | Seconds after start with no connections |
| `AUTOSTOP_PERIOD` | `10` | Status check interval |

### Autopause vs Autostop Comparison

| Feature | Autopause | Autostop |
|---------|-----------|----------|
| Behavior | Pauses JVM process | Stops container |
| Recovery | Instant resume | Requires container restart |
| Resource Savings | Medium (CPU only) | High (CPU + most memory) |
| Best For | Quick response needed | Maximum savings |

**Note:** In mcctl, auto-scaling is handled by mc-router (not autopause/autostop). mc-router starts stopped containers on client connect and stops them after idle timeout.

### Mod/Plugin Installation Methods

**Modrinth:**

```env
MODRINTH_PROJECTS=fabric-api,lithium,sodium,iris
MODRINTH_DOWNLOAD_DEPENDENCIES=required
MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE=release
```

Version specifiers: `mod-slug`, `mod-slug:version_id`, `mod-slug:beta`, `mod-slug:release`

**CurseForge:**

```env
CURSEFORGE_FILES=jei,journeymap,jade
```

Formats: slug (`jei`), ID (`238222`), slug:FileID (`jei:4593548`), URL

`CF_API_KEY` is only needed on java8/pre-17 tags or for your own key; set it with `mcctl config <server> CF_API_KEY '<key>'`.

**Spiget:**

```env
SPIGET_RESOURCES=9089,34315
```

**Packwiz:**

```env
PACKWIZ_URL=https://example.com/pack.toml
```

**Direct URLs:**

```env
MODS=https://example.com/mod1.jar,https://example.com/mod2.jar
MODS_FILE=/data/mods.txt
```

### Java Version Requirements

**Minecraft Version to Java Mapping:**

| Minecraft Version | Minimum Java | Recommended Image Tag |
|-------------------|-------------|----------------------|
| 26+ | Java 25 | `java25` |
| 1.21 - 1.21.x | Java 21 | `java21` |
| 1.20.5 - 1.20.6 | Java 21 | `java21` |
| 1.18 - 1.20.4 | Java 17 | `java17` or `java21` |
| 1.17 | Java 16 | `java17` |
| 1.12 - 1.16.5 | Java 8 | `java8` or `java11` |
| 1.11 and below | Java 8 | `java8` |

**Forge-Specific Requirements:**

| Forge / Minecraft Version | Required Java | Image Tag |
|---------------------------|---------------|-----------|
| Forge 1.20.5+ | Java 21 | `java21` |
| Forge 1.18 - 1.20.4 | Java 17 | `java17` |
| Forge 1.17.x | Java 16/17 | `java17` |
| **Forge 1.16.5 and below** | **Java 8** | `java8` **(required, higher fails)** |

New servers start on `itzg/minecraft-server:java25` whatever `VERSION` is. `mcctl update` sets each unpinned `itzg/minecraft-server` tag to the tag for its `VERSION` (`java8` up to 1.16.5, `java17` for 1.17-1.20.4, `java21` for 1.20.5-1.21.x, `java25` for 26.x/`LATEST`) and keeps pinned tags: a release tag such as `2026.10.0-java21`, or a digest. To change a server's image yourself, set `image:` in `servers/<name>/server.yaml`, run `mcctl migrate spec <name>`, then stop and start the server.

**Available Image Tags:**

| Tag | Java Version | amd64 | arm64 | armv7 |
|-----|-------------|:-----:|:-----:|:-----:|
| `latest`, `stable` | Java 25 | Yes | Yes | No |
| `java25` | Java 25 | Yes | Yes | No |
| `java21` | Java 21 | Yes | Yes | No |
| `java17` | Java 17 | Yes | Yes | No |
| `java11` | Java 11 | Yes | Yes | Yes |
| `java8` | Java 8 | Yes | Yes | Yes |
| `java21-graalvm` | GraalVM 21 | Yes | Yes | No |
| `java17-graalvm` | GraalVM 17 | Yes | Yes | No |

### Volume Mounts

| Container Path | Purpose | Notes |
|----------------|---------|-------|
| `/data` | All server data (world, config, logs) | Required - persistent storage |
| `/plugins` | Plugin JARs (Paper/Spigot) | Optional - `:ro` for read-only |
| `/mods` | Mod JARs (Forge/Fabric) | Optional - `:ro` for read-only |
| `/config` | Mod configuration files | Optional |

mcctl server containers mount `./data:/data`, `./logs:/data/logs`, `../../worlds:/worlds` and `../../shared/plugins:/plugins:ro` (paths relative to `servers/<name>/`). `shared/mods` is not mounted: put mod jars in `servers/<name>/data/mods/` or list them in `MODS`.

**/data Directory Structure:**

```
/data
├── server.jar          # Server executable
├── server.properties   # Server configuration
├── ops.json           # Operator list
├── whitelist.json     # Whitelist
├── banned-players.json
├── banned-ips.json
├── world/             # Default world (overworld)
├── world_nether/      # Nether dimension
├── world_the_end/     # End dimension
├── plugins/           # Downloaded plugins
├── mods/              # Downloaded mods
├── config/            # Mod configurations
└── logs/              # Server logs
```

**Permission Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `UID` | `1000` | User ID inside container |
| `GID` | `1000` | Group ID inside container |
| `SKIP_CHOWN_DATA` | `false` | Skip ownership changes |

### Healthcheck

| Variable | Default | Description |
|----------|---------|-------------|
| `DISABLE_HEALTHCHECK` | `false` | Disable the built-in healthcheck |
| `SERVER_HOST` | `localhost` | Monitoring target host |
| `SERVER_PORT` | `25565` | Monitoring target port |

**Recommended healthcheck settings by server type (in docker-compose.yml):**

| Server Type | `start_period` | `interval` | `retries` |
|-------------|---------------|-----------|----------|
| Vanilla / Paper | 1m | 5s | 20 |
| Forge / Fabric | 3m | 10s | 30 |
| Large Modpacks | 5m | 15s | 40 |

mcctl's server template sets no `healthcheck:`, so the image's built-in check applies. Adding one to `servers/<name>/docker-compose.yml` is a hand edit outside `image` and the `mc-router.*` labels: mcctl keeps it, but a later change that has to rewrite the file stops with `compose_edited` (`mcctl migrate spec <name> --force` re-renders it and keeps `docker-compose.yml.bak`).

---

## 11. mc-router Reference

### Overview

mc-router is a connection multiplexer enabling multiple Minecraft servers to share a single IP and port (25565) using hostname-based routing.

```
+-------------------------------------------------------+
|                  Minecraft Clients                      |
|        (Connect to server.example.com:25565)           |
+--------------------------+----------------------------+
                           |
+--------------------------v----------------------------+
|                  mc-router (:25565)                     |
|  - Reads hostname from Minecraft handshake packet      |
|  - Routes to correct backend server                    |
|  - Handles auto-scaling (start/stop containers)        |
+--------------------------+----------------------------+
                           |
    +----------------------+---------------------+
    v                      v                     v
+--------+           +--------+           +--------+
|Server1 |           |Server2 |           |Server3 |
| :25565 |           | :25565 |           | :25565 |
+--------+           +--------+           +--------+
```

**In mcctl**, the `router` service of `<root>/docker-compose.yml` runs `itzg/mc-router:1.47.1` (container `mc-router`) with `IN_DOCKER: "true"` (label discovery through the read-only Docker socket), the auto-scale values below as literal `environment:` entries, `API_BINDING: ":8080"` published as `127.0.0.1:25580` (management API used by `mcctl status`), and `group_add: ["${DOCKER_GID:-999}"]` (mc-router 1.46+ runs as non-root). There is no default route, so a client must send a known hostname.

- **Change router settings**: edit the `router` service `environment:` in `<root>/docker-compose.yml` (not `.env`), then `mcctl router start` (`docker compose up -d router` recreates the container). `mcctl router restart` (`docker compose restart router`) keeps the old values. `mcctl upgrade` patches only the router `image` and `group_add`, so edits survive.
- **Per server**: `routing.autoScale.up` / `routing.autoScale.down` in `servers/<name>/server.yaml` become the `mc-router.auto-scale-up/down` labels (`mcctl migrate spec <name>`, then recreate the container).
- **Hostnames** (`mc-router.host`): `<name>.local`, one `<name>.<ip>.nip.io` per address in `HOST_IPS` (else `HOST_IP`), the playit domain and custom hostnames. A container keeps the labels it was created with: apply changes with `mcctl stop <s> && mcctl start <s>` (or `mcctl start <s>` when stopped).
- **Auto-start needs a container**: after `mcctl create --no-start` or `mcctl down` (which removes containers), run `mcctl start <s>` (or `mcctl up`) once.

### Routing Methods

**1. Docker Auto-Discovery (Recommended for Docker Compose):**

```yaml
services:
  mc-router:
    image: itzg/mc-router:1.47.1  # Pin to explicit version for reproducible deployments
    command: --in-docker --auto-scale-up --auto-scale-down
    ports:
      - "25565:25565"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

  mc-survival:
    image: itzg/minecraft-server
    labels:
      - "mc-router.host=survival.local,survival.192.168.1.100.nip.io"
      - "mc-router.port=25565"
```

**2. Command-Line Mapping:**

```bash
mc-router -mapping "server1.example.com=mc-server1:25565,server2.example.com=mc-server2:25565"
```

**3. JSON Configuration File:**

```json
{
  "default-server": "vanilla:25565",
  "mappings": {
    "survival.example.com": "mc-survival:25565",
    "creative.example.com": "mc-creative:25565"
  }
}
```

**4. Kubernetes Service Discovery:**

Uses annotations on services.

### Docker Labels

| Label | Description |
|-------|-------------|
| `mc-router.host` | External hostname(s), comma-separated |
| `mc-router.port` | Backend port (default: 25565) |
| `mc-router.auto-scale-up` | Per-container override for auto-scale-up |
| `mc-router.auto-scale-down` | Per-container override for auto-scale-down |
| `mc-router.auto-scale-asleep-motd` / `mc-router.auto-scale-loading-motd` | Per-container MOTDs while stopped / starting (mcctl adds a loading MOTD label) |
| `mc-router.default` | Truthy: this container is the default route (still needs `mc-router.host`). mcctl does not set it |

### Auto-Scaling Configuration

| Flag | Environment Variable | mcctl value | Description |
|------|---------------------|-------------|-------------|
| `-auto-scale-up` | `AUTO_SCALE_UP` | `"true"` | Start stopped containers on connect |
| `-auto-scale-down` | `AUTO_SCALE_DOWN` | `"true"` | Stop idle containers |
| `-auto-scale-down-after` | `AUTO_SCALE_DOWN_AFTER` | `"10m"` | Idle timeout before stopping |
| `-docker-timeout` | `DOCKER_TIMEOUT` | `"120s"` | Wait for container start (Go duration such as `120s`, `2m`; bare integers fail) |
| `-auto-scale-asleep-motd` | `AUTO_SCALE_ASLEEP_MOTD` | `"§e§lServer is sleeping§r\n§7Connect to wake up!"` | MOTD of a stopped server |

**Player Allow/Deny Lists:**

| Flag | Description |
|------|-------------|
| `-auto-scale-up-allow-list` | File of player UUIDs/usernames allowed to wake servers |
| `-auto-scale-up-deny-list` | File of players blocked from waking servers |

### Security

| Feature | Description |
|---------|-------------|
| **Port Scanner Blocking** | Connections without valid hostname are blocked |
| **Rate Limiting** | Configurable connections per second per IP |
| **DDoS Mitigation** | Connection throttling reduces attack surface |

| Flag | Environment Variable | Default | Description |
|------|---------------------|---------|-------------|
| `-connection-rate-limit` | `CONNECTION_RATE_LIMIT` | `1` | Connections per second limit |

### Monitoring

| Flag | Environment Variable | Description |
|------|---------------------|-------------|
| `-metrics-backend` | `METRICS_BACKEND` | `prometheus`, `influxdb`, or `discard` |
| `-metrics-bind` | `METRICS_BIND` | Metrics server bind address |
| `-record-logins` | `RECORD_LOGINS` | Track player login metrics |
| `-webhook-url` | `WEBHOOK_URL` | URL for player login/disconnect notifications |

---

## 12. docker-compose.yml Examples

These are standalone examples. The files mcctl generates differ: its router service sets the auto-scale options as `environment:` entries (see section 11), and each server's `docker-compose.yml` is generated from `servers/<name>/server.yaml`.

### Basic Paper Server with mc-router

```yaml
services:
  router:
    image: itzg/mc-router:1.47.1  # Pin to explicit version for reproducible deployments
    command: --in-docker --auto-scale-up --auto-scale-down
    ports:
      - "25565:25565"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

  mc-survival:
    image: itzg/minecraft-server:java25  # Use java25 or latest for MC 26+, java21 for MC 1.21.x
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "LATEST"
      MEMORY: "4G"
      USE_AIKAR_FLAGS: "true"
    labels:
      - "mc-router.host=survival.local,survival.192.168.1.100.nip.io"
    volumes:
      - ./data:/data
```

### Fabric Server with Modrinth Mods

```yaml
services:
  mc-modded:
    image: itzg/minecraft-server:java25  # Use java25 or latest for MC 26+, java21 for MC 1.21.x
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "LATEST"
      MEMORY: "8G"
      MODRINTH_PROJECTS: |
        fabric-api
        sodium
        lithium
        iris
      MODRINTH_DOWNLOAD_DEPENDENCIES: required
    volumes:
      - ./data:/data
```

### Forge Server with CurseForge Mods

```yaml
services:
  mc-forge:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      VERSION: "1.20.1"
      MEMORY: "8G"
      CF_API_KEY: "${CF_API_KEY}"
      CURSEFORGE_FILES: |
        jei
        journeymap
        create
    volumes:
      - ./data:/data
```

### Legacy Forge (1.16.5) with java8

```yaml
services:
  mc-legacy:
    image: itzg/minecraft-server:java8  # Java 8 required!
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      VERSION: "1.16.5"
      MEMORY: "6G"
    volumes:
      - ./data:/data
```

---

## 13. Common Use Cases

### 1. Create Survival Server for Friends

```bash
mcctl init
mcctl router start
mcctl create survival -t PAPER -v 1.21.1
mcctl config survival MOTD "Welcome friends!"
mcctl config survival DIFFICULTY hard
mcctl config survival MAX_PLAYERS 10
mcctl op survival add YourName 4
mcctl stop survival && mcctl start survival   # apply the config changes
# Connect: survival.<HOST_IP>.nip.io:25565 (whitelist is off; `mcctl whitelist survival on` to restrict)
```

### 2. Set Up Modded Forge Server

```bash
mcctl create modded -t FORGE -v 1.20.4
mcctl mod add modded --curseforge jei journeymap create
mcctl config modded MEMORY 8G
mcctl stop modded && mcctl start modded
```

### 3. Performance Fabric Server

```bash
mcctl create perf -t FABRIC -v 1.21.1
mcctl config perf MODRINTH_PROJECTS "fabric-api,lithium,starlight,krypton"
mcctl config perf MODRINTH_DOWNLOAD_DEPENDENCIES required
mcctl config perf USE_AIKAR_FLAGS true
mcctl stop perf && mcctl start perf
```

### 4. Move a World to Another Server

```bash
mcctl world list
mcctl stop oldserver
mcctl world release myworld
mcctl stop newserver
mcctl world assign myworld newserver
mcctl start newserver
```

### 5. Backup Before Major Changes

```bash
mcctl server-backup myserver -m "Before 1.22 upgrade"
mcctl backup push -m "Pre-upgrade backup"
# If something goes wrong:
mcctl server-restore myserver
mcctl backup restore abc1234
```

### 6. Remote Access via VPN (Tailscale/ZeroTier)

```bash
mcctl init --reconfigure
# Choose "Host IP(s)", select the LAN and the VPN address
# (writes HOST_IP=192.168.1.100 and HOST_IPS=192.168.1.100,100.64.0.5),
# answer yes to "Update existing servers with new IP hostnames?"
mcctl stop myserver && mcctl start myserver   # recreate so the container gets the new hostname
# Friends connect: myserver.100.64.0.5.nip.io:25565
```

### 7. Add Players to Whitelist

```bash
mcctl whitelist myserver on
mcctl whitelist myserver add Steve
mcctl whitelist myserver add Alex
mcctl whitelist myserver list
```

### 8. Optimize Performance

```bash
mcctl config myserver USE_AIKAR_FLAGS true
mcctl config myserver MEMORY 6G
mcctl config myserver VIEW_DISTANCE 8
mcctl config myserver SIMULATION_DISTANCE 8
mcctl stop myserver && mcctl start myserver
```

### 9. Set Up Management Console (API + Web Console)

```bash
mcctl console init
# Select: [mcctl-api, mcctl-console]
# Enter admin email, name, and password
# Choose API access mode
mcctl console service start --console   # mcctl-api + mcctl-console (without the flag it asks)
# Web Console: http://localhost:5000
# REST API: http://localhost:5001
# Swagger UI (/docs) only with SWAGGER_ENABLED=true in .env
```

### 10. Use REST API

```bash
mcctl console init
# Select "api-key" access mode
mcctl console service start
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers
curl -X POST -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers/myserver/start
```

### 11. Set Up API Only (No Web Console)

```bash
mcctl console init
# Select: [mcctl-api] only (deselect mcctl-console)
mcctl console service start
# No prompt (only API available)
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers
```

### 12. Auto-Start Services on Boot

```bash
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
pm2 save
```

### 13. Updating Services

```bash
# Update everything (CLI + API + Console + shared + server images)
mcctl update            # in a terminal it also offers to recreate stopped servers on an old image
mcctl update --yes      # no questions; prints the recreate commands instead

# Or update only the CLI (services in .services/ stay as they are)
mcctl update --cli-only --yes

# Then sync the platform files
mcctl upgrade
```

### 14. Set Up External Access with playit.gg

```bash
# One-time setup
mcctl playit setup
mcctl playit start

# Create tunnel at https://playit.gg/account/tunnels
# Get your address: xx-xx.craft.playit.gg

# Register with server, then recreate it so mc-router sees the domain
mcctl playit domain survival xx-xx.craft.playit.gg
mcctl stop survival && mcctl start survival

# Share with friends: xx-xx.craft.playit.gg (no port forwarding needed!)

# Check status
mcctl playit status
```

### 15. Upgrade Platform After CLI Update

```bash
# After updating mcctl:
mcctl update

# Check what changed:
mcctl upgrade --dry-run

# Apply changes (interactive):
mcctl upgrade

# Or apply with defaults (scripts/CI):
mcctl upgrade --non-interactive
```

---

## 14. Troubleshooting

### Infrastructure Issues

#### Platform Not Initialized

**Error:** `Platform not initialized. Run: mcctl init`

**Solution:**
```bash
mcctl init
```

#### Docker Not Running

**Error:** `mcctl status` prints `Docker is not available`; `mcctl init` prints a prerequisite table and `Docker is not installed` (or a version below 24.0.0)

**Solution:**
```bash
sudo systemctl start docker
# Or on macOS/Windows: Start Docker Desktop
```

#### Server Won't Start

Check logs first: `mcctl logs <server> -n 100`

| Cause | Symptom | Fix |
|-------|---------|-----|
| EULA not accepted | Server exits immediately | Should be automatic with mcctl |
| Wrong Java version | `class file version` error | Use correct image tag (see Java matrix) |
| Insufficient memory | OutOfMemoryError | Increase MEMORY setting |
| Port 25565 in use (mc-router) | mc-router does not start, `Address already in use` | See Port Conflicts below (server containers publish no host ports) |

#### Can't Connect to Server

```bash
# 1. Check mc-router is running (mcctl init does not start it)
mcctl status
# mc-router should show "running" and "healthy"; if not:
mcctl router start

# 2. Check server status and its hostnames (HOSTNAME column)
mcctl status myserver

# 3. Try the server's hostnames
# nip.io: server.192.168.1.100.nip.io:25565  (the IP must be reachable from the client)
# mDNS:   server.local:25565
```

A bare IP (`192.168.1.100:25565`) never works: mc-router routes by hostname and mcctl sets no default route. Auto-start on connect needs an existing container: after `mcctl create --no-start` or `mcctl down`, run `mcctl start <server>` once. New or changed hostnames reach mc-router only after the container is recreated (`mcctl stop <s> && mcctl start <s>`).

#### mc-router Cannot Read the Docker Socket

`mcctl logs router` shows `permission denied` for `/var/run/docker.sock` and nothing is routed. mc-router 1.46+ runs as non-root and reads the socket through `group_add: ["${DOCKER_GID:-999}"]`; `DOCKER_GID` in `.env` must match `stat -c %g /var/run/docker.sock`. Run `mcctl upgrade` (sets `DOCKER_GID` and patches the router service), then `mcctl router start`.

#### mDNS Not Working

**Linux:**
```bash
sudo apt install avahi-daemon
sudo systemctl enable --now avahi-daemon
```

**Windows:** Install Bonjour Print Services from Apple

`mcctl create` registers `<name>.local` in `/etc/avahi/hosts` with sudo (`--sudo-password`, `MCCTL_SUDO_PASSWORD`, the prompt, or sudoers `NOPASSWD` for `tee -a /etc/avahi/hosts`, `sed -i * /etc/avahi/hosts`, `systemctl restart avahi-daemon`). If sudo failed, the server was still created with a warning: add `<ip> <name>.local` to `/etc/avahi/hosts` and restart avahi-daemon.

**Fallback:** Use nip.io hostname instead of .local

#### World Already Assigned

**Error:** `World 'myworld' is assigned to 'otherserver'; assign another world to 'otherserver' or delete it first` (API: 409)

```bash
mcctl stop otherserver
mcctl world release myworld
mcctl stop myserver
mcctl world assign myworld myserver
```

If the error mentions an unreadable world assignment, fix the `LEVEL` line in that server's `config.env` (plain `LEVEL=<name>`); every assignment change is refused until then. If the server keeps its world inside `servers/<name>/data`, stop it and run `mcctl migrate worlds --server <name>` first. A container in the `created` state (for example after `mcctl update` recreated it) counts as not stopped, and `mcctl stop` does not change it: run `mcctl start <name> && mcctl stop <name>`.

#### Out of Memory

| Scenario | Recommended Memory |
|----------|-------------------|
| Vanilla / Paper (1-10 players) | 2-4G |
| Paper (10-30 players) | 4-6G |
| Paper (30+ players) | 6-8G |
| Forge / Fabric (light mods) | 4-6G |
| Forge / Fabric (heavy mods) | 6-8G |
| Large modpacks (100+ mods) | 8-12G |

### Management Console Issues

#### Console service won't start

- Check prerequisites: `mcctl console init` checks Node.js >= 18, Docker, Docker Compose and a `pm2` >= 6.0.0 on `PATH` (`npm install -g pm2`)
- Verify PM2: `pm2 --version`
- Check ecosystem config: `ls ~/minecraft-servers/ecosystem.config.cjs`
- View PM2 logs: `pm2 logs mcctl-api` or `pm2 logs mcctl-console`
- Check port conflicts: `netstat -tlnp | grep -E "5000|5001"`. Ports are set only by `mcctl console init --api-port/--console-port` (written to `PORT` in `ecosystem.config.cjs`)
- `mcctl console service start` and `restart` wait up to 15 s for the health checks and exit 1 if a service is not healthy. `mcctl console service status` checks `GET /health` on mcctl-api (2xx) and `/api/auth/get-session` on mcctl-console (below 500), prints `Health: HTTP 500` or `Health: unreachable` for a failed check, and then exits 1 ("Some services need attention")

#### mcctl-console shows "not installed (skipping)"

- Install console package: `npm install @minecraft-docker/mcctl-console` in `~/minecraft-servers/.services/`
- Or reinitialize: `mcctl console init --force` and select mcctl-console
- Verify: `ls ~/minecraft-servers/.services/node_modules/@minecraft-docker/mcctl-console/` (older installs: `~/minecraft-servers/node_modules/...`)

#### API connection issues

- Check service: `mcctl console service status`
- Verify API key (shown only once during init; prefix `mctk_`). The key in use is `AUTH_API_KEY` in `ecosystem.config.cjs`; get a new one with `mcctl console init --force`
- Test health: `curl http://localhost:5001/health` returns `{"status":"ok","timestamp":"..."}`
- Check access mode: `grep AUTH_MODE ~/minecraft-servers/ecosystem.config.cjs` (`mcctl console api status` shows `api-config.json`, not the running API's settings; see #633)
- Web console requests fail with 403 under `ip-whitelist` or `api-key-ip`: the console calls mcctl-api from the same host, so the list must contain `127.0.0.1` (an entry `localhost` matches nothing). Re-run `mcctl console init --force` to change the list

#### Can't log in to Web Console

- Verify user: `mcctl console user list`
- Reset password: `mcctl console user reset-password admin@example.com`
- Signing in from an origin other than `localhost`, a private LAN address or a `.local` name (a Tailscale `100.x` address, a domain, an HTTPS reverse proxy) fails until `BETTER_AUTH_BASE_URL=<that URL>` is set in `~/minecraft-servers/.env`; then `mcctl console service restart --console`. If `ecosystem.config.cjs` still defines `BETTER_AUTH_*`, run `mcctl upgrade` first (until then the ecosystem value wins)
- View logs: `mcctl console service logs -f`

#### PM2 process keeps restarting

- Check crashes: `pm2 logs mcctl-api --lines 100`
- Verify dependencies: `cd ~/minecraft-servers/.services 2>/dev/null || cd ~/minecraft-servers; npm ls @minecraft-docker/mcctl-api`
- PM2 restarts a service that grows past `max_memory_restart` (`500M`): raise it in `ecosystem.config.cjs`
- A plain `mcctl console service restart` keeps the env and options PM2 already has. After editing `ecosystem.config.cjs`, use `mcctl console service restart --force` (deletes the processes, kills the PM2 daemon and starts the selected services from the file); `.env` changes need only a plain restart

#### Console returns 500 after a Node.js change

`pm2 logs mcctl-console` shows `NODE_MODULE_VERSION` or `ERR_DLOPEN_FAILED`: the native `better-sqlite3` module was built for another Node.js version than the PM2 daemon runs. `mcctl console service status` prints the steps: `pm2 kill`, switch to the Node.js version mcctl was installed with (e.g. `nvm use 22`), then `mcctl console service start --console`.

#### SSE not working (real-time updates)

- Ensure mcctl-api is running
- Check if proxy/firewall blocks SSE connections
- Verify the stream on mcctl-api: `curl -N 'http://localhost:5001/api/servers-status?follow=true'` (add `-H 'X-API-Key: <key>'` in the api-key modes). `/api/sse/servers-status` is the console's proxy path, not an mcctl-api route

#### World management issues

- Ensure server is stopped before world reset
- Check world assignments and warnings: `mcctl world list`
- Free a world another server uses: stop that server, then `mcctl world release <world>`
- Leftover `worlds/.locks` is unused and can be removed: `rm -rf worlds/.locks`

### Mod Issues

#### Version mismatch

- Verify all mods support the server's Minecraft version
- Check mod compatibility with server type (Forge mods on Forge, Fabric mods on Fabric)

#### Missing dependencies

```bash
mcctl config <server> MODRINTH_DOWNLOAD_DEPENDENCIES required
```

For Fabric servers, always include `fabric-api` in MODRINTH_PROJECTS.

#### Mod compatibility

- Review logs: `mcctl logs <server>`
- Remove incompatible mods: `mcctl mod remove <server> <mod>`

### Java Version Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `class file version 69.0` | Java 25 required | Use the `java25` image tag (MC 26+) |
| `class file version 65.0` | Java 21 required | Use `java21` image tag |
| `Unsupported class file major version` | Java too high for Forge | Use `java8` for Forge 1.16.5 and below |
| Mods fail to load | Version mismatch | Check mod docs for Java requirements |

**Diagnosis:**
```bash
mcctl logs <server>
# Look for "class file version" or "Unsupported" errors
```

**Fix steps:**
1. Check the Java version matrix in Section 10 (26.x / `LATEST`: Java 25; 1.20.5-1.21.x: Java 21; 1.17-1.20.4: Java 17; 1.16.5 and older: Java 8)
2. New servers start on `itzg/minecraft-server:java25` whatever `VERSION` is. Change `image` in `servers/<name>/server.yaml` and run `mcctl migrate spec <name>` (or edit the image in `servers/<name>/docker-compose.yml`; mcctl takes it into `server.yaml`), then `mcctl stop <name> && mcctl start <name>`
3. `mcctl update` moves an unpinned `java*` tag to the one `VERSION` needs; a release-version tag (e.g. `2026.10.0-java21`) or digest is kept
4. For Forge 1.16.5 and below, you **must** use `java8`

### RCON Connection Issues

**Symptoms:**
- `mcctl exec` or `mcctl console` commands fail
- "Connection refused" errors
- Player management commands (whitelist, ban, op) fail

**Diagnosis:**
```bash
# 1. Verify RCON is enabled
mcctl config <server> ENABLE_RCON
# Should show: true

# 2. Verify the server is running and healthy
mcctl status <server> -d

# 3. Check RCON password is set (servers get it through servers/global.env)
grep RCON_PASSWORD ~/minecraft-servers/.env
```

`mcctl console` / `mcctl rcon` connect over TCP to the container's IP on the Docker network (the server must be fully started; Docker Desktop on macOS may not expose that IP). `mcctl exec` and the player commands run `rcon-cli` inside the container with `docker exec`, so use `mcctl exec <server> <command>` when the TCP session cannot connect.

**Fix:**
```bash
# Ensure RCON is enabled
mcctl config <server> ENABLE_RCON true

# Restart server to apply
mcctl stop <server> && mcctl start <server>
```

### Autopause / Autostop Issues

**Symptoms:**
- Server pauses unexpectedly
- Server does not wake up on client connect
- Watchdog timer kills paused server

**Fix:**
```bash
# Disable watchdog when using autopause (critical!)
mcctl config <server> MAX_TICK_TIME -1

# Check network interface (must match container's interface)
mcctl config <server> AUTOPAUSE_KNOCK_INTERFACE eth0

# Enable debug logging for autopause
mcctl config <server> DEBUG_AUTOPAUSE true
mcctl stop <server> && mcctl start <server>
mcctl logs <server>
```

**Note:** In mcctl, auto-scaling is handled by mc-router (not autopause/autostop). Its `AUTO_SCALE_UP`/`AUTO_SCALE_DOWN` are set in the router service `environment:` of `docker-compose.yml` (apply with `mcctl router start`); per server, use `routing.autoScale` in `server.yaml`.

### CurseForge Mod Download Failures

**Symptoms:**
- "API key required" errors
- Mods fail to download from CurseForge
- 403 Forbidden errors

**Fix:** (Java 17+ images have a built-in key; this applies to java8/pre-17 tags or a custom key)
1. Get a key from [CurseForge for Studios](https://console.curseforge.com/)
2. Set it per server (do not escape `$`; mcctl quotes the value), then recreate the server:
   ```bash
   mcctl config <server> CF_API_KEY '<key>'
   mcctl stop <server> && mcctl start <server>
   ```
   For every server instead, add a `CF_API_KEY` line to `servers/global.env` and put the value in `.env` in single quotes. A key only in `.env` does not reach servers.
3. Some mods are restricted from third-party downloads; use manual download

### Common config.env Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| `GAMEMODE=creative` | Game mode unchanged | The image reads `MODE`: `mcctl config <server> MODE creative` |
| Unquoted ` #` in a value | Value cut at the `#` (`MOTD=Hi #1` sets `Hi`) | Quote it (`MOTD='Hi #1'`), or set it with `mcctl config`, which quotes it |
| A list continued on the next line | Only the first line is the value | One comma-separated line (`MODRINTH_PROJECTS=fabric-api,lithium,sodium`) |
| A value that starts with a quote set through mcctl | Refused | Pass the value without surrounding quotes; mcctl quotes what needs it |
| `CF_API_KEY` (or another key) only in `.env` | Not in the container | `mcctl config <server> CF_API_KEY '<key>'`, or add the name to `servers/global.env` |
| `TYPE` misspelled | The server does not run as the intended type | `mcctl config` does not check `TYPE`; use a name from Section 6 |

`EULA=TRUE` is set by each server's compose `environment:`, and `EXTRA_ARGS` (`--universe /worlds/`) is written from `world.storage` in `server.yaml`, so neither needs to be added by hand.

### nip.io DNS Not Resolving

**Symptoms:**
- `server.192.168.1.100.nip.io` does not resolve
- DNS lookup timeout

**Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| DNS firewall/filter blocking nip.io | Use alternative DNS (8.8.8.8, 1.1.1.1) |
| ISP DNS blocking wildcard | Switch to public DNS |
| Wrong HOST_IP in .env | Verify with `ip addr` or `ifconfig` |
| Private IP used from public network | Use Tailscale/ZeroTier VPN |

### Port Conflicts

**Error:** `Address already in use` for port 25565, 5000, or 5001

```bash
# Check what is using the port
sudo lsof -i :25565
sudo lsof -i :5000
sudo lsof -i :5001

# Or use netstat
netstat -tlnp | grep -E "25565|5000|5001"
```

**Fix:** Stop the conflicting service or change the port in configuration.

---

## 15. FAQ

### General

**Q: What is mcctl?**
A: A CLI tool for managing Docker-based Minecraft Java Edition servers with hostname routing, auto-scaling, and web management.

**Q: What Minecraft editions does it support?**
A: Java Edition only. Bedrock Edition is not supported.

**Q: Where is data stored?**
A: Default: `~/minecraft-servers/`. Set `MCCTL_ROOT`, or pass `--root <path>` to every command (it is not stored).

**Q: How many servers can I run?**
A: Unlimited, limited only by system resources.

**Q: What are the system requirements?**
A: Node.js >= 18.0.0, Docker Engine >= 24.0.0, Docker Compose >= 2.20.0 (`mcctl init` checks these). git >= 2.31 for GitHub backups; `pm2` >= 6 on `PATH` for the web console (`npm install -g pm2`).

### Server

**Q: What server types are supported?**
A: `mcctl create -t` accepts PAPER, VANILLA, FORGE, NEOFORGE, FABRIC, SPIGOT, BUKKIT, PURPUR, QUILT, LEAF, FOLIA, PUFFERFISH, MODRINTH and AUTO_CURSEFORGE (the last two with `--modpack <slug>`). itzg also supports MOHIST, ARCLIGHT, MAGMA_MAINTAINED, KETTING, SPONGEVANILLA, FTBA, CUSTOM (set `TYPE` with `mcctl config`).

**Q: What's the default server type?**
A: PAPER - a high-performance fork with plugin support. Defaults of `mcctl create`: version `LATEST`, memory 4G (6G for modpacks), image `itzg/minecraft-server:java25`, whitelist off.

**Q: How do I change Minecraft version?**
A: `mcctl config myserver VERSION 1.20.4`, then `mcctl stop myserver && mcctl start myserver`. Check that the image's Java fits the version (older versions need e.g. `java17`).

**Q: Do servers auto-start?**
A: Yes, with mc-router auto-scaling, a stopped server starts when a player connects, if mc-router runs (`mcctl router start`) and the server's container exists (after `mcctl create --no-start` or `mcctl down`, run `mcctl start <server>` once).

**Q: Do servers auto-stop?**
A: Yes, after 10 minutes of no players. Change `AUTO_SCALE_DOWN_AFTER` in the router service `environment:` of `<root>/docker-compose.yml` and apply it with `mcctl router start` (not `.env`, not `mcctl router restart`).

### Connection

**Q: What port do I use?**
A: Always 25565. mc-router handles routing.

**Q: Why can't I connect with just IP?**
A: mc-router needs a hostname to route. Use nip.io or mDNS.

**Q: What is nip.io?**
A: A magic DNS service. `server.192.168.1.100.nip.io` resolves to `192.168.1.100`.

**Q: Do clients need mDNS/avahi?**
A: Only for .local hostnames. nip.io works without client setup.

### Mod/Plugin

**Q: How do I add mods?**
A: `mcctl mod add <server> <mod-name>`. Default source is Modrinth. Use `--curseforge` for CurseForge.

**Q: What mod sources are supported?**
A: Modrinth (default), CurseForge, Spiget (SpigotMC), and direct URLs.

**Q: Do I need an API key for CurseForge?**
A: No on Java 17+ images (key built in). Only java8/pre-17 tags or your own key need `CF_API_KEY` (key from console.curseforge.com): set it per server with `mcctl config <server> CF_API_KEY '<key>'`. A key only in `.env` does not reach servers.

**Q: Where are mods stored?**
A: Downloaded automatically by the server container based on config.env settings.

**Q: Are mod dependencies downloaded automatically?**
A: Yes. By default `MODRINTH_DOWNLOAD_DEPENDENCIES=required` is set. When you add `iris`, its dependency `sodium` is auto-downloaded.

**Q: How do I disable automatic dependency download?**
A: Set `MODRINTH_DOWNLOAD_DEPENDENCIES=none` in config.env.

**Q: What dependency options are available?**
A: `required` (default, recommended), `optional` (required + optional deps), `none` (manual).

### Backup

**Q: What does backup include?**
A: The `worlds/` directory with all world data.

**Q: What does server-backup include?**
A: Server configuration files: `config.env`, `docker-compose.yml` and, when present, `server.yaml`, `data/ops.json`, `data/whitelist.json`, `data/banned-players.json`, `data/banned-ips.json`, `data/server.properties`. Not world data.

**Q: Is a GitHub account required for backups?**
A: Only for the GitHub backup feature. Manual backups don't require it.

### World

**Q: Can I share a world between servers?**
A: No. One world is used by one server. To move a world, stop both servers, run `mcctl world release <world>` (the old server goes back to its own default world), then `mcctl world assign <world> <server>`.

**Q: What happens when I delete a server?**
A: `mcctl delete` asks first (`-y` skips; `--force` also deletes with players online). The world is kept: a world inside the server folder is moved to `worlds/`, unless `--delete-world`.

**Q: How do I import an existing world?**
A: Place it in `~/minecraft-servers/worlds/` and use `mcctl create --world <name>`.

**Q: What happens when I run `mcctl world new` without --server?**
A: The world directory is created with a `.meta` file (seed, timestamp). Actual Minecraft world files are generated when a server first uses the world.

### Management Console

**Q: What is the Management Console?**
A: mcctl-api (REST API on port 5001) + mcctl-console (Web UI on port 5000).

**Q: Why PM2 instead of Docker?**
A: Lower overhead, faster startup, easier debugging, automatic process recovery.

**Q: How do I start the web console?**
A: `mcctl console init` then `mcctl console service start --console` (without `--console` it asks which services).

**Q: What access modes are available?**
A: `internal` (default), `api-key`, `ip-whitelist`, `api-key-ip`, `open`. `mcctl console init` writes them as mcctl-api `AUTH_MODE` values: `internal` → `ip-whitelist` (loopback only), `api-key-ip` → `combined`, `open` → `disabled`, the others unchanged.

**Q: Where is the API documentation?**
A: `docs/api/endpoints.md`. The Swagger UI at `http://localhost:5001/docs` is served only when mcctl-api does not run with `NODE_ENV=production` (the PM2 setup does) or when `SWAGGER_ENABLED=true` is set in `.env` (apply with `mcctl console service restart --api`). It needs the same authentication as the other routes (`X-API-Key` in the api-key modes).

**Q: Can I run just the API without the Web Console?**
A: Yes. During `mcctl console init`, select only `mcctl-api`. Or use `mcctl console service start --api`.

**Q: How does service selection work?**
A: Since v1.13.0, `mcctl console service start/stop/restart` shows interactive prompt when both services are installed. Console always requires API. Use `--api` or `--console` flags to skip prompt; without a terminal the command exits 1 unless one of them is given.

**Q: How do I check if the console is running?**
A: `mcctl console service status`

**Q: How do I view console logs?**
A: `mcctl console service logs` or `mcctl console service logs -f` for real-time.

**Q: Why is a player's session history empty or short?**
A: Session history (v2.27.0+) is collected by mcctl-api from Docker logs (`joined/left the game`) every 30s into `data/players.db`. It starts when the collector first runs; the first pass backfills at most 24h of container logs. Older sessions, or logs of a recreated container, cannot be recovered. Stats/position come from world files and are not affected.

**Q: Can I see players of a stopped server?**
A: Yes (v2.27.0+). `GET /api/servers/:name/players` returns the file-based `roster` with `running: false`; `online`/`max`/`players` are 0/empty.

**Q: How does SSE work in the Web Console?**
A: The browser opens Server-Sent Events streams to the console, which checks the session and proxies `/api/sse/<path>` to mcctl-api `/api/<path>?follow=true`. Server status comes from `GET /api/servers-status?follow=true`: mcctl-api checks Docker every 5 seconds and sends a `server-status` event per server, plus a heartbeat every 30 seconds. Logs, a single server's status and the router status and log use the same proxy; the player roster (`/api/servers/:name/players?follow=true`) and the audit log (`/api/audit-logs/stream`) have their own routes.

### Performance

**Q: How do I optimize performance?**
A: Use `mcctl config <server> USE_AIKAR_FLAGS true`. For modded servers, increase MEMORY to 6-8G. Reduce VIEW_DISTANCE and SIMULATION_DISTANCE.

**Q: What are Aikar flags?**
A: Recommended JVM garbage collection tuning for Minecraft. Reduces GC pause times.

### Audit Log

**Q: What are audit logs?**
A: A record of operations from the CLI, mcctl-api and the web console (servers, players, worlds, mods, playit, router, settings, files, schedules). View with `mcctl audit list` or in Web Console. Logs are kept until `mcctl audit purge` or the optional auto-cleanup removes them.

**Q: How do I configure audit retention?**
A: `AUDIT_AUTO_CLEANUP=true` (default off) and `AUDIT_RETENTION_DAYS` (default 90) in `.env`, read by mcctl-api (the CLI reads only its shell environment). Cleanup runs while logs are written (every 100 entries or 24 hours). Or run `mcctl audit purge --days <n>`.

**Q: What actions are tracked?**
A: `server.` create, delete, start, stop, restart, config, hostname; `player.` whitelist.add, whitelist.remove, whitelist.toggle, ban, unban, op, op.level, deop, kick; `world.` create, delete, assign, release, map.render; `mod.` add, remove; `playit.` start, stop; `router.restart`; `platform.settings.update`; `file.` read, write, delete, mkdir, rename, upload, download; `backup.schedule.` create, update, delete, enable, disable, run; `config.snapshot.` create, delete, restore; `config.snapshot.schedule.` create, update, delete, enable, disable; `audit.purge`. Filter with the full name, e.g. `mcctl audit list --action player.ban`.

**Q: Where is the audit database stored?**
A: SQLite database at `~/minecraft-servers/data/audit.db` using WAL mode for concurrent read/write.

### Docker / Infrastructure

**Q: Can I run mcctl on Windows?**
A: Only through WSL2 (Windows Subsystem for Linux). Native Windows is not supported.

**Q: Can I run mcctl on macOS?**
A: Yes. Docker Desktop for Mac is required. mDNS works natively via Bonjour.

**Q: How do I use mcctl with Docker Desktop?**
A: Docker Desktop provides Docker Engine and Docker Compose. After installing Docker Desktop, mcctl works normally.

**Q: Can I use Podman instead of Docker?**
A: Not officially supported. mcctl relies on Docker Compose and Docker socket for mc-router auto-discovery.

**Q: How do I check Docker Compose version?**
A: Run `docker compose version`. mcctl requires version >= 2.20.0 for the `include` feature.

**Q: What is the `include` feature in Docker Compose?**
A: Docker Compose `include` allows composing multiple compose files together. mcctl uses this to include per-server compose files from the main docker-compose.yml.

### Networking

**Q: Can friends outside my network connect?**
A: Yes, via playit.gg (`mcctl playit`), a VPN (Tailscale, ZeroTier) with the VPN IP in `HOST_IPS`, or port forwarding.

**Q: How does Tailscale/ZeroTier work with mcctl?**
A: Run `mcctl init --reconfigure`, choose "Host IP(s)", select the LAN and VPN addresses (written to `HOST_IPS`), answer yes to updating existing servers, then recreate each server (`mcctl stop <s> && mcctl start <s>`). Friends connect via `server.<vpn-ip>.nip.io:25565`.

**Q: Can I use a custom domain instead of nip.io?**
A: Yes. Point your domain's DNS A record to the server IP, then add the domain as a custom hostname: web console > server > Hostnames / Domains > Custom Domains, or `routing.customHostnames` in `servers/<name>/server.yaml` followed by `mcctl migrate spec <name>`. Recreate the container to apply (`mcctl stop <s> && mcctl start <s>`).

**Q: Why is nip.io recommended over mDNS?**
A: nip.io works everywhere without client setup. mDNS requires avahi-daemon (Linux) or Bonjour (macOS/Windows) on both server and client.

**Q: Can I have a default server (no hostname needed)?**
A: mcctl configures none, so a client that sends a hostname without a route (or a bare IP) gets no server. mc-router (1.47.1) has two options: the `DEFAULT` environment variable (flag `-default`, the `host:port` of the server used when no mapping matches), for example `DEFAULT: "mc-survival:25565"` in the router `environment:` of `<root>/docker-compose.yml` followed by `mcctl router start`; or the container label `mc-router.default: "true"` on one server, which still needs its `mc-router.host` label. mcctl renders the server labels from `server.yaml`, which has no field for this one, so a hand-added `mc-router.default` label is dropped the next time mcctl changes that server.

### External Access (playit.gg)

**Q: What is playit.gg?**
A: A free tunneling service that lets external players connect to your server without port forwarding or a static IP.

**Q: How do I set up playit.gg?**
A: Run `mcctl playit setup` with your SECRET_KEY (skip it if you enabled playit in `mcctl init`), then `mcctl playit start`, create a tunnel at playit.gg, register it with `mcctl playit domain <server> <domain>`, and recreate the server (`mcctl stop <s> && mcctl start <s>`). Turn on the whitelist before sharing the domain.

**Q: Can multiple servers use playit.gg?**
A: Yes. Each server needs its own tunnel domain. mc-router routes connections to the correct server based on hostname.

**Q: Is playit.gg free?**
A: Yes, the basic plan is free and supports Minecraft Java tunneling. Premium plans offer custom domains and more tunnels.

**Q: How do I add a playit domain to an existing server?**
A: `mcctl playit domain <server-name> <your-playit-domain>`. This sets `PLAYIT_DOMAIN` and the server's `mc-router.host` label; it applies after `mcctl stop <server-name> && mcctl start <server-name>` (a restart does not apply it). `--remove` removes it.

### Migration and Updates

**Q: How do I update mcctl?**
A: `mcctl update --yes` updates the CLI and the installed services. To update only the CLI, use `mcctl update --cli-only --yes` or `npm update -g @minecraft-docker/mcctl`.

**Q: How do I update everything (CLI + services)?**
A: `mcctl update --yes`. This updates mcctl, mcctl-api, mcctl-console, and shared packages (and pulls Docker images). `--all` is a deprecated alias for this default behavior.

**Q: Do I need to stop servers before updating?**
A: No. Minecraft server containers are independent of mcctl; only Management Console services are restarted. `mcctl update` pulls new server images: running servers keep their image until `mcctl stop <s> && mcctl start <s>`, and in a terminal it offers to recreate stopped servers that still use an old image (default No).

**Q: How do I migrate from an old version?**
A: Follow the Upgrade Runbook (`docs/advanced/upgrade-runbook.md`; from v2.x use `upgrade-v3.sh`). `mcctl migrate status` / `mcctl migrate worlds --all` move worlds out of server folders; `mcctl migrate spec --all` imports servers into `server.yaml`.

**Q: What is `mcctl upgrade`?**
A: A command that appends new environment variables from the bundled `.env.example` to your `.env` (existing values are kept), sets `DOCKER_GID`, syncs `servers/_template/`, updates only the `router` service's `image` and `group_add` in your root `docker-compose.yml` (diff, confirmation, timestamped `.bak`), creates `servers/global.env` and points servers at it, moves `BETTER_AUTH_*` from `ecosystem.config.cjs` into `.env`, lists servers without `server.yaml`, and offers to delete a leftover `<root>/scripts`.

**Q: When should I run `mcctl upgrade`?**
A: After updating mcctl to a new version via `mcctl update` or `npm update -g @minecraft-docker/mcctl`.

**Q: Is `mcctl upgrade` safe?**
A: Yes. It appends new `.env` variables and keeps existing values (except `DOCKER_GID` when missing or the default, and the moved `BETTER_AUTH_*` keys); the root `docker-compose.yml` patch is limited to `router.image` and `group_add`, is backed up first, and is restored if validation fails; `ecosystem.config.cjs` is backed up before the auth keys move. Use `--dry-run` to preview changes first.

**Q: What is the difference between `mcctl update` and `mcctl upgrade`?**
A: `mcctl update` updates the CLI and service packages to newer versions. `mcctl upgrade` updates your platform configuration files (.env, templates) to match the new version's template.

---

## 16. Version History

### Version 3.0.2 (2026-10-24) - Recreate Only Changed Images

Upgrade: from v3.0.x `mcctl update`; from v2.x `upgrade-v3.sh`.

**Fixed:** `mcctl update` and `upgrade-v3.sh` step 7b no longer offer to recreate stopped servers already on the current image; they report `up to date` (#810).

### Version 3.0.1 (2026-10-24) - Upgrade Fixes

Upgrade: from v2.x use the fixed `upgrade-v3.sh`; from v3.0.0 run `mcctl update` twice (the first run is still the 3.0.0 CLI).

**Fixed:** `upgrade-v3.sh` (restart with `--console --force`, `kill_timeout` check, rollback summary, recreate stopped servers) (#794); `mcctl console service` without a terminal (#795); `mcctl update` offers to recreate stopped servers, default No (#796).

**Changed:** console Routing Table grouped by server (#799); root `pnpm test` excludes e2e and e2e requires `E2E_BASE_URL` and `E2E_API_URL` (#797).

### Version 3.0.0 (2026-10-24) - Scripts Removed (BREAKING)

Upgrade: `curl -fsSL https://raw.githubusercontent.com/smallmiro/minecraft-server-manager/main/scripts/upgrade-v3.sh | bash -s -- --dry-run`, then without `--dry-run`; runbook `docs/advanced/upgrade-runbook.md` (v3.0.0 sections).

**Removed:** all Bash scripts (#715); script-based `@minecraft-docker/shared` exports (#736); `MCCTL_SCRIPTS` is ignored; `<root>/scripts` is deleted by `mcctl upgrade` only after `y`.

**Added:** `server.yaml` (ServerSpec) + `mcctl migrate spec`; `mcctl delete --delete-world`, `mcctl backup push --allow-missing`; `GET /api/router/logs/stream`, `GET /api/router/status/stream`, `POST /api/router/restart`, `GET /api/servers?include=summary`, console `GET /api/changelog`.

**Changed:** create/delete/backup in TypeScript; delete keeps the world by default; hosts with `BACKUP_AUTO_ON_STOP=true` add `kill_timeout: 130000` to mcctl-api; console dashboard, server detail and Routing page on Bento (hostname routing table, live router log, routing flow).

### Version 2.33.0 (2026-10-18) - Console Auth Upgrade Fix

Upgrade: `mcctl upgrade`, then `mcctl console service restart --console`. From ≤2.31 go straight to 2.33.0.

**Changed:**
- Create Server dialog: empty sudo password asks for confirmation (whitespace = empty); defaults VANILLA / `LATEST`, hint to pin a version for other types (#700)
- Routing table hostname lists collapsed by default

**Fixed (#699):**
- Console uses `.env` `BETTER_AUTH_SECRET` / `BETTER_AUTH_BASE_URL` only when `ecosystem.config.cjs` no longer defines the key; otherwise the PM2 value wins and a warning names the key
- `mcctl upgrade` moves both keys from the ecosystem into `.env` (secret kept, `ecosystem.config.cjs.bak-<ts>`, dry-run aware, idempotent)
- Platform Settings: these keys read-only (`source: pm2-ecosystem`) while the ecosystem defines them; PUT rejected with 400
- `mcctl console init` replaces a stale `.env` secret with the ecosystem secret

### Version 2.32.0 (2026-10-18) - Platform Settings & Secret Isolation

Includes the unreleased 2.31.1 hotfix. Upgrade: `mcctl upgrade`, then `mcctl stop <name> && mcctl start <name>` for every server; hosts that ran `mcctl console init` on ≤2.31.0 check `AUTH_MODE` (runbook 4-1).

**Added:**
- Console **Platform Settings** (admin, `/settings`): edit `<MCCTL_ROOT>/.env` via `GET/PUT /api/platform-settings`; keys classified editable / read-only / runtime (PM2) / legacy / unknown; secrets write-only; 409 on stale revision; atomic `0600` write; restart scope per key; audit action `platform.settings.update` (key names only) (#683)
- `BETTER_AUTH_SECRET` / `BETTER_AUTH_BASE_URL` read from `.env` (non-empty value wins over ecosystem); `mcctl console init` writes the secret to `.env`; apply with `mcctl console service restart --console` (#686)
- `mcctl init` generates a random 24-char `RCON_PASSWORD` (#680); `mcctl create --enable-whitelist` (#679)

**Changed:**
- Whitelist off by default for new servers (#679); connection addresses sorted LAN → VPN → nip.io → external → `.local`, LAN is primary (#681)
- `mcctl console init` maps `internal`→`ip-whitelist`, `api-key-ip`→`combined`, `open`→`disabled` (#633); legacy keys removed from `.env.example` (#687)

**Fixed:**
- Servers load `servers/global.env` (`TZ`, `EXTRA_ARGS`, `RCON_PASSWORD`, `RCON_PORT` only) instead of the whole `.env` (#685)
- sudo password no longer appended to `/etc/avahi/hosts`; first IPv4 of `HOST_IP` only (#682)
- `DELETE /api/audit-logs` requires admin (#689); `Config.updateEnv` atomic and bash-safe (#688)
- Copy on plain HTTP (#681), RCON ANSI fake player (#600), Minecraft 26.x world/player data (#601), CLI exit code when audit log fails (#602), `console service status` uptime/HTTP health (#677)

### Version 2.31.0 (2026-10-11) - Console Usage Analytics

**Added:**
- Anonymous GA4 `page_view` analytics in the web console (#631): `installId` (UUID in `.mcctl.json`, written by `mcctl init`/`mcctl upgrade` or on first console request), normalized page path, console version. Not sent: hostname/IP, server/world names, query, account. Opt out: `"telemetry": false` in `.mcctl.json` or `DO_NOT_TRACK=1`; disabled in dev mode.

**Fixed:**
- `mcctl console user/api` dropped `--role`, `--password`, `--json`, `--force` (#628)

### Version 2.30.0 (2026-10-11) - Docs & Development Workflow

No product behavior changes; documentation and contributor workflow only.

**Added:**
- Upgrade runbook with post-upgrade verification (#577, #579)
- `DEVELOPMENT.md` contributor guide (fork-based workflow) (#587)

**Changed:**
- README refreshed; `create-server.sh` instructions replaced with `mcctl create` (#581, #583)
- `/work` dev workflow: Stop hook (#585), contributor mode (#589), agent routing and difficulty tiers (#591), per-session work state (#593)

### Version 2.29.1 (2026-10-10) - Map Render Fix

**Fixed:**
- `render-map.sh`: `pick_dimension_root` no longer returns status 1 when a dimension has no region data, so `set -e` no longer aborts the render; empty dimensions are skipped with a warning (#575, PR #576)
- After rendering, BlueMap `settings.json` `maps` array is rewritten overworld → nether → end (BlueMap ignores per-map `sorting` for list order), so the viewer opens on the Overworld; existing worlds apply it on Re-render (#575, PR #576)

### Version 2.29.0 (2026-10-10) - mc-router 1.47.1 & Compose Upgrade

**Added:**
- `mcctl upgrade` patches the root `docker-compose.yml` `router` service (`image` tag + `group_add` only) with diff/confirm, `.bak-<timestamp>` backup, validation/restore, and `docker compose up -d router`. `--dry-run` = diff only, `--non-interactive` = apply without asking (#562, PR #569)
- Console world **Ore & Block Stats**: KPI cards, ore donut chart with legend and rare-ore chips, category-colored top-blocks bar (#567, PR #568)

**Changed:**
- mc-router `itzg/mc-router:1.43.1` → `1.47.1`. 1.46+ runs as non-root, so the router service has `group_add: ["${DOCKER_GID:-999}"]`; `mcctl init`/`mcctl upgrade` auto-detect the socket GID (honoring `DOCKER_HOST`) into `.env` (#549, PR #559)
- `CF_API_KEY` is optional: itzg Java 17+ images embed a CurseForge key; set it only for Java 8 / pre-17 tags or your own key (#561, PR #566)
- itzg reference docs synced to 2026.9.2 (#548, PR #560)

**Fixed:**
- BlueMap map confs set `sorting` (overworld=0, nether=1, end=2) so the map opens on the Overworld; existing worlds apply it on Re-render (#564, PR #565)

**Internal:**
- CLI and `shared` tests run in CI; 15 unloadable CLI test files fixed; `DIM-1`/`DIM1` fixtures tracked (#555, #570, PRs #558, #571)

### Version 2.28.0 (2026-10-01) - Console Bento Layout

**Changed:**
- **Bento layout in mcctl-console** - All screens (dashboard, servers list, server detail, server console, worlds, players, backups, routing, audit logs, settings, login/signup, admin users) use a page hero (title, key status, metrics, primary action) followed by bounded panels. No API, permission, navigation, or behavior changes. Dense views (tables, tabs, file browser, terminal) keep their layout inside a panel
- **Shared components** in `platform/services/mcctl-console/src/components/bento/`: `BentoGrid` (1/6/12-column responsive grid), `BentoPanel`, `PageHero`, `BentoMetricCard`. `ResourceStatCard` (server detail) was removed in favor of `BentoMetricCard`; dashboard `StatCard` wraps it
- Design/plan documents: `docs/superpowers/specs/2026-09-28-console-bento-design.md`, `docs/superpowers/plans/2026-09-28-console-bento-implementation.md`

**Fixed:**
- Dashboard "needs attention" count = servers that are not `running` or are `unhealthy`; status chip shows `Reconnecting` when the SSE connection is down, and SSE status overlays are ignored while disconnected
- Console pages show `Unavailable` / an error alert when data fails to load (no misleading `0`); after a successful load, refetch errors keep the cached data (backups show `Configured (cached)`)
- `mcctl console user ...` / `mcctl console api ...` failed with `error: unknown command 'node'`; Commander now parses with `{ from: 'node' }` (#556, PR #557)

### Version 2.27.0 (2026-09-27) - Server Players Panel

**Added (#528):**
- **Players Tab** in server detail (#550) - Unified online (RCON) + offline (`usercache.json`, `playerdata/`, `ops.json`, `whitelist.json`, `banned-players.json`) roster with avatars, badges, and kick/ban/unban/op/deop/whitelist actions
- **Player Detail Modal: Statistics** (#551) - Play time, deaths, kills, distance, blocks mined, items crafted, advancements (`?include=stats`)
- **Player Detail Modal: Position & Status** (#552) - Last saved position/dimension, health, food, XP level, game mode, inventory summary from `playerdata/<uuid>.dat`; live RCON position polled every 5s while online (`?include=nbt` → `data`, `livePosition`)
- **Player Detail Modal: Session History** (#553) - Visits, total playtime, last seen, recent 20 sessions (`?include=sessions`). `PlayerSessionCollectorService` in mcctl-api polls `docker logs --timestamps` every 30s into `data/players.db` (SQLite; tables `player_sessions`, `player_session_cursors`); first pass per server backfills 24h
- **New endpoint**: `GET /api/servers/:name/players/:uuid` (`?include=stats,nbt,sessions`, any combination; unknown value → 400; unknown player → 404)
- **Shared domain**: entities `Player`, `PlayerSession`; value objects `PlayerStats`, `PlayerData`, `PlayerSessionEvent`; use cases `PlayerManagementUseCase`, `PlayerSessionUseCase`; ports `IPlayerRepository`, `IPlayerSessionRepository`; adapters `PlayerRepository`, `SqlitePlayerSessionRepository`

**Changed:**
- `GET /api/servers/:name/players` now responds while the server is stopped (previously 400). Existing fields `online`/`max`/`players` are kept; added `serverName`, `running`, `roster[]` (`uuid`, `name`, `lastSeen`, `isOp`, `isBanned`, `isWhitelisted`, `online`). `?follow=true&interval=<ms>` streams `event: players` via SSE

**Notes:**
- Session history only covers the period since the collector first ran (plus up to 24h backfill); it is not reconstructed from world files

### Version 2.22.0 (2026-06-21) - itzg Image Refresh

**Changed:**
- **mc-router Image Pin** - Bump `itzg/mc-router` pin from `1.42.0` to `1.43.1` in `platform/docker-compose.yml` and pin the two previously-unpinned mc-router compose templates to `1.43.1` (#503, #504)
- **Server Template Java Tag** - Align the `_template` `itzg/minecraft-server` image tag from `java21` to `java25`, matching the McVersion LATEST default and the bundled CLI templates (#503, #504)

**Notes:**
- mc-router `1.43.1` introduces event-based Docker polling (faster auto-scale reactions), timezone (`TZ`) support, and a `--log-level` option. There are no breaking changes versus `1.42.0`, and the label-based `--in-docker` auto-scale workflow used here requires no configuration changes.
- The platform maps a Minecraft version to a Java image tag rather than pinning to a date-based image tag (see `McVersion`): MC 26+/LATEST → `java25`, 1.21+ → `java21`, 1.18-1.20.x → `java17`.

### Version 2.20.3 (2026-05-03) - mc-router Stability

**Fixed:**
- **mc-router DOCKER_TIMEOUT Format** - Correct DOCKER_TIMEOUT to Go time.Duration format (`120` → `120s`) so mc-router can parse it properly

**Changed:**
- **mc-router Image Pin** - Pin `itzg/mc-router` image to explicit version `1.42.0` for reproducible deployments (#472, #473)

### Version 2.20.2 (2026-04-03) - Loading MOTD Label

**Added:**
- **Loading MOTD Label** - Add `mc-router` loading MOTD label (`auto-scale-loading-motd`) to server templates (#471)
- **Auto Loading MOTD** - Auto-add loading MOTD label to existing servers during `mcctl update` (#471)

**Fixed:**
- **MC 26.x Defaults** - Update CLI defaults and docs for MC 26.x / Java 25 (`init`/`upgrade` defaultVersion → 26.1.1, common versions list)

### Version 2.20.1 (2026-04-03) - Docker Image Auto-Upgrade

**Added:**
- **Docker Image Auto-Pull** - `mcctl update` now automatically pulls the latest Docker image (#465)
- **Auto Image Tag Upgrade** - `mcctl update` checks VERSION vs image tag compatibility and auto-upgrades server Docker image tags (#468)

**Fixed:**
- **Java 25 Default Image** - MC 26.1.1+ requires Java 25; update default image tag to `java25`, McVersion supports 26.x versioning (#467)
- **CLI Defaults Update** - Update `init`/`upgrade` defaultVersion from 1.21.1 to 26.1.1 and docs for MC 26.x / Java 25
- **Merge Artifacts** - Resolve merge artifacts from parallel PR merges (vitest conversion, fieldConfigs syntax, sectionConfigs, IMcctlApiClient)

### Version 2.20.0 (2026-04-03) - itzg Docs Sync & Platform Update

**Added:**
- **Java 25 Support** - McVersion.recommendedImageTag and DocsAdapter java25 support (#444)
- **New Server Types** - Add LEAF, FOLIA, PUFFERFISH server types (#445)
- **Native AutoPause** - PAUSE_WHEN_EMPTY_SECONDS config support for MC 1.21.2+ (#446)
- **WebSocket & SSH Console** - WebSocket Console and SSH Console config support (#447)
- **Config Repository** - Configuration Repository settings (PAPER_CONFIG_REPO etc.) (#448)

**Fixed:**
- **DocsAdapter Path** - Fix DocsAdapter file path to include itzg-reference subdirectory (#449)

**Changed:**
- **Test Runner Migration** - Migrate shared package test runner from node:test to vitest (#450)
- **TypeScript Types** - Unify @types/node to ^22.x across all packages (#451)

**Documentation:**
- **Java Versions** - GraalVM deprecated, Java 25 tags added (#439)
- **AutoPause** - Native AutoPause (PAUSE_WHEN_EMPTY_SECONDS) for MC 1.21.2+ (#440)
- **Server Types** - Leaf, Config Repos, Fabric mirror (#441)
- **Mods & Plugins** - Auto-removal, VERSION_FROM_MODRINTH, new env vars (#442)
- **Console Features** - WebSocket Console, SSH Console, Autoscale documentation (#443)

### Version 2.19.0 (2026-03-01) - Console Bug Fixes & Community Links

**Added:**
- **Console Community Links** - Add Q&A and Ideas community links to Footer component (#434, #438)

**Fixed:**
- **Console Snapshot Null Guard** - Add null guards to `getNextPageParam` and `flatMap` in `useServerConfigSnapshots` to prevent TypeError (#431, #435)
- **Console View History Button** - Disable View History button when less than 2 snapshots available (#432, #437)

**Documentation:**
- **npm README** - Add Q&A and Ideas discussion links to README for community engagement (#433, #436)

### Version 2.18.0 (2026-02-24) - Backup Storage Path Consolidation

**Changed:**
- **Backup Storage Paths** - Relocate all backup storage paths to `<MCCTL_ROOT>/backups/` (#429, #430)
  - World backup cache: `$HOME/.minecraft-backup` -> `<MCCTL_ROOT>/backups/worlds/`
  - Backup schedule DB: `data/` -> `backups/meta/`
  - Config snapshot DB/storage: `data/` -> `backups/meta/`
  - Consolidates all backup-related data under a single `backups/` directory for easier management

**Documentation:**
- **CLAUDE.md** - Simplify Project Structure to high-level table (606 -> 393 lines, 35% reduction)
- **Orchestrator Agent** - Add Orchestrator Agent to Multi-Agent Collaboration and enforce orchestrator-first workflow

### Version 2.17.1 (2026-02-24) - Backup Sub-tab Reorder

**Changed:**
- **Console Backup Sub-tabs** - Reorder server backup sub-tabs to show Config Snapshots first, World Backups second

### Version 2.17.0 (2026-02-24) - Server Detail Backups Tab

**Added:**
- **Server Detail Backups Tab** - Implement Backups tab in Server Detail page (#427, #428)
  - World Backups sub-tab: Reuses existing backup components scoped to selected server
  - Config Snapshots sub-tab: Server-scoped config snapshot management with schedule filtering
  - Fix ConfigSnapshotSchedulePanel to filter schedules by server name
  - Fix onViewHistory to require >= 2 snapshots for diff dialog

**Fixed:**
- **Console Dependencies** - Add missing `react-diff-viewer-continued` dependency
- **Lock file sync** - Sync pnpm-lock.yaml

### Version 2.16.0 (2026-02-23) - Config Snapshots & Backup Retention

**Added:**
- **Config Snapshot System** - Full-stack server configuration versioning (#397~#406, #414~#424)
  - Domain layer: `ConfigSnapshot`, `ConfigSnapshotSchedule` entities with value objects
  - Infrastructure: `SqliteConfigSnapshotRepository` with SQLite persistence
  - API: RESTful Config Snapshot endpoints (CRUD, diff, restore, schedule management)
  - `ConfigSnapshotSchedulerService` with `node-cron` for automated snapshots
  - CLI: `mcctl config-snapshot` commands for snapshot management
  - Console: Config Snapshots tab on Backup page, Config History tab on Server Detail page
  - ConfigDiff viewer and ConfigRestore dialog components
  - E2E test fixtures and test files
- **Backup Retention Policy Pruning** - `applyRetentionPolicy()` implementation (#396, #426)
  - Git history truncation logic for automated backup cleanup

**Fixed:**
- **Backup Git Path** - Correct git repository path resolution (#423, #425)
  - Replace `exec()` with `execFile()` to prevent shell injection
  - Added test coverage for backup routes

### Version 2.4.0 (2026-02-14)

**Added:**
- **mcctl upgrade command** - Template-diffing based platform upgrade that detects new environment variables in `.env.example` and appends them to user's `.env` file (#326, #355)
  - `--dry-run` flag to preview changes without applying
  - `--non-interactive` flag for CI/CD usage (uses defaults)
  - `mcctl init --upgrade` shortcut
  - Append-only: existing user values are never modified
  - Variables grouped by section with clear markers
  - `templateVersion` tracking in `.mcctl.json`
- **mcctl playit domain subcommand** - Register playit.gg tunnel domains for existing servers (#347, #348)
- **Creeper ASCII banner** - Shows creeper art with version check on `mcctl init` (#353, #354)
- **Console Mods tab** - Full mod management functionality in Web Console server detail page (#351, #352)
  - View configured mods (Modrinth, CurseForge, Spiget, URL)
  - Renamed from 'Content' to 'Mods' for clarity (#349, #350)

### Version 2.3.5 (2026-02-12)

**Fixed:**
- Playit.gg container name fix - use correct `playit-agent` name in status checks (#345, #346)
- Console playit error feedback for start/stop actions (#343)
- Console playit section header layout improvement (#343, #344)

### Version 2.3.4 (2026-02-12)

**Fixed:**
- Playit.gg Docker Compose setup - properly adds playit service during `mcctl init` and `mcctl playit setup` (#341, #342)

### Version 2.3.3 (2026-02-12)

**Fixed:**
- Playit.gg Docker Compose CWD - pass correct working directory to docker compose commands (#339, #340)

### Version 2.3.2 (2026-02-12)

**Fixed:**
- Playit.gg status detection now checks `.mcctl.json` for `playit.enabled` flag instead of Docker container existence (#337, #338)
  - More reliable detection that works even when containers are not running

### Version 2.3.1 (2026-02-12)

**Fixed:**
- TypeScript build error in audit-logs purge catch block
- Handle missing `.mcctl.json` in `mcctl init --reconfigure` (#335, #336)

### Version 2.3.0 (2026-02-12) - External Play (playit.gg)

**Added:**
- playit.gg external access integration - allow external players to join without port forwarding
- `PlayitConfig` type and Docker Compose profile support in shared package (#291, #328)
- playit-agent service in docker-compose templates with `network_mode: host` and `profiles: [playit]` (#270, #327)
- `mcctl init --playit-key` for interactive playit.gg setup during platform initialization (#271, #329)
- `mcctl create --playit-domain` for registering playit.gg domains when creating servers (#272, #330)
- `mcctl playit` subcommand: start/stop/status/setup for playit-agent management (#273, #331)
- REST API endpoints: `GET /api/playit/status`, `POST /api/playit/start`, `POST /api/playit/stop` (#292, #332)
- Web Console UI: PlayitSummaryCard (dashboard), ConnectionInfoCard (server detail), PlayitSection (routing page) (#274, #333)
- Comprehensive playit.gg integration guide in English and Korean (#275, #334)
- Comprehensive audit logging for all mutating API routes (player, config, hostname, world routes) (#324, #325)

**Fixed:**
- Whitelist Add/Bulk button size inconsistency in WhitelistManager (#322, #323)

### Version 2.2.0 (2026-02-11) - Whitelist Console UI

**Added:**
- Whitelist Console UI: toggle ON/OFF, bulk player add, search/filter (#283, #321)
- Enable whitelist by default on `mcctl create` (#282, #320)
- Hostname/Domain management in server Options tab (#314, #315)

**Fixed:**
- 23 pre-existing failing unit tests (#296, #316)

### Version 2.1.0 (2026-02-09) - Console Feature Completion

**Added:**
- Modrinth modpack CLI/API support - full modpack server creation and management (#244, #245)
- Admin user management Console UI - list, detail, role management (#189)
- OP Level domain model with levels 1-4 and semantic descriptions (#284)
- OP Level CLI commands: `mcctl op set <player> --level <1-4>` with interactive mode (#285)
- OP Level REST API: `PATCH /api/servers/:name/ops/:player` with `{level}` (#286)
- OP Level Console Web UI: OpLevelBadge, OpLevelSelector, OpManager integration (#287)
- Offline player management support (#288, #289)
- User profile settings page with password change (#265, #266)

**Fixed:**
- Console sign-out 403 error with LAN IP addresses (#300, #301)
- Service node_modules isolation into `.services/` directory (#262, #267)
- MCCTL_TEMPLATES path resolution and console modLoader validation (#263, #264)

### Version 1.14.0 (2026-02-08)

**Added:**
- MODRINTH modpack server creation via CLI interactive mode with slug, loader, and version prompts
- Dynamic mod loader detection from Modrinth API (only loaders supported by the modpack are shown)
- NeoForge added as mod loader option for MODRINTH modpack servers (`forge`, `fabric`, `neoforge`, `quilt`)
- MODRINTH modpack server creation via Web Console (Create Server dialog with Standard/Modpack toggle)
- REST API `POST /api/servers` supports `modpack`, `modpackVersion`, `modLoader` fields for MODRINTH type
- `modLoader` schema includes `neoforge` option in REST API

### Version 1.13.0 (2026-02-07)

**Added:**
- Interactive service selection for `mcctl console service start/stop/restart/logs`
- Unified Prerequisite Checker for `mcctl init` and `mcctl console init`
- Console npm publishing: `@minecraft-docker/mcctl-console` available on npm
- `--force` option for `mcctl console service stop/restart`
- Routing Page in Web Console (Avahi mDNS monitoring)
- `isConsoleAvailable()` returns `true` (console is GA)

**Fixed:**
- `force-dynamic` export added to all 22 API routes to prevent SQLITE_BUSY at build time

### Version 1.12.0 ~ 1.12.1 (2026-02-06~07)

**Added:**
- All-Servers SSE Status Endpoint (`GET /api/servers-status?follow=true`; the console proxies it as `/api/sse/servers-status`)
- Server Detail Delete Menu with confirmation dialog
- API Audit Logging for server CRUD and actions

**Fixed:**
- `not_created` status handling in all SSE and API interfaces
- Assign world dialog shows all non-running servers

### Version 1.11.0 (2026-02-06)

**Added:**
- World Management UI in Web Console (list, create, assign, release, delete, reset)
- Server Options Tab (config management via web UI)
- SSE Real-time Server Status (replaced polling)
- Server Config API (`GET/PATCH /api/servers/:name/config`)
- World Reset API (`POST /api/servers/:name/world/reset`)

**Fixed:**
- Path traversal prevention in world reset endpoint
- Container status checks before world reset

### Version 1.10.0 (2026-02-05)

**Added:**
- Audit Log System with CLI (`mcctl audit`), API (5 endpoints), and Web Console UI
- SQLite storage with WAL mode, auto-migration, auto-cleanup (90-day retention)
- Dashboard: Recent Activity Feed
- Server Detail: Activity tab

### Version 1.9.0 (2026-02-05)

**Added:**
- `mcctl update --all` flag to update CLI and all installed services

### Version 1.8.0 (2026-02-05)

**Added:**
- Web Console sudo password support for server creation
- Dashboard ChangelogFeed from GitHub releases

### Version 1.7.9 ~ 1.7.12

- 1.7.12: Fix TEMPLATE_DIR path duplication and improve API error reporting
- 1.7.11: Fix world size calculation for servers using LEVEL config
- 1.7.10: Console ANSI colors, SSE streaming for server creation, MCCTL_ROOT path fix
- 1.7.9: Fix YAML syntax error in E2E workflow

### Version 1.7.8

**Added:**
- Selective console service support during `mcctl console init`
- Fixed environment variable names for mcctl-api authentication (`MCCTL_*` prefix)

### Version 1.7.5 ~ 1.7.7

- 1.7.7: Auto-install mcctl-api on console init
- 1.7.6: mcctl-api npm publishing support
- 1.7.5: Fixed Edge runtime error in mcctl-console middleware

**Known Issue - Edge Runtime Error (v1.7.4 and below):**
- **Symptom:** `mcctl-console` fails with `@better-auth/*` package incompatibility
- **Solution:** Update to v1.7.5 or later

### Version 1.7.0 ~ 1.7.4

- Router Status API (`GET /api/router/status`)
- Server Create/Delete API
- Player Management API
- Backup API
- `mcctl init --reconfigure` option

### Version 1.6.0 ~ 1.6.11

- Management Console (REST API + Web Console)
- `mcctl console` commands
- User management with roles
- Version update check
- Deprecated `mcctl admin` commands

### Version 1.5.x

- Mod management (`mcctl mod search/add/remove/list/sources`)
- Modrinth, CurseForge, Spiget, direct URL mod sources
- Server backup/restore commands

### Version 1.4.x

- Player management (whitelist, ban, op, kick)
- World management with `.meta` file support
- Interactive world selection in `mcctl create`

### Version 1.3.x

- nip.io magic DNS support
- VPN mesh network support (Tailscale, ZeroTier)
- Migration script for nip.io hostnames

---

## 17. Glossary

| Term | Definition |
|------|------------|
| **mcctl** | Minecraft Control - the CLI management tool |
| **mcctl-api** | REST API service for programmatic server management (Fastify, port 5001) |
| **mcctl-console** | Web-based management console (Next.js, port 5000) |
| **mc-router** | Hostname-based connection router that directs traffic to correct servers |
| **PM2** | Node.js process manager used to run Management Console services |
| **avahi-daemon** | Linux mDNS service for .local hostname discovery |
| **nip.io** | Magic DNS service that maps `x.y.z.w.nip.io` to IP `x.y.z.w` |
| **RCON** | Remote Console protocol for executing Minecraft server commands |
| **Paper** | High-performance Minecraft server fork with plugin support (recommended) |
| **Forge** | Original mod loader for Minecraft, supports vast mod library |
| **NeoForge** | Community fork of Forge (1.20.1+), increasingly popular |
| **Fabric** | Lightweight, modern mod loader with fast updates |
| **Modrinth** | Open-source mod hosting platform (default source in mcctl) |
| **CurseForge** | Popular mod hosting platform (CF_API_KEY optional on Java 17+ images) |
| **Spiget** | API for SpigotMC plugin resources |
| **Auto-scale** | mc-router feature that starts/stops servers based on player activity |
| **World assignment** | A world belongs to the one server whose `LEVEL` in `config.env` names it; prevents simultaneous server access to a world (replaced the former lock files) |
| **ecosystem.config.cjs** | PM2 configuration file generated by `mcctl console init` |
| **Access Mode** | API authentication method (internal, api-key, ip-whitelist, api-key-ip, open) |
| **BFF** | Backend-for-Frontend pattern used by mcctl-console to proxy mcctl-api |
| **SSE** | Server-Sent Events for real-time streaming (server status, audit logs) |
| **Better Auth** | Authentication library used by mcctl-console for session management |
| **playit.gg** | Free tunneling service for external access without port forwarding |
| **mcctl upgrade** | Platform configuration migration command (appends new .env keys, patches the router service, moves servers to `servers/global.env`) |
| **templateVersion** | Version tracking field in `.mcctl.json` to track which template version was last applied |

---

## 18. External Resources & Links

| Resource | URL |
|----------|-----|
| **mcctl Documentation** | https://minecraft-server-manager.readthedocs.io/ |
| **GitHub Repository** | https://github.com/smallmiro/minecraft-server-manager |
| **npm Package (mcctl)** | https://www.npmjs.com/package/@minecraft-docker/mcctl |
| **npm Package (mcctl-api)** | https://www.npmjs.com/package/@minecraft-docker/mcctl-api |
| **npm Package (mcctl-console)** | https://www.npmjs.com/package/@minecraft-docker/mcctl-console |
| **AI Assistant (NotebookLM)** | https://notebooklm.google.com/notebook/e91b656e-0d95-45b4-a961-fb1610b13962 |
| **itzg/minecraft-server Docs** | https://docker-minecraft-server.readthedocs.io/ |
| **itzg/minecraft-server GitHub** | https://github.com/itzg/docker-minecraft-server |
| **mc-router GitHub** | https://github.com/itzg/mc-router |
| **Docker Hub (minecraft-server)** | https://hub.docker.com/r/itzg/minecraft-server |
| **Docker Hub (mc-router)** | https://hub.docker.com/r/itzg/mc-router |
| **PM2 Process Manager** | https://pm2.keymetrics.io/ |
| **CurseForge API** | https://console.curseforge.com/ |
| **Modrinth** | https://modrinth.com/ |

---

*This document was generated as a comprehensive knowledge base for LLM agent consumption. Version 3.0.2, last updated 2026-10-25.*
