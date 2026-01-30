# Environment Variables

Complete reference for all environment variables used in the platform.

## Quick Configuration with mcctl

Most settings can be configured using `mcctl config`:

```bash
# View current configuration
mcctl config myserver

# Change settings
mcctl config myserver MEMORY 8G
mcctl config myserver MOTD "Welcome!"
mcctl config myserver MAX_PLAYERS 50

# Shortcuts for common settings
mcctl config myserver --cheats        # Enable cheats
mcctl config myserver --no-pvp        # Disable PvP
mcctl config myserver --command-block # Enable command blocks
```

!!! tip "Recommended Approach"
    Use `mcctl config` for standard settings. Edit config files directly only for advanced options not supported by the CLI.

---

## Global Variables (.env)

These variables are set in `~/minecraft-servers/.env` and apply to all servers.

### Network Configuration

| Variable | Description | Default | mcctl |
|----------|-------------|---------|-------|
| `HOST_IP` | Host machine IP address | Auto-detected | `mcctl init` |
| `HOST_IPS` | Multiple IPs for VPN mesh (comma-separated) | - | Manual |
| `MINECRAFT_NETWORK` | Docker network name | `minecraft-net` | Auto |
| `MINECRAFT_SUBNET` | Network subnet | `172.28.0.0/16` | Auto |

