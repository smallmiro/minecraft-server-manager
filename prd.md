# PRD: Multi-Server Minecraft Management System

## 1. Overview

### 1.1 Purpose

This document defines the requirements for a Docker-based multi-server Minecraft management system that enables running multiple Minecraft servers with shared world storage, centralized management, and resource isolation.

### 1.2 Scope

- Multi-server orchestration using Docker Compose
- Shared world storage with locking mechanism
- Per-server logging and monitoring
- Management CLI for server operations
- Based on `itzg/minecraft-server` Docker image

### 1.3 Terminology

| Term | Definition |
|------|------------|
| Server | A single Minecraft server instance running in a Docker container |
| World | A Minecraft world directory containing level data, regions, etc. |
| Lock | A mechanism to prevent multiple servers from using the same world |
| RCON | Remote Console protocol for server administration |

## 2. Requirements

### 2.1 Functional Requirements

#### FR-001: Multi-Server Operation
- **Priority**: High
- **Description**: Support running multiple Minecraft servers simultaneously
- **Acceptance Criteria**:
  - [ ] At least 3 servers can run concurrently
  - [ ] Each server has independent configuration
  - [ ] Servers can be started/stopped independently
  - [ ] Different server types supported (Vanilla, Paper, Forge, Fabric)

#### FR-002: Shared World Storage
- **Priority**: High
- **Description**: All servers share a common world storage directory
- **Acceptance Criteria**:
  - [ ] `worlds/` directory accessible by all servers
  - [ ] Worlds can be assigned to different servers
  - [ ] World data persists across server restarts
  - [ ] New worlds can be created and managed

#### FR-003: World Locking Mechanism
- **Priority**: High
- **Description**: Prevent multiple servers from using the same world simultaneously
- **Acceptance Criteria**:
  - [ ] Only one server can use a world at a time
  - [ ] Lock is acquired before server starts
  - [ ] Lock is released when server stops
  - [ ] Lock status is queryable
  - [ ] Stale locks can be manually cleared

#### FR-004: Per-Server Logging
- **Priority**: Medium
- **Description**: Each server maintains separate log files
- **Acceptance Criteria**:
  - [ ] Logs stored in `servers/<name>/logs/`
  - [ ] Log rotation configured (max size, max files)
  - [ ] Logs viewable via CLI command
  - [ ] Real-time log tailing supported

#### FR-005: Management CLI
- **Priority**: Medium
- **Description**: Command-line tool for server management
- **Acceptance Criteria**:
  - [ ] Start/stop/restart servers
  - [ ] View server status
  - [ ] View and tail logs
  - [ ] Manage world assignments
  - [ ] Access RCON console

#### FR-006: Shared Resources
- **Priority**: Low
- **Description**: Plugins and mods can be shared across servers
- **Acceptance Criteria**:
  - [ ] `shared/plugins/` mountable as read-only
  - [ ] `shared/mods/` mountable as read-only
  - [ ] Server-specific overrides supported

### 2.2 Non-Functional Requirements

#### NFR-001: Performance
- **Description**: System resource efficiency
- **Criteria**:
  - Each server consumes only allocated memory (configurable)
  - Container startup time < 60 seconds
  - Lock acquisition < 1 second

#### NFR-002: Reliability
- **Description**: Data integrity and availability
- **Criteria**:
  - World data never corrupted by concurrent access
  - Graceful shutdown preserves all data
  - Lock files cleaned up on abnormal termination

#### NFR-003: Operability
- **Description**: Ease of management and monitoring
- **Criteria**:
  - All operations performable via CLI
  - Health checks for each server
  - Clear error messages and logging

#### NFR-004: Portability
- **Description**: Cross-platform compatibility
- **Criteria**:
  - Works on Linux (primary)
  - Works on macOS (secondary)
  - WSL2 compatible (secondary)

## 3. System Architecture

### 3.1 Directory Structure

```
minecraft/
├── prd.md                       # This document
├── docker-compose.yml           # Main orchestration
├── .env                         # Global environment variables
│
├── scripts/                     # Management scripts
│   ├── mcctl.sh                 # Main CLI
│   ├── lock.sh                  # World locking
│   └── logs.sh                  # Log viewer
│
├── servers/                     # Server configurations
│   ├── _template/               # Template for new servers
│   │   └── config.env
│   ├── survival/
│   │   ├── config.env           # Server settings
│   │   ├── data/                # Server data
│   │   └── logs/                # Server logs
│   ├── creative/
│   │   ├── config.env
│   │   ├── data/
│   │   └── logs/
│   └── modded/
│       ├── config.env
│       ├── data/
│       └── logs/
│
├── worlds/                      # Shared world storage
│   ├── .locks/                  # Lock files
│   ├── survival-world/
│   ├── creative-world/
│   └── modded-world/
│
├── shared/                      # Shared resources
│   ├── plugins/
│   └── mods/
│
└── backups/                     # Backup storage
    ├── worlds/
    └── servers/
```

### 3.2 Docker Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    minecraft-net (bridge)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  mc-survival │  │  mc-creative │  │  mc-modded   │       │
│  │  :25565      │  │  :25566      │  │  :25567      │       │
│  │  Paper       │  │  Vanilla     │  │  Forge       │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
└─────────┼─────────────────┼─────────────────┼────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
    ┌─────────────────────────────────────────────┐
    │              Shared Volumes                  │
    ├─────────────────────────────────────────────┤
    │  worlds/          (rw)  - World data        │
    │  shared/plugins/  (ro)  - Shared plugins    │
    │  shared/mods/     (ro)  - Shared mods       │
    └─────────────────────────────────────────────┘
