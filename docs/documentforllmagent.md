# mcctl - Docker Minecraft Server Management CLI

> **Version**: 2.1.0
> **Last Updated**: 2026-02-09
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
| **Zero Resources** | Only ~40MB RAM used when servers are idle |
| **Interactive CLI** | Guided prompts for all operations |
| **Management Console** | Web Console (port 5000) + REST API (port 5001) |
| **Player Management** | Unified player command with Mojang API integration |
| **Mod Management** | Search, add, remove mods from Modrinth, CurseForge, Spiget, direct URLs |
| **World Management** | Shared world storage with locking, cross-server world sharing |
| **GitHub Backup** | Automatic world backup to private GitHub repositories |
| **Audit Logs** | Comprehensive activity tracking with SQLite storage and web UI |
| **Self Update** | `mcctl update` to update CLI and all services |

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
| **PM2** | >= 6.0.14 | Latest | Bundled with mcctl, for Management Console |
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

# Or via pnpm
pnpm add -g @minecraft-docker/mcctl

# Verify installation
mcctl --version
```

### Quick Start

```bash
# Step 1: Initialize platform (creates ~/minecraft-servers/)
mcctl init

# Step 2: Create your first server
mcctl create myserver -t PAPER -v 1.21.1

# Step 3: Start all infrastructure
mcctl up

# Step 4: Check status
mcctl status
```

### Connection Methods

| Method | Address | Requirements |
|--------|---------|--------------|
| **nip.io** (Recommended) | `myserver.192.168.1.100.nip.io:25565` | Internet access |
| **mDNS** | `myserver.local:25565` | avahi-daemon/Bonjour |
| **Direct IP** | `192.168.1.100:25565` | None (single-server fallback) |

Replace `192.168.1.100` with your HOST_IP from `.env`.

### Platform Directory Structure

```
~/minecraft-servers/
├── docker-compose.yml      # Main orchestration (mc-router + server includes)
├── .env                    # Global configuration
├── servers/                # Server configurations
│   ├── compose.yml         # Server include list (auto-generated)
│   └── _template/          # Template for new servers
├── worlds/                 # Shared world storage
│   └── .locks/             # Lock files for world-server assignment
├── shared/                 # Shared resources
│   ├── plugins/            # Shared plugins (read-only mount)
│   └── mods/               # Shared mods (read-only mount)
├── scripts/                # Management scripts (Bash)
└── backups/                # Backup storage
```

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
| :25566 |              | :25567 |                   | :25568 |
+---+----+              +---+----+                   +---+----+
    |                       |                            |
    +-----------+-----------+----------------------------+
                |
     +----------v----------+
     |     worlds/          |
     |  (shared storage)    |
     +----------------------+
```

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
|    Better Auth               Docker Socket + Shell          |
|    Session Auth              Server Management              |
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

### Platform Directory Structure

After running `mcctl init`, the following directory structure is created:

```
~/minecraft-servers/                  # Platform root (MCCTL_ROOT)
├── .env                              # Global environment variables
├── .mcctl-admin.yml                  # Management Console config (after console init)
├── users.yaml                        # Console user credentials (hashed)
├── audit.db                          # SQLite audit log database
│
├── platform/
│   ├── docker-compose.yml            # Main orchestration (mc-router)
│   ├── ecosystem.config.cjs          # PM2 process config (after console init)
│   └── scripts/                      # Bash management scripts
│
├── servers/
│   ├── compose.yml                   # Auto-generated server include list
│   ├── _template/                    # Template for new servers
│   │   ├── docker-compose.yml
│   │   └── config.env
│   └── <server-name>/               # Per-server directory
│       ├── docker-compose.yml        # Server-specific compose
│       ├── config.env                # Server configuration
│       └── data/                     # Server container data mount
│
├── worlds/                           # Shared world storage
│   ├── .locks/                       # Lock files (server-world assignment)
│   │   └── <world>.lock              # Lock file content: server-name
│   └── <world-name>/                 # World directories
│       ├── .meta                     # World metadata (seed, createdAt)
│       ├── level.dat                 # Minecraft world data
│       ├── region/                   # Overworld chunks
│       ├── DIM-1/                    # Nether dimension
│       └── DIM1/                     # End dimension
│
├── shared/
│   ├── plugins/                      # Shared plugins (read-only mount)
│   └── mods/                         # Shared mods (read-only mount)
│
├── backups/                          # Local backup storage
│
└── node_modules/                     # npm packages (after console init)
    └── @minecraft-docker/
        ├── mcctl-api/                # REST API package
        ├── mcctl-console/            # Web Console package
        └── shared/                   # Shared domain package
```

### Connection Flow

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

---

## 5. Complete CLI Command Reference

### Global Options

| Option | Description |
|--------|-------------|
| `--root <path>` | Custom data directory (default: `~/minecraft-servers`) |
| `--json` | Output in JSON format |
| `--help` / `-h` | Show help |
| `--version` | Show version |
| `--sudo-password <pwd>` | Sudo password for mDNS operations |

**Environment Variable**: `MCCTL_SUDO_PASSWORD` - Alternative to `--sudo-password`

---

### Platform Management