!!! tip "Multi-Network Access (Tailscale/ZeroTier)"
    To allow connections from both LAN and VPN, use `HOST_IPS`:
    ```bash
    # LAN IP + Tailscale IP
    HOST_IPS=192.168.1.100,100.64.0.5
    ```
    See **[VPN Mesh Networks Guide](../advanced/networking.md#vpn-mesh-networks)** for detailed setup.

### Default Server Settings

| Variable | Description | Default | mcctl |
|----------|-------------|---------|-------|
| `DEFAULT_MEMORY` | Default memory allocation | `4G` | `mcctl init` |
| `DEFAULT_VERSION` | Default Minecraft version | `LATEST` | `mcctl init` |
| `TZ` | Timezone | `UTC` | Manual |
| `RCON_PASSWORD` | RCON console password | `changeme` | Manual |
| `RCON_PORT` | RCON port | `25575` | Auto |

### Backup Configuration

| Variable | Description | Default | mcctl |
|----------|-------------|---------|-------|
| `BACKUP_GITHUB_TOKEN` | GitHub Personal Access Token | - | Manual |
| `BACKUP_GITHUB_REPO` | Target repository | - | Manual |
| `BACKUP_GITHUB_BRANCH` | Target branch | `main` | Manual |
| `BACKUP_AUTO_ON_STOP` | Auto-backup on server stop | `false` | Manual |

!!! info "Backup Setup"
    After configuring backup variables, verify with:
    ```bash
    mcctl backup status
    ```

---

## Server Variables (config.env)

These variables are set per-server. Use `mcctl config` to manage them.

### Required Settings

| Variable | Description | Default | mcctl Command |
|----------|-------------|---------|---------------|
| `EULA` | Accept Minecraft EULA | `TRUE` | Auto-set |
| `TYPE` | Server type | `PAPER` | `mcctl create -t TYPE` |
| `VERSION` | Minecraft version | `LATEST` | `mcctl config <server> VERSION` |

### Memory Configuration

| Variable | Description | Default | mcctl Command |
|----------|-------------|---------|---------------|
| `MEMORY` | JVM heap memory | `4G` | `mcctl config <server> MEMORY` |
| `INIT_MEMORY` | Initial heap size | Same as `MEMORY` | Manual |
| `MAX_MEMORY` | Maximum heap size | Same as `MEMORY` | Manual |
| `JVM_OPTS` | Additional JVM options | - | Manual |
| `JVM_DD_OPTS` | JVM -D options | - | Manual |

**Example - Set memory:**

```bash
mcctl config myserver MEMORY 8G
mcctl stop myserver && mcctl start myserver
```

### Server Properties

These map directly to Minecraft's `server.properties`:

| Variable | Description | Default | mcctl Command |
|----------|-------------|---------|---------------|
| `MOTD` | Server message | `A Minecraft Server` | `mcctl config <server> MOTD` |
| `MAX_PLAYERS` | Maximum players | `20` | `mcctl config <server> MAX_PLAYERS` |
| `DIFFICULTY` | Game difficulty | `easy` | `mcctl config <server> DIFFICULTY` |
| `GAMEMODE` | Default game mode | `survival` | `mcctl config <server> GAMEMODE` |
| `LEVEL` | World/level name | Auto-set | `mcctl config <server> LEVEL` |
| `SEED` | World generation seed | Random | `mcctl create -s SEED` |
| `PVP` | Enable PvP | `true` | `mcctl config <server> --pvp/--no-pvp` |
| `HARDCORE` | Hardcore mode | `false` | `mcctl config <server> HARDCORE` |
| `ALLOW_FLIGHT` | Allow flying | `false` | `mcctl config <server> ALLOW_FLIGHT` |
| `SPAWN_PROTECTION` | Spawn protection radius | `16` | `mcctl config <server> SPAWN_PROTECTION` |
| `VIEW_DISTANCE` | View distance (chunks) | `10` | `mcctl config <server> VIEW_DISTANCE` |
| `SIMULATION_DISTANCE` | Simulation distance | `10` | `mcctl config <server> SIMULATION_DISTANCE` |
| `ONLINE_MODE` | Authenticate with Mojang | `true` | `mcctl config <server> ONLINE_MODE` |
| `ENABLE_COMMAND_BLOCK` | Enable command blocks | `false` | `mcctl config <server> --command-block` |
| `FORCE_GAMEMODE` | Force default gamemode | `false` | `mcctl config <server> FORCE_GAMEMODE` |
| `ENABLE_WHITELIST` | Enable whitelist | `false` | `mcctl whitelist <server> on` |

**Example - Configure game settings:**

```bash
mcctl config myserver DIFFICULTY hard
mcctl config myserver GAMEMODE survival
mcctl config myserver MAX_PLAYERS 30
mcctl config myserver --no-pvp
```

### World Configuration

| Variable | Description | Default | mcctl Command |
|----------|-------------|---------|---------------|
| `LEVEL_TYPE` | World type | `DEFAULT` | `mcctl config <server> LEVEL_TYPE` |
| `GENERATOR_SETTINGS` | Flat world preset | - | Manual |
| `WORLD` | Download world from URL | - | `mcctl create -u URL` |
| `WORLD_INDEX` | Path within world ZIP | `/` | Manual |

### Mod/Plugin Configuration

| Variable | Description | Default | mcctl Command |
|----------|-------------|---------|---------------|
| `MODRINTH_PROJECTS` | Modrinth mod slugs | - | `mcctl config <server> MODRINTH_PROJECTS` |
| `MODRINTH_DOWNLOAD_DEPENDENCIES` | Download dependencies | `optional` | `mcctl config <server> MODRINTH_DOWNLOAD_DEPENDENCIES` |
| `CF_API_KEY` | CurseForge API key | - | Manual (.env) |
| `CURSEFORGE_FILES` | CurseForge project slugs | - | `mcctl config <server> CURSEFORGE_FILES` |
| `SPIGET_RESOURCES` | Spigot resource IDs | - | `mcctl config <server> SPIGET_RESOURCES` |
| `MODS` | Mod download URLs | - | Manual |
| `PLUGINS_SYNC_UPDATE` | Auto-update plugins | `false` | Manual |

**Example - Add mods:**

```bash
# Fabric server with performance mods
mcctl config myserver MODRINTH_PROJECTS "fabric-api,lithium,sodium"
mcctl config myserver MODRINTH_DOWNLOAD_DEPENDENCIES required
mcctl stop myserver && mcctl start myserver
```

### Server Operators

| Variable | Description | Default | mcctl Command |
|----------|-------------|---------|---------------|
| `OPS` | Operator usernames | - | `mcctl op <server> add <player>` |
| `OPS_FILE` | Path to ops file | - | Manual |
| `WHITELIST` | Whitelisted players | - | `mcctl whitelist <server> add <player>` |
| `WHITELIST_FILE` | Path to whitelist file | - | Manual |

**Example - Manage operators:**

```bash
# Add operator
mcctl op myserver add Steve

# List operators
mcctl op myserver list

# Remove operator
mcctl op myserver remove Steve
```

### Performance Tuning

| Variable | Description | Default | mcctl Command |
|----------|-------------|---------|---------------|
| `USE_AIKAR_FLAGS` | Use Aikar's JVM flags | `false` | `mcctl config <server> USE_AIKAR_FLAGS` |
| `MAX_TICK_TIME` | Max ms per tick | `60000` | Manual |
| `NETWORK_COMPRESSION_THRESHOLD` | Compression threshold | `256` | Manual |
| `ENTITY_BROADCAST_RANGE_PERCENTAGE` | Entity render distance % | `100` | Manual |

**Example - Enable performance optimization:**

```bash
mcctl config myserver USE_AIKAR_FLAGS true
mcctl stop myserver && mcctl start myserver
```

### Container Configuration

| Variable | Description | Default | mcctl Command |
|----------|-------------|---------|---------------|
| `UID` | User ID for file permissions | `1000` | Manual |
| `GID` | Group ID for file permissions | `1000` | Manual |
| `SKIP_CHOWN_DATA` | Skip ownership change | `false` | Manual |
| `TZ` | Container timezone | `UTC` | Manual |
| `ENABLE_RCON` | Enable RCON | `true` | Auto |
| `RCON_PASSWORD` | RCON password | From global .env | Auto |

### Debugging

| Variable | Description | Default | mcctl Command |
|----------|-------------|---------|---------------|
| `DEBUG` | Enable debug output | `false` | Manual |
| `DEBUG_EXEC` | Debug exec commands | `false` | Manual |
| `DEBUG_MEMORY` | Debug memory usage | `false` | Manual |

---

## mc-router Variables

These are set in `~/minecraft-servers/.env` and passed to mc-router:

| Variable | Description | Default | Management |
|----------|-------------|---------|------------|
| `IN_DOCKER` | Enable Docker mode | `true` | Auto |
| `AUTO_SCALE_UP` | Auto-start servers on connect | `true` | Manual |
| `AUTO_SCALE_DOWN` | Auto-stop idle servers | `true` | Manual |
| `AUTO_SCALE_DOWN_AFTER` | Idle timeout | `10m` | Manual |
| `DOCKER_TIMEOUT` | Server startup timeout (sec) | `120` | Manual |
| `AUTO_SCALE_ASLEEP_MOTD` | MOTD for sleeping servers | - | Manual |
| `API_BINDING` | Management API binding | `:8080` | Auto |

**After changing mc-router settings:**

```bash
mcctl router restart
```

---

## Example Configurations

### Survival Server

```bash
# Create server
mcctl create survival -t PAPER -v 1.21.1

# Configure
mcctl config survival MOTD "Survival Server - Good luck!"
mcctl config survival DIFFICULTY hard
mcctl config survival GAMEMODE survival
mcctl config survival MAX_PLAYERS 30
mcctl config survival --pvp
mcctl config survival USE_AIKAR_FLAGS true
mcctl config survival VIEW_DISTANCE 12
```

### Creative Server

```bash
# Create server
mcctl create creative -t VANILLA -v 1.21.1

# Configure
mcctl config creative MOTD "Creative Mode - Build freely!"
mcctl config creative DIFFICULTY peaceful
mcctl config creative GAMEMODE creative
mcctl config creative MAX_PLAYERS 20
mcctl config creative SPAWN_PROTECTION 0
mcctl config creative --command-block
```

### Modded Server (Forge)

```bash
# Create server
mcctl create modded -t FORGE -v 1.20.4

# Configure
mcctl config modded MOTD "Modded Server - Enhanced Experience"
mcctl config modded DIFFICULTY normal
mcctl config modded GAMEMODE survival
mcctl config modded MEMORY 8G
mcctl config modded USE_AIKAR_FLAGS true

# Add mods (requires CF_API_KEY in .env)
mcctl config modded CURSEFORGE_FILES "jei,journeymap,create"

# Restart to apply
mcctl stop modded && mcctl start modded
```

### Modded Server (Fabric)

```bash
# Create server
mcctl create fabric -t FABRIC -v 1.21.1

# Configure
mcctl config fabric MOTD "Fabric Server - Performance Mods"
mcctl config fabric DIFFICULTY normal
mcctl config fabric GAMEMODE survival
mcctl config fabric MEMORY 6G

# Add mods from Modrinth
mcctl config fabric MODRINTH_PROJECTS "fabric-api,lithium,sodium,starlight"
mcctl config fabric MODRINTH_DOWNLOAD_DEPENDENCIES required

# Restart to apply
mcctl stop fabric && mcctl start fabric
```

---

## Variable Interpolation

When editing config files directly, you can reference other variables:

```bash
# .env
HOST_IP=192.168.1.100

# config.env
MOTD=Connect via ${HOST_IP}
```

## See Also

- **[Server Types](server-types.md)** - Type-specific configuration
- **[CLI Commands](../cli/commands.md)** - Full mcctl reference
- **[itzg/minecraft-server Documentation](https://docker-minecraft-server.readthedocs.io/)** - Full variable reference