```

### 3.3 Port Mapping

| Server | Game Port | RCON Port |
|--------|-----------|-----------|
| survival | 25565 | 25575 |
| creative | 25566 | 25576 |
| modded | 25567 | 25577 |

## 4. Detailed Design

### 4.1 World Locking System

#### Lock File Structure
```
worlds/.locks/<world-name>.lock
```

#### Lock File Content
```
<server-name>:<unix-timestamp>:<process-id>
```

#### Lock Operations

| Operation | Command | Description |
|-----------|---------|-------------|
| Acquire | `lock.sh lock <world> <server>` | Get exclusive access |
| Release | `lock.sh unlock <world> <server>` | Release access |
| Check | `lock.sh check <world>` | Query lock status |
| List | `lock.sh list` | Show all locks |

#### Lock Flow
```
Server Start Request
        │
        ▼
┌───────────────────┐
│ Check Lock Status │
└────────┬──────────┘
         │
    ┌────┴────┐
    │ Locked? │
    └────┬────┘
         │
    Yes  │  No
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌──────────────┐
│ ABORT │ │ Acquire Lock │
└───────┘ └──────┬───────┘
                 │
                 ▼
         ┌──────────────┐
         │ Start Server │
         └──────────────┘
```

### 4.2 Logging System

#### Log Configuration
- **Driver**: json-file
- **Max Size**: 50MB per file
- **Max Files**: 5 (rotation)
- **Location**: `servers/<name>/logs/`

#### Log Access Methods
1. Docker logs: `docker logs mc-<server>`
2. File access: `servers/<name>/logs/latest.log`
3. CLI: `mcctl.sh logs <server>`

### 4.3 Management CLI

#### Command Reference

```bash
mcctl.sh <command> [options]

Commands:
  start <server> [world]    Start server with optional world
  stop <server>             Stop server gracefully
  restart <server>          Restart server
  status                    Show all servers status
  logs <server> [lines]     View/tail server logs
  console <server>          Open RCON console

  world list                List all worlds and lock status
  world assign <w> <s>      Assign world to server
  world release <w>         Force release world lock

  backup <target>           Create backup

Options:
  -f, --force              Force operation (skip confirmations)
  -q, --quiet              Suppress output
  -h, --help               Show help
```

## 5. Implementation Plan

### Phase 1: Infrastructure Setup
- [ ] Create directory structure
- [ ] Create `.env` with global settings
- [ ] Create `docker-compose.yml`
- [ ] Create server config templates

### Phase 2: Locking System
- [ ] Implement `scripts/lock.sh`
- [ ] Test lock acquire/release
- [ ] Test concurrent lock attempts
- [ ] Handle stale lock cleanup

### Phase 3: Management CLI
- [ ] Implement `scripts/mcctl.sh`
- [ ] Implement `scripts/logs.sh`
- [ ] Test all CLI commands
- [ ] Add error handling

### Phase 4: Documentation
- [ ] Update `CLAUDE.md`
- [ ] Update `README.md`
- [ ] Create usage examples

### Phase 5: Testing & Refinement
- [ ] Test multi-server startup
- [ ] Test world switching
- [ ] Test failure scenarios
- [ ] Performance validation

## 6. Configuration Reference

### 6.1 Global Environment (.env)

```bash
# Network
MINECRAFT_NETWORK=minecraft-net
MINECRAFT_SUBNET=172.20.0.0/16

# Defaults
DEFAULT_MEMORY=4G
DEFAULT_VERSION=1.20.4
DEFAULT_JAVA=java21

# Timezone
TZ=Asia/Seoul

# RCON (override per-server)
RCON_PASSWORD=change-me-in-production
```

### 6.2 Server Configuration (config.env)

```bash
# Required
EULA=TRUE
TYPE=PAPER
VERSION=1.20.4
MEMORY=4G

# World
LEVEL=survival-world

# Server Properties
MOTD=Welcome to Survival Server
MAX_PLAYERS=50
DIFFICULTY=normal
PVP=true
VIEW_DISTANCE=10

# RCON
ENABLE_RCON=true
RCON_PASSWORD=${RCON_PASSWORD}

# Performance
USE_AIKAR_FLAGS=true
SIMULATION_DISTANCE=8
```

## 7. Testing Plan

### 7.1 Unit Tests

| Test Case | Expected Result |
|-----------|-----------------|
| Lock acquire on free world | Success, lock file created |
| Lock acquire on locked world | Fail with error message |
| Lock release by owner | Success, lock file removed |
| Lock release by non-owner | Fail with error message |

### 7.2 Integration Tests

| Test Case | Expected Result |
|-----------|-----------------|
| Start server with world | Server running, world locked |
| Stop server | Server stopped, world unlocked |
| Start second server same world | Blocked by lock |
| Start second server different world | Both running |

### 7.3 Stress Tests

| Test Case | Expected Result |
|-----------|-----------------|
| 3 servers concurrent start | All start within 2 minutes |
| Rapid start/stop cycles | No orphaned locks |
| Kill -9 server process | Lock recoverable |

## 8. Security Considerations

### 8.1 RCON Security
- RCON passwords stored in `.env` (not committed)
- Per-server password override supported
- RCON ports not exposed externally by default

### 8.2 File Permissions
- Lock files: 644 (owner write, others read)
- Config files: 600 (owner only)
- World data: 755 (Docker user access)

### 8.3 Network Security
- Internal bridge network isolated
- Only game ports exposed to host
- RCON accessible only from localhost

## 9. Future Enhancements

### 9.1 Planned
- [ ] Web-based management UI
- [ ] Automated backup scheduling
- [ ] Discord integration for notifications
- [ ] Prometheus metrics export

### 9.2 Considered
- [ ] Kubernetes deployment option
- [ ] Multi-host cluster support
- [ ] Player synchronization between servers
- [ ] Automated world migration

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-17 | - | Initial PRD |
