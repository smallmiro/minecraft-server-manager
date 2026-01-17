# Advanced Configuration

Variable interpolation, automatic RCON commands, and other advanced configuration options.

## Variable Interpolation

Dynamically substitute environment variables in configuration files.

### Basic Usage

Use `${CFG_VARIABLE_NAME}` format in configuration files:

```yaml
# config.yml
server-name: ${CFG_SERVER_NAME}
max-players: ${CFG_MAX_PLAYERS}
```

```yaml
# docker-compose.yml
environment:
  CFG_SERVER_NAME: "My Server"
  CFG_MAX_PLAYERS: "50"
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REPLACE_ENV_IN_PLACE` | `true` | Interpolate variables in files within `/data` |
| `REPLACE_ENV_DURING_SYNC` | `false` | Interpolate variables during sync |
| `REPLACE_ENV_VARIABLE_PREFIX` | `CFG_` | Prefix for interpolation variables |

### Supported File Extensions

`.yml`, `.yaml`, `.txt`, `.cfg`, `.conf`, `.properties`

### Exclusion Settings

```yaml
environment:
  REPLACE_ENV_SUFFIXES_EXCLUSIONS: ".json"
  REPLACE_ENV_VARIABLES_EXCLUDES: "CFG_SECRET"
```

---

## Automatic RCON Commands

Automatically execute RCON commands on server events.

### On Server Startup

```yaml
environment:
  RCON_CMDS_STARTUP: |
    gamerule keepInventory true
    gamerule doDaylightCycle false
    difficulty hard
```

### On Player Connect

```yaml
environment:
  RCON_CMDS_ON_CONNECT: |
    say Welcome to the server!
    give @a minecraft:bread 16
```

### On Player Disconnect

```yaml
environment:
  RCON_CMDS_ON_DISCONNECT: |
    say A player has left
```

### On First Player Connect

```yaml
environment:
  RCON_CMDS_FIRST_CONNECT: |
    say Server is now active!
```

### On Last Player Disconnect

```yaml
environment:
  RCON_CMDS_LAST_DISCONNECT: |
    say Server is now empty
```

### Using YAML Blocks in Docker Compose

```yaml
environment:
  RCON_CMDS_STARTUP: |-
    gamerule keepInventory true
    gamerule doDaylightCycle false
```

---

## Other Configuration Options

### Custom Server JAR

```yaml
environment:
  TYPE: "CUSTOM"
  CUSTOM_SERVER: "https://example.com/server.jar"
  # or local path
  CUSTOM_SERVER: "/data/custom-server.jar"
```

### Additional Server Arguments

```yaml
environment:
  EXTRA_ARGS: "--world-dir ./worlds/"
```

### Force Server Redownload

```yaml
environment:
  FORCE_REDOWNLOAD: "true"
```

### Setup Only and Exit

```yaml
environment:
  SETUP_ONLY: "true"
```

### Console Settings

```yaml
environment:
  CONSOLE: "FALSE"  # noconsole option
  GUI: "FALSE"      # Disable GUI
```

---

## Server Shutdown Settings

### Shutdown Delay

```yaml
environment:
  STOP_SERVER_ANNOUNCE_DELAY: "30"  # Shutdown after 30 seconds
```

### Shutdown Wait Time

```yaml
environment:
  STOP_DURATION: "120"  # Wait 120 seconds for graceful shutdown
```

---

## Logging Settings

### Basic Logging

```yaml
environment:
  LOG_LEVEL: "info"          # debug, info, warn, error
  LOG_TIMESTAMP: "true"      # Add timestamps
```

### Log4j2 Configuration

```yaml
environment:
  GENERATE_LOG4J2_CONFIG: "true"
  LOG_CONSOLE_FORMAT: "[%d{HH:mm:ss}] [%level]: %msg%n"
```

### Rolling Logs

```yaml
environment:
  ROLLING_LOG_FILE_PATTERN: "logs/server-%d{yyyy-MM-dd}-%i.log.gz"
  ROLLING_LOG_MAX_FILES: "7"
```

---

## Proxy Settings

Using HTTP/HTTPS proxy:

```yaml
environment:
  PROXY: "http://proxy.example.com:8080"
  # or
  PROXY_HOST: "proxy.example.com"
  PROXY_PORT: "8080"
  PROXY_NON_PROXY_HOSTS: "localhost|*.internal.com"
```

---

## Applying Extra Files

### APPLY_EXTRA_FILES

Automatically copy/download configuration files:

```yaml
environment:
  APPLY_EXTRA_FILES: |
    /config/spigot.yml=/data/spigot.yml
    https://example.com/bukkit.yml=/data/bukkit.yml
```

### Sync Directory

```yaml
volumes:
  - ./sync:/data/sync
environment:
  SYNC_SKIP_NEWER_IN_DESTINATION: "false"
```

---

## Example: Complete Advanced Configuration

```yaml
services:
  mc:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"

      # Variable interpolation
      REPLACE_ENV_IN_PLACE: "true"
      CFG_SERVER_NAME: "Production Server"
      CFG_DISCORD_WEBHOOK: "${DISCORD_WEBHOOK}"

      # Automatic RCON commands
      RCON_CMDS_STARTUP: |-
        gamerule keepInventory true
        whitelist on

      RCON_CMDS_FIRST_CONNECT: |-
        say Server is waking up!

      # Logging
      LOG_LEVEL: "info"
      LOG_TIMESTAMP: "true"
      ROLLING_LOG_MAX_FILES: "14"

      # Shutdown settings
      STOP_SERVER_ANNOUNCE_DELAY: "60"
      STOP_DURATION: "120"

    volumes:
      - ./data:/data
      - ./config:/config:ro
```
