# Docker Minecraft Server Manager

A multi-server Minecraft management system using `itzg/minecraft-server` with `itzg/mc-router` for automatic scaling and hostname-based routing.

## Features

- **Multi-Server**: Run multiple Minecraft servers (survival, creative, modded, etc.)
- **Single Port**: All servers accessible via port 25565 with hostname routing
- **Auto-Scale**: Servers start on client connect, stop after idle timeout
- **mDNS Discovery**: Clients auto-discover servers via Bonjour/Zeroconf (no hosts file needed)
- **Zero Resources**: Only infrastructure services run when servers are idle (~40MB RAM)
- **Modular Config**: Each server has its own directory with independent configuration

## Quick Start

### Option A: npm Package (Recommended)

```bash
# Install globally
npm install -g @minecraft-docker/mcctl

# Initialize platform (creates ~/minecraft-servers)
mcctl init

# Create your first server
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

With mDNS auto-discovery, just connect directly:
- `myserver.local:25565`

**mDNS Requirements** (for auto-discovery):
| OS | Requirement |
|----|-------------|
| Linux | avahi-daemon (usually pre-installed) |
| macOS | Built-in Bonjour (no setup needed) |
| Windows | Bonjour Print Services or iTunes |

**Fallback** (if mDNS unavailable): Add `<server-ip> myserver.local` to hosts file.

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
2. Creates symlink to existing world (if `--world` specified)
3. Updates `servers/compose.yml` (main docker-compose.yml is NOT modified)
4. Registers hostname with avahi-daemon (mDNS)
5. Starts the server (unless `--no-start` specified)

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

## Useful Commands

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
