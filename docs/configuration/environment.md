# Environment Variables

Complete reference for all environment variables used in the platform.

## Global Variables (.env)

These variables are set in `~/minecraft-servers/.env` and apply to all servers.

### Network Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `HOST_IP` | Host machine IP address | Auto-detected | `192.168.1.100` |
| `MINECRAFT_NETWORK` | Docker network name | `minecraft-net` | `minecraft-net` |
| `MINECRAFT_SUBNET` | Network subnet | `172.28.0.0/16` | `172.28.0.0/16` |

### Default Server Settings

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DEFAULT_MEMORY` | Default memory allocation | `4G` | `4G`, `8G` |
| `DEFAULT_VERSION` | Default Minecraft version | `LATEST` | `1.21.1`, `1.20.4` |
| `TZ` | Timezone | `UTC` | `Asia/Seoul`, `America/New_York` |
| `RCON_PASSWORD` | RCON console password | `changeme` | `your-secure-password` |
| `RCON_PORT` | RCON port | `25575` | `25575` |

### Backup Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `BACKUP_GITHUB_TOKEN` | GitHub Personal Access Token | - | `ghp_xxxx...` |
| `BACKUP_GITHUB_REPO` | Target repository | - | `user/minecraft-backup` |
| `BACKUP_GITHUB_BRANCH` | Target branch | `main` | `main`, `backups` |
| `BACKUP_AUTO_ON_STOP` | Auto-backup on server stop | `false` | `true`, `false` |

---

## Server Variables (config.env)

These variables are set per-server in `servers/<name>/config.env`.

### Required Settings

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `EULA` | Accept Minecraft EULA | `TRUE` | `TRUE` (required) |
| `TYPE` | Server type | `PAPER` | `PAPER`, `FORGE`, `FABRIC` |
| `VERSION` | Minecraft version | `LATEST` | `1.21.1` |

### Memory Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `MEMORY` | JVM heap memory | `4G` | `2G`, `4G`, `8G` |
| `INIT_MEMORY` | Initial heap size | Same as `MEMORY` | `2G` |
| `MAX_MEMORY` | Maximum heap size | Same as `MEMORY` | `8G` |
| `JVM_OPTS` | Additional JVM options | - | `-XX:+UseG1GC` |
| `JVM_DD_OPTS` | JVM -D options | - | `key=value,key2=value2` |

### Server Properties

These map directly to Minecraft's `server.properties`:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `MOTD` | Server message of the day | `A Minecraft Server` | `Welcome!` |
| `MAX_PLAYERS` | Maximum players | `20` | `50`, `100` |
| `DIFFICULTY` | Game difficulty | `easy` | `peaceful`, `easy`, `normal`, `hard` |
| `GAMEMODE` | Default game mode | `survival` | `survival`, `creative`, `adventure`, `spectator` |
| `LEVEL` | World/level name | `world` | `survival`, `creative` |
| `SEED` | World generation seed | Random | `12345`, `minecraft` |
| `PVP` | Enable PvP | `true` | `true`, `false` |
| `HARDCORE` | Hardcore mode | `false` | `true`, `false` |
| `ALLOW_FLIGHT` | Allow flying | `false` | `true`, `false` |
| `SPAWN_PROTECTION` | Spawn protection radius | `16` | `0`, `16`, `32` |
| `VIEW_DISTANCE` | View distance (chunks) | `10` | `8`, `12`, `16` |
| `SIMULATION_DISTANCE` | Simulation distance | `10` | `8`, `12` |
| `ONLINE_MODE` | Authenticate with Mojang | `true` | `true`, `false` |
| `ENABLE_COMMAND_BLOCK` | Enable command blocks | `false` | `true`, `false` |
| `FORCE_GAMEMODE` | Force default gamemode | `false` | `true`, `false` |
| `ENABLE_WHITELIST` | Enable whitelist | `false` | `true`, `false` |

### World Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `LEVEL_TYPE` | World type | `DEFAULT` | `DEFAULT`, `FLAT`, `LARGEBIOMES`, `AMPLIFIED` |
| `GENERATOR_SETTINGS` | Flat world preset | - | JSON string |
| `WORLD` | Download world from URL | - | `https://example.com/world.zip` |
| `WORLD_INDEX` | Path within world ZIP | `/` | `/world` |

### Mod/Plugin Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `MODRINTH_PROJECTS` | Modrinth mod slugs | - | `fabric-api,lithium` |
| `MODRINTH_DOWNLOAD_DEPENDENCIES` | Download dependencies | `optional` | `required`, `optional`, `none` |
| `CF_API_KEY` | CurseForge API key | - | `$2a$10$...` |
| `CURSEFORGE_FILES` | CurseForge project slugs | - | `jei,journeymap` |
| `SPIGET_RESOURCES` | Spigot resource IDs | - | `1234,5678` |
| `MODS` | Mod download URLs | - | `https://example.com/mod.jar` |
| `PLUGINS_SYNC_UPDATE` | Auto-update plugins | `false` | `true` |

