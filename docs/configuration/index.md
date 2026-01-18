# Configuration Overview

This section covers all configuration options for the Docker Minecraft Server platform.

## Configuration Files

The platform uses several configuration files:

| File | Purpose | Location |
|------|---------|----------|
| `.env` | Global environment variables | `~/minecraft-servers/.env` |
| `docker-compose.yml` | Main orchestration | `~/minecraft-servers/docker-compose.yml` |
| `servers/<name>/config.env` | Per-server configuration | `~/minecraft-servers/servers/<name>/config.env` |
| `servers/<name>/docker-compose.yml` | Per-server compose | `~/minecraft-servers/servers/<name>/docker-compose.yml` |

## Quick Configuration

### Essential Settings

Edit `~/minecraft-servers/.env`:

```bash
# Your server's IP address (required for nip.io)
HOST_IP=192.168.1.100

# Default memory allocation
DEFAULT_MEMORY=4G

# Default Minecraft version
DEFAULT_VERSION=1.20.4

# Timezone
TZ=Asia/Seoul

# RCON password (change this!)
RCON_PASSWORD=your-secure-password
```

### Per-Server Configuration

Edit `~/minecraft-servers/servers/<name>/config.env`:

```bash
# Server type
TYPE=PAPER

# Minecraft version
VERSION=1.21.1

# Memory allocation
MEMORY=4G

# Server properties
MAX_PLAYERS=20
MOTD=Welcome to my server!
DIFFICULTY=normal
GAMEMODE=survival
```

## Configuration Categories

<div class="grid cards" markdown>

-   :material-cog:{ .lg .middle } **Environment Variables**

    ---

    Complete reference for all environment variables

    [:octicons-arrow-right-24: Environment Variables](environment.md)

-   :material-server:{ .lg .middle } **Server Types**

    ---

    Paper, Forge, Fabric, and other server platforms

    [:octicons-arrow-right-24: Server Types](server-types.md)

</div>

## Configuration Priority

Settings are applied in this order (later overrides earlier):

1. **Default values** - Built into itzg/minecraft-server image
2. **Global `.env`** - Platform-wide defaults
3. **Server `config.env`** - Per-server overrides
4. **Docker Compose** - Container-specific settings

## Common Configuration Tasks

### Change Server Memory

Edit `servers/<name>/config.env`:

```bash
MEMORY=8G
```

Then restart:

```bash
docker compose restart mc-<name>
```

### Change Minecraft Version

Edit `servers/<name>/config.env`:

```bash
VERSION=1.21.1
```

Then recreate the container:

```bash
docker compose up -d mc-<name>
```

### Enable Mods/Plugins

For mod servers (Forge/Fabric), add to `config.env`:

```bash
# Download from Modrinth
MODRINTH_PROJECTS=fabric-api,lithium,sodium

# Or from CurseForge
CF_API_KEY=${CF_API_KEY}
CURSEFORGE_FILES=jei,journeymap
```

For plugin servers (Paper/Spigot), use the `shared/plugins/` directory.

### Configure Auto-Scaling

mc-router handles auto-scaling. Edit `docker-compose.yml`:

```yaml
services:
  router:
    environment:
      AUTO_SCALE_UP: "true"
      AUTO_SCALE_DOWN: "true"  # Stop idle servers
      DOCKER_TIMEOUT: "120"    # Wait time for server start
```

## Validation

After configuration changes, validate:

```bash
# Check compose syntax
docker compose config --quiet

# Test server startup
docker compose up -d mc-<name>
docker logs -f mc-<name>
```

## Next Steps

- **[Environment Variables](environment.md)** - All available configuration options
- **[Server Types](server-types.md)** - Detailed guide for each server platform
- **[Advanced Networking](../advanced/networking.md)** - Network configuration
