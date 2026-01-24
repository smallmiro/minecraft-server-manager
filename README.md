# Docker Minecraft Server Manager

A multi-server Minecraft management system using `itzg/minecraft-server` with `itzg/mc-router` for automatic scaling and hostname-based routing.

## Features

- **Multi-Server**: Run multiple Minecraft servers (survival, creative, modded, etc.)
- **Single Port**: All servers accessible via port 25565 with hostname routing
- **Auto-Scale**: Servers start on client connect, stop after idle timeout
- **mDNS Discovery**: Clients auto-discover servers via Bonjour/Zeroconf (no hosts file needed)
- **Zero Resources**: Only infrastructure services run when servers are idle (~40MB RAM)
- **Modular Config**: Each server has its own directory with independent configuration
- **Interactive CLI**: Guided prompts for server creation, player management, and more
- **Player Management**: Unified `mcctl player` command with Mojang API integration and local cache
- **Automation Ready**: Environment variable and CLI options for sudo password handling

## Quick Start

### Option A: npm Package (Recommended)

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

### Option B: Clone Repository

```bash
git clone <repository>
cd minecraft/platform
cp .env.example .env
# Edit .env with your settings

# Start infrastructure
docker compose up -d

# Create your first server
./scripts/create-server.sh myserver -t VANILLA -v 1.21.1
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

---

## Table of Contents

### Basic Configuration

| Document | Description |
|----------|-------------|
| [Getting Started](01-getting-started.md) | Basic usage, required settings |
| [Data Directory](02-data-directory.md) | Volume mounts, data structure |
| [Environment Variables](03-variables.md) | Complete environment variable reference |

### Server Configuration

| Document | Description |
|----------|-------------|
| [Server Properties](04-server-properties.md) | server.properties environment variables |
| [JVM Options](05-jvm-options.md) | Memory, performance optimization |
| [Server Types](06-types-and-platforms.md) | Paper, Forge, Fabric, modpacks |
| [Java Versions](07-java-versions.md) | Java requirements by version |

### Extensions

| Document | Description |
|----------|-------------|
| [Mods/Plugins](08-mods-and-plugins.md) | Modrinth, CurseForge, Spiget |
| [Advanced Configuration](09-configuration.md) | Variable interpolation, RCON automation |
| [Sending Commands](10-commands.md) | RCON, SSH, WebSocket |

### Operations

| Document | Description |
|----------|-------------|
| [Autopause/Autostop](11-autopause-autostop.md) | Resource saving features |
| [Healthcheck](12-healthcheck.md) | Monitoring configuration |
| [Deployment](13-deployment.md) | Kubernetes, AWS, Raspberry Pi |
| [World Data](14-world-data.md) | World management, datapacks |

### Reference

| Document | Description |
|----------|-------------|
| [Troubleshooting](15-troubleshooting.md) | Common problems and solutions |
| [Examples](16-examples.md) | docker-compose example collection |
| [Documentation Links](doc-list.md) | Original documentation URLs |

### Development

| Document | Description |
|----------|-------------|
| [CLI Usage Examples](docs/usage/cli-usage-examples.md) | Detailed CLI usage with examples (Korean) |
| [CLI Architecture](docs/development/cli-architecture.md) | Hexagonal architecture and patterns |

---

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker Engine 20.10+
- Docker Compose v2.0+

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
    │   └── src/              # Common types, utils, docker helpers
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
1️⃣ @minecraft-docker/shared  (no dependencies)
2️⃣ @minecraft-docker/mcctl   (depends on shared)
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

### Automation

| Variable | Description |
|----------|-------------|
| `MCCTL_SUDO_PASSWORD` | sudo password for mDNS registration (avahi-daemon) |

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
mcctl console myserver
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
# Execute RCON commands
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

## External Links

- **GitHub**: https://github.com/itzg/docker-minecraft-server
- **Docker Hub**: https://hub.docker.com/r/itzg/minecraft-server/
- **Official Docs**: https://docker-minecraft-server.readthedocs.io/
- **Setup Tool**: https://setupmc.com/java-server/
