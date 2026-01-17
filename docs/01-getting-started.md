# Getting Started

A guide for building Minecraft servers using Docker.

## Overview

The `itzg/minecraft-server` image allows you to easily run a Minecraft Java Edition server in a Docker container.

## Quick Start

### Docker CLI

```bash
docker run -d -it --name mc \
  -p 25565:25565 \
  -e EULA=TRUE \
  itzg/minecraft-server
```

### Docker Compose

```yaml
services:
  mc:
    image: itzg/minecraft-server
    tty: true
    stdin_open: true
    ports:
      - "25565:25565"
    environment:
      EULA: "TRUE"
    volumes:
      - ./minecraft-data:/data
```

## Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `EULA` | Minecraft EULA agreement (must set `TRUE`) | **Required** |

## Basic Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TYPE` | `VANILLA` | Server type |
| `VERSION` | `LATEST` | Minecraft version |
| `MEMORY` | `1G` | JVM heap memory |
| `TZ` | `UTC` | Timezone |

## Default Ports

| Port | Purpose |
|------|---------|
| `25565` | Minecraft server (TCP) |
| `25575` | RCON (TCP) |
| `19132` | Bedrock compatible (UDP, when using GeyserMC) |

## Data Persistence

To persist server data, you must mount the `/data` volume:

```bash
docker run -d -it --name mc \
  -p 25565:25565 \
  -e EULA=TRUE \
  -v /path/to/minecraft-data:/data \
  itzg/minecraft-server
```

## View Server Logs

```bash
docker logs -f mc
```

## Access Server Console

When RCON is enabled (default):

```bash
docker exec -i mc rcon-cli
```

## Stop Server

```bash
docker stop mc
```

## Next Steps

- [Data Directory](02-data-directory.md) - Understanding data structure
- [Environment Variables](03-variables.md) - Complete variable list
- [Server Types](06-types-and-platforms.md) - Paper, Forge, Fabric, etc.
- [Mods/Plugins](08-mods-and-plugins.md) - Installing mods and plugins
