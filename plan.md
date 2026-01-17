# Implementation Plan: Multi-Server Minecraft Management System

## Overview

This plan outlines the implementation steps for the multi-server Minecraft management system defined in `prd.md`.

## Development Strategy: CLI-First, Web-Ready

All features are implemented via **CLI first**, with **Web Management UI** as a future enhancement.

### Web-Ready Implementation Guidelines

When implementing CLI scripts:

```bash
# 1. Support JSON output for Web API integration
mcctl.sh status --json
# Output: {"servers":[{"name":"survival","status":"running","port":25565},...]}

# 2. Use consistent exit codes
# 0 = success
# 1 = error
# 2 = warning

# 3. Separate logic from CLI parsing
# Bad:  echo "Server started"
# Good: output_message "Server started" (function handles format)

# 4. All config in parseable formats (TOML, JSON, env)
```

### Example: Web-Ready Function Design

```bash
# scripts/lib/servers.sh - Reusable functions

get_server_status() {
    local server=$1
    local status=$(docker inspect -f '{{.State.Status}}' "mc-$server" 2>/dev/null || echo "not_found")
    local port=$(grep -oP 'address.*:\K\d+' lazymc.toml | head -1)
    echo "{\"name\":\"$server\",\"status\":\"$status\",\"port\":$port}"
}

# scripts/mcctl.sh - CLI wrapper
case "$1" in
    status)
        if [[ "$2" == "--json" ]]; then
            get_server_status "$3"
        else
            # Human-readable output
        fi
        ;;
esac
```

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2.0+
- Bash 4.0+
- At least 8GB RAM available for servers

## Phase 1: Infrastructure Setup

### 1.1 Create Directory Structure

```bash
mkdir -p servers/{_template,survival,creative,modded}/{data,logs}
mkdir -p worlds/.locks
mkdir -p shared/{plugins,mods}
mkdir -p backups/{worlds,servers}
mkdir -p scripts
```

### 1.2 Create Global Environment File

**File**: `.env`

```bash
# Network Configuration
MINECRAFT_NETWORK=minecraft-net
MINECRAFT_SUBNET=172.20.0.0/16

# Lazymc Settings
LAZYMC_IDLE_TIMEOUT=600          # Stop server after 10 min idle
LAZYMC_MIN_ONLINE_TIME=60        # Min time before auto-stop

# Default Settings
DEFAULT_MEMORY=4G
DEFAULT_VERSION=1.20.4

# Timezone
TZ=Asia/Seoul

# RCON (change in production)
RCON_PASSWORD=changeme
```

### 1.3 Create Server Template

**File**: `servers/_template/config.env`

Template for creating new server configurations.

## Phase 2: Docker & Lazymc Configuration

### 2.1 Create docker-compose.yml

**Key Features**:
- Lazymc proxy service (always running)
- YAML anchors for common configuration (`x-minecraft-common`)
- Shared network (`minecraft-net`)
- Shared volumes (`worlds`, `shared-plugins`, `shared-mods`)
- Per-server log directories
- **No port mapping on MC servers** (Lazymc handles ports)
- `restart: "no"` on MC servers (Lazymc controls lifecycle)

**Services**:
| Service | Port | Type | Managed By |
|---------|------|------|------------|
| lazymc | 25565-25567 | Proxy | Always running |
| mc-survival | (internal) | PAPER | Lazymc |
| mc-creative | (internal) | VANILLA | Lazymc |
| mc-modded | (internal) | FORGE | Lazymc |

**Docker Compose Structure**:
```yaml
services:
  # Lazymc - Always running proxy
  lazymc:
    image: ghcr.io/timvisee/lazymc:latest
    restart: unless-stopped
    ports:
      - "25565:25565"  # survival
      - "25566:25566"  # creative
      - "25567:25567"  # modded
    volumes:
      - ./lazymc.toml:/etc/lazymc/lazymc.toml:ro
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - minecraft-net

  # MC servers - No ports, Lazymc manages
  mc-survival:
    image: itzg/minecraft-server:java21
    restart: "no"  # Lazymc controls
    # No ports - internal only
    networks:
      - minecraft-net
```

