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
| mc-router | A connection router that automatically scales Minecraft servers via Docker |

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

#### FR-007: Automatic Server Start/Stop (mc-router)
- **Priority**: High
- **Description**: Automatically start servers on client connection and stop after idle timeout
- **Acceptance Criteria**:
  - [ ] mc-router always running, listening on single port with hostname routing
  - [ ] Server auto-starts when client connects (via Docker socket)
  - [ ] MOTD shows server status when sleeping (configurable message)
  - [ ] Server auto-stops after configurable idle timeout (default: 10 min)
  - [ ] Zero resource usage when server is stopped (container not running)
  - [ ] External PCs connect via hostname (e.g., ironwood.local, myserver.local)
  - [ ] Multiple servers supported with hostname-based routing

#### FR-008: Player UUID Lookup
- **Priority**: Medium
- **Description**: Look up player information including Online/Offline UUID via PlayerDB API
- **API**: `https://playerdb.co/api/player/minecraft/{playerName}`
- **Acceptance Criteria**:
  - [ ] Query PlayerDB API to retrieve player information
  - [ ] Return Online UUID (from Mojang account)
  - [ ] Calculate Offline UUID (MD5-based Version 3 UUID)
  - [ ] Display player avatar URL and skin texture
  - [ ] Support `--json` output for Web API integration
  - [ ] Integrate with `mcctl.sh player` command
  - [ ] Handle errors gracefully (player not found, API timeout)

#### FR-009: World Creation Options
- **Priority**: Medium
- **Description**: Support multiple world initialization methods when creating a new server
- **Acceptance Criteria**:
  - [x] Seed specification: Use `SEED` environment variable for new world generation
  - [x] ZIP download: Use `WORLD` environment variable with URL to download and extract world
  - [x] Existing world: Use `LEVEL` environment variable to point to existing world in `worlds/` directory
  - [x] `create-server.sh` supports `--seed <number>` option
  - [x] `create-server.sh` supports `--world-url <url>` option for ZIP download
  - [x] `create-server.sh` supports `--world <name>` option for existing world
  - [x] Options are mutually exclusive (only one can be specified)
  - [x] Clear error messages when invalid options are provided

#### FR-010: Fully Automated Server Creation
- **Priority**: High
- **Description**: Single command to create and configure a new server with all necessary setup
- **Acceptance Criteria**:
  - [x] `create-server.sh` automatically updates main docker-compose.yml
  - [x] Adds include entry for new server
  - [x] Adds MAPPING entry to mc-router configuration
  - [x] Adds depends_on entry for router
  - [x] Validates docker-compose.yml after changes
  - [x] Restores backup on validation failure
  - [x] `--start` option starts server after creation (default)
  - [x] `--no-start` option skips server start

#### FR-011: mDNS Auto-Broadcast
- **Priority**: High
- **Description**: Automatically broadcast mDNS (Bonjour/Zeroconf) records for `.local` hostnames so clients can discover servers without manual hosts file configuration
- **Acceptance Criteria**:
  - [ ] `mdns-publisher` service monitors Docker events (start/die)
  - [ ] Reads `mc-router.host` labels from Minecraft server containers
  - [ ] Broadcasts mDNS A records for `.local` hostnames using `zeroconf` library
  - [ ] Registers on container start, unregisters on container stop
  - [ ] Uses host network mode for proper mDNS packet broadcasting
  - [ ] Health check endpoint for monitoring
  - [ ] Graceful shutdown with proper mDNS unregistration
  - [ ] Clients on same LAN can connect via `ironwood.local:25565` without hosts file
  - [ ] Works on Linux, macOS, and Windows (with Bonjour support)

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
├── CLAUDE.md                    # Project guide
├── README.md                    # Project overview
├── plan.md                      # Implementation roadmap
│
├── platform/                    # Docker platform (all runtime files)
│   ├── docker-compose.yml       # Main orchestration (includes mc-router)
│   ├── .env                     # Global environment variables
│   ├── .env.example             # Environment template
│   │
│   ├── scripts/                 # Management scripts
│   │   └── create-server.sh     # Server creation script (with world options)
│   │
│   ├── services/                # Microservices
│   │   └── mdns-publisher/      # mDNS auto-broadcast service
│   │       ├── Dockerfile
│   │       ├── requirements.txt
│   │       ├── mdns_publisher.py
│   │       └── README.md
│   │
│   ├── servers/                 # Server configurations
│   │   ├── _template/           # Template for new servers
│   │   │   ├── docker-compose.yml
│   │   │   └── config.env
│   │   └── ironwood/            # Example: Paper server (default)
│   │       ├── docker-compose.yml
│   │       ├── config.env
│   │       ├── data/            # Server data (gitignored)
│   │       └── logs/            # Server logs (gitignored)
│   │
│   ├── worlds/                  # Shared world storage
│   │   └── .locks/              # Lock files (future)
│   │
│   ├── shared/                  # Shared resources
│   │   ├── plugins/
│   │   └── mods/
│   │
│   └── backups/                 # Backup storage
│       ├── worlds/
│       └── servers/
│
├── docs/                        # Documentation
│   └── *.md
│
└── .claude/                     # Claude commands
    └── commands/