```bash
mcctl init                       # Initialize platform
mcctl init --reconfigure         # Reconfigure existing installation
mcctl up                         # Start all (router + servers)
mcctl down                       # Stop all
mcctl router start|stop|restart  # Manage mc-router only
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
| `--type` | `-t` | Server type | PAPER |
| `--version` | `-v` | Minecraft version | LATEST |
| `--seed` | `-s` | World seed | Random |
| `--world-url` | `-u` | Download world from ZIP URL | - |
| `--world` | `-w` | Use existing world from worlds/ | - |
| `--no-start` | | Create without starting | - |

**Interactive mode**: Run `mcctl create` without a name for guided prompts.

**Interactive mode flow for MODRINTH type** (v1.14.0+):

When selecting MODRINTH as the server type in interactive mode, the flow changes:

1. **Server name** - alphanumeric, lowercase, hyphens allowed
2. **Server type** - select MODRINTH
3. **Modpack slug** - enter Modrinth modpack slug or URL (e.g., `cobblemon`)
4. **Mod loader** - select from loaders supported by the modpack (dynamically fetched from Modrinth API). Options: Auto-detect, Fabric, Forge, NeoForge, Quilt (only loaders supported by the modpack are shown)
5. **Modpack version** - specific version or leave empty for latest
6. **Memory** - defaults to 6G for modpacks
7. **World selection** - create new world, use existing, or download from URL
8. **Confirmation** - review settings before creation

> **Note**: Minecraft version is not prompted for modpack servers; it is determined by the modpack.

**What happens during creation:**
1. Server directory created at `~/minecraft-servers/servers/<name>/`
2. `config.env` generated from template
3. `docker-compose.yml` generated with container name `mc-<name>`
4. Server registered in `servers/compose.yml`
5. mDNS hostname registered via avahi-daemon (if installed)
6. nip.io hostname configured: `<name>.<HOST_IP>.nip.io`
7. Server container started (unless `--no-start`)

#### mcctl delete

```bash
mcctl delete [name] [options]
```

| Option | Short | Description |
|--------|-------|-------------|
| `--force` | `-y` | Skip confirmation, delete even with players online |

World data is preserved in the worlds/ directory.

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

#### mcctl start / stop

```bash
mcctl start <server>            # Start specific server
mcctl stop <server>             # Stop specific server
mcctl start --all               # Start all servers
mcctl stop --all                # Stop all servers
```

#### mcctl logs

```bash
mcctl logs <server>             # View server logs
mcctl logs <server> -f          # Follow logs
mcctl logs <server> -n 100      # Last 100 lines
```

#### mcctl console (RCON)

```bash
mcctl console <server>          # Interactive RCON console
```

#### mcctl exec

```bash
mcctl exec <server> <command>   # Execute single RCON command
mcctl exec myserver say "Hello!"
mcctl exec myserver list
mcctl exec myserver give Steve diamond 64
```

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
```

---

### Player Management

#### mcctl op

```bash
mcctl op <server> list             # List operators
mcctl op <server> add <player>     # Add operator
mcctl op <server> remove <player>  # Remove operator
```

#### mcctl whitelist

```bash
mcctl whitelist <server> list         # List whitelisted
mcctl whitelist <server> add <p>      # Add to whitelist
mcctl whitelist <server> remove <p>   # Remove from whitelist
mcctl whitelist <server> on           # Enable whitelist
mcctl whitelist <server> off          # Disable whitelist
mcctl whitelist <server> status       # Show whitelist status
```

#### mcctl ban

```bash
mcctl ban <server> list               # List banned players
mcctl ban <server> add <p> [reason]   # Ban player
mcctl ban <server> remove <p>         # Unban player
mcctl ban <server> ip list            # List banned IPs
mcctl ban <server> ip add <ip> [reason]  # Ban IP
mcctl ban <server> ip remove <ip>     # Unban IP
```

#### mcctl kick

```bash
mcctl kick <server> <player> [reason]
```

#### mcctl player

```bash
mcctl player                       # Full interactive mode
mcctl player <server>              # Interactive for specific server
mcctl player info <name>           # Player info (UUID, skin URL)
mcctl player info <name> --offline # Offline UUID
mcctl player online <server>       # List online players
mcctl player online --all          # All servers
mcctl player cache stats           # Cache statistics
mcctl player cache clear           # Clear cache
```

---

### World Management

```bash
mcctl world list                              # List worlds with lock status
mcctl world new [name]                        # Create new world (interactive or CLI)
mcctl world new <name> --seed 12345           # Create with seed
mcctl world new <name> --server <srv>         # Create and assign to server
mcctl world new <name> --server <srv> --no-start  # Don't auto-start server
mcctl world assign [world] [server]           # Lock world to server
mcctl world release [world]                   # Release lock
mcctl world release [world] --force           # Force release
mcctl world delete [world]                    # Delete world (with confirmation)
mcctl world delete [world] --force            # Force delete
```

**World behavior**: `mcctl world new` creates a world directory with a `.meta` file (containing seed and creation timestamp). Actual Minecraft world files are generated when a server first uses the world.

---

### Mod Management

```bash
mcctl mod search <query>                 # Search mods on Modrinth
mcctl mod add <server> <mod...>          # Add mods (Modrinth default)
mcctl mod add <server> --curseforge <mod>  # CurseForge (requires CF_API_KEY)
mcctl mod add <server> --spiget <id>     # SpigotMC plugin
mcctl mod add <server> --url <url>       # Direct URL
mcctl mod list <server>                  # List configured mods
mcctl mod remove <server> <mod>          # Remove mod
mcctl mod sources                        # Show mod sources
```

**Automatic Dependency Download** (via `MODRINTH_DOWNLOAD_DEPENDENCIES` in config.env):

| Setting | Behavior |
|---------|----------|
| `required` | Download required dependencies automatically **(DEFAULT)** |
| `optional` | Download required + optional dependencies |
| `none` | Don't download dependencies (manual management) |

---

### Backup Management

```bash
# World backup (GitHub)
mcctl backup init                    # Interactive GitHub backup setup
mcctl backup status                  # Show backup config
mcctl backup push                    # Backup to GitHub
mcctl backup push -m "message"       # With commit message
mcctl backup history                 # Show backup history
mcctl backup restore [commit]        # Restore from backup

# Server config backup
mcctl server-backup <server>         # Backup server config
mcctl server-backup <server> --list  # List backups
mcctl server-backup <server> -m "msg"  # With message
mcctl server-restore <server>        # Interactive restore
mcctl server-restore <server> <id>   # Restore specific backup
mcctl server-restore <server> --dry-run  # Preview changes
```

---

### Migration

```bash
mcctl migrate status              # Check migration status
mcctl migrate worlds              # Interactive migration
mcctl migrate worlds --all        # Migrate all servers
mcctl migrate worlds --dry-run    # Preview changes
mcctl migrate worlds --backup     # Create backup before migration
```

---

### Console Management (Management Console)

#### Initialization

