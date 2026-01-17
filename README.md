# Docker Minecraft Server Manager

A multi-server Minecraft management system using `itzg/minecraft-server` with `itzg/mc-router` for automatic scaling and hostname-based routing.

## Features

- **Multi-Server**: Run multiple Minecraft servers (survival, creative, modded, etc.)
- **Single Port**: All servers accessible via port 25565 with hostname routing
- **Auto-Scale**: Servers start on client connect, stop after idle timeout
- **Zero Resources**: Only mc-router runs when servers are idle (~20MB RAM)
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

### 3. Configure Client DNS

Add to `/etc/hosts` (Linux/macOS) or `C:\Windows\System32\drivers\etc\hosts` (Windows):

```
<server-ip> ironwood.local crystalpeak.local shadowvale.local
```

### 4. Connect via Minecraft

- Ironwood (Paper): `ironwood.local:25565`
- Crystalpeak (Vanilla): `crystalpeak.local:25565`
- Shadowvale (Forge): `shadowvale.local:25565`

## Architecture

```
┌─────────────────────────────────────────────────────┐
│          mc-router (always running :25565)          │
├─────────────────────────────────────────────────────┤
│  ironwood.local    → mc-ironwood    (auto-scale)    │
│  crystalpeak.local → mc-crystalpeak (auto-scale)    │
│  shadowvale.local  → mc-shadowvale  (auto-scale)    │
└─────────────────────────────────────────────────────┘
```

## Adding a New Server

Use the server name for all identifiers (directory, service, container, hostname):

```bash
cd platform
./scripts/create-server.sh <server-name> [options]

# Basic examples:
./scripts/create-server.sh myworld              # Creates myworld.local (PAPER)
./scripts/create-server.sh techcraft -t FORGE   # Creates techcraft.local (FORGE)

# World options (mutually exclusive):
./scripts/create-server.sh myworld --seed 12345           # Specific seed
./scripts/create-server.sh myworld --world-url <URL>      # Download from ZIP
./scripts/create-server.sh myworld --world existing-world # Use existing world
```

Then follow the script's instructions to complete setup.

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

# Start specific server
docker compose up -d mc-ironwood

# Stop specific server
docker compose stop mc-ironwood

# View router logs
docker logs -f mc-router

# View server logs
docker logs -f mc-ironwood

# Console access
docker exec -i mc-ironwood rcon-cli

# Execute command
docker exec mc-ironwood rcon-cli say Hello World

# Stop all
docker compose down
```

---

## External Links

- **GitHub**: https://github.com/itzg/docker-minecraft-server
- **Docker Hub**: https://hub.docker.com/r/itzg/minecraft-server/
- **Official Docs**: https://docker-minecraft-server.readthedocs.io/
- **Setup Tool**: https://setupmc.com/java-server/