### 2.2 Create lazymc.toml

**File**: `lazymc.toml`

```toml
# Survival Server
[[servers]]
name = "survival"

[servers.public]
address = "0.0.0.0:25565"
motd = "§aSurvival§r - Starting server..."
version = "1.20.4"

[servers.server]
address = "mc-survival:25565"
wake_timeout = 300
start_timeout = 600

[servers.docker]
enabled = true
container = "mc-survival"

[servers.time]
sleep_after = 600
minimum_online_time = 60

# Creative Server
[[servers]]
name = "creative"

[servers.public]
address = "0.0.0.0:25566"
motd = "§bCreative§r - Starting server..."

[servers.server]
address = "mc-creative:25565"

[servers.docker]
enabled = true
container = "mc-creative"

[servers.time]
sleep_after = 600

# Modded Server
[[servers]]
name = "modded"

[servers.public]
address = "0.0.0.0:25567"
motd = "§6Modded§r - Starting server..."

[servers.server]
address = "mc-modded:25565"

[servers.docker]
enabled = true
container = "mc-modded"

[servers.time]
sleep_after = 900  # 15 min for modded
```

### 2.3 Create Server Configurations

**Files to create**:
- `servers/survival/config.env`
- `servers/creative/config.env`
- `servers/modded/config.env`

## Phase 3: World Locking System

### 3.1 Implement lock.sh

**File**: `scripts/lock.sh`

**Functions**:
| Function | Description |
|----------|-------------|
| `lock_world` | Acquire exclusive lock using `flock` |
| `unlock_world` | Release lock, verify ownership |
| `check_lock` | Query lock status |
| `list_locks` | Display all locks and available worlds |

**Lock File Format**:
```
<server-name>:<timestamp>:<pid>
```

### 3.2 Lock Safety Rules

1. Lock acquired BEFORE container start
2. Lock released AFTER container stop
3. Only lock owner can release
4. Stale locks detectable via timestamp

**Note**: Port management is handled by Lazymc (fixed ports in lazymc.toml), not by scripts.

## Phase 4: Management CLI

### 4.1 Implement mcctl.sh

**File**: `scripts/mcctl.sh`

**Commands**:
```
mcctl.sh status                   - Show all servers status
mcctl.sh logs <server> [lines]    - View logs
mcctl.sh console <server>         - RCON console

mcctl.sh world list               - List worlds/locks
mcctl.sh world assign <w> <s>     - Assign world to server config
mcctl.sh world release <w>        - Force release world lock

# Manual override (bypasses Lazymc)
mcctl.sh start <server>           - Force start server
mcctl.sh stop <server>            - Force stop server
```

**Note**: With Lazymc, servers start/stop automatically on client connect/idle. Manual start/stop is only for maintenance or debugging.

**Status Output Example**:
```
=== Server Status (Lazymc Managed) ===
SERVER      STATUS     PORT    WORLD            IDLE
survival    RUNNING    25565   survival-world   2m ago
creative    STOPPED    25566   creative-world   -
modded      STOPPED    25567   modded-world     -

Lazymc: RUNNING (3 servers configured)
```

**Status Check Logic**:
```bash
# Check if Lazymc is running
docker ps --filter "name=lazymc" --format "{{.Status}}"

# Check individual server status
docker ps --filter "name=mc-$server" --format "{{.Status}}"
```

### 4.2 Implement logs.sh

**File**: `scripts/logs.sh`

Helper script for log viewing with Docker and file options.

### 4.3 Make Scripts Executable

```bash
chmod +x scripts/*.sh
```

## Phase 5: Documentation Update

### 5.1 Update CLAUDE.md

Add sections:
- Multi-server architecture overview
- New CLI commands (`mcctl.sh`)
- World locking explanation
- Troubleshooting for multi-server

### 5.2 Update README.md

Add sections:
- Multi-server quick start
- Server management commands
- World management guide

## File Checklist

### Create New Files