```bash
mcctl console init                # Initialize console service (interactive)
mcctl console init --force        # Reinitialize (stops services, cleans config)
mcctl console init --api-port 8001 --console-port 8000  # Custom ports
```

**Interactive init flow:**

1. Select services to install (mcctl-api, mcctl-console via multiselect)
2. Admin username (required only if console selected)
3. Admin password (min 8 chars, uppercase + lowercase + number)
4. API access mode (internal / api-key / ip-whitelist / api-key-ip / open)
5. API key generated (if api-key or api-key-ip mode)
6. IP whitelist (if ip-whitelist or api-key-ip mode)
7. Generates PM2 ecosystem.config.cjs
8. Saves configuration (.mcctl-admin.yml)

**Files created after init:**

| File | Location | Description |
|------|----------|-------------|
| `.mcctl-admin.yml` | `~/minecraft-servers/` | Admin service configuration |
| `users.yaml` | `~/minecraft-servers/` | User credentials (hashed) |
| `ecosystem.config.cjs` | `~/minecraft-servers/platform/` | PM2 process config |

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
mcctl console service stop --force    # Force kill PM2 processes

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

#### User Management

```bash
mcctl console user list                  # List console users
mcctl console user add <name>            # Add user (interactive password prompt)
mcctl console user add <name> --role viewer --password "Pass123"
mcctl console user remove <name>         # Remove user
mcctl console user reset-password <name> # Reset password
mcctl console user update <name> --role admin  # Change role
```

**User roles:**

| Role | Permissions |
|------|------------|
| `admin` | Full access: manage servers, users, settings |
| `viewer` | Read-only: view status, logs (no start/stop/create/delete) |

#### API Key Management

```bash
mcctl console api status               # Show API access mode and config
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
mcctl console remove --keep-config    # Keep config files
```

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

---

### Self Update

```bash
mcctl update                    # Update CLI to latest version
mcctl update --check            # Check for updates only
mcctl update --force            # Force check (ignore cache)
mcctl update --yes              # Auto-confirm update
mcctl update --all              # Update CLI + all installed services
mcctl update --check --all      # Check updates for CLI and services
```

The `--all` flag updates mcctl-api, mcctl-console, and @minecraft-docker/shared via `npm install <pkg>@latest` and restarts their PM2 processes automatically.

---

## 6. Server Types

### mcctl Supported Types (9 types)

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

### Modpack Platforms

| Platform | Environment Variable | Description |
|----------|---------------------|-------------|
| `AUTO_CURSEFORGE` | `CF_API_KEY`, `CF_SLUG` | Automatic CurseForge modpack installation |
| `MODRINTH` | `MODRINTH_MODPACK`, `MODRINTH_LOADER`, `MODRINTH_VERSION` | Modrinth modpack installation with dynamic loader detection |
| `FTBA` | `FTB_MODPACK_ID` | Feed The Beast modpacks |
| `CUSTOM` | `CUSTOM_SERVER` | Custom server JAR URL or path |

**MODRINTH Modpack Server** (v1.14.0+): When creating a MODRINTH server via interactive CLI, the system:

1. Prompts for **modpack slug** (e.g., `cobblemon`, `adrenaserver`)
2. Queries Modrinth API to detect **supported loaders** dynamically (e.g., if a modpack only supports `fabric` and `quilt`, then `forge` and `neoforge` are excluded from the selection)
3. Prompts for **mod loader** selection (auto-detect, or choose from available loaders: `forge`, `fabric`, `neoforge`, `quilt`)
4. Prompts for **modpack version** (leave empty for latest)
5. Skips Minecraft version prompt (determined by the modpack)
6. Defaults memory to `6G` (modpacks are heavier than standard servers)

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
| `CF_API_KEY` | Yes | CurseForge API key |
| `CF_PAGE_URL` / `CF_SLUG` | Yes (one) | Modpack URL or slug |
| `CF_FILE_ID` | No | Specific file/version ID |
| `CF_EXCLUDE_MODS` | No | Mods to exclude |

---

## 7. Configuration

### Global Configuration (.env)

Located at `~/minecraft-servers/.env`:

```bash
# Network
HOST_IP=192.168.1.100               # Your server's IP
HOST_IPS=192.168.1.100,100.64.0.5   # Multiple IPs (VPN mesh)
MINECRAFT_NETWORK=minecraft-net
MINECRAFT_SUBNET=172.28.0.0/16

# Defaults
DEFAULT_MEMORY=4G
DEFAULT_VERSION=LATEST
TZ=UTC
RCON_PASSWORD=changeme

# mc-router Settings
AUTO_SCALE_UP=true                   # Auto-start on connect
AUTO_SCALE_DOWN=true                 # Auto-stop idle
AUTO_SCALE_DOWN_AFTER=10m            # Idle timeout
DOCKER_TIMEOUT=120                   # Start timeout (seconds)
AUTO_SCALE_ASLEEP_MOTD=Server is sleeping. Connect to wake up!

# Backup (GitHub)
BACKUP_GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
BACKUP_GITHUB_REPO=username/minecraft-worlds-backup
BACKUP_GITHUB_BRANCH=main
BACKUP_AUTO_ON_STOP=true

# CurseForge (for mods)
CF_API_KEY=your-api-key

# Audit Logs
AUDIT_AUTO_CLEANUP=true
AUDIT_RETENTION_DAYS=90
```

### Server Configuration (config.env)

Each server has a `config.env` at `servers/<name>/config.env`:

