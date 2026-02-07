# Docker Minecraft Server Manager

[![npm version](https://img.shields.io/npm/v/@minecraft-docker/mcctl)](https://www.npmjs.com/package/@minecraft-docker/mcctl)
[![npm downloads](https://img.shields.io/npm/dm/@minecraft-docker/mcctl)](https://www.npmjs.com/package/@minecraft-docker/mcctl)
[![GitHub issues](https://img.shields.io/github/issues/smallmiro/minecraft-server-manager)](https://github.com/smallmiro/minecraft-server-manager/issues)
[![Documentation](https://readthedocs.org/projects/minecraft-server-manager/badge/?version=latest)](https://minecraft-server-manager.readthedocs.io/)
[![License](https://img.shields.io/github/license/smallmiro/minecraft-server-manager)](https://github.com/smallmiro/minecraft-server-manager/blob/main/LICENSE)

A multi-server Minecraft management system using `itzg/minecraft-server` with `itzg/mc-router` for automatic scaling and hostname-based routing.

## System Requirements

| Component | Minimum Version | Recommended | Notes |
|-----------|-----------------|-------------|-------|
| **Node.js** | >= 18.0.0 | 20 LTS | Required for mcctl CLI |
| **Docker Engine** | >= 24.0.0 | Latest | Container runtime |
| **Docker Compose** | >= 2.20.0 | Latest | `include` feature required |
| **OS** | Linux, macOS | Ubuntu 22.04+ | Windows via WSL2 |

## Features

- **Multi-Server**: Run multiple Minecraft servers (survival, creative, modded, etc.)
- **Single Port**: All servers accessible via port 25565 with hostname routing
- **Auto-Scale**: Servers start on client connect, stop after idle timeout
- **nip.io Magic DNS**: Connect via `server.<ip>.nip.io` - no client setup needed
- **mDNS Discovery**: Clients auto-discover servers via Bonjour/Zeroconf
- **Zero Resources**: Only infrastructure services run when servers are idle (~40MB RAM)
- **Interactive CLI**: Guided prompts for server creation, player management, and more
- **Management Console**: Web Console (port 5000) + REST API (port 5001) for remote management
- **Player Management**: Unified `mcctl player` command with Mojang API integration
- **Mod Management**: Search, add, and remove mods from Modrinth, CurseForge, Spiget
- **NeoForge Support**: Full support for NeoForge modded servers (Minecraft 1.20.1+)
- **GitHub Backup**: Automatic world backup to private GitHub repositories
- **Audit Logs**: Comprehensive activity tracking with SQLite storage, auto-cleanup, and web UI
- **World Management UI**: Web-based world management with reset, assignment, and real-time status

## Quick Start

```bash
# Install globally
npm install -g @minecraft-docker/mcctl

# Initialize platform (creates ~/minecraft-servers)
mcctl init

# Create your first server (interactive mode)
mcctl create

# Or with options (CLI mode)
mcctl create myserver -t VANILLA -v 1.21.1

# Check status
mcctl status
```

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

**Option C: VPN Mesh (Remote Access)**

For remote access without port forwarding, use [Tailscale](https://tailscale.com/) or [ZeroTier](https://zerotier.com/):

```bash
# .env - add your VPN IP alongside LAN IP
HOST_IPS=192.168.1.100,100.64.0.5
```

Friends on your VPN network can connect via:
- `myserver.100.64.0.5.nip.io:25565`

See [VPN Mesh Networks Guide](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/networking/#vpn-mesh-networks) for setup instructions.

Add more servers using `create-server.sh` - they're automatically discoverable!

## Architecture

```
┌──────────────────────┐  ┌────────────────────┐
│  mc-router (:25565)  │  │  avahi-daemon      │
│  hostname routing    │  │  (system mDNS)     │
├──────────────────────┤  ├────────────────────┤
│ <server>.local ─→    │  │ /etc/avahi/hosts:  │
│  mc-<server>         │  │  <server>.local    │
└──────────────────────┘  └────────────────────┘
```

## Adding a New Server

Fully automated with a single command:

```bash
cd platform
./scripts/create-server.sh <server-name> [options]

# Basic examples:
./scripts/create-server.sh myworld              # Creates & starts myworld.local (PAPER)
./scripts/create-server.sh techcraft -t FORGE   # Creates & starts techcraft.local (FORGE)
./scripts/create-server.sh modern -t NEOFORGE -v 1.21.1  # NeoForge for modern mods
./scripts/create-server.sh myworld --no-start   # Create only, don't start

# With version:
./scripts/create-server.sh myworld -t VANILLA -v 1.21.1   # Specific version

# World options (mutually exclusive):
./scripts/create-server.sh myworld --seed 12345           # Specific seed
./scripts/create-server.sh myworld --world-url <URL>      # Download from ZIP
./scripts/create-server.sh myworld -w existing-world -v 1.21.1 # Use existing world (symlink)
```

The script automatically:
1. Creates server directory with configuration
2. Sets LEVEL to server name (world stored in `/worlds/<server-name>/`)
3. Creates symlink to existing world (if `--world` specified)
4. Updates `servers/compose.yml` (main docker-compose.yml is NOT modified)
5. Registers hostname with avahi-daemon (mDNS)
6. Starts the server (unless `--no-start` specified)

**World Storage**: Worlds are stored in the shared `/worlds/` directory using `EXTRA_ARGS=--universe /worlds/`. This enables world sharing between servers.

**mc-router auto-discovery**: Servers are auto-discovered via Docker labels (`mc-router.host`).

New servers are automatically discoverable via mDNS - just connect!

See [CLAUDE.md](CLAUDE.md) for detailed instructions.

## Mod Management

mcctl integrates with multiple mod sources for easy mod installation:

```bash
# Search for mods on Modrinth
mcctl mod search sodium

# Add mods to your server (from Modrinth, the default)
mcctl mod add myserver sodium lithium phosphor

# Add mods from CurseForge (requires CF_API_KEY in .env)
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
| [Server Types](https://minecraft-server-manager.readthedocs.io/en/latest/configuration/server-types/) | Paper, Forge, Fabric, NeoForge |
| [Environment Variables](https://minecraft-server-manager.readthedocs.io/en/latest/configuration/environment/) | All configuration options |
| [Mods & Plugins](https://minecraft-server-manager.readthedocs.io/en/latest/mods-and-plugins/) | Modrinth, CurseForge, Spiget |

### Advanced

| Document | Description |
|----------|-------------|
| [Networking](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/networking/) | nip.io, mDNS, VPN mesh |
| [Backup](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/backup/) | GitHub backup setup |
| [Management Console](https://minecraft-server-manager.readthedocs.io/en/latest/console/) | Web Console & REST API |

### Development

| Document | Description |
|----------|-------------|
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
minecraft/
├── package.json              # Root workspace
├── pnpm-workspace.yaml       # pnpm workspace config
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
        └── src/              # CLI commands and adapters
```

### Available Scripts

| Location | Command | Description |
|----------|---------|-------------|
| Root (`/minecraft`) | `pnpm install` | Install all dependencies |
| Root (`/minecraft`) | `pnpm build` | Build all packages (recommended) |
| Root (`/minecraft`) | `pnpm clean` | Clean all build outputs |
| Root (`/minecraft`) | `pnpm test` | Run all tests |
| `platform/services/cli` | `pnpm build` | Build CLI only |
| `platform/services/cli` | `pnpm test` | Run CLI tests |
| `platform/services/cli` | `pnpm link --global` | Link CLI globally |

### Build Order

pnpm automatically builds packages in dependency order:

```
1. @minecraft-docker/shared              (no dependencies)
2. @minecraft-docker/mod-source-modrinth (depends on shared)
3. @minecraft-docker/mcctl               (depends on shared, mod-source-modrinth)
```

---

## Quick Reference - Key Environment Variables

### Required

| Variable | Value | Description |
|----------|-------|-------------|
| `EULA` | `TRUE` | Minecraft EULA agreement (**Required**) |

### Server Basics

| Variable | Default | Description |
|----------|---------|-------------|
| `TYPE` | `VANILLA` | Server type (PAPER, FORGE, FABRIC, etc.) |
| `VERSION` | `LATEST` | Minecraft version |
| `MEMORY` | `1G` | JVM memory |

### Game Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MOTD` | - | Server message |
| `DIFFICULTY` | `easy` | Difficulty |
| `MODE` | `survival` | Game mode |
| `MAX_PLAYERS` | `20` | Maximum players |

### Security

| Variable | Description |
|----------|-------------|
| `RCON_PASSWORD` | RCON password |
| `ENABLE_WHITELIST` | Enable whitelist |
| `OPS` | Operator list |

### Network

| Variable | Description |
|----------|-------------|
| `HOST_IP` | Host IP for nip.io hostname |
| `HOST_IPS` | Multiple IPs for VPN mesh (comma-separated) |

### Automation

| Variable | Description |
|----------|-------------|
| `MCCTL_SUDO_PASSWORD` | sudo password for mDNS registration (avahi-daemon) |

### Audit Logs

| Variable | Default | Description |
|----------|---------|-------------|
| `AUDIT_AUTO_CLEANUP` | `true` | Automatically delete old audit logs |
| `AUDIT_RETENTION_DAYS` | `90` | Number of days to retain audit logs |

---

## Server Type Selection Guide

```
Plugin server → TYPE=PAPER
Forge mods → TYPE=FORGE + java17/java8
Fabric mods → TYPE=FABRIC + java21
Modpacks → TYPE=AUTO_CURSEFORGE or TYPE=MODRINTH
Vanilla → TYPE=VANILLA (default)
```

---

## Java Version Selection Guide

```
Minecraft 1.21+ → java21 or latest
Minecraft 1.18-1.20.4 → java17 or java21
Forge 1.16.5 and below → java8 (required)
```

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
mcctl world            # Shows subcommand help
mcctl world list       # List all worlds with lock status
mcctl world new        # Interactively create new world
mcctl world assign     # Interactively assign world to server
mcctl world release    # Interactively release world lock

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

# Delete server by name (--force skips player check)
mcctl delete myserver --force

# World management with names
mcctl world new myworld --seed 12345 --server myserver
mcctl world assign survival mc-myserver
mcctl world release survival

# Backup with message
mcctl backup push -m "Before upgrade"
mcctl backup restore abc1234
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

mc-router settings are configured via environment variables in `.env` file:

```bash
# ~/minecraft-servers/.env

# Auto-scaling settings
AUTO_SCALE_UP=true              # Auto-start servers on player connect
AUTO_SCALE_DOWN=true            # Auto-stop idle servers
AUTO_SCALE_DOWN_AFTER=10m       # Idle timeout (default: 10 minutes)
DOCKER_TIMEOUT=120              # Container start timeout in seconds

# Custom MOTD for sleeping servers
AUTO_SCALE_ASLEEP_MOTD=§e§lServer is sleeping§r\n§7Connect to wake up!

# Management API (for health checks)
API_BINDING=:8080               # Internal API port
```

**Common timeout values:**
| Value | Description |
|-------|-------------|
| `1m` | 1 minute |
| `5m` | 5 minutes |
| `10m` | 10 minutes (default) |
| `30m` | 30 minutes |
| `1h` | 1 hour |

After changing `.env`, restart mc-router:
```bash
mcctl router restart
```

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
mcctl op myserver list             # List current operators
mcctl op myserver add Notch        # Add operator
mcctl op myserver remove Steve     # Remove operator
mcctl op myserver list --json      # JSON output

# Dual update strategy:
# - RCON (/op, /deop) for immediate effect when server is running
# - config.env (OPS=) for persistence across restarts
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
# Backup server configuration (not world data)
mcctl server-backup myserver              # Create backup with auto message
mcctl server-backup myserver -m "msg"     # Create backup with message
mcctl server-backup myserver --list       # List all backups

# Restore server from backup
mcctl server-restore myserver             # Interactive restore (select from list)
mcctl server-restore myserver abc123      # Restore specific backup
mcctl server-restore myserver --dry-run   # Preview restore without applying
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

Audit logs capture all critical operations:
- Server lifecycle (create, delete, start, stop, restart)
- Player management (whitelist, ban, op, kick)
- Log retention configurable via `AUDIT_RETENTION_DAYS` (default: 90)
- Auto-cleanup enabled by default (`AUDIT_AUTO_CLEANUP=true`)

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

### Automation (sudo Password Handling)

For CI/CD or scripting, you can provide sudo password for mDNS registration:

```bash
# Environment variable (recommended for automation)
MCCTL_SUDO_PASSWORD=secret mcctl create myserver

# CLI option
mcctl create myserver --sudo-password "secret"
mcctl delete myserver --sudo-password "secret"

# Interactive mode (prompted when needed)
mcctl create myserver
# ? sudo password (for mDNS registration): ••••••••
```

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
cd platform

# Start all servers
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

### [1.13.0] - 2026-02-07

**Added:**
- **Interactive Service Selection** - `mcctl console service start/stop/restart` now shows interactive prompt
  - Start: choose "API only" or "API + Console"
  - Stop: choose "All services" or "Console only"
  - Console always requires API; stopping API also stops Console
- **Unified Prerequisite Checker** - Consolidated dependency validation for `mcctl init` and `mcctl console init`
- **Console npm Publishing** - `@minecraft-docker/mcctl-console` now available on npm
- **Console --force Option** - Force PM2 process termination for stop/restart
- **Routing Page** - Avahi mDNS monitoring in Web Console

**Fixed:**
- `force-dynamic` export added to all 22 API routes to prevent SQLITE_BUSY at build time
- `isConsoleAvailable()` now returns `true` (console is GA)

### [1.12.1] - 2026-02-07

**Fixed:**
- Add `not_created` status to all SSE and API interface type definitions (useServerStatus, useServersSSE, IMcctlApiClient, events.ts)

### [1.12.0] - 2026-02-06

**Added:**
- **All-Servers SSE Status Endpoint** - `GET /api/servers-status` for streaming all server statuses
- **Server Detail Delete Menu** - MoreVert button with delete option and confirmation dialog
- **API Audit Logging** - Automatic audit log recording for server CRUD and actions via REST API

**Fixed:**
- SSE URL path updated to `/api/sse/servers-status`
- Handle `not_created` server status in card, list, and detail page views
- Show all non-running servers in assign world dialog

### [1.11.0] - 2026-02-06

**Added:**
- **World Management UI** - Full world management interface in Web Console (#175)
- **Server Options Tab** - Config management UI with real-time updates (#229)
- **SSE Real-time Server Status** - Replace polling with Server-Sent Events (#223)
- **Server Config & World Reset API** - New REST endpoints (#229)

**Fixed:**
- Path traversal prevention and container status checks in world reset
- Force update check bypass for `mcctl update`

### [1.10.0] - 2026-02-05

**Added:**
- **Audit Log System** - Comprehensive activity tracking across CLI, API, and Web Console (#234, #235)
  - CLI: `mcctl audit list/purge/stats` commands with filtering
  - API: 5 REST endpoints (list, stats, purge, SSE streaming)
  - Web UI: Audit log page with filtering, dashboard widget, server activity tab
  - SQLite storage with WAL mode, auto-cleanup (90-day retention)

### [1.9.0] - 2026-02-05

**Added:**
- **`mcctl update --all` flag** - Update CLI and all installed services with npm update + PM2 restart

### [1.8.0] - 2026-02-05

**Added:**
- **Web Console sudo password support** - Pass sudo password from CreateServerDialog (#230)
- **Dashboard ChangelogFeed** - Real changelog from GitHub replaces placeholder ActivityFeed

See [CHANGELOG.md](CHANGELOG.md) for full version history.

---

## Links

- **Documentation**: https://minecraft-server-manager.readthedocs.io/
- **GitHub**: https://github.com/smallmiro/minecraft-server-manager
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **AI Assistant**: [Ask questions about mcctl](https://notebooklm.google.com/notebook/e91b656e-0d95-45b4-a961-fb1610b13962)

### Based On

- **itzg/minecraft-server**: https://hub.docker.com/r/itzg/minecraft-server/
- **itzg/mc-router**: https://github.com/itzg/mc-router
- **Official Docs**: https://docker-minecraft-server.readthedocs.io/
