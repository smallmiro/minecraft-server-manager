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

### 1. Clone and Configure

```bash
git clone <repository>
cd minecraft/platform
cp .env.example .env
# Edit .env with your settings
```

### 2. Start All Servers

```bash
cd platform
docker compose up -d
```

### 3. Create Your First Server

```bash
cd platform
./scripts/create-server.sh myserver -t VANILLA -v 1.21.1
```

### 4. Connect via Minecraft

With mDNS auto-discovery, just connect directly:
- `myserver.local:25565`

**mDNS Requirements** (for auto-discovery):
| OS | Requirement |
|----|-------------|
| Linux | avahi-daemon (usually pre-installed) |
| macOS | Built-in Bonjour (no setup needed) |
| Windows | Bonjour Print Services or iTunes |

**Fallback** (if mDNS unavailable): Add `<server-ip> myserver.local` to hosts file.

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

## External Links

- **GitHub**: https://github.com/itzg/docker-minecraft-server
- **Docker Hub**: https://hub.docker.com/r/itzg/minecraft-server/
- **Official Docs**: https://docker-minecraft-server.readthedocs.io/
- **Setup Tool**: https://setupmc.com/java-server/