```bash
# Required
EULA=TRUE
TYPE=PAPER
VERSION=1.21.1

# Memory
MEMORY=4G

# Game Settings
MOTD=Welcome to my server!
MAX_PLAYERS=20
DIFFICULTY=normal
GAMEMODE=survival
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

### Key Environment Variables Reference

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
| `MODE` / `GAMEMODE` | `survival` | `survival`, `creative`, `adventure`, `spectator` |
| `MAX_PLAYERS` | `20` | Maximum concurrent players |
| `PVP` | `true` | Enable PvP |
| `LEVEL` | `world` | World save folder name |
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
| `RCON_PASSWORD` | - | RCON password (inherited from platform .env) |
| `RCON_PASSWORD_FILE` | - | Read password from file (Docker Secrets) |
| `RCON_PORT` | `25575` | RCON port |

#### Mods and Plugins

**Modrinth:**

| Variable | Default | Description |
|----------|---------|-------------|
| `MODRINTH_PROJECTS` | - | Project slugs (comma/newline separated) |
| `MODRINTH_DOWNLOAD_DEPENDENCIES` | `none` | `required`, `optional`, `none` |
| `MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE` | `release` | `release`, `beta`, `alpha` |

**CurseForge:**

| Variable | Description |
|----------|-------------|
| `CF_API_KEY` | CurseForge API key (required) |
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

Management Console provides a REST API on port 5001.

### Authentication

```bash
# API Key (recommended)
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers

# Basic Auth
curl -u admin:password http://localhost:5001/api/servers
```

**5 Authentication Modes:**

| Mode | Description | Use Case |
|------|-------------|----------|
| `internal` | Local network only (default) | Home/local deployment |
| `api-key` | X-API-Key header required | Automation, scripts |
| `ip-whitelist` | IP-based access control | Known client IPs |
| `api-key-ip` | Both API key AND IP required | Maximum security |
| `open` | No authentication | Development only |

### All Endpoints

**Health:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

**Servers:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servers` | List all servers |
| POST | `/api/servers` | Create new server |
| GET | `/api/servers/:name` | Get server details |
| DELETE | `/api/servers/:name` | Delete server |
| POST | `/api/servers/:name/start` | Start server |
| POST | `/api/servers/:name/stop` | Stop server |
| POST | `/api/servers/:name/restart` | Restart server |
| POST | `/api/servers/:name/exec` | Execute RCON command |
| GET | `/api/servers/:name/logs` | Get logs (supports SSE with `?stream=true`) |
| GET | `/api/servers/:name/config` | Get server configuration |
| PUT | `/api/servers/:name/config` | Update server configuration |
| POST | `/api/servers/:name/world/reset` | Reset server world |

**SSE (Server-Sent Events):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sse/servers-status` | Stream all server statuses (real-time) |

**Router:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/router/status` | Get mc-router status and routes |

**Players:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servers/:name/players` | List online players |
| GET | `/api/players/:username` | Get player info from Mojang |

**Whitelist:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servers/:name/whitelist` | Get whitelist |
| POST | `/api/servers/:name/whitelist` | Add to whitelist |
| DELETE | `/api/servers/:name/whitelist/:player` | Remove from whitelist |

**Bans:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servers/:name/bans` | Get banned players |
| POST | `/api/servers/:name/bans` | Ban player |
| DELETE | `/api/servers/:name/bans/:player` | Unban player |

**Operators:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servers/:name/ops` | Get operators |
| POST | `/api/servers/:name/ops` | Add operator |
| DELETE | `/api/servers/:name/ops/:player` | Remove operator |

**Kick:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/servers/:name/kick` | Kick player |

**Worlds:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/worlds` | List all worlds |
| POST | `/api/worlds` | Create world |
| GET | `/api/worlds/:name` | Get world details |
| DELETE | `/api/worlds/:name` | Delete world |
| POST | `/api/worlds/:name/assign` | Assign world to server |
| POST | `/api/worlds/:name/release` | Release world lock |

**Backup:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/backup/status` | Get backup config status |
| POST | `/api/backup/push` | Push backup to GitHub |
| GET | `/api/backup/history` | Get backup history |
| POST | `/api/backup/restore` | Restore from backup |

**Audit:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit` | List audit logs (with filtering) |
| GET | `/api/audit/stats` | Audit log statistics |
| GET | `/api/audit/:id` | Get audit log detail |
| DELETE | `/api/audit` | Purge old audit logs |
| GET | `/api/audit/stream` | SSE stream: real-time audit events |

**Swagger:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/docs` | OpenAPI/Swagger documentation |

### Example: List Servers

```bash
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers
```

### Example: Execute Command

```bash
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"command": "list"}' \
  http://localhost:5001/api/servers/survival/exec
```

### Example: Create Server

```bash
# Standard server
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"name": "survival", "type": "PAPER", "version": "1.21.1", "memory": "4G"}' \
  http://localhost:5001/api/servers

# MODRINTH modpack server (v1.14.0+)
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cobblemon",
    "type": "MODRINTH",
    "memory": "6G",
    "modpack": "cobblemon-modpack",
    "modLoader": "fabric",
    "modpackVersion": ""
  }' \
  http://localhost:5001/api/servers
```

**Create Server request body fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Server name |
| `type` | string | No | Server type (default: `PAPER`). Use `MODRINTH` for modpacks |
| `version` | string | No | Minecraft version (default: `LATEST`) |
| `memory` | string | No | Memory allocation (default: `4G`) |
| `modpack` | string | No | Modrinth modpack slug, ID, or URL (required for `MODRINTH` type) |
| `modpackVersion` | string | No | Specific modpack version ID (empty for latest) |
| `modLoader` | string | No | Mod loader override: `forge`, `fabric`, `neoforge`, `quilt` (empty for auto-detect) |
| `seed` | string | No | World seed |
| `worldUrl` | string | No | Download world from a ZIP URL |
| `worldName` | string | No | Use existing world from worlds/ |
| `autoStart` | boolean | No | Start server after creation (default: `true`) |
| `sudoPassword` | string | No | Sudo password for mDNS registration |

### Example: Start/Stop/Restart Server

```bash
curl -X POST -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers/survival/start
curl -X POST -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers/survival/stop
curl -X POST -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers/survival/restart
```

### Example: Get Server Logs

```bash
# Static logs (last N lines)
curl -H "X-API-Key: mctk_xxx" "http://localhost:5001/api/servers/survival/logs?lines=50"

# SSE streaming logs
curl -N -H "X-API-Key: mctk_xxx" "http://localhost:5001/api/servers/survival/logs?stream=true"
```

### Example: Player Management via API

```bash
# Get online players
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers/survival/players

# Whitelist operations
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"player": "Steve"}' \
  http://localhost:5001/api/servers/survival/whitelist

