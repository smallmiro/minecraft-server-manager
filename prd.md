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
| Lazymc | A proxy that automatically starts/stops Minecraft servers on demand |

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

#### FR-007: Automatic Server Start/Stop (Lazymc)
- **Priority**: High
- **Description**: Automatically start servers on client connection and stop after idle timeout
- **Acceptance Criteria**:
  - [ ] Lazymc proxy always running, listening on fixed ports
  - [ ] Server auto-starts when client connects
  - [ ] "Starting server..." message shown to waiting clients
  - [ ] Server auto-stops after configurable idle timeout (default: 10 min)
  - [ ] Zero resource usage when server is stopped (container not running)
  - [ ] External PCs on same LAN can connect via `<host-ip>:<port>`
  - [ ] Multiple servers supported with different ports

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
├── lazymc.toml                  # Lazymc proxy configuration
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
│                  Same LAN (Local Network)                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Server Host (192.168.x.x)               │    │
│  │                                                      │    │
│  │   ┌─────────────────────────────────────────────┐   │    │
│  │   │         Lazymc Proxy (Always Running)        │   │    │
│  │   │                                              │   │    │
│  │   │   :25565 ──→ mc-survival (auto start/stop)  │   │    │
│  │   │   :25566 ──→ mc-creative (auto start/stop)  │   │    │
│  │   │   :25567 ──→ mc-modded   (auto start/stop)  │   │    │
│  │   │                                              │   │    │
│  │   └─────────────────────┬────────────────────────┘   │    │
│  │                         │                            │    │
│  │   ┌─────────────────────┴────────────────────────┐   │    │
│  │   │           minecraft-net (bridge)              │   │    │
│  │   │                                               │   │    │
│  │   │  mc-survival    mc-creative    mc-modded     │   │    │
│  │   │  (on demand)    (on demand)    (on demand)   │   │    │
│  │   │                                               │   │    │
│  │   └───────────────────────────────────────────────┘   │    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                              │                               │
│  ┌───────────────────────────┴────────────────────────────┐  │
│  │                    External PCs                         │  │
│  │     Connect via: <host-ip>:25565 (survival)            │  │
│  │                   <host-ip>:25566 (creative)            │  │
│  │                   <host-ip>:25567 (modded)              │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Port Configuration

#### Fixed Port Mapping (via Lazymc)
| Server | Game Port | RCON Port | Status |
|--------|-----------|-----------|--------|
| survival | 25565 | 25575 | Lazymc managed |
| creative | 25566 | 25576 | Lazymc managed |
| modded | 25567 | 25577 | Lazymc managed |

#### Server Lifecycle
```
Client connects to :25565
        │
        ▼
┌───────────────────┐
│  Lazymc receives  │
└────────┬──────────┘
         │
    ┌────┴────┐
    │ Server  │
    │ running?│
    └────┬────┘
         │
   Yes   │   No
   ┌─────┴─────┐
   │           │
   ▼           ▼
┌───────┐  ┌──────────────────┐
│ Proxy │  │ Show "Starting..." │
│ to MC │  │ docker start      │
└───────┘  │ wait for ready    │
           │ then proxy        │
           └──────────────────┘

After 10 min idle
        │
        ▼
┌───────────────────┐
│  docker stop      │
│  (zero resources) │
└───────────────────┘
```

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
  status                    Show all servers status (running/stopped)
  logs <server> [lines]     View/tail server logs
  console <server>          Open RCON console

  world list                List all worlds and lock status
  world assign <w> <s>      Assign world to server
  world release <w>         Force release world lock

  backup <target>           Create backup

  # Manual override (bypasses Lazymc auto-management)
  start <server>            Force start server
  stop <server>             Force stop server

Options:
  -f, --force              Force operation (skip confirmations)
  -q, --quiet              Suppress output
  -h, --help               Show help
```

**Note**: With Lazymc, servers start/stop automatically. Manual start/stop is only for maintenance.

### 4.4 Lazymc Proxy System

#### Configuration File
```
lazymc.toml
```

#### Key Settings
```toml
[public]
address = "0.0.0.0:25565"              # External listening port
motd = "§7Server starting..."          # Message when server is down

