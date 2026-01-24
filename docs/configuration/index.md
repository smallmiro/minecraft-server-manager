# Configuration Overview

This section covers all configuration options for the Docker Minecraft Server platform.

## Quick Configuration with mcctl

**mcctl** provides the easiest way to configure servers:

```bash
# View all configuration
mcctl config myserver

# View specific setting
mcctl config myserver MOTD

# Change settings
mcctl config myserver MOTD "Welcome to my server!"
mcctl config myserver MAX_PLAYERS 50
mcctl config myserver MEMORY 8G

# Use shortcuts
mcctl config myserver --cheats        # Enable cheats
mcctl config myserver --no-pvp        # Disable PvP
mcctl config myserver --command-block # Enable command blocks
```

!!! tip "Recommended Approach"
    Use `mcctl config` for most configuration changes. It handles validation and applies changes correctly.

## Configuration Files

For reference, the platform uses these configuration files:

| File | Purpose | Managed By |
|------|---------|------------|
| `.env` | Global environment variables | `mcctl init` |
| `servers/<name>/config.env` | Per-server configuration | `mcctl config` |
| `docker-compose.yml` | Main orchestration | `mcctl init` (auto-generated) |
| `servers/<name>/docker-compose.yml` | Per-server compose | `mcctl create` (auto-generated) |

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

## Common Configuration Tasks

### Change Server Memory

```bash
mcctl config myserver MEMORY 8G
mcctl stop myserver && mcctl start myserver
```

### Change Minecraft Version

```bash
mcctl config myserver VERSION 1.21.1
mcctl stop myserver && mcctl start myserver
```

### Enable Mods/Plugins

For mod servers (Forge/Fabric):

```bash
# Modrinth mods
mcctl config myserver MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# CurseForge mods (requires API key in .env)
mcctl config myserver CURSEFORGE_FILES "jei,journeymap"
```

For plugin servers (Paper/Spigot), place plugins in `shared/plugins/` directory.

### Configure Auto-Scaling

```bash
# View current mc-router settings
mcctl status router

# After editing .env, restart mc-router
mcctl router restart
```

Auto-scaling settings in `~/minecraft-servers/.env`:

```bash
AUTO_SCALE_UP=true              # Auto-start servers on player connect
AUTO_SCALE_DOWN=true            # Auto-stop idle servers
AUTO_SCALE_DOWN_AFTER=10m       # Idle timeout
DOCKER_TIMEOUT=120              # Server startup timeout (seconds)
```

### Change Server Properties

```bash
# Game settings
mcctl config myserver DIFFICULTY hard
mcctl config myserver GAMEMODE survival
mcctl config myserver MAX_PLAYERS 30

# World settings
mcctl config myserver SPAWN_PROTECTION 0
mcctl config myserver VIEW_DISTANCE 12

# Enable whitelist
mcctl whitelist myserver on
mcctl whitelist myserver add Steve
```

## Configuration Priority

Settings are applied in this order (later overrides earlier):

1. **Default values** - Built into itzg/minecraft-server image
2. **Global `.env`** - Platform-wide defaults
3. **Server `config.env`** - Per-server overrides (via `mcctl config`)

## Validation

After configuration changes, verify the server status:

```bash
# Check server configuration
mcctl config myserver

# Check server status
mcctl status myserver

# View logs for any errors
mcctl logs myserver -n 50
```

## Advanced Configuration

For settings not supported by `mcctl config`, edit config files directly:

```bash
# Edit global settings
nano ~/minecraft-servers/.env

# Edit server-specific settings
nano ~/minecraft-servers/servers/myserver/config.env

# Restart to apply changes
mcctl stop myserver && mcctl start myserver
```

!!! note "When to Edit Files Directly"
    Direct file editing is only needed for:

    - Advanced JVM options (`JVM_OPTS`, `JVM_DD_OPTS`)
    - Custom environment variables
    - Docker resource limits

    For standard settings, prefer `mcctl config`.

## Next Steps

- **[Environment Variables](environment.md)** - All available configuration options
- **[Server Types](server-types.md)** - Detailed guide for each server platform
- **[Advanced Networking](../advanced/networking.md)** - Network configuration