curl -X DELETE -H "X-API-Key: mctk_xxx" \
  http://localhost:5001/api/servers/survival/whitelist/Steve

# Ban/Unban
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"player": "Griefer", "reason": "Griefing"}' \
  http://localhost:5001/api/servers/survival/bans

# Kick
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"player": "Troublemaker", "reason": "Breaking rules"}' \
  http://localhost:5001/api/servers/survival/kick

# Operator management
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"player": "TrustedPlayer"}' \
  http://localhost:5001/api/servers/survival/ops
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

# Assign world to server
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"server": "survival"}' \
  http://localhost:5001/api/worlds/newworld/assign

# Release world lock
curl -X POST -H "X-API-Key: mctk_xxx" \
  http://localhost:5001/api/worlds/newworld/release

# Delete world
curl -X DELETE -H "X-API-Key: mctk_xxx" \
  http://localhost:5001/api/worlds/newworld
```

### Example: SSE Real-time Status

```bash
# Stream all server statuses (Server-Sent Events)
curl -N -H "X-API-Key: mctk_xxx" http://localhost:5001/api/sse/servers-status

# Output format:
# data: {"servers":[{"name":"survival","status":"running","players":3,"maxPlayers":20},...]}
```

### Example: Audit Logs via API

```bash
# List audit logs with filtering
curl -H "X-API-Key: mctk_xxx" \
  "http://localhost:5001/api/audit?action=server.create&limit=20"

# Get audit statistics
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/audit/stats

# Stream real-time audit events
curl -N -H "X-API-Key: mctk_xxx" http://localhost:5001/api/audit/stream
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

**Server Object:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Server name |
| `type` | string | Server type (PAPER, FORGE, etc.) |
| `version` | string | Minecraft version |
| `status` | string | `running`, `stopped`, `starting`, `not_created` |
| `players` | number | Online player count |
| `maxPlayers` | number | Maximum players |
| `memory` | string | Allocated memory |
| `hostname` | string | Connection hostname |
| `uptime` | string | Container uptime |
| `health` | string | `healthy`, `unhealthy`, `starting` |

**Audit Log Object:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID |
| `action` | string | e.g., `server.create`, `player.whitelist.add` |
| `actor` | string | e.g., `cli:local`, `api:admin` |
| `target` | string | Server or player name |
| `status` | string | `success`, `failure` |
| `details` | object | Additional context |
| `createdAt` | string | ISO 8601 timestamp |

---

## 9. Web Console (mcctl-console)

### Overview

mcctl-console is a Next.js web application providing a modern UI for managing Minecraft servers.

**Key Technologies:**
- Next.js 14+ (App Router)
- React 18+ with MUI 5.x (Material UI)
- Better Auth for session-based authentication
- React Query for data fetching and caching
- SSE (Server-Sent Events) for real-time updates

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
2. Better Auth handles user sessions securely
3. Type-safe shared TypeScript interfaces
4. React Query provides optimistic updates and caching

### Pages and Features

#### Dashboard (`/`)

- Server cards showing: name, type, version, status, players, hostname
- Quick action buttons: Start / Stop / Restart per server
- Real-time status via SSE (no polling)
- Create Server dialog with type, version, memory, world options (supports Standard and Modpack modes)
  - **Standard mode**: Select server type (PAPER, FORGE, etc.), version, memory
  - **Modpack mode** (v1.14.0+): Enter Modrinth modpack slug, select mod loader (forge/fabric/neoforge/quilt), specify version
- Recent Activity Feed from audit logs
- Changelog Feed from GitHub releases

**Status indicators:**

| Color | Meaning |
|-------|---------|
| Green | Running, healthy |
| Yellow | Starting, health check in progress |
| Red | Stopped, unhealthy |
| Gray | Not created, unknown |

#### Server Detail (`/servers/:name`)

- **Overview Tab**: Container info, uptime, memory, world name/size
- **Players Tab**: Online player list with Mojang skins
- **Console Tab**: RCON command execution with output display
- **Logs Tab**: Real-time server logs viewer
- **Options Tab** (v1.11+): Server configuration editing via web UI
- **Activity Tab** (v1.10+): Per-server audit log history
- **Delete**: MoreVert menu with delete confirmation dialog

#### Worlds Page (`/worlds`)

- World list with: name, size, lock status, assigned server
- Create new world with seed option
- Assign world to server (shows non-running servers only)
- Release world lock
- Delete world with confirmation
- World reset functionality with safety checks

#### Audit Logs Page (`/audit-logs`)

- Filterable audit log table: action, actor, target, status, date
- Statistics overview (total events, actions breakdown)
- Detail view for individual entries
- Export functionality
- SSE real-time streaming of new events

#### Routing Page (`/routing`) (v1.13+)

- Avahi mDNS monitoring
- Hostname routing configuration

### BFF Proxy Routes

| Console Route | Method | mcctl-api Route | Description |
|---------------|--------|-----------------|-------------|
| `/api/servers` | GET | `/api/servers` | List servers |
| `/api/servers` | POST | `/api/servers` | Create server |
| `/api/servers/:name` | GET | `/api/servers/:name` | Server details |
| `/api/servers/:name` | DELETE | `/api/servers/:name` | Delete server |
| `/api/servers/:name/start` | POST | `/api/servers/:name/start` | Start |
| `/api/servers/:name/stop` | POST | `/api/servers/:name/stop` | Stop |
| `/api/servers/:name/restart` | POST | `/api/servers/:name/restart` | Restart |
| `/api/servers/:name/exec` | POST | `/api/servers/:name/exec` | RCON exec |
| `/api/servers/:name/logs` | GET | `/api/servers/:name/logs` | Logs |
| `/api/servers/:name/config` | GET/PUT | `/api/servers/:name/config` | Config |
| `/api/servers/:name/world/reset` | POST | `/api/servers/:name/world/reset` | Reset world |
| `/api/worlds` | GET/POST | `/api/worlds` | List/Create worlds |
| `/api/worlds/:name` | GET/DELETE | `/api/worlds/:name` | World detail/delete |
| `/api/worlds/:name/assign` | POST | `/api/worlds/:name/assign` | Assign world |
| `/api/worlds/:name/release` | POST | `/api/worlds/:name/release` | Release world |
| `/api/audit` | GET | `/api/audit` | Audit logs |
| `/api/audit/stats` | GET | `/api/audit/stats` | Audit stats |
| `/api/sse/servers-status` | GET | `/api/sse/servers-status` | SSE status |

