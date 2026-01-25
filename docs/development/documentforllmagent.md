# mcctl - Minecraft Server Management CLI Knowledge Base

> **Purpose**: This document serves as a comprehensive knowledge base for LLM agents (ChatGPT, Gemini, Claude) to understand and answer questions about mcctl, a Docker-based Minecraft server management tool.

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Architecture](#architecture)
5. [Complete Command Reference](#complete-command-reference)
6. [Configuration](#configuration)
7. [Common Use Cases](#common-use-cases)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)
10. [Reference Documentation](#reference-documentation)
    - [itzg/minecraft-server](#itzgminecraft-server)
    - [mc-router](#mc-router)
11. [Glossary](#glossary)

---

## Overview

### What is mcctl?

**mcctl** (Minecraft Control) is a command-line interface (CLI) tool for managing Docker-based Minecraft Java Edition servers. It provides a unified interface for:

- Creating and managing multiple Minecraft servers
- Automatic hostname-based routing via mc-router
- World management with locking/sharing between servers
- Player management (operators, whitelist, bans)
- Mod/plugin management from multiple sources (Modrinth, CurseForge, Spiget)
- Backup and restore functionality
- Auto-scaling (servers start on connect, stop when idle)

### Key Features

| Feature | Description |
|---------|-------------|
| **Multi-Server** | Run multiple Minecraft servers simultaneously |
| **Single Port** | All servers accessible via port 25565 with hostname routing |
| **Auto-Scale** | Servers start on client connect, stop after idle timeout |
| **mDNS Discovery** | Clients auto-discover servers via Bonjour/Zeroconf |
| **Zero Resources** | Only ~40MB RAM used when servers are idle |
| **Interactive CLI** | Guided prompts for all operations |
| **Mod Management** | Install mods from Modrinth, CurseForge, Spiget, or direct URLs |

### Package Information

- **npm Package**: `@minecraft-docker/mcctl`
- **Current Version**: 0.1.0
- **Repository**: Part of the minecraft-server-manager monorepo
- **License**: Open source
- **Dependencies**: Docker, Docker Compose, Node.js 18+

---

## Installation

### Prerequisites

Before installing mcctl, ensure you have:

| Requirement | Minimum Version | Check Command |
|-------------|-----------------|---------------|
| Docker Engine | 20.10+ | `docker --version` |
| Docker Compose | v2.0+ | `docker compose version` |
| Node.js | 18.0.0+ | `node --version` |
| npm or pnpm | npm 8+ or pnpm 8+ | `npm --version` |

### Installation Methods

#### Method 1: npm (Recommended)

```bash
npm install -g @minecraft-docker/mcctl
```

#### Method 2: pnpm

```bash
pnpm add -g @minecraft-docker/mcctl
```

#### Method 3: From Source

```bash
git clone https://github.com/smallmiro/minecraft-server-manager.git
cd minecraft-server-manager
pnpm install
pnpm build
cd platform/services/cli
pnpm link --global
```

### Verify Installation

```bash
mcctl --version
# Output: mcctl version 0.1.0

mcctl --help
# Shows complete command reference
```

---

## Quick Start

### Step 1: Initialize Platform

```bash
mcctl init
```

This creates the platform directory structure at `~/minecraft-servers/`:

```
~/minecraft-servers/
├── docker-compose.yml      # Main orchestration
├── .env                    # Global configuration
├── servers/                # Server configurations
│   ├── compose.yml         # Server include list
│   └── _template/          # Template for new servers
├── worlds/                 # Shared world storage
├── shared/                 # Shared plugins/mods
│   ├── plugins/
│   └── mods/
├── scripts/                # Management scripts
└── backups/                # Backup storage
```

### Step 2: Create Your First Server

```bash
# Interactive mode (recommended for beginners)
mcctl create

# CLI mode with options
mcctl create myserver -t PAPER -v 1.21.1
```

### Step 3: Start Infrastructure

```bash
mcctl up
```

### Step 4: Connect via Minecraft

Use one of these connection methods:

| Method | Address | Requirements |
|--------|---------|--------------|
| **nip.io** (Recommended) | `myserver.192.168.1.100.nip.io:25565` | Internet access |
| **mDNS** | `myserver.local:25565` | avahi-daemon/Bonjour |
| **Direct IP** | `192.168.1.100:25565` | None (fallback) |

Replace `192.168.1.100` with your server's HOST_IP from `.env`.

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Minecraft Clients                        │
│                   (Connect via hostname)                    │
└────────────────────────┬────────────────────────────────────┘
                         │ Port 25565
┌────────────────────────▼────────────────────────────────────┐
│                    mc-router                                 │
│  - Hostname-based routing (survival.local, creative.local)  │
│  - Auto-scale up (start servers on connect)                 │
│  - Auto-scale down (stop idle servers)                      │
└────────────────────────┬────────────────────────────────────┘
                         │ Docker Network
┌────────────────────────▼────────────────────────────────────┐
│              Minecraft Servers (Docker Containers)          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ mc-survival  │  │ mc-creative  │  │ mc-modded    │       │
│  │ (Paper)      │  │ (Vanilla)    │  │ (Forge)      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  Shared Storage                              │
│  ├── worlds/        (Shared world data)                     │
│  ├── shared/plugins/ (Shared plugins)                       │
│  └── shared/mods/    (Shared mods)                          │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Purpose |
|-----------|---------|
| **mc-router** | Routes connections by hostname, handles auto-scaling |
| **avahi-daemon** | System mDNS service for .local hostname discovery |
| **itzg/minecraft-server** | Docker image running Minecraft servers |
| **mcctl** | CLI tool for management operations |

---

## Complete Command Reference

### Global Options

These options work with all commands:

| Option | Short | Description |
|--------|-------|-------------|
| `--root <path>` | | Custom data directory (default: ~/minecraft-servers) |
| `--json` | | Output in JSON format |
| `--help` | `-h` | Show help |
| `--version` | | Show version |
| `--sudo-password <pwd>` | | Sudo password for mDNS operations |

**Environment Variable**: `MCCTL_SUDO_PASSWORD` - Alternative to `--sudo-password`

---

### Infrastructure Commands

#### mcctl init

Initialize the platform directory structure.

**Syntax:**
```bash
mcctl init [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--root <path>` | Custom data directory |
| `--skip-validation` | Skip Docker validation |
| `--skip-docker` | Skip Docker check |

**Examples:**
```bash
# Initialize in default location
mcctl init

# Initialize in custom location
mcctl --root /opt/minecraft init
```

**What it creates:**
- docker-compose.yml
- .env file with defaults
- Directory structure (servers/, worlds/, shared/, scripts/, backups/)
- Docker network: minecraft-net

---

#### mcctl up

Start all infrastructure (mc-router + all Minecraft servers).

**Syntax:**
```bash
mcctl up
```

**Equivalent to:** `docker compose up -d`

---

#### mcctl down

Stop all infrastructure and remove network.

**Syntax:**
```bash
mcctl down
```

**Equivalent to:** `docker compose down`

---

#### mcctl router

Manage mc-router independently.

**Syntax:**
```bash
mcctl router <action>
```

**Actions:**

| Action | Description |
|--------|-------------|
| `start` | Start mc-router only |
| `stop` | Stop mc-router only |
| `restart` | Restart mc-router (required after .env changes) |

**Examples:**
```bash
mcctl router start
mcctl router stop
mcctl router restart
```

---

### Server Commands

#### mcctl create

Create a new Minecraft server.

**Syntax:**
```bash
mcctl create [name] [options]
```

**Options:**

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--type` | `-t` | Server type | PAPER |
| `--version` | `-v` | Minecraft version | LATEST |
| `--seed` | `-s` | World seed | Random |
| `--world-url` | `-u` | Download world from ZIP URL | - |
| `--world` | `-w` | Use existing world from worlds/ | - |
| `--no-start` | | Create without starting | - |
| `--sudo-password` | | Sudo password for mDNS | - |

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

**Examples:**
```bash
# Interactive mode
mcctl create

# Paper server with default settings
mcctl create myserver

# Forge server with specific version
mcctl create modded -t FORGE -v 1.20.4

# With world seed
mcctl create survival -t PAPER -v 1.21.1 -s 12345

# Using existing world
mcctl create legacy -w old-world -v 1.20.4

# Create without starting
mcctl create test --no-start

# Automation with sudo password
MCCTL_SUDO_PASSWORD=secret mcctl create myserver
```

---

#### mcctl delete

Delete a server (preserves world data).

**Syntax:**
```bash
mcctl delete [name] [options]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--force` | `-y` | Skip confirmation, delete even with players online |
| `--sudo-password` | | Sudo password for mDNS deregistration |

**Examples:**
```bash
# Interactive (shows server list)
mcctl delete

# Delete specific server
mcctl delete myserver

# Force delete
mcctl delete myserver --force
```

**Important:** World data is preserved in the worlds/ directory.

---

#### mcctl status

Show status of all servers.

**Syntax:**
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
```bash
# Basic status
mcctl status

# Detailed status
mcctl status --detail

# Real-time monitoring
mcctl status --watch

# Custom refresh interval
mcctl status --watch --interval 2

# Single server status
mcctl status myserver

# mc-router status
mcctl status router

# JSON output
mcctl status --json
```

---

#### mcctl start

Start a stopped server or all servers.

**Syntax:**
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
mcctl start myserver
mcctl start --all
```

---

#### mcctl stop

Stop a running server or all servers.

**Syntax:**
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
mcctl stop myserver
mcctl stop --all
```

---

#### mcctl logs

View server logs.

**Syntax:**
```bash
mcctl logs <name> [options]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--follow` | `-f` | Follow log output |
| `--lines` | `-n` | Number of lines to show |

**Examples:**
```bash
mcctl logs myserver
mcctl logs myserver -f
mcctl logs myserver -n 100
```

---

#### mcctl console

Connect to server RCON console.

**Syntax:**
```bash
mcctl console <name>
```

**Example:**
```bash
mcctl console myserver
# > list
# > say Hello everyone!
# Press Ctrl+C to exit
```

---

#### mcctl exec

Execute a single RCON command on a server.

**Syntax:**
```bash
mcctl exec <server> <command...>
```

**Examples:**
```bash
mcctl exec myserver say "Hello everyone!"
mcctl exec myserver list
mcctl exec myserver give Steve diamond 64
mcctl exec myserver weather clear
mcctl exec myserver time set day
mcctl exec myserver tp Steve Alex
```

---

#### mcctl config

View or modify server configuration.

**Syntax:**
```bash
mcctl config <server> [key] [value] [options]
```

**Shortcut Options:**

| Option | Description |
|--------|-------------|
| `--cheats` | Enable cheats (ALLOW_CHEATS=true) |
| `--no-cheats` | Disable cheats |
| `--pvp` | Enable PvP |
| `--no-pvp` | Disable PvP |
| `--command-block` | Enable command blocks |
| `--no-command-block` | Disable command blocks |

**Examples:**
```bash
# View all config
mcctl config myserver

# View specific key
mcctl config myserver MOTD

# Set value
mcctl config myserver MOTD "Welcome to my server!"
mcctl config myserver MAX_PLAYERS 50
mcctl config myserver MEMORY 8G

# Use shortcuts
mcctl config myserver --cheats
mcctl config myserver --no-pvp
mcctl config myserver --command-block
```

---

### Player Management Commands

#### mcctl op

Manage server operators.

**Syntax:**
```bash
mcctl op <server> <action> [player]
```

**Actions:**

| Action | Description |
|--------|-------------|
| `list` | Show current operators |
| `add <player>` | Add operator (updates RCON + config.env) |
| `remove <player>` | Remove operator |

**Examples:**
```bash
mcctl op myserver list
mcctl op myserver add Steve
mcctl op myserver remove Steve
```

---

#### mcctl whitelist

Manage server whitelist.

**Syntax:**
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

**Examples:**
```bash
mcctl whitelist myserver list
mcctl whitelist myserver add Steve
mcctl whitelist myserver remove Steve
mcctl whitelist myserver on
mcctl whitelist myserver off
mcctl whitelist myserver status
```

---

#### mcctl ban

Manage player and IP bans.

**Syntax:**
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

**Examples:**
```bash
mcctl ban myserver list
mcctl ban myserver add Griefer "Griefing spawn area"
mcctl ban myserver remove Griefer
mcctl ban myserver ip list
mcctl ban myserver ip add 192.168.1.100 "Spam"
mcctl ban myserver ip remove 192.168.1.100
```

---

#### mcctl kick

Kick a player from the server.

**Syntax:**
```bash
mcctl kick <server> <player> [reason]
```

**Examples:**
```bash
mcctl kick myserver Steve
mcctl kick myserver Steve "AFK too long"
```

---

#### mcctl player

Unified player management (interactive mode).

**Syntax:**
```bash
mcctl player                       # Full interactive mode
mcctl player <server>              # Interactive for specific server
mcctl player info <name>           # Player info lookup
mcctl player info <name> --offline # Offline UUID calculation
mcctl player online <server>       # List online players
mcctl player online --all          # All servers
mcctl player cache stats           # Cache statistics
mcctl player cache clear           # Clear cache
```

**Options:**

| Option | Description |
|--------|-------------|
| `--offline` | Calculate offline-mode UUID |
| `--all` | Show all servers (for online) |
| `--json` | JSON output |

**Examples:**
```bash
# Interactive workflow
mcctl player
# 1. Select server
# 2. Select player
# 3. Choose action (op, whitelist, ban, kick, info)

# Player info lookup
mcctl player info Notch
mcctl player info Steve --offline

# Online players
mcctl player online myserver
mcctl player online --all

# Cache management
mcctl player cache stats
mcctl player cache clear
```

---

### World Management Commands

#### mcctl world list

List all worlds with lock status.

**Syntax:**
```bash
mcctl world list [--json]
```

**Example Output:**
```
Worlds:
  survival-world
    Status: locked (mc-survival)
    Size: 514.0MB
    Path: /home/user/minecraft-servers/worlds/survival-world

  creative-world
    Status: unlocked
    Size: 128.5MB
```

---

#### mcctl world new

Create a new world directory.

**Syntax:**
```bash
mcctl world new [name] [options]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--seed` | `-s` | World seed for generation |
| `--server` | | Server to assign world to |
| `--no-start` | | Don't auto-start server |

**Examples:**
```bash
# Interactive
mcctl world new

# Create with seed
mcctl world new myworld --seed 12345

# Create and assign to server
mcctl world new myworld --server myserver

# Create with seed, assign, don't start
mcctl world new myworld --seed 12345 --server myserver --no-start
```

---

#### mcctl world assign

Lock a world to a server.

**Syntax:**
```bash
mcctl world assign [world] [server]
```

**Examples:**
```bash
# Interactive
mcctl world assign

# CLI mode
mcctl world assign survival mc-myserver
```

---

#### mcctl world release

Release a world lock.

**Syntax:**
```bash
mcctl world release [world] [--force]
```

**Examples:**
```bash
# Interactive
mcctl world release

# CLI mode
mcctl world release survival
mcctl world release survival --force
```

---

#### mcctl world delete

Permanently delete a world.

**Syntax:**
```bash
mcctl world delete [world] [options]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--force` | `-f` | Skip confirmation |
| `--json` | | JSON output |

**WARNING:** This permanently deletes all world data. Cannot be undone.

**Examples:**
```bash
mcctl world delete
mcctl world delete old-world
mcctl world delete old-world --force
```

---

### Mod Management Commands

#### mcctl mod search

Search for mods on Modrinth.

**Syntax:**
```bash
mcctl mod search <query> [--json]
```

**Examples:**
```bash
mcctl mod search sodium
mcctl mod search "world generation"
mcctl mod search lithium --json
```

---

#### mcctl mod add

Add mods to a server configuration.

**Syntax:**
```bash
mcctl mod add <server> <mod...> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--modrinth` | Use Modrinth (default) |
| `--curseforge` | Use CurseForge (requires CF_API_KEY) |
| `--spiget` | Use Spiget (SpigotMC plugins) |
| `--url` | Direct JAR URL download |
| `--force` | Add even if mod not found |
| `--json` | JSON output |

**Examples:**
```bash
# Modrinth (default)
mcctl mod add myserver sodium
mcctl mod add myserver sodium lithium phosphor

# CurseForge
mcctl mod add myserver --curseforge jei journeymap

# Spiget (SpigotMC)
mcctl mod add myserver --spiget 9089  # EssentialsX

# Direct URL
mcctl mod add myserver --url https://example.com/mod.jar
```

**⚠️ Important: Automatic Dependency Download**

Mods often require other mods as dependencies. By default, dependencies are **automatically downloaded** via `MODRINTH_DOWNLOAD_DEPENDENCIES=required` in `config.env`.

| Setting | Behavior |
|---------|----------|
| `required` | Download required dependencies automatically **(DEFAULT)** |
| `optional` | Download required + optional dependencies |
| `none` | Don't download dependencies (manual management) |

**Example**: Adding `iris` automatically downloads `sodium` (required dependency) on server start.

---

#### mcctl mod list

List configured mods for a server.

**Syntax:**
```bash
mcctl mod list <server> [--json]
```

**Example:**
```bash
mcctl mod list myserver
```

---

#### mcctl mod remove

Remove mods from a server configuration.

**Syntax:**
```bash
mcctl mod remove <server> <mod...> [--json]
```

**Examples:**
```bash
mcctl mod remove myserver sodium
mcctl mod remove myserver sodium lithium phosphor
```

---

#### mcctl mod sources

Display available mod sources.

**Syntax:**
```bash
mcctl mod sources [--json]
```

---

### Backup Commands

#### mcctl backup status

Show backup configuration status.

**Syntax:**
```bash
mcctl backup status [--json]
```

---

#### mcctl backup push

Push world data to GitHub repository.

**Syntax:**
```bash
mcctl backup push [options]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--message` | `-m` | Commit message |

**Examples:**
```bash
# Interactive
mcctl backup push

# CLI mode
mcctl backup push -m "Before server upgrade"
```

---

#### mcctl backup history

Show backup history.

**Syntax:**
```bash
mcctl backup history [--json]
```

---

#### mcctl backup restore

Restore world data from a backup.

**Syntax:**
```bash
mcctl backup restore [commit]
```

**Examples:**
```bash
# Interactive
mcctl backup restore

# CLI mode
mcctl backup restore abc1234
```

**WARNING:** Restore overwrites current world data.

---

### Server Backup Commands

#### mcctl server-backup

Backup server configuration (config.env, docker-compose.yml).

**Syntax:**
```bash
mcctl server-backup <server> [options]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--message` | `-m` | Backup description |
| `--list` | | List all backups for server |
| `--json` | | JSON output |

**Examples:**
```bash
mcctl server-backup myserver
mcctl server-backup myserver -m "Before upgrade"
mcctl server-backup myserver --list
```

---

#### mcctl server-restore

Restore server configuration from backup.

**Syntax:**
```bash
mcctl server-restore <server> [backup-id] [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation |
| `--dry-run` | Preview without changes |
| `--json` | JSON output |

**Examples:**
```bash
mcctl server-restore myserver
mcctl server-restore myserver abc123
mcctl server-restore myserver abc123 --dry-run
```

---

### Migration Commands

#### mcctl migrate status

Check migration status for all servers.

**Syntax:**
```bash
mcctl migrate status [--json]
```

---

#### mcctl migrate worlds

Migrate worlds to shared /worlds/ directory structure.

**Syntax:**
```bash
mcctl migrate worlds [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--all` | Migrate all servers |
| `--dry-run` | Preview changes without applying |
| `--backup` | Create backup before migration |
| `--force` | Skip confirmation |

**Examples:**
```bash
mcctl migrate status
mcctl migrate worlds
mcctl migrate worlds --all
mcctl migrate worlds --dry-run
mcctl migrate worlds --all --backup
```

---

## Configuration

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
AUTO_SCALE_UP=true                  # Auto-start on connect
AUTO_SCALE_DOWN=true                # Auto-stop idle
AUTO_SCALE_DOWN_AFTER=10m           # Idle timeout
DOCKER_TIMEOUT=120                  # Start timeout (seconds)
AUTO_SCALE_ASLEEP_MOTD=Server is sleeping. Connect to wake up!

# Backup (GitHub)
BACKUP_GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
BACKUP_GITHUB_REPO=username/minecraft-worlds-backup
BACKUP_GITHUB_BRANCH=main
BACKUP_AUTO_ON_STOP=true

# CurseForge (for mods)
CF_API_KEY=your-api-key
```

### Server Configuration (config.env)

Each server has a config.env at `servers/<name>/config.env`:

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

# World
LEVEL=myserver
SEED=12345

# Players
OPS=Steve,Alex
ENABLE_WHITELIST=false

# Mods/Plugins
MODRINTH_PROJECTS=sodium,lithium
CURSEFORGE_FILES=jei,journeymap
SPIGET_RESOURCES=9089

# Performance
USE_AIKAR_FLAGS=true
VIEW_DISTANCE=10
```

### Key Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EULA` | Accept Minecraft EULA | TRUE |
| `TYPE` | Server type (PAPER, FORGE, etc.) | PAPER |
| `VERSION` | Minecraft version | LATEST |
| `MEMORY` | JVM heap memory | 4G |
| `MOTD` | Server message | - |
| `MAX_PLAYERS` | Maximum players | 20 |
| `DIFFICULTY` | Game difficulty (peaceful, easy, normal, hard) | easy |
| `GAMEMODE` | Default mode (survival, creative, adventure, spectator) | survival |
| `PVP` | Enable PvP | true |
| `LEVEL` | World/level name | Auto |
| `SEED` | World generation seed | Random |
| `OPS` | Operator usernames (comma-separated) | - |
| `ENABLE_WHITELIST` | Enable whitelist | false |
| `USE_AIKAR_FLAGS` | Enable Aikar's JVM optimizations | false |

---

## Common Use Cases

### Use Case 1: Create a Survival Server for Friends

**Q: How do I create a survival server my friends can join?**

```bash
# 1. Initialize (first time only)
mcctl init

# 2. Create server
mcctl create survival -t PAPER -v 1.21.1

# 3. Configure
mcctl config survival MOTD "Welcome friends!"
mcctl config survival DIFFICULTY hard
mcctl config survival MAX_PLAYERS 10

# 4. Add yourself as operator
mcctl op survival add YourName

# 5. Check connection info
mcctl status survival
# Friends connect via: survival.192.168.1.100.nip.io:25565
```

---

### Use Case 2: Set Up a Modded Forge Server

**Q: How do I create a Forge server with mods?**

```bash
# 1. Create Forge server
mcctl create modded -t FORGE -v 1.20.4

# 2. Add mods from CurseForge
# First, set CF_API_KEY in ~/.minecraft-servers/.env
mcctl mod add modded --curseforge jei journeymap create

# 3. Allocate more memory (mods need more)
mcctl config modded MEMORY 8G

# 4. Restart to apply
mcctl stop modded && mcctl start modded
```

---

### Use Case 3: Share a World Between Servers

**Q: How do I use the same world on different servers?**

```bash
# 1. Check world status
mcctl world list

# 2. Release world from current server
mcctl world release myworld

# 3. Assign to new server
mcctl world assign myworld mc-newserver

# 4. Start new server
mcctl start newserver
```

---

### Use Case 4: Backup Before Major Changes

**Q: How do I backup before upgrading?**

```bash
# 1. Backup server configuration
mcctl server-backup myserver -m "Before 1.22 upgrade"

# 2. Backup world data to GitHub
mcctl backup push -m "Pre-upgrade backup"

# 3. Make changes...

# 4. If something goes wrong, restore:
mcctl server-restore myserver
mcctl backup restore abc1234
```

---

### Use Case 5: Remote Access via VPN

**Q: How do I let friends connect over the internet?**

```bash
# Option 1: Use Tailscale/ZeroTier
# 1. Install Tailscale on server and clients
# 2. Edit .env:
HOST_IPS=192.168.1.100,100.64.0.5  # LAN IP + Tailscale IP

# 3. Restart router
mcctl router restart

# Friends connect via: myserver.100.64.0.5.nip.io:25565

# Option 2: Port forwarding
# Forward port 25565 on your router to your server's IP
```

---

### Use Case 6: Add Players to Whitelist

**Q: How do I enable whitelist and add players?**

```bash
# 1. Enable whitelist
mcctl whitelist myserver on

# 2. Add players
mcctl whitelist myserver add Steve
mcctl whitelist myserver add Alex

# 3. Check status
mcctl whitelist myserver list
mcctl whitelist myserver status
```

---

### Use Case 7: Optimize Performance

**Q: How do I improve server performance?**

```bash
# 1. Use Paper (optimized fork)
mcctl create optimized -t PAPER -v 1.21.1

# 2. Enable Aikar's flags
mcctl config optimized USE_AIKAR_FLAGS true

# 3. Allocate appropriate memory
mcctl config optimized MEMORY 6G

# 4. Adjust view distance
mcctl config optimized VIEW_DISTANCE 8
mcctl config optimized SIMULATION_DISTANCE 8

# 5. For Fabric, add performance mods
mcctl mod add optimized sodium lithium phosphor
```

---

## Troubleshooting

### Common Issues and Solutions

#### Platform Not Initialized

**Error:** `Platform not initialized. Run: mcctl init`

**Solution:**
```bash
mcctl init
```

---

#### Docker Not Running

**Error:** `Docker is not installed or not running`

**Solution:**
```bash
# Start Docker
sudo systemctl start docker

# Or on macOS/Windows: Start Docker Desktop
```

---

#### Server Won't Start

**Check logs:**
```bash
mcctl logs myserver -n 100
```

**Common causes:**
1. EULA not accepted - should be automatic with mcctl
2. Wrong Java version - check server type compatibility
3. Insufficient memory - increase MEMORY setting
4. Port conflict - check if another service uses 25565

---

#### Can't Connect to Server

**Checklist:**
```bash
# 1. Check mc-router is running
mcctl status
# mc-router should show "running" and "healthy"

# 2. Check server status
mcctl status myserver

# 3. Verify hostname
# Use the hostname from status output
```

**Connection methods:**
- nip.io: `server.192.168.1.100.nip.io:25565`
- mDNS: `server.local:25565`
- Direct IP: `192.168.1.100:25565`

---

#### mDNS Not Working

**Linux:**
```bash
sudo apt install avahi-daemon
sudo systemctl enable --now avahi-daemon
```

**Windows:**
Install Bonjour Print Services from Apple

**Fallback:**
Use nip.io hostname instead of .local

---

#### World Already Locked

**Error:** `World 'myworld' is already locked by 'mc-otherserver'`

**Solution:**
```bash
# Release lock
mcctl world release myworld --force

# Reassign
mcctl world assign myworld mc-myserver
```

---

#### Out of Memory

**Error:** Server crashes or runs slowly

**Solution:**
```bash
mcctl config myserver MEMORY 8G
mcctl stop myserver && mcctl start myserver
```

**Recommendations:**
- Vanilla: 2-4G
- Paper: 4-6G
- Modded: 6-12G depending on modpack

---

## FAQ

### General Questions

**Q: What is mcctl?**
A: mcctl is a CLI tool for managing Docker-based Minecraft servers. It uses itzg/minecraft-server Docker images and mc-router for hostname-based routing.

**Q: What Minecraft editions does it support?**
A: Java Edition only. Bedrock Edition is not currently supported.

**Q: Where is data stored?**
A: Default location is `~/minecraft-servers/`. Use `--root` option to change.

**Q: How many servers can I run?**
A: Unlimited, limited only by your system resources.

---

### Server Questions

**Q: What server types are supported?**
A: PAPER, VANILLA, FORGE, NEOFORGE, FABRIC, SPIGOT, BUKKIT, PURPUR, QUILT

**Q: What's the default server type?**
A: PAPER - a high-performance fork with plugin support.

**Q: How do I change Minecraft version?**
A: `mcctl config myserver VERSION 1.20.4` then restart the server.

**Q: Do servers auto-start?**
A: Yes! With mc-router, servers start when a player connects.

**Q: Do servers auto-stop?**
A: Yes, after 10 minutes of no players (configurable via AUTO_SCALE_DOWN_AFTER).

---

### Connection Questions

**Q: What port do I use?**
A: Always 25565. mc-router handles routing to the correct server.

**Q: Why can't I connect with just IP?**
A: mc-router needs a hostname to know which server to route to. Use nip.io or mDNS.

**Q: What is nip.io?**
A: A magic DNS service. `server.192.168.1.100.nip.io` resolves to `192.168.1.100`.

**Q: Do clients need mDNS/avahi?**
A: Only for .local hostnames. nip.io works without any client setup.

---

### Mod/Plugin Questions

**Q: How do I add mods?**
A: Use `mcctl mod add <server> <mod-slug>` for Modrinth mods, or specify other sources.

**Q: What mod sources are supported?**
A: Modrinth (default), CurseForge, Spiget (SpigotMC), and direct URLs.

**Q: Do I need an API key for CurseForge?**
A: Yes. Get one from console.curseforge.com and set CF_API_KEY in .env.

**Q: Where are mods stored?**
A: Downloaded automatically by the server container based on config.env settings.

**Q: Are mod dependencies downloaded automatically?**
A: Yes! By default, `MODRINTH_DOWNLOAD_DEPENDENCIES=required` is set in config.env. This means when you add a mod like `iris`, its required dependency `sodium` is automatically downloaded on server start.

**Q: How do I disable automatic dependency download?**
A: Set `MODRINTH_DOWNLOAD_DEPENDENCIES=none` in your server's config.env file.

**Q: What dependency options are available?**
A: Three options:
- `required` - Download required dependencies only (DEFAULT, RECOMMENDED)
- `optional` - Download required + optional dependencies
- `none` - Don't download dependencies (manual management)

---

### Backup Questions

**Q: What does backup include?**
A: The `worlds/` directory with all world data.

**Q: What does server-backup include?**
A: Server configuration files (config.env, docker-compose.yml), not world data.

**Q: Is a GitHub account required for backups?**
A: Only for the GitHub backup feature. You can also use manual backups.

---

### World Questions

**Q: Can I share a world between servers?**
A: Yes! Release the world lock and assign to another server.

**Q: What happens when I delete a server?**
A: World data is preserved in the worlds/ directory.

**Q: How do I import an existing world?**
A: Place it in `~/minecraft-servers/worlds/` and use `mcctl create --world <name>`.

---

## Reference Documentation

This section provides essential information from the official itzg/minecraft-server and mc-router documentation for LLM agents to accurately answer technical questions about the underlying Docker infrastructure.

---

### itzg/minecraft-server

The `itzg/minecraft-server` Docker image is the core component that runs Minecraft Java Edition servers. It handles automatic version management, mod/plugin installation, and server configuration.

#### Supported Server Types

| Type | Description | Plugins | Mods | Best For |
|------|-------------|:-------:|:----:|----------|
| `VANILLA` | Official Mojang server | No | No | Pure vanilla experience |
| `PAPER` | High-performance Spigot fork | Yes | No | Production servers (recommended) |
| `SPIGOT` | Modified Bukkit server | Yes | No | Plugin compatibility |
| `BUKKIT` | Classic plugin server | Yes | No | Legacy support |
| `PURPUR` | Paper fork with extra features | Yes | No | Advanced customization |
| `PUFFERFISH` | Performance-optimized Paper fork | Yes | No | High player counts |
| `FOLIA` | Multi-threaded Paper fork | Yes | No | Large worlds, many entities |
| `FORGE` | Mod server for Forge mods | No | Yes | Forge modpacks |
| `NEOFORGE` | Modern Forge fork (1.20.1+) | No | Yes | Modern Forge mods |
| `FABRIC` | Lightweight mod loader | No | Yes | Performance mods |
| `QUILT` | Fabric-compatible loader | No | Yes | Modern modding |
| `MOHIST` | Forge + Bukkit hybrid | Yes | Yes | Mods with plugins |
| `ARCLIGHT` | Multi-loader hybrid | Yes | Yes | Flexible hybrid |
| `MAGMA_MAINTAINED` | Forge + Bukkit hybrid | Yes | Yes | Stable hybrid |

**Modpack Platforms:**

| Platform | Environment Variable | Description |
|----------|---------------------|-------------|
| `AUTO_CURSEFORGE` | `CF_API_KEY`, `CF_SLUG` | Automatic CurseForge modpack installation |
| `MODRINTH` | `MODRINTH_MODPACK` | Modrinth modpack installation |
| `FTBA` | `FTB_MODPACK_ID` | Feed The Beast modpacks |

---

#### Key Environment Variables

**Essential Variables:**

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `EULA` | **Yes** | - | Must be `TRUE` to accept Minecraft EULA |
| `TYPE` | No | `VANILLA` | Server type (see table above) |
| `VERSION` | No | `LATEST` | Minecraft version (e.g., `1.21.1`, `1.20.4`) |
| `MEMORY` | No | `1G` | JVM heap memory (e.g., `4G`, `8G`) |

**Server Settings:**

| Variable | Default | Description |
|----------|---------|-------------|
| `MOTD` | - | Server message of the day |
| `DIFFICULTY` | `easy` | Game difficulty: `peaceful`, `easy`, `normal`, `hard` |
| `MODE` | `survival` | Default game mode: `survival`, `creative`, `adventure`, `spectator` |
| `MAX_PLAYERS` | `20` | Maximum concurrent players |
| `PVP` | `true` | Enable player vs player combat |
| `LEVEL` | `world` | World save folder name |
| `SEED` | Random | World generation seed |
| `VIEW_DISTANCE` | - | Server view distance (chunks) |
| `SIMULATION_DISTANCE` | - | Simulation distance (chunks) |
| `SPAWN_PROTECTION` | `16` | Spawn protection radius (0 to disable) |

**Memory Configuration:**

| Variable | Description |
|----------|-------------|
| `MEMORY` | Sets both initial and max heap (e.g., `4G`) |
| `INIT_MEMORY` | Initial heap size (separate from max) |
| `MAX_MEMORY` | Maximum heap size (separate from initial) |

Format: `<size>[g|G|m|M|k|K]` or percentage `<size>%`

**Player Management:**

| Variable | Description |
|----------|-------------|
| `OPS` | Operator usernames (comma-separated) |
| `OPS_FILE` | Path/URL to ops file |
| `ENABLE_WHITELIST` | Enable whitelist (`true`/`false`) |
| `WHITELIST` | Whitelisted players (comma-separated) |
| `WHITELIST_FILE` | Path/URL to whitelist file |

**RCON (Remote Console):**

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_RCON` | `true` | Enable RCON protocol |
| `RCON_PASSWORD` | - | RCON authentication password |
| `RCON_PASSWORD_FILE` | - | Read password from file (Docker Secrets) |
| `RCON_PORT` | `25575` | RCON port |

**JVM Optimization:**

| Variable | Description |
|----------|-------------|
| `USE_AIKAR_FLAGS` | Enable Aikar's GC tuning (recommended for Paper) |
| `USE_MEOWICE_FLAGS` | Updated JVM flags |
| `USE_MEOWICE_GRAALVM_FLAGS` | GraalVM-specific optimizations |
| `USE_SIMD_FLAGS` | SIMD optimization flags |

**Debugging:**

| Variable | Description |
|----------|-------------|
| `DEBUG` | Enable verbose logging |
| `DEBUG_EXEC` | Show server start command |
| `DEBUG_MEMORY` | Memory allocation debugging |

---

#### Mod/Plugin Sources

**Modrinth (Recommended):**

```yaml
environment:
  MODRINTH_PROJECTS: |
    fabric-api
    lithium
    sodium
    iris
  MODRINTH_DOWNLOAD_DEPENDENCIES: required  # none, required, optional
  MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE: release  # release, beta, alpha
```

**Version Specifiers:**
- `mod-slug` - Latest release
- `mod-slug:version_id` - Specific version
- `mod-slug:beta` - Latest beta
- `mod-slug:release` - Latest release

**CurseForge:**

```yaml
environment:
  CF_API_KEY: "${CF_API_KEY}"  # Required from console.curseforge.com
  CURSEFORGE_FILES: |
    jei
    journeymap
    jade
```

**CurseForge Formats:**
- Project slug: `jei`
- Project ID: `238222`
- Slug:FileID: `jei:4593548`
- Project URL: `https://www.curseforge.com/minecraft/mc-mods/jei`

**Spiget (SpigotMC Plugins):**

```yaml
environment:
  SPIGET_RESOURCES: "9089,34315"  # Resource IDs from SpigotMC URLs
```

**Direct URLs:**

```yaml
environment:
  MODS: |
    https://example.com/mod1.jar
    https://example.com/mod2.jar
  MODS_FILE: "/data/mods.txt"  # File containing URLs
```

**Mod Cleanup:**

| Variable | Description |
|----------|-------------|
| `REMOVE_OLD_MODS` | `TRUE` to clean up old mod versions |
| `REMOVE_OLD_MODS_INCLUDE` | Pattern to include (e.g., `*.jar`) |
| `REMOVE_OLD_MODS_EXCLUDE` | Pattern to exclude |

---

#### Java Version Requirements

| Minecraft Version | Minimum Java | Recommended Image Tag |
|-------------------|--------------|----------------------|
| 1.21+ | Java 21 | `java21` or `latest` |
| 1.20.5 - 1.20.6 | Java 21 | `java21` |
| 1.18 - 1.20.4 | Java 17 | `java17` or `java21` |
| 1.17 | Java 16 | `java17` |
| 1.12 - 1.16.5 | Java 8 | `java8` or `java11` |
| 1.11 and below | Java 8 | `java8` |

**Forge-Specific Requirements:**

| Forge Version | Required Java | Image Tag |
|---------------|---------------|-----------|
| Forge 1.20.5+ | Java 21 | `java21` |
| Forge 1.18 - 1.20.4 | Java 17 | `java17` |
| Forge 1.17.x | Java 16/17 | `java17` |
| **Forge 1.16.5 and below** | **Java 8** | `java8` **(required)** |

**Available Image Tags:**

| Tag | Java Version | Architectures |
|-----|--------------|---------------|
| `latest`, `stable` | Java 25 | amd64, arm64 |
| `java21` | Java 21 | amd64, arm64 |
| `java17` | Java 17 | amd64, arm64, armv7 |
| `java11` | Java 11 | amd64, arm64 |
| `java8` | Java 8 | amd64, arm64 |
| `java21-graalvm` | GraalVM 21 | amd64, arm64 |

---

#### Volume Mounts

| Container Path | Purpose | Recommended Mount |
|----------------|---------|-------------------|
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
| `SKIP_CHOWN_DATA` | `false` | Skip ownership changes (for pre-configured permissions) |

---

#### Autopause / Autostop

**Autopause** - Pauses the server process when no players are online:

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AUTOPAUSE` | `false` | Enable autopause feature |
| `AUTOPAUSE_TIMEOUT_EST` | `3600` | Seconds after last player leaves |
| `AUTOPAUSE_TIMEOUT_INIT` | `600` | Seconds after start with no connections |
| `AUTOPAUSE_PERIOD` | `10` | Status check interval |
| `MAX_TICK_TIME` | - | Set to `-1` to disable watchdog (recommended) |

**Autostop** - Completely stops the container when idle:

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AUTOSTOP` | `false` | Enable autostop feature |
| `AUTOSTOP_TIMEOUT_EST` | `3600` | Seconds after last player leaves |
| `AUTOSTOP_TIMEOUT_INIT` | `1800` | Seconds after start with no connections |
| `AUTOSTOP_PERIOD` | `10` | Status check interval |

**Comparison:**

| Feature | Autopause | Autostop |
|---------|-----------|----------|
| Behavior | Pauses JVM process | Stops container |
| Recovery | Instant resume | Requires container restart |
| Resource Savings | Medium (CPU only) | High (CPU + most memory) |
| Best For | Quick response needed | Maximum savings |

---

#### Environment Variable Interpolation

The server supports dynamic configuration through variable substitution:

**Syntax:** `${CFG_VARIABLE_NAME}`

| Variable | Default | Description |
|----------|---------|-------------|
| `REPLACE_ENV_IN_PLACE` | `true` | Enable variable replacement in config files |
| `REPLACE_ENV_VARIABLE_PREFIX` | `CFG_` | Prefix for replaceable variables |
| `REPLACE_ENV_DURING_SYNC` | `false` | Replace in synced `/plugins`, `/mods`, `/config` |
| `REPLACE_ENV_VARIABLES_EXCLUDES` | - | Files to exclude from replacement |
| `REPLACE_ENV_VARIABLES_EXCLUDE_PATHS` | - | Paths to exclude |

**Supported File Types:** `.yml`, `.yaml`, `.txt`, `.cfg`, `.conf`, `.properties`

**Secret Files:** Append `_FILE` to variable name to read from mounted file:
```yaml
environment:
  RCON_PASSWORD_FILE: /run/secrets/rcon_password
```

---

### mc-router

**mc-router** is a connection multiplexer that enables multiple Minecraft servers to share a single IP address and port (25565) using hostname-based routing.

#### Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Minecraft Clients                        │
│        (Connect to server.example.com:25565)                │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    mc-router (:25565)                       │
│  - Reads hostname from Minecraft handshake packet          │
│  - Routes to correct backend server                        │
│  - Handles auto-scaling (start/stop containers)            │
└────────────────────────┬────────────────────────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    ▼                    ▼                    ▼
┌─────────┐        ┌─────────┐        ┌─────────┐
│ Server1 │        │ Server2 │        │ Server3 │
│ :25566  │        │ :25567  │        │ :25568  │
└─────────┘        └─────────┘        └─────────┘
```

#### Routing Methods

**1. Command-Line Mapping:**
```bash
mc-router -mapping "server1.example.com=mc-server1:25565,server2.example.com=mc-server2:25565"
```

**2. JSON Configuration File:**
```json
{
  "default-server": "vanilla:25565",
  "mappings": {
    "survival.example.com": "mc-survival:25565",
    "creative.example.com": "mc-creative:25565"
  }
}
```

**3. Docker Auto-Discovery (Recommended for Docker Compose):**

Set `-in-docker` flag and use Docker labels:

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
      - "mc-router.host=survival.local"
      - "mc-router.port=25565"
```

**Docker Labels:**

| Label | Description |
|-------|-------------|
| `mc-router.host` | External hostname(s), comma-separated |
| `mc-router.port` | Backend port (default: 25565) |
| `mc-router.auto-scale-up` | Per-container override for auto-scale-up |
| `mc-router.auto-scale-down` | Per-container override for auto-scale-down |

**4. Kubernetes Service Discovery:**

```yaml
metadata:
  annotations:
    "mc-router.itzg.me/externalServerName": "survival.example.com"
    "mc-router.itzg.me/defaultServer": "true"
```

---

#### Configuration

**Key Environment Variables / Flags:**

| Flag | Environment Variable | Default | Description |
|------|---------------------|---------|-------------|
| `-port` | `PORT` | `25565` | Listen port |
| `-default` | `DEFAULT` | - | Default backend server |
| `-in-docker` | - | - | Enable Docker auto-discovery |
| `-in-kube-cluster` | - | - | Enable Kubernetes discovery |
| `-mapping` | `MAPPING` | - | Static hostname mappings |
| `-connection-rate-limit` | `CONNECTION_RATE_LIMIT` | `1` | Connections per second limit |

---

#### Auto-Scaling

mc-router can automatically start stopped containers when players connect and stop idle containers.

**Configuration:**

| Flag | Environment Variable | Default | Description |
|------|---------------------|---------|-------------|
| `-auto-scale-up` | `AUTO_SCALE_UP` | `false` | Start stopped containers on connect |
| `-auto-scale-down` | `AUTO_SCALE_DOWN` | `false` | Stop idle containers |
| `-auto-scale-down-after` | `AUTO_SCALE_DOWN_AFTER` | `10m` | Idle timeout before stopping |
| `-docker-timeout` | `DOCKER_TIMEOUT` | `60` | Seconds to wait for container start |

**MOTD for Sleeping Servers:**

| Flag | Environment Variable | Default |
|------|---------------------|---------|
| `-auto-scale-asleep-motd` | `AUTO_SCALE_ASLEEP_MOTD` | `Server is sleeping. Connect to wake up!` |

**Player Allow/Deny Lists:**

| Flag | Description |
|------|-------------|
| `-auto-scale-up-allow-list` | File of player UUIDs/usernames allowed to wake servers |
| `-auto-scale-up-deny-list` | File of players blocked from waking servers |

---

#### Security Features

| Feature | Description |
|---------|-------------|
| **Port Scanner Blocking** | Connections without valid hostname are blocked |
| **Rate Limiting** | Configurable connections per second per IP |
| **DDoS Mitigation** | Connection throttling reduces attack surface |

---

#### Monitoring

| Flag | Environment Variable | Description |
|------|---------------------|-------------|
| `-metrics-backend` | `METRICS_BACKEND` | `prometheus`, `influxdb`, or `discard` |
| `-metrics-bind` | `METRICS_BIND` | Metrics server bind address |
| `-record-logins` | `RECORD_LOGINS` | Track player login metrics |
| `-webhook-url` | `WEBHOOK_URL` | URL for player login/disconnect notifications |

---

#### Platform Support

**Docker Images:** `itzg/mc-router`

| Architecture | Supported |
|--------------|:---------:|
| amd64 (x86_64) | Yes |
| arm64 (Apple Silicon, AWS Graviton) | Yes |
| arm32v6 (Raspberry Pi) | Yes |

---

### Quick Reference Examples

**Basic Paper Server with mc-router:**

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

**Fabric Server with Mods:**

```yaml
services:
  mc-modded:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"
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

**Forge Server with CurseForge Mods:**

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

**Legacy Forge (1.16.5):**

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

### Official Documentation Links

| Resource | URL |
|----------|-----|
| **minecraft-server Docs** | https://docker-minecraft-server.readthedocs.io/ |
| **minecraft-server GitHub** | https://github.com/itzg/docker-minecraft-server |
| **mc-router GitHub** | https://github.com/itzg/mc-router |
| **Docker Hub (minecraft-server)** | https://hub.docker.com/r/itzg/minecraft-server |
| **Docker Hub (mc-router)** | https://hub.docker.com/r/itzg/mc-router |

---

## Glossary

| Term | Definition |
|------|------------|
| **mcctl** | Minecraft Control - the CLI management tool |
| **mc-router** | Hostname-based router that directs connections to correct servers |
| **avahi-daemon** | Linux mDNS service for .local hostname discovery |
| **nip.io** | Magic DNS service that maps hostnames to IP addresses |
| **RCON** | Remote Console protocol for executing server commands |
| **Paper** | High-performance Minecraft server fork with plugin support |
| **Forge/NeoForge** | Modding platforms for Minecraft mods |
| **Fabric** | Lightweight modding platform |
| **Modrinth** | Open-source mod hosting platform |
| **CurseForge** | Popular mod hosting platform |
| **Spiget** | API for SpigotMC plugins |
| **Auto-scale** | Feature that starts/stops servers based on player activity |
| **World lock** | Mechanism to prevent simultaneous access to a world |

---

## Version History

| Version | Changes |
|---------|---------|
| 0.1.0 | Initial release |

---

## External Resources

- **Official Documentation**: https://minecraft-server-manager.readthedocs.io/
- **itzg/minecraft-server**: https://docker-minecraft-server.readthedocs.io/
- **GitHub Repository**: https://github.com/smallmiro/minecraft-server-manager
- **Docker Hub (itzg)**: https://hub.docker.com/r/itzg/minecraft-server/
- **mc-router**: https://github.com/itzg/mc-router

---

*This document was generated for LLM agent consumption. Last updated: January 2026.*
