# Implementation Plan: Multi-Server Minecraft Management System

## Overview

This plan outlines the implementation steps for the multi-server Minecraft management system defined in `prd.md`.

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

## Phase 2: Docker Configuration

### 2.1 Create docker-compose.yml

**Key Features**:
- YAML anchors for common configuration (`x-minecraft-common`)
- Shared network (`minecraft-net`)
- Shared volumes (`worlds`, `shared-plugins`, `shared-mods`)
- Per-server log directories
- Health checks enabled

**Services**:
| Service | Port | Type | Java |
|---------|------|------|------|
| survival | 25565 | PAPER | java21 |
| creative | 25566 | VANILLA | java21 |
| modded | 25567 | FORGE | java17 |

### 2.2 Create Server Configurations

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
4. Stale locks detectable via timestamp/pid

## Phase 4: Management CLI

### 4.1 Implement mcctl.sh

**File**: `scripts/mcctl.sh`

**Commands**:
```
mcctl.sh start <server> [world]   - Start with world lock
mcctl.sh stop <server>            - Stop and release lock
mcctl.sh restart <server>         - Restart server
mcctl.sh status                   - Show all status
mcctl.sh logs <server> [lines]    - View logs
mcctl.sh console <server>         - RCON console
mcctl.sh world list               - List worlds/locks
mcctl.sh world assign <w> <s>     - Assign world
mcctl.sh world release <w>        - Force release
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
# Test CLI (without starting servers)
./scripts/mcctl.sh --help
./scripts/mcctl.sh status
./scripts/mcctl.sh world list
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
   rm -rf servers/ worlds/ shared/ scripts/ .env docker-compose.yml
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
- Docker Engine & Compose

### Internal
- `prd.md` - Requirements reference
- `docs/` - Official documentation reference

## Notes

- All scripts use Bash (no additional runtime needed)
- Lock system uses `flock` for atomic operations
- World directory shared via `--world-dir` argument
- Each server has isolated `/data` but shared `/worlds`