### React Query Hooks

```typescript
// Server hooks
useServers()                    // List all servers (auto-refresh 10s)
useServer(name)                 // Get server details (auto-refresh 5s)
useCreateServer()               // Create server mutation
useDeleteServer()               // Delete server mutation
useStartServer()                // Start server mutation
useStopServer()                 // Stop server mutation
useRestartServer()              // Restart server mutation
useExecCommand()                // Execute RCON command
useServerLogs(name, lines)      // Get server logs (auto-refresh 3s)
useServersSSE()                 // SSE real-time server status stream
useServerStatus(name)           // Individual server SSE status

// World hooks
useWorlds()                     // List all worlds (auto-refresh 30s)
useWorld(name)                  // Get world details
useCreateWorld()                // Create world mutation
useAssignWorld()                // Assign world mutation
useReleaseWorld()               // Release world mutation
useDeleteWorld()                // Delete world mutation

// Audit hooks
useAuditLogs(filters)           // List audit logs with filtering
useAuditStats()                 // Audit log statistics
```

### Web Console Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCCTL_API_URL` | mcctl-api URL (internal) | `http://localhost:5001` |
| `MCCTL_API_KEY` | API key for authentication | Required |
| `BETTER_AUTH_SECRET` | Session encryption secret | Auto-generated |
| `BETTER_AUTH_URL` | Console URL for auth | `http://localhost:5000` |
| `PORT` | Console listening port | `5000` |
| `HOSTNAME` | Console listening host | `0.0.0.0` |
| `MCCTL_ROOT` | Platform root directory | `~/minecraft-servers` |

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
CF_API_KEY=${CF_API_KEY}
CURSEFORGE_FILES=jei,journeymap,jade
```

Formats: slug (`jei`), ID (`238222`), slug:FileID (`jei:4593548`), URL

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
| 1.21+ | Java 21 | `java21` or `latest` |
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

**Available Image Tags:**

| Tag | Java Version | amd64 | arm64 | armv7 |
|-----|-------------|:-----:|:-----:|:-----:|
| `latest`, `stable` | Java 25 | Yes | Yes | No |
| `java21` | Java 21 | Yes | Yes | No |
| `java17` | Java 17 | Yes | Yes | Yes |
| `java11` | Java 11 | Yes | Yes | No |
| `java8` | Java 8 | Yes | Yes | No |
| `java21-graalvm` | GraalVM 21 | Yes | Yes | No |
| `java17-graalvm` | GraalVM 17 | Yes | Yes | No |

### Volume Mounts

| Container Path | Purpose | Notes |
|----------------|---------|-------|
| `/data` | All server data (world, config, logs) | Required - persistent storage |
| `/plugins` | Plugin JARs (Paper/Spigot) | Optional - `:ro` for read-only |
| `/mods` | Mod JARs (Forge/Fabric) | Optional - `:ro` for read-only |
| `/config` | Mod configuration files | Optional |

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
| :25566 |           | :25567 |           | :25568 |
+--------+           +--------+           +--------+
```

### Routing Methods

**1. Docker Auto-Discovery (Recommended for Docker Compose):**

```yaml
services:
  mc-router:
    image: itzg/mc-router
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

### Auto-Scaling Configuration

| Flag | Environment Variable | Default | Description |
|------|---------------------|---------|-------------|
| `-auto-scale-up` | `AUTO_SCALE_UP` | `false` | Start stopped containers on connect |
| `-auto-scale-down` | `AUTO_SCALE_DOWN` | `false` | Stop idle containers |
| `-auto-scale-down-after` | `AUTO_SCALE_DOWN_AFTER` | `10m` | Idle timeout before stopping |
| `-docker-timeout` | `DOCKER_TIMEOUT` | `60` | Seconds to wait for container start |
| `-auto-scale-asleep-motd` | `AUTO_SCALE_ASLEEP_MOTD` | `Server is sleeping...` | MOTD for sleeping servers |

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

### Basic Paper Server with mc-router

```yaml
services:
  router:
    image: itzg/mc-router
    command: --in-docker --auto-scale-up --auto-scale-down
    ports:
      - "25565:25565"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

  mc-survival:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.21.1"
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
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.21.1"
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
mcctl create survival -t PAPER -v 1.21.1
mcctl config survival MOTD "Welcome friends!"
mcctl config survival DIFFICULTY hard
mcctl config survival MAX_PLAYERS 10
mcctl op survival add YourName
# Connect: survival.<HOST_IP>.nip.io:25565
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

### 4. Share World Between Servers

```bash
mcctl world list
mcctl stop oldserver
mcctl world release myworld
mcctl world assign myworld mc-newserver
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
# Edit .env:
HOST_IPS=192.168.1.100,100.64.0.5  # LAN IP + Tailscale IP
mcctl router restart
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
# Enter admin username and password
# Choose API access mode
mcctl console service start
# Select: "API + Console"
# Web Console: http://localhost:5000
# REST API: http://localhost:5001
# Swagger Docs: http://localhost:5001/docs
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
# Update everything (CLI + API + Console)
mcctl update --all --yes

# Or update manually
mcctl console service stop
npm update -g @minecraft-docker/mcctl
mcctl console service start
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

**Error:** `Docker is not installed or not running`

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
| Port conflict | Address already in use | Check if another service uses the port |

#### Can't Connect to Server

```bash
# 1. Check mc-router is running
mcctl status
# mc-router should show "running" and "healthy"

# 2. Check server status
mcctl status myserver

