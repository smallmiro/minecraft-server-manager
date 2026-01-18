# Environment Variables Reference

Complete list of environment variables available in Docker Minecraft Server.

## General Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `EULA` | - | Minecraft EULA agreement (**Required**: `TRUE`) |
| `TYPE` | `VANILLA` | Server type |
| `VERSION` | `LATEST` | Minecraft version |
| `TZ` | `UTC` | Timezone (e.g., `America/New_York`) |
| `UID` | `1000` | Container user ID |
| `GID` | `1000` | Container group ID |

## Server Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MOTD` | - | Server message |
| `DIFFICULTY` | `easy` | Difficulty (`peaceful`, `easy`, `normal`, `hard`) |
| `MODE` | `survival` | Game mode (`survival`, `creative`, `adventure`, `spectator`) |
| `MAX_PLAYERS` | `20` | Maximum player count |
| `PVP` | `true` | Enable PvP |
| `LEVEL` | `world` | World save folder name |
| `SEED` | - | World seed |
| `VIEW_DISTANCE` | - | View distance |
| `SIMULATION_DISTANCE` | - | Simulation distance |

## Memory Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMORY` | `1G` | Initial/max heap memory |
| `INIT_MEMORY` | - | Initial heap size (separate setting) |
| `MAX_MEMORY` | - | Maximum heap size (separate setting) |

Format: `<size>[g|G|m|M|k|K]` or percentage `<size>%`

## Whitelist

| Variable | Description |
|----------|-------------|
| `ENABLE_WHITELIST` | Enable whitelist (`true`/`false`) |
| `WHITELIST` | Player list (comma separated) |
| `WHITELIST_FILE` | Whitelist file path/URL |

## Operators (OPs)

| Variable | Description |
|----------|-------------|
| `OPS` | Operator list (comma separated) |
| `OPS_FILE` | Operator file path/URL |

## RCON

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_RCON` | `true` | Enable RCON |
| `RCON_PASSWORD` | - | RCON password |
| `RCON_PASSWORD_FILE` | - | RCON password file (Docker Secrets) |
| `RCON_PORT` | `25575` | RCON port |

## Resource Pack

| Variable | Description |
|----------|-------------|
| `RESOURCE_PACK` | Resource pack URL |
| `RESOURCE_PACK_SHA1` | Checksum |
| `RESOURCE_PACK_ENFORCE` | Enforce on clients (`TRUE`/`FALSE`) |

## Server Icon

| Variable | Description |
|----------|-------------|
| `ICON` | Server icon URL or path (64x64 PNG) |

## Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Log level |
| `LOG_TIMESTAMP` | `false` | Add timestamp |
| `GENERATE_LOG4J2_CONFIG` | `false` | Generate log4j2 config |
| `ROLLING_LOG_FILE_PATTERN` | - | Rolling log file pattern |
| `ROLLING_LOG_MAX_FILES` | `1000` | Maximum log file count |

## Monitoring

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_HOST` | `localhost` | Monitoring host |
| `SERVER_PORT` | `25565` | Monitoring port |
| `DISABLE_HEALTHCHECK` | `false` | Disable healthcheck |

## Proxy

| Variable | Description |
|----------|-------------|
| `PROXY` | HTTP/HTTPS proxy URL |
| `PROXY_HOST` | Proxy host |
| `PROXY_PORT` | Proxy port |
| `PROXY_NON_PROXY_HOSTS` | Proxy exclusion hosts |

## Custom Server

| Variable | Description |
|----------|-------------|
| `CUSTOM_SERVER` | Custom server JAR URL/path |
| `EXTRA_ARGS` | Additional arguments to pass to server JAR |

## Server Control

| Variable | Default | Description |
|----------|---------|-------------|
| `STOP_SERVER_ANNOUNCE_DELAY` | - | Stop announcement delay (seconds) |
| `STOP_DURATION` | `60` | Graceful stop wait time (seconds) |
| `FORCE_REDOWNLOAD` | `false` | Force re-download server files |
| `SETUP_ONLY` | `false` | Setup only, then exit |

## Debugging

| Variable | Description |
|----------|-------------|
| `DEBUG` | Verbose log output |
| `DEBUG_EXEC` | Show server start command |
| `DEBUG_MEMORY` | Memory allocation debugging |

## JVM Optimization Flags

| Variable | Description |
|----------|-------------|
| `USE_AIKAR_FLAGS` | Aikar's GC tuning flags |
| `USE_MEOWICE_FLAGS` | MeowIce updated flags |
| `USE_MEOWICE_GRAALVM_FLAGS` | GraalVM optimization |
| `USE_FLARE_FLAGS` | Flare profiling |
| `USE_SIMD_FLAGS` | SIMD optimization |

## OpenJ9 Specific

| Variable | Description |
|----------|-------------|
| `TUNE_VIRTUALIZED` | Virtualized environment optimization |
| `TUNE_NURSERY_SIZES` | Nursery size settings |

## Miscellaneous

| Variable | Description |
|----------|-------------|
| `CONSOLE` | Set `FALSE` for noconsole option |
| `GUI` | Set `FALSE` to disable GUI |
| `SKIP_CHOWN_DATA` | Skip `/data` ownership change |
