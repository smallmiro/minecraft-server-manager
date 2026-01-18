# Data Directory

Guide to the `/data` directory structure and volume management inside the container.

## Overview

All server data is stored under the `/data` path in the container. This path is declared as a Docker volume, so an anonymous volume is created if not explicitly configured.

> **Warning**: Anonymous volumes may result in data loss when the container is deleted.

## Directory Structure

```
/data
├── server.jar          # Server executable
├── server.properties   # Server configuration
├── ops.json           # Operator list
├── whitelist.json     # Whitelist
├── banned-players.json
├── banned-ips.json
├── world/             # Default world
├── world_nether/      # Nether world
├── world_the_end/     # End world
├── plugins/           # Plugins (Paper/Spigot)
├── mods/              # Mods (Forge/Fabric)
├── config/            # Mod configurations
└── logs/              # Server logs
```

## Volume Mount Methods

### Host Directory Bind

```bash
docker run -d \
  -v /home/user/minecraft-data:/data \
  -e EULA=TRUE \
  itzg/minecraft-server
```

### Docker Compose

```yaml
services:
  mc:
    image: itzg/minecraft-server
    volumes:
      - ./minecraft-data:/data
    environment:
      EULA: "TRUE"
```

### Named Volume

```yaml
services:
  mc:
    image: itzg/minecraft-server
    volumes:
      - mc-data:/data
    environment:
      EULA: "TRUE"

volumes:
  mc-data:
```

## SELinux / Podman Environments

In environments using SELinux or AppArmor, add the `:Z` option:

```bash
docker run -d \
  -v /home/user/minecraft-data:/data:Z \
  -e EULA=TRUE \
  itzg/minecraft-server
```

## Converting Anonymous Volume to Named Volume

Method to migrate data from an existing anonymous volume to a named volume:

```bash
# 1. Stop existing container
docker stop mc

# 2. Find anonymous volume location
docker inspect -f "{{json .Mounts}}" mc | jq

# 3. Create new named volume and copy data
docker volume create mc-data
docker run --rm \
  -v OLD_VOLUME_PATH:/source:ro \
  -v mc-data:/dest \
  alpine cp -a /source/. /dest/

# 4. Run new container
docker run -d \
  -v mc-data:/data \
  -e EULA=TRUE \
  itzg/minecraft-server
```

## Permission-Related Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `UID` | `1000` | User ID inside container |
| `GID` | `1000` | Group ID inside container |
| `SKIP_CHOWN_DATA` | `false` | Skip `/data` ownership change |

### Resolving Permission Issues

If permission issues occur between host and container:

```yaml
environment:
  UID: 1000
  GID: 1000
```

Or to skip ownership changes:

```yaml
environment:
  SKIP_CHOWN_DATA: "true"
```

## Optional Mount Points

You can mount specific directories separately:

| Path | Purpose |
|------|---------|
| `/plugins` | Plugin files |
| `/mods` | Mod files |
| `/config` | Mod configuration files |

```yaml
volumes:
  - ./data:/data
  - ./plugins:/plugins:ro  # Read-only
  - ./mods:/mods:ro
```