# 3. Try different connection methods
# nip.io: server.192.168.1.100.nip.io:25565
# mDNS:   server.local:25565
# Direct: 192.168.1.100:25565
```

#### mDNS Not Working

**Linux:**
```bash
sudo apt install avahi-daemon
sudo systemctl enable --now avahi-daemon
```

**Windows:** Install Bonjour Print Services from Apple

**Fallback:** Use nip.io hostname instead of .local

#### World Already Locked

**Error:** `World 'myworld' is already locked by 'mc-otherserver'`

```bash
mcctl world release myworld --force
mcctl world assign myworld mc-myserver
```

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

- Check prerequisites: `mcctl console init` validates Node.js, PM2, Docker
- Verify PM2: `pm2 --version`
- Check ecosystem config: `ls ~/minecraft-servers/platform/ecosystem.config.cjs`
- View PM2 logs: `pm2 logs mcctl-api` or `pm2 logs mcctl-console`
- Check port conflicts: `netstat -tlnp | grep -E "5000|5001"`

#### mcctl-console shows "not installed (skipping)"

- Install console package: `npm install @minecraft-docker/mcctl-console` in `~/minecraft-servers/`
- Or reinitialize: `mcctl console init --force` and select mcctl-console
- Verify: `ls ~/minecraft-servers/node_modules/@minecraft-docker/mcctl-console/`

#### API connection issues

- Check service: `mcctl console service status`
- Verify API key (shown only once during init)
- Test health: `curl http://localhost:5001/health`
- Check access mode: `mcctl console api status`

#### Can't log in to Web Console

- Verify user: `mcctl console user list`
- Reset password: `mcctl console user reset-password admin`
- Check Better Auth config in ecosystem config
- View logs: `mcctl console service logs -f`

#### PM2 process keeps restarting

- Check crashes: `pm2 logs mcctl-api --lines 100`
- Verify dependencies: `cd ~/minecraft-servers && npm ls @minecraft-docker/mcctl-api`
- PM2 restarts at 500MB by default
- Force restart: `mcctl console service restart --force`

#### SSE not working (real-time updates)

- Ensure mcctl-api is running
- Check if proxy/firewall blocks SSE connections
- Verify: `curl -N http://localhost:5001/api/sse/servers-status`

#### World management issues

- Ensure server is stopped before world reset
- Check world locks: `mcctl world list`
- Release stuck locks: `mcctl world release <world>`

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
| `class file version 65.0` | Java 21 required | Use `java21` image tag |
| `Unsupported class file major version` | Java too high for Forge | Use `java8` for Forge 1.16.5 and below |
| Mods fail to load | Version mismatch | Check mod docs for Java requirements |

**Diagnosis:**
```bash
mcctl logs <server>
# Look for "class file version" or "Unsupported" errors
```

**Fix steps:**
1. Check the Java version matrix in Section 10
2. Edit the server's docker-compose.yml to use the correct image tag
3. For Forge 1.16.5 and below, you **must** use `java8`

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

# 3. Check RCON password is set
grep RCON_PASSWORD ~/minecraft-servers/.env
```

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

**Note:** In mcctl, auto-scaling is handled by mc-router (not autopause/autostop). Use mc-router's AUTO_SCALE_UP/DOWN for automatic start/stop.

### CurseForge Mod Download Failures

**Symptoms:**
- "API key required" errors
- Mods fail to download from CurseForge
- 403 Forbidden errors

**Fix:**
1. Set `CF_API_KEY` in `~/minecraft-servers/.env`:
   ```bash
   CF_API_KEY=your-curseforge-api-key
   ```
2. Get a key from [CurseForge for Studios](https://console.curseforge.com/)
3. Some mods are restricted from third-party downloads; use manual download

### Common config.env Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Missing `EULA=TRUE` | Server exits immediately | Should be automatic with mcctl |
| `TYPE` misspelled | Server starts as Vanilla | Check type name (case sensitive) |
| Quotes around values | Unexpected behavior | In config.env, **do not** wrap values in quotes |
| Spaces around `=` | Variable not read | Use `KEY=value` not `KEY = value` |
| Forgetting `EXTRA_ARGS=--universe /worlds/` | Worlds in wrong directory | Set for shared world storage |

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
A: Default: `~/minecraft-servers/`. Use `--root` to change.

**Q: How many servers can I run?**
A: Unlimited, limited only by system resources.

**Q: What are the system requirements?**
A: Node.js >= 18.0.0, Docker Engine >= 24.0.0, Docker Compose >= 2.20.0. PM2 is bundled with mcctl.

### Server

**Q: What server types are supported?**
A: PAPER, VANILLA, FORGE, NEOFORGE, FABRIC, SPIGOT, BUKKIT, PURPUR, QUILT. Plus itzg supports PUFFERFISH, FOLIA, LEAF, MOHIST, ARCLIGHT, MAGMA_MAINTAINED, KETTING, SPONGEVANILLA, AUTO_CURSEFORGE, MODRINTH, FTBA, CUSTOM.

**Q: What's the default server type?**
A: PAPER - a high-performance fork with plugin support.

**Q: How do I change Minecraft version?**
A: `mcctl config myserver VERSION 1.20.4` then restart.

**Q: Do servers auto-start?**
A: Yes, with mc-router auto-scaling, servers start when a player connects.

**Q: Do servers auto-stop?**
A: Yes, after 10 minutes of no players (configurable via `AUTO_SCALE_DOWN_AFTER`).

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
A: Yes. Get one from console.curseforge.com and set `CF_API_KEY` in .env.

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
A: Server configuration files (config.env, docker-compose.yml), not world data.

**Q: Is a GitHub account required for backups?**
A: Only for the GitHub backup feature. Manual backups don't require it.

### World

**Q: Can I share a world between servers?**
A: Yes. Release the world lock and assign to another server.

**Q: What happens when I delete a server?**
A: World data is preserved in the worlds/ directory.

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
A: `mcctl console init` then `mcctl console service start`.

**Q: What access modes are available?**
A: `internal` (default), `api-key`, `ip-whitelist`, `api-key-ip`, `open`.

**Q: Where is the API documentation?**
A: `http://localhost:5001/docs` (Swagger/OpenAPI).

