# Docker Minecraft Server Guide

A guide for building and operating Minecraft Java Edition servers using the `itzg/minecraft-server` Docker image.

## Quick Start

```yaml
# docker-compose.yml
services:
  mc:
    image: itzg/minecraft-server
    tty: true
    stdin_open: true
    environment:
      EULA: "TRUE"
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
```

```bash
docker compose up -d
```

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
# Start server
docker compose up -d

# View logs
docker logs -f mc

# Console access
docker exec -i mc rcon-cli

# Execute command
docker exec mc rcon-cli say Hello World

# Stop server
docker compose down
```

---

## External Links

- **GitHub**: https://github.com/itzg/docker-minecraft-server
- **Docker Hub**: https://hub.docker.com/r/itzg/minecraft-server/
- **Official Docs**: https://docker-minecraft-server.readthedocs.io/
- **Setup Tool**: https://setupmc.com/java-server/