[server]
address = "mc-survival:25565"          # Internal server address

[docker]
enabled = true
container = "mc-survival"              # Container to control

[time]
sleep_after = 600                      # Stop after 10 min idle
minimum_online_time = 60               # Min time before auto-stop
```

#### Multi-Server Configuration
```toml
# Server 1: Survival
[[servers]]
name = "survival"
[servers.public]
address = "0.0.0.0:25565"
[servers.docker]
container = "mc-survival"

# Server 2: Creative
[[servers]]
name = "creative"
[servers.public]
address = "0.0.0.0:25566"
[servers.docker]
container = "mc-creative"

# Server 3: Modded
[[servers]]
name = "modded"
[servers.public]
address = "0.0.0.0:25567"
[servers.docker]
container = "mc-modded"
```

#### Resource Efficiency
| State | RAM Usage | CPU Usage |
|-------|-----------|-----------|
| All servers stopped | ~50MB (Lazymc only) | ~0% |
| 1 server running | 4GB + 50MB | Variable |
| 3 servers running | 12GB + 50MB | Variable |

#### External Access
PCs on the same LAN can connect using:
```
<server-host-ip>:<port>

Example:
  Server Host: 192.168.1.100
  Survival: 192.168.1.100:25565
  Creative: 192.168.1.100:25566
  Modded:   192.168.1.100:25567
```

## 5. Implementation Plan

### Development Strategy: CLI-First, Web-Ready

All features are implemented via **CLI first** (Phase 1-5), with **Web Management UI** as a future enhancement (see Section 9.1).

**Why CLI-First?**
- Immediate usability without additional infrastructure
- Scripts can be automated via cron, systemd, etc.
- Foundation for Web API (scripts become backend functions)
- Easy testing and debugging

**Web-Ready Design Principles**:
When implementing CLI tools, always consider future Web UI integration:

| Principle | CLI Implementation | Web Integration |
|-----------|-------------------|-----------------|
| **Structured Output** | `mcctl.sh status --json` | API returns JSON directly |
| **Exit Codes** | 0=success, 1=error, 2=warning | HTTP status codes mapping |
| **Config Files** | TOML, JSON, env files | Parseable by Node.js |
| **Stateless Operations** | Each command is independent | Stateless API endpoints |
| **Separation of Concerns** | Logic in functions, CLI in main | Functions become API handlers |

### Phase 1: Infrastructure Setup
- [ ] Create directory structure
- [ ] Create `.env` with global settings
- [ ] Create `docker-compose.yml` with Lazymc
- [ ] Create `lazymc.toml`
- [ ] Create server config templates

### Phase 2: Locking System
- [ ] Implement `scripts/lock.sh`
- [ ] Test lock acquire/release
- [ ] Test concurrent lock attempts
- [ ] Handle stale lock cleanup

### Phase 3: Management CLI
- [ ] Implement `scripts/mcctl.sh`
- [ ] Implement `scripts/logs.sh`
- [ ] Add `--json` output option for Web-ready integration
- [ ] Test all CLI commands
- [ ] Add error handling with proper exit codes

### Phase 4: Documentation
- [ ] Update `CLAUDE.md`
- [ ] Update `README.md`
- [ ] Create usage examples

### Phase 5: Testing & Refinement
- [ ] Test multi-server startup
- [ ] Test world switching
- [ ] Test failure scenarios
- [ ] Performance validation
- [ ] Verify JSON output parsing

### Future: Phase 6 (Web Management UI)
See **Section 9.1** for detailed Web UI implementation plan.
- Wrap CLI functions with Next.js API routes
- Build MUI dashboard components
- Add SQLite/PostgreSQL for persistent state
- Package as npm module

## 6. Configuration Reference

### 6.1 Global Environment (.env)

```bash
# Network
MINECRAFT_NETWORK=minecraft-net
MINECRAFT_SUBNET=172.20.0.0/16

