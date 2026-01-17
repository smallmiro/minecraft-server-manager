# Server Properties

How to manage `server.properties` file through environment variables.

## Overview

All `server.properties` entries can be set via environment variables. Variable names are converted to uppercase with `-` replaced by `_`.

Example: `max-players` → `MAX_PLAYERS`

## Key Environment Variables

### Basic Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MOTD` | - | Server message (supports formatting codes, `\n` for multiline) |
| `DIFFICULTY` | `easy` | `peaceful`, `easy`, `normal`, `hard` |
| `MODE` | `survival` | `survival`, `creative`, `adventure`, `spectator` |
| `SEED` | - | World seed (wrap negative numbers in quotes) |
| `LEVEL` | `world` | World save folder name |
| `MAX_PLAYERS` | `20` | Maximum player count |
| `PVP` | `true` | Enable PvP |

### View and Performance

| Variable | Description |
|----------|-------------|
| `VIEW_DISTANCE` | Server view distance (chunks) |
| `SIMULATION_DISTANCE` | Simulation distance (chunks) |
| `MAX_TICK_TIME` | Max tick time (`-1` to disable watchdog) |

### World Generation

| Variable | Description |
|----------|-------------|
| `LEVEL_TYPE` | World type (`default`, `flat`, `largeBiomes`, `amplified`) |
| `GENERATOR_SETTINGS` | JSON format generator settings |
| `GENERATE_STRUCTURES` | Generate structures (`true`/`false`) |
| `SPAWN_ANIMALS` | Spawn animals |
| `SPAWN_MONSTERS` | Spawn monsters |
| `SPAWN_NPCS` | Spawn NPCs |

### Player Management

| Variable | Description |
|----------|-------------|
| `WHITELIST` | Whitelisted players (comma/newline separated) |
| `WHITELIST_FILE` | Whitelist file path/URL |
| `OPS` | Operator players (comma/newline separated) |
| `OPS_FILE` | Operator file path/URL |
| `ENABLE_WHITELIST` | Enable whitelist |
| `ENFORCE_WHITELIST` | Enforce whitelist |

### RCON

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_RCON` | `true` | Enable RCON |
| `RCON_PASSWORD` | - | RCON password (**required**) |
| `RCON_PASSWORD_FILE` | - | For Docker Secrets |
| `RCON_PORT` | `25575` | RCON port |

### Resource Pack

| Variable | Description |
|----------|-------------|
| `RESOURCE_PACK` | Resource pack download URL |
| `RESOURCE_PACK_SHA1` | Resource pack checksum |
| `RESOURCE_PACK_ENFORCE` | Enforce on clients |
| `RESOURCE_PACK_PROMPT` | Resource pack prompt message |

### Server Icon

```yaml
environment:
  ICON: "https://example.com/icon.png"
```

64x64 PNG image URL or container path

### Datapacks

| Variable | Description |
|----------|-------------|
| `INITIAL_ENABLED_PACKS` | Initially enabled datapacks |
| `INITIAL_DISABLED_PACKS` | Initially disabled datapacks |

## Advanced Settings

### Custom Properties

Set multiple properties at once with `CUSTOM_SERVER_PROPERTIES`:

```yaml
environment:
  CUSTOM_SERVER_PROPERTIES: |
    allow-flight=true
    spawn-protection=0
    enable-command-block=true
```

### Disable Automatic Management

Setting `OVERRIDE_SERVER_PROPERTIES=false` disables automatic `server.properties` management via environment variables.

### Placeholders

Placeholders can be used in configuration files:

| Format | Description |
|--------|-------------|
| `%VAR%` | Environment variable value |
| `%env:VAR%` | Environment variable value (explicit) |
| `%date:FMT%` | Date format |

### User API Provider

| Variable | Default | Description |
|----------|---------|-------------|
| `USER_API_PROVIDER` | `playerdb` | `playerdb` or `mojang` |

### Debugging

```yaml
environment:
  DUMP_SERVER_PROPERTIES: "true"  # Output settings at startup
```

## Example: Complete Server Configuration

```yaml
services:
  mc:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"

      # Server info
      MOTD: "Welcome to My Server!\nEnjoy!"
      ICON: "https://example.com/icon.png"

      # Game settings
      DIFFICULTY: "normal"
      MODE: "survival"
      PVP: "true"
      MAX_PLAYERS: "50"
      VIEW_DISTANCE: "12"

      # World
      LEVEL: "world"
      SEED: "12345"

      # Security
      ENABLE_WHITELIST: "true"
      WHITELIST: "player1,player2"
      OPS: "admin1"

      # RCON
      RCON_PASSWORD: "secure_password"
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```