| File | Phase | Priority |
|------|-------|----------|
| `.env` | 1 | High |
| `docker-compose.yml` | 2 | High |
| `lazymc.toml` | 2 | High |
| `servers/_template/config.env` | 1 | High |
| `servers/survival/config.env` | 2 | High |
| `servers/creative/config.env` | 2 | High |
| `servers/modded/config.env` | 2 | High |
| `scripts/lock.sh` | 3 | High |
| `scripts/mcctl.sh` | 4 | Medium |
| `scripts/logs.sh` | 4 | Medium |

### Update Existing Files

| File | Phase | Changes |
|------|-------|---------|
| `CLAUDE.md` | 5 | Add multi-server section |
| `README.md` | 5 | Add management guide |

### Create Directories

```
servers/_template/
servers/survival/{data,logs}/
servers/creative/{data,logs}/
servers/modded/{data,logs}/
worlds/.locks/
shared/{plugins,mods}/
backups/{worlds,servers}/
scripts/
```

## Verification Steps

### Phase 1 Verification
```bash
# Check directory structure
ls -la servers/ worlds/ shared/ scripts/

# Verify .env exists
cat .env
```

### Phase 2 Verification
```bash
# Validate docker-compose syntax
docker compose config

# Check services defined
docker compose config --services
```

### Phase 2 Verification (Lazymc)
```bash
# Validate lazymc.toml syntax
docker run --rm -v ./lazymc.toml:/etc/lazymc/lazymc.toml \
  ghcr.io/timvisee/lazymc:latest --config-test

# Start Lazymc only
docker compose up -d lazymc

# Check Lazymc is listening
ss -tuln | grep -E "25565|25566|25567"

# Check Lazymc logs
docker logs lazymc
```

### Phase 3 Verification
```bash
# Test lock operations
./scripts/lock.sh lock test-world test-server
./scripts/lock.sh check test-world
./scripts/lock.sh list
./scripts/lock.sh unlock test-world test-server
```

### Phase 4 Verification
```bash
# Test CLI
./scripts/mcctl.sh --help
./scripts/mcctl.sh status
./scripts/mcctl.sh world list

# Test Lazymc auto-start (connect with MC client)
# 1. Connect to 192.168.x.x:25565
# 2. Check server started: docker ps
# 3. Disconnect and wait 10 min
# 4. Check server stopped: docker ps
```

### Phase 5 Verification
```bash
# Run sync-docs to validate documentation
/project:sync-docs
```

## Rollback Plan

If implementation fails at any phase:

1. **Phase 1-2 Failure**: Remove created directories and files
   ```bash
   docker compose down
   rm -rf servers/ worlds/ shared/ scripts/ .env docker-compose.yml lazymc.toml
   ```

2. **Phase 3-4 Failure**: Remove only scripts
   ```bash
   rm -rf scripts/
   ```

3. **Phase 5 Failure**: Restore from git
   ```bash
   git checkout CLAUDE.md README.md
   ```

## Dependencies

### External
- `itzg/minecraft-server` Docker image
- `ghcr.io/timvisee/lazymc` Docker image
- Docker Engine & Compose

### Internal
- `prd.md` - Requirements reference
- `docs/` - Official documentation reference

### Lazymc Resources
- GitHub: https://github.com/timvisee/lazymc
- Docker Hub: https://ghcr.io/timvisee/lazymc

## Notes

- All scripts use Bash (no additional runtime needed)
- Lock system uses `flock` for atomic operations
- World directory shared via `--world-dir` argument
- Each server has isolated `/data` but shared `/worlds`

### Lazymc Architecture
- **Lazymc proxy**: Always running, minimal resources (~50MB RAM)
- **MC servers**: Started on-demand by Lazymc, stopped after idle
- **Fixed ports**: 25565 (survival), 25566 (creative), 25567 (modded)
- **External access**: Same LAN PCs connect via `<host-ip>:<port>`
- **Auto start**: Client connects → Lazymc starts container → proxies connection
- **Auto stop**: No players for 10 min → Lazymc stops container
- **Resource efficiency**: Zero RAM usage when servers are stopped