# Lazymc Settings
LAZYMC_IDLE_TIMEOUT=600          # Stop server after 10 min idle
LAZYMC_MIN_ONLINE_TIME=60        # Min time before auto-stop

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
| Lazymc config validation | Valid TOML, correct container names |
| Lazymc port binding | All configured ports accessible |

### 7.2 Integration Tests

| Test Case | Expected Result |
|-----------|-----------------|
| Client connects to stopped server | Lazymc starts container, client connects |
| Server idle timeout | Container stops after configured time |
| Second client during startup | Queued and connected after ready |
| External PC connection | Can connect via host-ip:port |
| Multiple servers simultaneously | Each starts/stops independently |
| Lazymc restart | Servers maintain state correctly |

### 7.3 Stress Tests

| Test Case | Expected Result |
|-----------|-----------------|
| 3 servers concurrent start | All start within 2 minutes |
| Rapid connect/disconnect | Lazymc handles gracefully |
| Kill -9 server process | Lazymc detects and recovers |
| Multiple clients same server | All connected successfully |
| Long idle period | Server stops, restarts on next connect |

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

### 9.1 Planned: Web Management UI (All-in-One Package)

**Goal**: Create a web-based management tool that provides complete control over the Minecraft server infrastructure.

#### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js, TypeScript, MUI (Material-UI) |
| Backend | Next.js API Routes |
| Database | SQLite (default) or PostgreSQL (optional) |
| Packaging | npm package (all-in-one installation) |

#### Features
- [ ] Dashboard with server status overview
- [ ] Start/Stop/Restart servers via UI
- [ ] World management (create, assign, backup)
- [ ] Player management and whitelist
- [ ] Log viewer with real-time streaming
- [ ] Configuration editor (server.properties, config.env)
- [ ] Backup scheduling and management
- [ ] Resource monitoring (CPU, RAM, disk)
- [ ] User authentication and access control

#### Installation Goal
```bash
# Single command installation
npm install minecraft-server-manager

# Or global installation
npm install -g minecraft-server-manager

# Start the management UI
minecraft-manager start
# → Opens http://localhost:3000
# → All Docker containers, Lazymc, and servers managed from UI
```

#### Package Structure
```
minecraft-server-manager/
├── package.json
├── bin/
│   └── cli.js              # CLI entry point
├── src/
│   ├── app/                # Next.js app
│   ├── components/         # MUI components
│   ├── api/                # API routes
│   └── lib/
│       ├── docker.ts       # Docker API integration
│       ├── lazymc.ts       # Lazymc management
│       └── db.ts           # SQLite/PostgreSQL
├── docker/
│   ├── docker-compose.yml  # Bundled compose file
│   └── lazymc.toml         # Bundled Lazymc config
└── prisma/
    └── schema.prisma       # Database schema
```

#### Architecture
```
┌─────────────────────────────────────────────────┐
│           Web Management UI (Next.js)            │
│                 http://localhost:3000            │
├─────────────────────────────────────────────────┤
│  Dashboard │ Servers │ Worlds │ Logs │ Settings │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│              API Layer (Next.js API)             │
│  /api/servers  /api/worlds  /api/logs  /api/... │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │  Docker  │ │  Lazymc  │ │ Database │
    │   API    │ │  Config  │ │ SQLite/  │
    │          │ │          │ │ Postgres │
    └──────────┘ └──────────┘ └──────────┘
```

### 9.2 Other Planned Features
- [ ] Automated backup scheduling
- [ ] Discord integration for notifications
- [ ] Prometheus metrics export

### 9.3 Considered
- [ ] Kubernetes deployment option
- [ ] Multi-host cluster support
- [ ] Player synchronization between servers
- [ ] Automated world migration

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-17 | - | Initial PRD |
| 1.1.0 | 2025-01-17 | - | Add automatic port assignment (FR-007) |
| 2.0.0 | 2025-01-17 | - | Replace port assignment with Lazymc auto start/stop |