### Server Operators

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `OPS` | Operator usernames | - | `Steve,Alex` |
| `OPS_FILE` | Path to ops file | - | `/config/ops.json` |
| `WHITELIST` | Whitelisted players | - | `Steve,Alex` |
| `WHITELIST_FILE` | Path to whitelist file | - | `/config/whitelist.json` |

### Performance Tuning

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `USE_AIKAR_FLAGS` | Use Aikar's JVM flags | `false` | `true` |
| `MAX_TICK_TIME` | Max ms per tick | `60000` | `-1` (disable watchdog) |
| `NETWORK_COMPRESSION_THRESHOLD` | Compression threshold | `256` | `256`, `512` |
| `ENTITY_BROADCAST_RANGE_PERCENTAGE` | Entity render distance % | `100` | `50`, `75`, `100` |

### Container Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `UID` | User ID for file permissions | `1000` | `1000` |
| `GID` | Group ID for file permissions | `1000` | `1000` |
| `SKIP_CHOWN_DATA` | Skip ownership change | `false` | `true` |
| `TZ` | Container timezone | `UTC` | `Asia/Seoul` |
| `ENABLE_RCON` | Enable RCON | `true` | `true`, `false` |
| `RCON_PASSWORD` | RCON password | From global .env | `your-password` |

### Debugging

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DEBUG` | Enable debug output | `false` | `true` |
| `DEBUG_EXEC` | Debug exec commands | `false` | `true` |
| `DEBUG_MEMORY` | Debug memory usage | `false` | `true` |

---

## mc-router Variables

These are set in `~/minecraft-servers/.env` and passed to mc-router:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `IN_DOCKER` | Enable Docker mode | `true` | `true` |
| `AUTO_SCALE_UP` | Auto-start servers on connect | `true` | `true`, `false` |
| `AUTO_SCALE_DOWN` | Auto-stop idle servers | `true` | `true`, `false` |
| `AUTO_SCALE_DOWN_AFTER` | Idle timeout before stopping | `10m` | `1m`, `5m`, `10m`, `30m`, `1h` |
| `DOCKER_TIMEOUT` | Server startup timeout (sec) | `120` | `120`, `300` |
| `AUTO_SCALE_ASLEEP_MOTD` | MOTD for sleeping servers | - | `§e§lServer sleeping§r` |
| `API_BINDING` | Management API binding | `:8080` | `:8080` |

!!! tip "Managing mc-router"
    After changing mc-router variables, restart it with:
    ```bash
    mcctl router restart
    ```

---

## Example Configurations

### Survival Server

```bash
# servers/survival/config.env
TYPE=PAPER
VERSION=1.21.1
MEMORY=4G

MOTD=Survival Server - Good luck!
DIFFICULTY=hard
GAMEMODE=survival
MAX_PLAYERS=30
PVP=true

USE_AIKAR_FLAGS=true
VIEW_DISTANCE=12
```

### Creative Server

```bash
# servers/creative/config.env
TYPE=VANILLA
VERSION=1.21.1
MEMORY=2G

MOTD=Creative Mode - Build freely!
DIFFICULTY=peaceful
GAMEMODE=creative
MAX_PLAYERS=20

SPAWN_PROTECTION=0
ENABLE_COMMAND_BLOCK=true
```

### Modded Server (Forge)

```bash
# servers/modded/config.env
TYPE=FORGE
VERSION=1.20.4
MEMORY=8G

MOTD=Modded Server - Enhanced Experience
DIFFICULTY=normal
GAMEMODE=survival

CF_API_KEY=${CF_API_KEY}
CURSEFORGE_FILES=jei,journeymap,create

USE_AIKAR_FLAGS=true
```

### Modded Server (Fabric)

```bash
# servers/fabric/config.env
TYPE=FABRIC
VERSION=1.21.1
MEMORY=6G

MOTD=Fabric Server - Performance Mods
DIFFICULTY=normal
GAMEMODE=survival

MODRINTH_PROJECTS=fabric-api,lithium,sodium,starlight
MODRINTH_DOWNLOAD_DEPENDENCIES=required
```

---

## Variable Interpolation

You can reference other variables:

```bash
# .env
HOST_IP=192.168.1.100

# config.env
MOTD=Connect via ${HOST_IP}
```

## See Also

- **[Server Types](server-types.md)** - Type-specific configuration
- **[itzg/minecraft-server Documentation](https://docker-minecraft-server.readthedocs.io/)** - Full variable reference
