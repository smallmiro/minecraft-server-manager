# Docker Minecraft Server Manager

[![npm version](https://img.shields.io/npm/v/@minecraft-docker/mcctl)](https://www.npmjs.com/package/@minecraft-docker/mcctl)
[![npm downloads](https://img.shields.io/npm/dm/@minecraft-docker/mcctl)](https://www.npmjs.com/package/@minecraft-docker/mcctl)
[![GitHub issues](https://img.shields.io/github/issues/smallmiro/minecraft-server-manager)](https://github.com/smallmiro/minecraft-server-manager/issues)
[![Documentation](https://readthedocs.org/projects/minecraft-server-manager/badge/?version=latest)](https://minecraft-server-manager.readthedocs.io/)
[![License](https://img.shields.io/github/license/smallmiro/minecraft-server-manager)](https://github.com/smallmiro/minecraft-server-manager/blob/main/LICENSE)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/smallmiro)

> **Official Website:** [https://mcctl.mirolab.dev](https://mcctl.mirolab.dev/)  
> **Documentation:** [ReadTheDocs](https://minecraft-server-manager.readthedocs.io/en/latest/)

Docker-based Minecraft server manager with automatic idle shutdown and web console.

A multi-server Minecraft management system using `itzg/minecraft-server` with `itzg/mc-router` for automatic scaling and hostname-based routing.

## System Requirements

| Component | Minimum Version | Recommended | Notes |
|-----------|-----------------|-------------|-------|
| **Node.js** | >= 18.0.0 | 20 LTS | Required for mcctl CLI |
| **Docker Engine** | >= 24.0.0 | Latest | Container runtime |
| **Docker Compose** | >= 2.20.0 | Latest | `include` feature required |
| **PM2** | >= 6.0.0 | Latest | Install globally (`npm install -g pm2`) before `mcctl console init`; runs the Console services |
| **OS** | Linux, macOS | Ubuntu 22.04+ | Windows via WSL2 |

## Features

- **Multi-Server**: Run multiple Minecraft servers (survival, creative, modded, etc.)
- **Single Port**: All servers accessible via port 25565 with hostname routing
- **Auto-Scale**: Servers start on client connect, stop after idle timeout
- **nip.io Magic DNS**: Connect via `server.<ip>.nip.io` - no client setup needed
- **mDNS Discovery**: Clients auto-discover servers via Bonjour/Zeroconf
- **Idle Servers Stop**: When nobody plays, only mc-router (and the console services, if installed) keep running
- **Interactive CLI**: Guided prompts for server creation, player management, and more
- **Server Definition (`server.yaml`)**: Each server is described by `servers/<name>/server.yaml`; mcctl writes its `config.env` and compose file from it (`mcctl migrate spec` imports older servers)
- **Management Console**: Web Console (port 5000) + REST API (port 5001) for remote management
- **Server File Manager**: Browse, edit, upload/download server files with drag-and-drop support
- **server.properties Editor**: Inline FORM/RAW toggle editor for server.properties configuration
- **Player Management**: Unified `mcctl player` command with Mojang API integration
- **Mod Management**: Search, add, and remove mods from Modrinth, CurseForge, Spiget
- **Modpack Support**: Create servers from Modrinth modpacks with dynamic loader detection
- **NeoForge Support**: Full support for NeoForge modded servers (Minecraft 1.20.1+)
- **GitHub Backup**: World backup to a private GitHub repository, manually, on a schedule, or when a server stops
- **Backup Scheduling**: Cron-based automated backup scheduling with retention policies
- **Config Snapshots**: Snapshot, compare, and restore a server's configuration, on demand or on a schedule (`mcctl config-snapshot`)
- **Audit Logs**: Activity tracking with SQLite storage, optional auto-cleanup, and web UI
- **World Management UI**: Web-based world management with reset, assignment, and real-time status
- **Create World from ZIP**: Import a world from a ZIP upload (flat/wrapper/split-dimension layouts auto-detected) and pick an existing world, seed, or URL when creating a server
- **World Info Panel & Map**: Per-world details (level.dat, dimensions, structures, players), Ore & Block Stats, and a BlueMap web map that opens on the Overworld
- **Server Player Panel**: Online/offline roster with per-player stats, last position, and session history
- **Modpack Safety**: Loader/version compatibility checks and automatic exclusion of client-only mods (web console)
- **Routing Page**: Per-server hostname routing table, live mc-router log, routing flow, and mc-router restart in the web console
- **Platform Settings**: Admins view and edit the platform `.env` from the web console (secrets are write-only)
- **Installable PWA**: Add the web console to your home screen
- **External Access (playit.gg)**: Allow external players to join without port forwarding via playit.gg tunneling

## Quick Start

```bash
# Install globally
npm install -g @minecraft-docker/mcctl

# Initialize platform (creates ~/minecraft-servers)
mcctl init

# Start mc-router (routes every server through port 25565; restarts with Docker)
mcctl router start

# Create your first server (interactive mode)
mcctl create

# Or with options (CLI mode)
mcctl create myserver -t VANILLA -v 1.21.1

# Check status (the HOSTNAME column lists every address of a server)
mcctl status
```

`mcctl create` starts only the new server. Players can connect once mc-router runs; `mcctl up` starts mc-router and every server.

### Set Up Management Console (Optional)

After creating your first server, add the web-based management console:

```bash
# Initialize Console (API + Web UI)
mcctl console init
# Follow prompts: select services → create admin user → choose access mode

# Start Console services (--console = API + Console; without it you are asked)
mcctl console service start --console

# Open in browser
# http://localhost:5000
```

See the [Setup Guide](https://minecraft-server-manager.readthedocs.io/en/latest/console/setup-guide/) for the complete walkthrough.

### Connect via Minecraft

**Option A: nip.io Magic DNS (Recommended)**

No setup required - just connect using the nip.io hostname:
- `myserver.192.168.20.37.nip.io:25565`

Replace `192.168.20.37` with your server's HOST_IP from `.env`.

**Option B: mDNS (.local)**

With avahi/Bonjour, connect directly:
- `myserver.local:25565`

**mDNS Requirements** (for .local hostnames):
| OS | Requirement |
|----|-------------|
| Linux | avahi-daemon (usually pre-installed) |
| macOS | Built-in Bonjour (no setup needed) |
| Windows | Bonjour Print Services or iTunes |

**Fallback** (if both unavailable): Add `<server-ip> myserver.local` to hosts file.

See [mDNS Setup Guide](#mdns-setup-guide) for detailed installation instructions.

**Option C: playit.gg (External Access - Recommended for Public)**

Allow anyone on the internet to join without port forwarding:

```bash
# Set up playit.gg tunneling
mcctl playit setup
# Enter your SECRET_KEY from https://playit.gg/account/agents/new-docker

# Start the tunnel agent
mcctl playit start

# Create server with playit domain
mcctl create myserver -t PAPER -v 1.21.1 --playit-domain xx-xx.craft.playit.gg

# Or give an existing server the domain, then stop and start it
mcctl playit domain myserver xx-xx.craft.playit.gg
```

Friends connect via: `xx-xx.craft.playit.gg`

New servers have the whitelist off. Turn it on before you share the address: `mcctl whitelist myserver on`.

See [External Access Guide](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/external-access/) for detailed setup instructions.

**Option D: VPN Mesh (Remote Access)**

For remote access without port forwarding, use [Tailscale](https://tailscale.com/) or [ZeroTier](https://zerotier.com/):

```bash
# Choose "Host IP(s)" and select both the LAN and the VPN address
# (writes HOST_IP=192.168.1.100 and HOST_IPS=192.168.1.100,100.64.0.5 to .env)
mcctl init --reconfigure
```

Answer yes to updating existing servers, then stop and start each server so mc-router sees the new hostname. Friends on your VPN network can connect via:
- `myserver.100.64.0.5.nip.io:25565`

See [VPN Mesh Networks Guide](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/networking/#vpn-mesh-networks) for setup instructions.

Add more servers using `mcctl create` - they're automatically discoverable!

## Architecture

```
                    Minecraft Clients
                          │
              ┌───────────┴───────────┐
              │   mc-router (:25565)  │
              │   hostname routing    │
              │   auto-scale up/down  │
              └───────────┬───────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │mc-server1│     │mc-server2│     │mc-serverN│
  └──────────┘     └──────────┘     └──────────┘
        ▲                 ▲                 ▲
        │    Docker Compose (start/stop)    │
        └─────────────────┼─────────────────┘
                          │
              ┌───────────┴───────────┐
              │   mcctl-api (:5001)   │
              │   Fastify REST API    │
              └───────────┬───────────┘
                          │
              ┌───────────┴───────────┐
              │ mcctl-console (:5000) │
              │ Next.js Web UI + Auth │
              └───────────────────────┘
```

mc-router finds servers through their Docker labels (`mc-router.host`), reading the Docker socket read-only. The `mcctl` CLI and mcctl-api run on the host (mcctl-api and mcctl-console under PM2) and manage the server containers with Docker Compose.

## Adding a New Server

Fully automated with a single command:

```bash
mcctl create <server-name> [options]

# Basic examples:
mcctl create myworld                            # Creates & starts myworld (PAPER, LATEST)
mcctl create techcraft -t FORGE                 # Creates & starts techcraft (FORGE)
mcctl create modern -t NEOFORGE -v 1.21.1       # NeoForge for modern mods
mcctl create myworld --no-start                 # Create only, don't start
mcctl create                                    # Interactive mode (guided prompts)

# With version:
mcctl create myworld -t VANILLA -v 1.21.1       # Specific version (-v)

# Modpack:
mcctl create cobblemon -t MODRINTH --modpack cobblemon   # Modrinth modpack slug

# World options (mutually exclusive):
mcctl create myworld --seed 12345               # Specific seed
mcctl create myworld --world-url <URL>          # Download from ZIP
mcctl create myworld -w existing-world -v 1.21.1  # Use an existing world in worlds/ (sets LEVEL)

# Whitelist (off by default):
mcctl create myworld --whitelist Steve,Alex     # Turn it on with players
mcctl create myworld --enable-whitelist         # Turn it on, empty
```

`mcctl create` automatically:
1. Writes `servers/<name>/server.yaml` and generates `config.env` and `docker-compose.yml` from it
2. Sets `LEVEL` to the server name (world stored in `worlds/<server-name>/`), or to the world given with `--world`
3. Adds the server to `servers/compose.yml` (the main `docker-compose.yml` is NOT modified)
4. Registers `<name>.local` with avahi-daemon (mDNS; needs sudo, see [Automation](#automation-sudo-password-handling))
5. Starts the server (unless `--no-start` specified)

**Defaults**: type `PAPER`, version `LATEST`, memory `4G` (`6G` for modpacks), image tag by `VERSION` (`java25` for `LATEST`; see the [Java Version Selection Guide](#java-version-selection-guide)).

**World Storage**: Worlds are stored in the shared `worlds/` directory (`EXTRA_ARGS=--universe /worlds/`). A world belongs to one server at a time: the server whose `LEVEL` names it.

**mc-router auto-discovery**: Servers are auto-discovered via Docker labels (`mc-router.host`): `<name>.local`, one `<name>.<ip>.nip.io` per address in `HOST_IPS` (or `HOST_IP`), the playit domain, and custom hostnames. mc-router must be running (`mcctl router start`).

See [Server Definition (server.yaml)](docs/configuration/server-yaml.md) for what the generated files hold and [CLI Commands Reference](docs/cli/commands.md) for all `create` options.

## Management Console

The Management Console provides a full-featured web interface and REST API for managing your Minecraft servers remotely. Install with `mcctl console init` -- see the [Setup Guide](https://minecraft-server-manager.readthedocs.io/en/latest/console/setup-guide/) for details.

| Feature | Description |
|---------|-------------|
| **Dashboard** | Server status, player counts and memory, per-server Console/Start/Stop/Restart, Create Server, mc-router card, external access list, and recent activity (live over SSE) |
| **Server Management** | Start/stop/restart servers, RCON console, resource monitoring (CPU/memory/world size), server switcher |
| **Server Files** | Browse, edit, upload, and download files with smart editors for server.properties and player data |
| **Server Options** | Hostname management, gameplay settings, JVM/performance tuning with FORM/RAW toggle |
| **Mod Management** | Search, install, and remove mods from Modrinth with rich detail cards; include/exclude modpack jars |
| **Config History** | Snapshot, compare, and restore a server's configuration, with schedules |
| **World Management** | Create (seed, URL, or ZIP upload), assign, release, delete, and reset worlds, with the server that uses each world |
| **World Info & Map** | World details, Ore & Block Stats, structure markers, and a BlueMap web map (render from the world detail page) |
| **Player Management** | Whitelist, operator, and ban management across all servers, plus a per-server Players tab with stats and session history |
| **Backup & Scheduling** | Manual push + cron-based automated backup schedules with retention policies |
| **Audit Logs** | Activity tracking with filtering, statistics, export, and real-time updates |
| **Routing** | Per-server hostname routing table, mc-router status and restart, live router log, routing flow, mDNS (Avahi) and playit.gg status |
| **Platform Settings** (admin) | View and edit the platform `.env`; secrets are write-only and changes say what to restart |
| **Users** (admin) | Manage console users, roles, and per-server access |

**Endpoints:**

| Service | Default Port | Description |
|---------|-------------|-------------|
| mcctl-console | 5000 | Next.js Web UI with Better Auth |
| mcctl-api | 5001 | Fastify REST API (Swagger UI at `/docs` only with `SWAGGER_ENABLED=true` in `.env`) |

See the [Web Console Guide](https://minecraft-server-manager.readthedocs.io/en/latest/console/web-console/) for the complete feature walkthrough.

---

## Mod Management

mcctl integrates with multiple mod sources for easy mod installation:

```bash
# Search for mods on Modrinth
mcctl mod search sodium

# Add mods to your server (from Modrinth, the default)
mcctl mod add myserver sodium lithium phosphor

# Add mods from CurseForge (CF_API_KEY optional on Java 17+ images)
mcctl mod add myserver --curseforge jei journeymap

# Add plugins from SpigotMC (use resource ID)
mcctl mod add myserver --spiget 9089  # EssentialsX

# Add from direct URL
mcctl mod add myserver --url https://example.com/mod.jar

# List configured mods
mcctl mod list myserver

# Remove a mod
mcctl mod remove myserver sodium

# Show all available sources
mcctl mod sources
```

After adding or removing mods, restart the server:
```bash
mcctl stop myserver && mcctl start myserver
```

See [CLI Commands Reference](docs/cli/commands.md) for complete documentation.

---

## Documentation

### Getting Started

| Document | Description |
|----------|-------------|
| [Installation](https://minecraft-server-manager.readthedocs.io/en/latest/getting-started/installation/) | Install mcctl and prerequisites |
| [Quick Start](https://minecraft-server-manager.readthedocs.io/en/latest/getting-started/quickstart/) | Create your first server |
| [CLI Commands](https://minecraft-server-manager.readthedocs.io/en/latest/cli/commands/) | Complete command reference |

### Configuration

| Document | Description |
|----------|-------------|
| [Server Definition (server.yaml)](https://minecraft-server-manager.readthedocs.io/en/latest/configuration/server-yaml/) | The file each server is generated from, hand edits, `mcctl migrate spec` |
| [Server Types](https://minecraft-server-manager.readthedocs.io/en/latest/configuration/server-types/) | Paper, Forge, Fabric, NeoForge, modpacks, Java versions |
| [Environment Variables](https://minecraft-server-manager.readthedocs.io/en/latest/configuration/environment/) | All configuration options |
| [Mods & Plugins](https://minecraft-server-manager.readthedocs.io/en/latest/mods-and-plugins/) | Modrinth, CurseForge, Spiget |

### Management Console

| Document | Description |
|----------|-------------|
| [Setup Guide](https://minecraft-server-manager.readthedocs.io/en/latest/console/setup-guide/) | Complete setup from `mcctl init` to Console |
| [Web Console Guide](https://minecraft-server-manager.readthedocs.io/en/latest/console/web-console/) | Full feature walkthrough with screenshots |
| [Console CLI](https://minecraft-server-manager.readthedocs.io/en/latest/console/cli-commands/) | Console CLI command reference |
| [REST API](https://minecraft-server-manager.readthedocs.io/en/latest/api/) | mcctl-api overview, authentication, and errors |
| [API Endpoints](https://minecraft-server-manager.readthedocs.io/en/latest/api/endpoints/) | Every mcctl-api endpoint |

### Advanced

| Document | Description |
|----------|-------------|
| [Networking](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/networking/) | nip.io, mDNS, VPN mesh |
| [External Access (playit.gg)](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/external-access/) | Allow external players without port forwarding |
| [Backup](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/backup/) | GitHub backup setup |
| [Upgrade Runbook](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/) | Upgrade every component on each release, with post-upgrade verification |
| [Troubleshooting](https://minecraft-server-manager.readthedocs.io/en/latest/troubleshooting/) | Common problems and fixes |

### Development

| Document | Description |
|----------|-------------|
| [DEVELOPMENT.md](DEVELOPMENT.md) | Contributor guide: fork, issue-driven workflow, and PRs |
| [CLI Architecture](docs/development/cli-architecture.md) | Hexagonal architecture and patterns |

---

## Development Setup

### Prerequisites

| Component | Minimum Version | Recommended | Notes |
|-----------|-----------------|-------------|-------|
| Node.js | >= 18.0.0 | 20 LTS | Required for mcctl CLI |
| Docker Engine | >= 24.0.0 | Latest | Container runtime |
| Docker Compose | >= 2.20.0 | Latest | `include` feature required |
| pnpm | >= 8.0.0 | Latest | For development only |

### Build from Source

```bash
# Clone repository
git clone https://github.com/smallmiro/minecraft-server-manager.git
cd minecraft-server-manager

# Install dependencies
pnpm install

# Build all packages (shared → cli, in order)
pnpm build

# Link CLI globally for development
cd platform/services/cli
pnpm link --global

# Verify installation
mcctl --version
```

### Project Structure (Monorepo)

```
minecraft-server-manager/
├── package.json              # Root workspace
├── pnpm-workspace.yaml       # pnpm workspace config
├── docs/                     # MkDocs documentation (EN/KO)
├── e2e/                      # Playwright E2E tests
├── scripts/                  # upgrade-v3.sh (v2.x → v3 upgrade helper)
├── website/                  # Landing page (mcctl.mirolab.dev)
│
└── platform/services/
    ├── shared/               # @minecraft-docker/shared
    │   └── src/              # Common types, utils, domain models
    │
    ├── mod-source-modrinth/  # @minecraft-docker/mod-source-modrinth
    │   └── src/              # Modrinth API adapter
    │
    ├── mcctl-api/            # @minecraft-docker/mcctl-api
    │   └── src/              # Fastify REST API (port 5001)
    │
    ├── mcctl-console/        # @minecraft-docker/mcctl-console
    │   └── src/              # Next.js Web UI (port 5000)
    │
    └── cli/                  # @minecraft-docker/mcctl
        ├── src/              # CLI commands and adapters
        └── templates/        # Files `mcctl init` copies (docker-compose.yml, .env.example, servers/_template)
```

### Available Scripts

| Location | Command | Description |
|----------|---------|-------------|
| Repository root | `pnpm install` | Install all dependencies |
| Repository root | `pnpm build` | Build all packages (recommended) |
| Repository root | `pnpm clean` | Clean all build outputs |
| Repository root | `pnpm test` | Run the tests of every package except `e2e` (same as CI) |
| Repository root | `pnpm test:e2e` | Run the Playwright E2E tests (set `E2E_BASE_URL` and `E2E_API_URL` first) |
| `platform/services/cli` | `pnpm build` | Build CLI only |
| `platform/services/cli` | `pnpm test` | Run CLI tests |
| `platform/services/cli` | `pnpm link --global` | Link CLI globally |

### Build Order

pnpm automatically builds packages in dependency order:

```
1. @minecraft-docker/shared              (no dependencies)
2. @minecraft-docker/mod-source-modrinth (depends on shared)
3. @minecraft-docker/mcctl               (depends on shared, mod-source-modrinth)
4. @minecraft-docker/mcctl-api           (depends on shared, mod-source-modrinth)
5. @minecraft-docker/mcctl-console       (depends on shared)
```

---

## Quick Reference - Key Environment Variables

Server settings live in `servers/<name>/config.env`, which mcctl generates from `server.yaml`; change them with `mcctl config <server> <KEY> <value>` or the web console. Of the platform `.env`, only `TZ`, `EXTRA_ARGS`, `RCON_PASSWORD` and `RCON_PORT` reach the servers (through `servers/global.env`).

### Required

| Variable | Value | Description |
|----------|-------|-------------|
| `EULA` | `TRUE` | Minecraft EULA agreement (mcctl sets it in every server's compose file) |

### Server Basics

Defaults are what `mcctl create` writes; the itzg image default is in parentheses where it differs.

| Variable | Default | Description |
|----------|---------|-------------|
| `TYPE` | `PAPER` (`VANILLA`) | Server type (PAPER, FORGE, FABRIC, etc.) |
| `VERSION` | `LATEST` | Minecraft version |
| `MEMORY` | `4G`, `6G` for modpacks (`1G`) | JVM memory |

### Game Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MOTD` | `Welcome to <name>! Your adventure begins here.` | Server message |
| `DIFFICULTY` | `normal` (`easy`) | Difficulty |
| `MODE` | `survival` | Game mode |
| `MAX_PLAYERS` | `20` | Maximum players |

### Security

| Variable | Description |
|----------|-------------|
| `RCON_PASSWORD` | RCON password (platform `.env`; `mcctl init` generates a random one) |
| `ENABLE_WHITELIST` | Enable whitelist (off for new servers) |
| `OPS` | Operator list |

### Network

| Variable | Description |
|----------|-------------|
| `HOST_IP` | Host IP for nip.io hostname |
| `HOST_IPS` | Multiple IPs for VPN mesh (comma-separated) |

### Automation

| Variable | Description |
|----------|-------------|
| `MCCTL_ROOT` | Platform directory (default `~/minecraft-servers`; or pass `--root` to every command) |
| `MCCTL_SUDO_PASSWORD` | sudo password for mDNS registration (avahi-daemon) |

### Backup

`mcctl backup init` asks for these and writes them to `.env`.

| Variable | Description |
|----------|-------------|
| `BACKUP_GITHUB_TOKEN` | GitHub token with access to the backup repository |
| `BACKUP_GITHUB_REPO` | Backup repository (`owner/name`) |
| `BACKUP_GITHUB_BRANCH` | Branch to push to (default `main`) |
| `BACKUP_AUTO_ON_STOP` | `true`: back up the worlds after a server stops (CLI, API, or web console stop) |

### Audit Logs

Set these in the platform `.env` (read by mcctl-api); the CLI reads them from its shell environment.

| Variable | Default | Description |
|----------|---------|-------------|
| `AUDIT_AUTO_CLEANUP` | off | `true`: delete logs older than `AUDIT_RETENTION_DAYS`, checked every 100 entries or 24 hours while logs are written |
| `AUDIT_RETENTION_DAYS` | `90` | Number of days to retain audit logs |

---

## Server Type Selection Guide

```
Plugin server → TYPE=PAPER (mcctl create default)
Forge mods    → TYPE=FORGE
NeoForge mods → TYPE=NEOFORGE (1.20.1+)
Fabric mods   → TYPE=FABRIC
Modpacks      → mcctl create <name> -t MODRINTH --modpack <slug>
Vanilla       → TYPE=VANILLA
```

Pick the image's Java version for the Minecraft version with the guide below.

---

## Java Version Selection Guide

```
Minecraft 26.x / LATEST   → java25
Minecraft 1.20.5 - 1.21.x → java21
Minecraft 1.17 - 1.20.4   → java17
Minecraft 1.16.5 and older → java8 (required for old Forge)
```

`mcctl create` picks the tag `VERSION` needs from this guide; `LATEST`, a modpack without `-v` and snapshots get `java25`. To change a server's image, set `image:` in `servers/<name>/server.yaml` and run `mcctl migrate spec <name>` (or edit the image in `servers/<name>/docker-compose.yml`; mcctl takes it into `server.yaml`), then stop and start the server. `mcctl update` moves `java*` tags to the one `VERSION` needs and keeps pinned tags, such as a release tag (`2026.10.0-java21`) or a digest.

---

## CLI Commands

### Interactive Mode (mcctl)

The CLI supports **interactive mode** with guided prompts for easy server management:

```bash
# Interactive server creation with guided prompts
mcctl create

# Interactive server deletion with confirmation
mcctl delete

# Interactive world management
mcctl world            # Same as world list
mcctl world list       # List worlds and the server that uses each
mcctl world new        # Interactively create new world
mcctl world assign     # Interactively assign world to server
mcctl world release    # Switch the server using a world back to its own world

# Interactive backup management
mcctl backup status    # Show backup configuration
mcctl backup push      # Interactive backup with message prompt
mcctl backup history   # Show backup history
mcctl backup restore   # Interactive restore from backup
```

### CLI Mode (with arguments)

All commands also support **CLI mode** for scripting:

```bash
# Create server with options
mcctl create myserver -t PAPER -v 1.21.1 --seed 12345

# Delete server (asks first; its world is kept in worlds/)
mcctl delete myserver
mcctl delete myserver -y               # Skip the confirmation
mcctl delete myserver --force          # Delete even if players are online (implies -y)
mcctl delete myserver --delete-world   # Delete the world inside the server instead of keeping it

# World management with names (the server must be stopped)
mcctl world new myworld --seed 12345 --server myserver
mcctl world assign survival myserver   # Server name, not the mc- container name
mcctl world release survival

# Backup with message
mcctl backup push -m "Before upgrade"
mcctl backup push --allow-missing      # Accept worlds deleted since the last backup
mcctl backup restore abc1234           # Asks first (--force skips); all servers must be stopped
```

### Infrastructure Commands

```bash
# Start/stop all infrastructure (mc-router + all servers)
mcctl up                   # Start everything
mcctl down                 # Stop everything

# Manage mc-router independently
mcctl router start         # Start mc-router only
mcctl router stop          # Stop mc-router only
mcctl router restart       # Restart mc-router

# Start/stop all MC servers (mc-router keeps running)
mcctl start --all          # or mcctl start -a
mcctl stop --all           # or mcctl stop -a

# Individual server management
mcctl start myserver
mcctl stop myserver
mcctl logs myserver

# RCON console access (via Docker)
docker exec -i mc-myserver rcon-cli
```

### mc-router Configuration

mc-router reads its settings from the `environment:` of the `router` service in `docker-compose.yml`. They are not read from `.env`:

```yaml
# ~/minecraft-servers/docker-compose.yml
services:
  router:
    environment:
      AUTO_SCALE_UP: "true"            # Start a stopped server when a player connects
      AUTO_SCALE_DOWN: "true"          # Stop idle servers
      AUTO_SCALE_DOWN_AFTER: "10m"     # Idle timeout (default: 10 minutes)
      DOCKER_TIMEOUT: "120s"           # Container start timeout (Go duration: 120s, 2m; a bare number fails)
      AUTO_SCALE_ASLEEP_MOTD: "§e§lServer is sleeping§r\n§7Connect to wake up!"
      API_BINDING: ":8080"             # Management API (published on 127.0.0.1:25580)
```

Per server, `routing.autoScale.up` / `down` in `servers/<name>/server.yaml` override these (scale-up works only while `AUTO_SCALE_UP` is on).

**Common timeout values:**
| Value | Description |
|-------|-------------|
| `1m` | 1 minute |
| `5m` | 5 minutes |
| `10m` | 10 minutes (default) |
| `30m` | 30 minutes |
| `1h` | 1 hour |

After editing, recreate mc-router so it picks up the change:
```bash
mcctl router start     # docker compose up -d router (recreates the container when its settings changed)
```

`mcctl router restart` restarts the existing container with its old settings. `mcctl upgrade` only updates the router's `image` and `group_add`, so your edits are kept.

### Server Commands (RCON)

```bash
# Interactive RCON console (multiple commands)
mcctl rcon myserver
> list
> say Hello!
> exit

# Single RCON command (for scripts/automation)
mcctl exec myserver say "Hello!"         # Broadcast message
mcctl exec myserver list                 # List online players
mcctl exec myserver give Player diamond 64  # Give items
mcctl exec myserver tp Player 0 100 0    # Teleport player
```

### Server Configuration

```bash
# View configuration
mcctl config myserver              # View all config.env values
mcctl config myserver MOTD         # View specific key
mcctl config myserver --json       # JSON output

# Modify configuration
mcctl config myserver MOTD "Welcome!"  # Set any config value

# Shortcut flags for common settings
mcctl config myserver --cheats         # Enable cheats (ALLOW_CHEATS=true)
mcctl config myserver --no-cheats      # Disable cheats
mcctl config myserver --pvp            # Enable PvP
mcctl config myserver --no-pvp         # Disable PvP
mcctl config myserver --command-block  # Enable command blocks
```

### Operator Management

```bash
# List, add, remove operators
mcctl op myserver list             # List current operators with level and role
mcctl op myserver add Notch        # Add operator (asks for the level, default 4)
mcctl op myserver add Notch 2      # Add operator with level 2
mcctl op myserver set-level Notch 3  # Change the level (server must be running)
mcctl op myserver remove Steve     # Remove operator
mcctl op myserver list --json      # JSON output

# Dual update strategy:
# - RCON (/op, /deop) for immediate effect when server is running
# - OPS in config.env (through server.yaml) for persistence across restarts
```

### Whitelist Management

```bash
mcctl whitelist myserver list      # List whitelisted players
mcctl whitelist myserver add Steve # Add to whitelist
mcctl whitelist myserver remove Steve  # Remove from whitelist
mcctl whitelist myserver on        # Enable whitelist
mcctl whitelist myserver off       # Disable whitelist
mcctl whitelist myserver status    # Show whitelist status
```

### Ban Management

```bash
mcctl ban myserver list            # List banned players
mcctl ban myserver add Griefer "reason"  # Ban player with reason
mcctl ban myserver remove Griefer  # Unban player
mcctl ban myserver ip list         # List banned IPs
mcctl ban myserver ip add 1.2.3.4 "reason"  # Ban IP
mcctl ban myserver ip remove 1.2.3.4  # Unban IP
```

### Kick and Online Players

```bash
# Kick player from server
mcctl kick myserver PlayerName "Too long AFK"

# View online players
mcctl player online myserver       # List online players on server
mcctl player online --all          # List online players on all servers
```

### Unified Player Management (Interactive)

```bash
# Interactive player management (server → player → action)
mcctl player                       # Full interactive mode
mcctl player myserver              # Skip server selection

# Player info lookup (Mojang API with local cache)
mcctl player info Steve            # Show UUID, skin URL, etc.
mcctl player info Steve --json     # JSON output

# Cache management (avoids Mojang API rate limiting)
mcctl player cache stats           # Show cache statistics
mcctl player cache clear           # Clear all cached data
```

**Interactive workflow**:
```
$ mcctl player

? Select server:
❯ survival (3 players online)
  creative (0 players online)

? Select player:
❯ Steve (online)
  Alex (online)
  [Enter player name manually]

? Select action:
❯ View player info
  Add to whitelist
  Add as operator
  Ban player
  Kick player
```

### Server Backup/Restore

```bash
# Backup server configuration (server.yaml, config.env, docker-compose.yml,
# ops/whitelist/ban lists, server.properties; not world data)
mcctl server-backup myserver              # Create backup with auto message
mcctl server-backup myserver -m "msg"     # Create backup with message
mcctl server-backup myserver --list       # List all backups

# Restore server from backup
mcctl server-restore myserver                   # Interactive restore (select from list)
mcctl server-restore myserver 20260120-203357   # Restore specific backup
mcctl server-restore myserver --dry-run         # Preview restore without applying
```

### Audit Log Management

View and manage audit logs of all server operations:

```bash
# List audit logs with filtering
mcctl audit list                   # List recent 50 logs
mcctl audit list --limit 100       # List 100 logs
mcctl audit list --action server.create  # Filter by action
mcctl audit list --actor cli:local  # Filter by actor
mcctl audit list --target myserver  # Filter by target server
mcctl audit list --status failure   # Show only failures
mcctl audit list --from 2026-01-01  # Date range filtering

# Show statistics
mcctl audit stats                  # Overview of all logs

# Purge old logs
mcctl audit purge                  # Delete logs older than 90 days (default)
mcctl audit purge --days 30        # Delete logs older than 30 days
mcctl audit purge --before 2026-01-01  # Delete before specific date
mcctl audit purge --dry-run        # Preview without deleting
mcctl audit purge --force          # Skip confirmation
```

Audit logs capture server lifecycle (create, delete, start, stop, restart), player management (whitelist, ban, op, kick), and world, mod, backup, configuration and settings changes. They are stored in `~/minecraft-servers/data/audit.db`.
- Automatic cleanup is off unless `AUDIT_AUTO_CLEANUP=true`
- Retention for that cleanup: `AUDIT_RETENTION_DAYS` (default: 90)

### Migration (Existing Servers)

Migrate existing servers to the new shared world directory structure:

```bash
# Check migration status
mcctl migrate status               # Show servers needing migration

# Migrate worlds to /worlds/ directory
mcctl migrate worlds               # Interactive server selection
mcctl migrate worlds --all         # Migrate all servers
mcctl migrate worlds --dry-run     # Preview changes without applying
mcctl migrate worlds --backup      # Create backup before migration
```

The migration:
- Moves world data from `servers/<name>/data/world` to `worlds/<server-name>/`
- Updates `config.env` with `EXTRA_ARGS=--universe /worlds/` and `LEVEL=<server-name>`
- Detects existing worlds with case-insensitive matching

Servers created before v3.0.0 have no `server.yaml` yet. They keep working and are imported the first time mcctl changes them; to import them now:

```bash
mcctl migrate spec --all --dry-run   # Show what would be imported
mcctl migrate spec --all             # Import and write the files
mcctl migrate spec myserver --force  # Re-render one server from server.yaml (keeps .bak copies)
```

### Update & Upgrade

Keep mcctl and all services up to date:

```bash
# Check for updates (no install; exit code 1 = update available)
mcctl update --check

# Update the CLI and all installed services (mcctl-api, mcctl-console, shared)
mcctl update

# Auto-confirm without prompt (for CI/CD)
mcctl update --yes

# Update only the mcctl CLI binary
mcctl update --cli-only
```

**Options:**

| Option | Description |
|--------|-------------|
| `--check` | Check only, don't install (exit code 1 = update available, or the npm registry could not be reached) |
| `--yes` | Auto-confirm update without prompt |
| `--cli-only` | Update only the CLI binary, not the services |
| `--all` | Deprecated alias (same as the default) |

Besides the packages, `mcctl update` aligns each server's `itzg/minecraft-server` tag with its `VERSION` (pinned tags such as `2026.10.0-java21` or a digest are kept) and pulls the images. mc-router auto-scale starts the existing container, so a stopped server would wake up on its old image: `mcctl update` lists the stopped servers whose image differs (the rest are `up to date`) and, in a terminal, asks whether to recreate them (default No). Running servers are not touched; apply the new image with `mcctl stop <server> && mcctl start <server>`.

**`update` vs `upgrade`:**

| Command | Purpose |
|---------|---------|
| `mcctl update` | Update npm packages (CLI, API, Console) and restart the Console services |
| `mcctl upgrade` | Migrate platform files after a CLI update: new `.env` variables, `DOCKER_GID`, `servers/_template`, `servers/global.env`, console auth keys moved into `.env`, and the `router` service in your root `docker-compose.yml`; it also lists servers without `server.yaml` and offers to delete the unused `<root>/scripts` folder |

`mcctl update` does **not** run `mcctl upgrade`. Run it afterwards:

```bash
mcctl upgrade --dry-run        # preview changes only
mcctl upgrade                  # apply (asks before changing docker-compose.yml)
mcctl upgrade --non-interactive  # apply defaults without prompting
```

`mcctl upgrade` only patches the router's `image` tag and `group_add` in `docker-compose.yml` (a timestamped `.bak` is written first), and recreates the router. For the complete, release-independent procedure including backups, verification, and rollback, see the [Upgrade Runbook](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/).

Upgrading from v2.x to v3.0.0? A guided script checks your host, backs up, updates and migrates with a question per step: see [the upgrade script](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/#v300-upgrade-script).

### Automation (sudo Password Handling)

For CI/CD or scripting, you can provide sudo password for mDNS registration:

```bash
# Environment variable (recommended for automation)
MCCTL_SUDO_PASSWORD=secret mcctl create myserver

# CLI option
mcctl create myserver --sudo-password "secret"
mcctl delete myserver --sudo-password "secret"

# Interactive mode (prompted when avahi-daemon is installed)
mcctl create myserver
# Enter sudo password (or press Enter to try sudo without a password): ********
```

With no password, mcctl runs `sudo -n`, which works with the sudoers rules below or cached credentials; otherwise the mDNS registration is skipped with a warning. The password is only used to authenticate sudo.

**Alternative: sudoers NOPASSWD**

For passwordless operation, add to `/etc/sudoers.d/mcctl`:
```bash
# Allow mcctl commands without password
%docker ALL=(ALL) NOPASSWD: /usr/bin/tee -a /etc/avahi/hosts
%docker ALL=(ALL) NOPASSWD: /usr/bin/sed -i * /etc/avahi/hosts
%docker ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart avahi-daemon
```

### Docker Commands (Alternative)

```bash
cd ~/minecraft-servers

# Start mc-router and all servers
docker compose up -d

# Start specific server (replace <server-name> with your server name)
docker compose up -d mc-<server-name>

# Stop specific server
docker compose stop mc-<server-name>

# View router logs
docker logs -f mc-router

# View server logs
docker logs -f mc-<server-name>

# Console access
docker exec -i mc-<server-name> rcon-cli

# Execute command
docker exec mc-<server-name> rcon-cli say Hello World

# Stop all
docker compose down
```

---

## mDNS Setup Guide

mDNS (Multicast DNS) enables automatic hostname discovery on local networks. This allows Minecraft clients to connect using `.local` hostnames without configuring hosts files.

### Server Host Setup (where Minecraft servers run)

The server host needs avahi-daemon to broadcast `.local` hostnames.

#### Debian / Ubuntu (Systemd)

```bash
# Install avahi-daemon
sudo apt update
sudo apt install avahi-daemon

# Enable and start service
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon

# Verify status
sudo systemctl status avahi-daemon
```

#### CentOS / RHEL / Fedora (Systemd)

```bash
# Install avahi
sudo dnf install avahi

# Enable and start service
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon

# Open firewall for mDNS (if firewalld is active)
sudo firewall-cmd --permanent --add-service=mdns
sudo firewall-cmd --reload
```

#### Arch Linux (Systemd)

```bash
# Install avahi and nss-mdns
sudo pacman -S avahi nss-mdns

# Enable and start service
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon

# Edit /etc/nsswitch.conf for .local resolution
# Add 'mdns_minimal [NOTFOUND=return]' before 'resolve' in hosts line
```

#### Alpine Linux (OpenRC)

```bash
# Install avahi
apk add avahi

# Add to default runlevel and start
rc-update add avahi-daemon default
rc-service avahi-daemon start

# Verify status
rc-service avahi-daemon status
```

### Client Setup (connecting to servers)

#### Linux

Same as server setup - install avahi-daemon using the instructions above.

#### macOS

No setup required. macOS has built-in Bonjour support.

#### Windows

**Option 1: Bonjour Print Services (Recommended)**
1. Download [Bonjour Print Services](https://support.apple.com/kb/DL999) from Apple
2. Install and restart if needed
3. `.local` hostnames will resolve automatically

**Option 2: iTunes**
Installing iTunes also installs Bonjour support.

**Option 3: WSL2 (Windows Subsystem for Linux)**
```bash
# Inside WSL2 Ubuntu
sudo apt update
sudo apt install avahi-daemon

# Start avahi-daemon
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon

# Note: WSL2 network is bridged, so mDNS discovery works for Linux apps in WSL
# For Windows apps, use Option 1 or 2
```

### Verifying mDNS Setup

```bash
# On Linux/macOS, test hostname resolution
ping myserver.local

# Or use avahi-browse to discover services
avahi-browse -art

# Check if hostname is registered in avahi
cat /etc/avahi/hosts
```

### Troubleshooting mDNS

| Issue | Solution |
|-------|----------|
| `.local` not resolving | Ensure avahi-daemon is running and firewall allows UDP 5353 |
| Hostname conflicts | Check `/etc/avahi/hosts` for duplicate entries |
| Windows can't resolve | Install Bonjour Print Services |
| Works on Linux, not Windows | Windows needs Bonjour; or use hosts file fallback |

---

## Changelog

### [3.0.2] - 2026-10-24

**Upgrade:** from v3.0.x run `mcctl update`; from v2.x use `upgrade-v3.sh`.

**Fixed:** `mcctl update` and `upgrade-v3.sh` no longer offer to recreate stopped servers that already run the current image; they report `up to date` (#810). See [CHANGELOG.md](CHANGELOG.md).

### [3.0.1] - 2026-10-24

**Upgrade:** from v2.x use the fixed `upgrade-v3.sh`; from v3.0.0 run `mcctl update` twice (the stopped-server offer needs the new CLI).

**Fixed:** `upgrade-v3.sh` restart and rollback output (#794); `mcctl console service` without a terminal (#795); `mcctl update` offers to recreate stopped servers (#796).

**Changed:** console Routing Table grouped by server (#799); root `pnpm test` skips e2e and e2e needs explicit targets (#797). See [CHANGELOG.md](CHANGELOG.md).

### [3.0.0] - 2026-10-24

**BREAKING:** all Bash scripts are removed (#715). Run the [upgrade script](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/#v300-upgrade-script) (`curl -fsSL https://raw.githubusercontent.com/smallmiro/minecraft-server-manager/main/scripts/upgrade-v3.sh | bash -s -- --dry-run` first), or follow the [runbook](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/#v300-scripts).

**Added:** `server.yaml` (ServerSpec) and `mcctl migrate spec`; `mcctl delete --delete-world`; router live log and status SSE, `POST /api/router/restart`, `GET /api/servers?include=summary`.

**Changed:** servers are created, deleted and backed up from TypeScript; deleting keeps the world by default; console dashboard, server detail and Routing page rebuilt on Bento with a hostname routing table.

**Removed:** `scripts/` and the script-based `@minecraft-docker/shared` exports. See [CHANGELOG.md](CHANGELOG.md).

### [2.33.0] - 2026-10-18

**Upgrade:** run `mcctl upgrade`, then `mcctl console service restart --console`. From 2.31.x or earlier, upgrade straight to this version (#699).

**Changed:**
- Create Server dialog asks before creating with an empty sudo password; defaults are VANILLA / `LATEST` (#700)
- Routing table hostname lists start collapsed

**Fixed:**
- Upgrading to 2.32.0 signed console users out when `.env` held older `BETTER_AUTH_*` values: the ecosystem value now wins until `mcctl upgrade` moves it into `.env`; Platform Settings shows these keys read-only meanwhile (#699)
- `mcctl console init` no longer keeps a stale `.env` session secret (#699)

### [2.32.0] - 2026-10-18

**Upgrade:** run `mcctl upgrade`, then stop and start every server so platform secrets leave the containers (#685). Includes the unreleased 2.31.1 hotfix.

**Added:**
- **Platform Settings (admin)**: view and edit the platform `.env` from the console Settings page; write-only secrets, conflict detection, restart guidance, audit log by key name (#683)
- Console auth settings (`BETTER_AUTH_SECRET`, `BETTER_AUTH_BASE_URL`) read from the platform `.env` (#686)
- Random `RCON_PASSWORD` on `mcctl init` (#680); `mcctl create --enable-whitelist` (#679); all connection addresses with copy buttons, LAN first (#681)

**Changed:**
- Whitelist is off by default for new servers (#679)
- `mcctl console init` writes access modes mcctl-api recognizes (#633)

**Fixed:**
- Platform secrets no longer reach server containers (`servers/global.env`) (#685)
- sudo password no longer written to `/etc/avahi/hosts` (#682)
- `DELETE /api/audit-logs` requires admin (#689); atomic, bash-safe `.env` writes (#688)
- Copy over plain HTTP (#681), fake `[0m` player (#600), Minecraft 26.x world info (#601), CLI exit code with broken audit log (#602), `mcctl console service status` uptime/health (#677)

### [2.31.0] - 2026-10-11

**Added:**
- **Console usage analytics (GA4)**: anonymous per-install `installId` + normalized page path + console version; no hostname/IP, server/world names, query or account data. Opt out with `"telemetry": false` in `.mcctl.json` or `DO_NOT_TRACK=1` (#631)

**Fixed:**
- `mcctl console user/api` now honor `--role`, `--password`, `--json`, `--force` (#628)

### [2.30.0] - 2026-10-11

No product behavior changes - documentation and development-workflow release.

- **Docs**: Upgrade runbook with post-upgrade verification (#577, #579); README refreshed (#581, #583); contributor guide `DEVELOPMENT.md` (#587)
- **Dev workflow**: `/work` Stop hook (#585), contributor (fork) mode (#589), agent routing and difficulty tiers (#591), per-session work state (#593)

### [2.29.1] - 2026-10-10

**Fixed:**
- **World map render** - No longer fails ("exit code 1") on worlds with an empty Nether/End; those dimensions are skipped with a warning (#575, #576)
- **World map default view** - The map list is rewritten overworld → nether → end so the viewer opens on the Overworld; re-render existing worlds to apply (#575, #576)

### [2.29.0] - 2026-10-10

**Added:**
- **`mcctl upgrade` patches the router** in your root `docker-compose.yml` (image + `group_add`) with diff, confirmation, and backup (#562, #569)
- **Ore & Block Stats** visualization in the world panel (#567, #568)

**Changed:**
- **mc-router 1.43.1 → 1.47.1**; the router now needs `DOCKER_GID` for Docker socket access (#549, #559)

### [2.28.0] - 2026-10-01

**Changed:**
- **Bento layout** across the Web Console, with honest "Unavailable"/"Reconnecting" states when data fails to load

### [2.27.0] - 2026-09-27

**Added:**
- **Server Player Panel** - Players tab with online/offline roster, stats, position, and session history (#528)

### [2.26.0] - 2026-06-28

**Added:**
- **World Info Panel** and **BlueMap world map** (#525, #529)
- **Auto-detect client-only mods** in modpacks (#524, #527)

### [2.23.0] - 2026-06-21

**Added:**
- **Create World from ZIP** and flexible world selection on Create Server (#490, #491)

See [CHANGELOG.md](CHANGELOG.md) for full version history.

---

## Links

- **Documentation**: https://minecraft-server-manager.readthedocs.io/
- **GitHub**: https://github.com/smallmiro/minecraft-server-manager
- **Sponsor**: https://github.com/sponsors/smallmiro
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **AI Assistant**: [Ask questions about mcctl](https://notebooklm.google.com/notebook/e91b656e-0d95-45b4-a961-fb1610b13962)

### Based On

- **itzg/minecraft-server**: https://hub.docker.com/r/itzg/minecraft-server/
- **itzg/mc-router**: https://github.com/itzg/mc-router
- **Official Docs**: https://docker-minecraft-server.readthedocs.io/
