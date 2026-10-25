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

For reference, the platform uses these configuration files (under `~/minecraft-servers/`):

| File | Purpose | Managed By |
|------|---------|------------|
| `.env` | Platform settings. Only the keys named in `servers/global.env` reach servers | `mcctl init` |
| `servers/global.env` | Names of the `.env` keys passed to every server | `mcctl init`, `mcctl upgrade` |
| `servers/<name>/server.yaml` | Server definition | `mcctl create`, `mcctl config` and every other mcctl change |
| `servers/<name>/config.env` | Server environment variables, generated from `server.yaml` | mcctl |
| `docker-compose.yml` | Main orchestration: mc-router and its settings | `mcctl init` |
| `servers/<name>/docker-compose.yml` | Server container, generated from `server.yaml` | mcctl |
| `servers/compose.yml` | List of the server compose files | mcctl |

See [Server Definition (server.yaml)](server-yaml.md) for how mcctl keeps the generated files in step.

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

-   :material-file-document:{ .lg .middle } **Server Definition**

    ---

    `server.yaml`, the file mcctl writes each server's files from

    [:octicons-arrow-right-24: Server Definition](server-yaml.md)

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

`VERSION` does not change the server's Java image. New servers run `itzg/minecraft-server:java25`; for a version that needs an older Java, see [Java Versions and Image Tags](server-types.md#java-versions-and-image-tags).

### Enable Mods/Plugins

For mod servers (Forge/Fabric):

```bash
# Modrinth mods
mcctl config myserver MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# CurseForge mods (CF_API_KEY optional on Java 17+ images)
mcctl config myserver CURSEFORGE_FILES "jei,journeymap"
```

For plugin servers (Paper/Spigot), place plugins in `shared/plugins/` directory.

### Configure Auto-Scaling

mc-router reads its auto-scaling settings from the `router` service in `~/minecraft-servers/docker-compose.yml`, not from `.env`:

```yaml
services:
  router:
    environment:
      AUTO_SCALE_UP: "true"         # Auto-start servers on player connect
      AUTO_SCALE_DOWN: "true"       # Auto-stop idle servers
      AUTO_SCALE_DOWN_AFTER: "10m"  # Idle timeout
      DOCKER_TIMEOUT: "120s"        # Server startup timeout (Go time.Duration: 120s, 2m)
```

```bash
# Show mc-router status and routes
mcctl status router

# After editing docker-compose.yml, recreate mc-router
mcctl router start
```

`mcctl router restart` keeps the old settings; `mcctl router start` recreates the container from the edited file. `mcctl upgrade` changes only the router `image` and `group_add` in this file, so your edits stay. To turn auto-scaling off for one server, set `routing.autoScale` in its [server.yaml](server-yaml.md).

### Change Server Properties

```bash
# Game settings
mcctl config myserver DIFFICULTY hard
mcctl config myserver MODE survival
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
2. **`servers/global.env`** - The platform keys it names (`TZ`, `EXTRA_ARGS`, `RCON_PASSWORD`, `RCON_PORT`), with their values from `.env`
3. **Server `config.env`** - Per-server values, generated from `server.yaml` (via `mcctl config`)
4. **`environment` in the server's `docker-compose.yml`** - Only `EULA=TRUE`

Other `.env` keys do not reach servers. To pass one to every server, add its name to `servers/global.env` (see [Setting Classification](environment.md#setting-classification)).

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

mcctl writes `config.env` and the server's `docker-compose.yml` from `servers/<name>/server.yaml`. A hand edit of `config.env` is taken into `server.yaml` the next time mcctl changes the server. Edits to `docker-compose.yml` outside `image` and the `mc-router.*` labels, such as resource limits, are kept, but a later change that has to rewrite the file stops with `compose_edited`. See [Hand edits](server-yaml.md#hand-edits) and the [value rules](environment.md#value-rules) for `config.env`.

!!! note "When to Edit Files Directly"
    Direct file editing is only needed for:

    - Advanced JVM options (`JVM_OPTS`, `JVM_DD_OPTS`)
    - Custom environment variables
    - Docker resource limits

    For standard settings, prefer `mcctl config`.

## Next Steps

- **[Environment Variables](environment.md)** - All available configuration options
- **[Server Definition (server.yaml)](server-yaml.md)** - The file each server's settings are generated from
- **[Server Types](server-types.md)** - Detailed guide for each server platform
- **[Advanced Networking](../advanced/networking.md)** - Network configuration