**Q: Can I run just the API without the Web Console?**
A: Yes. During `mcctl console init`, select only `mcctl-api`. Or use `mcctl console service start --api`.

**Q: How does service selection work?**
A: Since v1.13.0, `mcctl console service start/stop/restart` shows interactive prompt when both services are installed. Console always requires API. Use `--api` or `--console` flags to skip prompt.

**Q: How do I check if the console is running?**
A: `mcctl console service status`

**Q: How do I view console logs?**
A: `mcctl console service logs` or `mcctl console service logs -f` for real-time.

**Q: How does SSE work in the Web Console?**
A: Server-Sent Events provide real-time status updates without polling. Endpoint: `GET /api/sse/servers-status`.

### Performance

**Q: How do I optimize performance?**
A: Use `mcctl config <server> USE_AIKAR_FLAGS true`. For modded servers, increase MEMORY to 6-8G. Reduce VIEW_DISTANCE and SIMULATION_DISTANCE.

**Q: What are Aikar flags?**
A: Recommended JVM garbage collection tuning for Minecraft. Reduces GC pause times.

### Audit Log

**Q: What are audit logs?**
A: Track all operations (create, delete, start, stop, player management). View with `mcctl audit list` or in Web Console. Auto-cleanup removes logs older than 90 days.

**Q: How do I configure audit retention?**
A: Set `AUDIT_RETENTION_DAYS` (default: 90) and `AUDIT_AUTO_CLEANUP` (default: true) in .env.

**Q: What actions are tracked?**
A: `server.create`, `server.delete`, `server.start`, `server.stop`, `server.restart`, `player.whitelist.add`, `player.whitelist.remove`, `player.ban.add`, `player.ban.remove`, `player.op.add`, `player.op.remove`, `player.kick`, `world.create`, `world.assign`, `world.release`, `world.delete`, `backup.push`, `backup.restore`, `console.init`, `console.user.add`, `console.user.remove`.

**Q: Where is the audit database stored?**
A: SQLite database at `~/minecraft-servers/audit.db` using WAL mode for concurrent read/write.

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
A: Yes, via VPN (Tailscale, ZeroTier) or port forwarding. Set HOST_IPS with your VPN IP.

**Q: How does Tailscale/ZeroTier work with mcctl?**
A: Add your VPN IP to HOST_IPS in .env, restart router. Friends connect via `server.<vpn-ip>.nip.io:25565`.

**Q: Can I use a custom domain instead of nip.io?**
A: Yes. Point your domain's DNS A record to the server IP, then set the hostname in mc-router labels.

**Q: Why is nip.io recommended over mDNS?**
A: nip.io works everywhere without client setup. mDNS requires avahi-daemon (Linux) or Bonjour (macOS/Windows) on both server and client.

**Q: Can I have a default server (no hostname needed)?**
A: Configure mc-router with `--default-server` flag or set the `DEFAULT_SERVER` environment variable pointing to a backend server.

### Migration and Updates

**Q: How do I update mcctl?**
A: `mcctl update --yes` or `npm update -g @minecraft-docker/mcctl`.

**Q: How do I update everything (CLI + services)?**
A: `mcctl update --all --yes`. This updates mcctl, mcctl-api, mcctl-console, and shared packages.

**Q: Do I need to stop servers before updating?**
A: No. Minecraft server containers are independent of mcctl. Only Management Console services are restarted during `--all` update.

**Q: How do I migrate from an old version?**
A: `mcctl migrate status` to check, then `mcctl migrate worlds --all` to fix known issues (v1.6.8-1.6.11 world storage bug).

---

## 16. Version History

### Version 2.1.0 (2026-02-09) - Console Feature Completion

**Added:**
- Modrinth modpack CLI/API support - full modpack server creation and management (#244, #245)
- Admin user management Console UI - list, detail, role management (#189)
- OP Level domain model with levels 1-4 and semantic descriptions (#284)
- OP Level CLI commands: `mcctl op set <player> --level <1-4>` with interactive mode (#285)
- OP Level REST API: `PUT /api/servers/:name/ops/:player/level` (#286)
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
- All-Servers SSE Status Endpoint (`GET /api/sse/servers-status`)
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
- Server Config API (`GET/PUT /api/servers/:name/config`)
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

### Version 1.6.8 ~ 1.6.11 (Critical Bug: World Storage Location)

!!! warning "Critical Bug - Affects v1.6.8 ~ v1.6.11"
    Servers created with these versions store worlds in wrong directory.

**Issue:** Missing `EXTRA_ARGS=--universe /worlds/` in npm package template

**Symptoms:**
- World data stored in `servers/<name>/data/` instead of `worlds/`
- Server creates new world on every restart
- World sharing doesn't work

**Detection:**
```bash
ls ~/minecraft-servers/servers/*/data/*/level.dat 2>/dev/null
```

**Solution:**
```bash
# Option 1: Automated migration (recommended)
mcctl migrate status
mcctl migrate worlds --all

# Option 2: Manual fix
echo 'EXTRA_ARGS=--universe /worlds/' >> ~/minecraft-servers/servers/<name>/config.env
mcctl stop <name>
mv ~/minecraft-servers/servers/<name>/data/<world> ~/minecraft-servers/worlds/<world>
mcctl start <name>
```

### Version 1.6.0 ~ 1.6.7

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
| **CurseForge** | Popular mod hosting platform (requires API key) |
| **Spiget** | API for SpigotMC plugin resources |
| **Auto-scale** | mc-router feature that starts/stops servers based on player activity |
| **World lock** | Mechanism preventing simultaneous server access to a world |
| **ecosystem.config.cjs** | PM2 configuration file generated by `mcctl console init` |
| **Access Mode** | API authentication method (internal, api-key, ip-whitelist, api-key-ip, open) |
| **BFF** | Backend-for-Frontend pattern used by mcctl-console to proxy mcctl-api |
| **SSE** | Server-Sent Events for real-time streaming (server status, audit logs) |
| **Better Auth** | Authentication library used by mcctl-console for session management |

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

*This document was generated as a comprehensive knowledge base for LLM agent consumption. Version 1.13.0, last updated 2026-02-07.*