```

### 3.2 Docker Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Same LAN (Local Network)                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Server Host (192.168.x.x)              │    │
│  │                                                     │    │
│  │   ┌──────────────────────┐  ┌────────────────────┐  │    │
│  │   │  mc-router (Always)  │  │  mdns-publisher    │  │    │
│  │   │  :25565 hostname rte │  │  (mDNS broadcast)  │  │    │
│  │   │                      │  │  host network mode │  │    │
│  │   │  ironwood.local ─→   │  │                    │  │    │
│  │   │   mc-ironwood        │  │  Broadcasts:       │  │    │
│  │   │  <server>.local ─→   │  │  ironwood.local    │  │    │
│  │   │   mc-<server>        │  │  <server>.local    │  │    │
│  │   └──────────┬───────────┘  └─────────┬──────────┘  │    │
│  │              │ Docker Socket          │             │    │
│  │   ┌──────────┴────────────────────────┴───────────┐ │    │
│  │   │           minecraft-net (bridge)              │ │    │
│  │   │                                               │ │    │
│  │   │  mc-ironwood   mc-<server>  (add via script)  │ │    │
│  │   │  (auto-scale)   (auto-scale)                  │ │    │
│  │   │                                               │ │    │
│  │   └───────────────────────────────────────────────┘ │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                              │
│                              │ mDNS (multicast)             │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    External PCs                       │  │
│  │     mDNS auto-discovery (no hosts file needed):       │  │
│  │       ironwood.local → <host-ip> (auto-resolved)      │  │
│  │       <server>.local → <host-ip> (auto-resolved)      │  │
│  │     Connect via: ironwood.local:25565                 │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Port Configuration

#### Hostname-Based Routing (via mc-router)
| Hostname | Backend | Status |
|----------|---------|--------|
| ironwood.local | mc-ironwood:25565 | auto-scale (default) |
| `<server>.local` | `mc-<server>:25565` | add via create-server.sh |

**Note**: All servers share port 25565 via hostname routing.
Clients must configure DNS or hosts file to resolve hostnames.

#### Server Lifecycle
```
Client connects to ironwood.local:25565
        │
        ▼
┌───────────────────┐
│ mc-router receives│
│ (hostname routing)│
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
│ Proxy │  │ docker start     │
│ to MC │  │ Show MOTD        │
└───────┘  │ Client reconnects│
           │ after ~30-60s    │
           └──────────────────┘

After 10 min idle
        │
        ▼
┌───────────────────┐
│  docker stop      │
│  (zero resources) │
└───────────────────┘
```

**Note**: Unlike Lazymc, mc-router does not hold client connections.
Clients must reconnect after server wakes up (typically 30-60 seconds).

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

### 4.4 mc-router Connection Router

#### Configuration (in docker-compose.yml)
```yaml
router:
  image: itzg/mc-router
  command: >
    --in-docker
    --auto-scale-up
    --auto-scale-down
    --auto-scale-down-after=10m
    --docker-timeout=120
    --auto-scale-asleep-motd=§e서버가 시작 중입니다...
  ports:
    - "25565:25565"
  environment:
    MAPPING: |
      ironwood.local=mc-ironwood:25565
      # Add more servers via create-server.sh
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
```

#### Key Settings
| Option | Description |
|--------|-------------|
| `--in-docker` | Enable Docker integration |
| `--auto-scale-up` | Start containers on client connect |
| `--auto-scale-down` | Stop containers when idle |
| `--auto-scale-down-after=10m` | Idle timeout before shutdown |
| `--docker-timeout=120` | Wait time for container startup |
| `--auto-scale-asleep-motd` | MOTD when server is sleeping |

#### Container Labels
Each Minecraft server needs these labels:
```yaml
labels:
  - "mc-router.host=ironwood.local"
  - "mc-router.auto-scale-up=true"
  - "mc-router.auto-scale-down=true"
```

#### Resource Efficiency
| State | RAM Usage | CPU Usage |
|-------|-----------|-----------|
| All servers stopped | ~20MB (mc-router only) | ~0% |
| 1 server running | 4GB + 20MB | Variable |
| 3 servers running | 12GB + 20MB | Variable |

#### External Access
With mDNS publisher enabled, PCs on the same LAN automatically discover servers:
```
# No configuration needed with mDNS!
# Just connect directly:
ironwood.local:25565

# mDNS requirements:
# - Linux: avahi-daemon (usually pre-installed)
# - macOS: Built-in Bonjour (no setup needed)
# - Windows: Bonjour Print Services or iTunes (provides Bonjour)

# Fallback (if mDNS unavailable):
# Add to /etc/hosts or C:\Windows\System32\drivers\etc\hosts
192.168.1.100 ironwood.local
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
- [x] Create directory structure
- [x] Create `.env` with global settings
- [x] Create `docker-compose.yml` with mc-router
- [x] Create server config templates

### Phase 2: mDNS Auto-Broadcast
- [x] Create `services/mdns-publisher/` directory structure
- [x] Implement `mdns_publisher.py` with Docker event monitoring
- [x] Implement mDNS broadcasting with `zeroconf` library
- [x] Create Dockerfile and docker-compose service
- [x] Add health check endpoint
- [ ] Test on Linux, macOS, Windows clients
- [x] Update main docker-compose.yml to include service

### Phase 3: Locking System
- [ ] Implement `scripts/lock.sh`
- [ ] Test lock acquire/release
- [ ] Test concurrent lock attempts
- [ ] Handle stale lock cleanup

### Phase 4: Management CLI
- [ ] Implement `scripts/mcctl.sh`
- [ ] Implement `scripts/logs.sh`
- [ ] Add `--json` output option for Web-ready integration
- [ ] Test all CLI commands
- [ ] Add error handling with proper exit codes

### Phase 5: Documentation
- [ ] Update `CLAUDE.md`
- [ ] Update `README.md`
- [ ] Create usage examples

### Phase 6: Testing & Refinement
- [ ] Test multi-server startup
- [ ] Test world switching
- [ ] Test failure scenarios
- [ ] Performance validation
- [ ] Verify JSON output parsing

### Future: Phase 7 (Web Management UI)
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
MINECRAFT_SUBNET=172.28.0.0/16

# mc-router Settings (configured in docker-compose.yml command)
# --auto-scale-down-after=10m    # Stop server after 10 min idle
# --docker-timeout=120           # Wait 2 min for server startup

# Defaults
DEFAULT_MEMORY=4G
DEFAULT_VERSION=1.20.4

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
LEVEL=ironwood-world

# Server Properties
MOTD=Welcome to Ironwood Server
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
| mc-router hostname routing | Correct backend resolution |
| mc-router Docker labels | All containers have required labels |

### 7.2 Integration Tests

| Test Case | Expected Result |
|-----------|-----------------|
| Client connects to stopped server | mc-router starts container, client reconnects |
| Server idle timeout | Container stops after configured time |
| MOTD when server sleeping | Custom MOTD displayed |
| External PC connection | Can connect via hostname:25565 |
| Multiple servers simultaneously | Each starts/stops independently |
| mc-router restart | Servers maintain state correctly |

### 7.3 Stress Tests

| Test Case | Expected Result |
|-----------|-----------------|
| 3 servers concurrent start | All start within 2 minutes |
| Rapid connect/disconnect | mc-router handles gracefully |
| Kill -9 server process | mc-router detects and recovers |
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
│       ├── mc-router.ts    # mc-router management
│       └── db.ts           # SQLite/PostgreSQL
├── docker/
│   └── docker-compose.yml  # Bundled compose file (includes mc-router)
└── prisma/
    └── schema.prisma       # Database schema
```

#### Architecture
```
┌─────────────────────────────────────────────────┐
│           Web Management UI (Next.js)           │
│                 http://localhost:3000           │
├─────────────────────────────────────────────────┤
│  Dashboard │ Servers │ Worlds │ Logs │ Settings │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│              API Layer (Next.js API)            │
│  /api/servers  /api/worlds  /api/logs  /api/... │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │  Docker  │ │mc-router │ │ Database │
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
| 2.1.0 | 2026-01-17 | - | Migrate from Lazymc to mc-router (hostname routing, Docker auto-scale) |
