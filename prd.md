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
  - [x] `create-server.sh` creates server directory and configuration
  - [x] Updates `servers/compose.yml` (main docker-compose.yml not modified)
  - [x] mc-router auto-discovers servers via Docker labels (no MAPPING needed)
  - [x] Registers hostname with avahi-daemon for mDNS
  - [x] Validates docker-compose.yml after changes
  - [x] Restores backup on validation failure
  - [x] `--start` option starts server after creation (default)
  - [x] `--no-start` option skips server start

#### FR-011: mDNS Auto-Broadcast
- **Priority**: High
- **Description**: Automatically broadcast mDNS (Bonjour/Zeroconf) records for `.local` hostnames so clients can discover servers without manual hosts file configuration
- **Acceptance Criteria**:
  - [x] Use system avahi-daemon for mDNS broadcasting (simpler than Docker service)
  - [x] `create-server.sh` registers hostname in `/etc/avahi/hosts`
  - [x] `delete-server.sh` removes hostname from `/etc/avahi/hosts`
  - [x] avahi-daemon broadcasts mDNS A records for `.local` hostnames
  - [x] Clients on same LAN can connect via `<server>.local:25565` without hosts file
  - [x] Works on Linux (avahi-daemon), macOS (Bonjour), Windows (Bonjour Print Services)
  - [x] Documentation for avahi-daemon setup on various Linux distributions

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
│   │   ├── create-server.sh     # Server creation (registers avahi hostname)
│   │   └── delete-server.sh     # Server deletion (removes avahi hostname)
│   │
│   ├── services/                # Microservices (reserved for future use)
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
│  │   │  mc-router (Docker)  │  │  avahi-daemon      │  │    │
│  │   │  :25565 hostname rte │  │  (system service)  │  │    │
│  │   │  auto-scale up/down  │  │                    │  │    │
│  │   │                      │  │  /etc/avahi/hosts: │  │    │
│  │   │  ironwood.local ─→   │  │  ironwood.local    │  │    │
│  │   │   mc-ironwood        │  │  <server>.local    │  │    │
│  │   │  <server>.local ─→   │  │  (auto-registered  │  │    │
│  │   │   mc-<server>        │  │   by script)       │  │    │
│  │   └──────────┬───────────┘  └─────────┬──────────┘  │    │
│  │              │ Docker Socket          │ mDNS        │    │
│  │   ┌──────────┴───────────────────┐    │ multicast   │    │
│  │   │    minecraft-net (bridge)    │    │             │    │
│  │   │                              │    │             │    │
│  │   │  mc-ironwood  mc-<server>    │    │             │    │
│  │   │  (auto-scale) (auto-scale)   │    │             │    │
│  │   └──────────────────────────────┘    │             │    │
│  │                                       │             │    │
│  └───────────────────────────────────────┼─────────────┘    │
│                                          │                  │
│                                          ▼                  │
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

**Note**: With mc-router, servers start/stop automatically. Manual start/stop is only for maintenance.

### 4.4 mc-router Connection Router

#### Configuration (in docker-compose.yml)
```yaml
router:
  image: itzg/mc-router
  container_name: mc-router
  restart: unless-stopped
  environment:
    IN_DOCKER: "true"
    AUTO_SCALE_UP: "true"
    AUTO_SCALE_DOWN: "true"
    AUTO_SCALE_DOWN_AFTER: "10m"
    DOCKER_TIMEOUT: "120"
    AUTO_SCALE_ASLEEP_MOTD: "§e§lServer is sleeping§r\n§7Connect to wake up!"
  ports:
    - "25565:25565"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
  networks:
    - minecraft-net
```

**Note**: No MAPPING environment variable needed. mc-router auto-discovers servers via Docker labels (`mc-router.host`).

#### Key Settings
| Environment Variable | Description |
|---------------------|-------------|
| `IN_DOCKER` | Enable Docker integration |
| `AUTO_SCALE_UP` | Start containers on client connect |
| `AUTO_SCALE_DOWN` | Stop containers when idle |
| `AUTO_SCALE_DOWN_AFTER` | Idle timeout before shutdown (e.g., "10m") |
| `DOCKER_TIMEOUT` | Wait time for container startup in seconds |
| `AUTO_SCALE_ASLEEP_MOTD` | MOTD when server is sleeping |

#### Container Labels
Each Minecraft server needs these labels:
```yaml
labels:
  mc-router.host: "ironwood.local"
  mc-router.auto-scale-up: "true"
  mc-router.auto-scale-down: "true"
  mc-router.auto-scale-asleep-motd: "§e§lServer is sleeping§r\n§7Connect to wake up!"
```

#### Resource Efficiency
| State | RAM Usage | CPU Usage |
|-------|-----------|-----------|
| All servers stopped | ~20MB (mc-router only) | ~0% |
| 1 server running | 4GB + 20MB | Variable |
| 3 servers running | 12GB + 20MB | Variable |

#### External Access
With mDNS (avahi-daemon) enabled, PCs on the same LAN automatically discover servers:
```
# No configuration needed with mDNS!
# Just connect directly:
ironwood.local:25565

# Fallback (if mDNS unavailable):
# Add to /etc/hosts or C:\Windows\System32\drivers\etc\hosts
192.168.1.100 ironwood.local
```

#### mDNS Setup Guide

**Server Host Setup** (where Minecraft servers run):

| OS | Installation Command |
|----|---------------------|
| Debian/Ubuntu | `sudo apt install avahi-daemon && sudo systemctl enable --now avahi-daemon` |
| CentOS/RHEL/Fedora | `sudo dnf install avahi && sudo systemctl enable --now avahi-daemon` |
| Arch Linux | `sudo pacman -S avahi nss-mdns && sudo systemctl enable --now avahi-daemon` |
| Alpine Linux | `apk add avahi && rc-update add avahi-daemon default && rc-service avahi-daemon start` |

**Client Setup** (connecting to servers):

| OS | Setup |
|----|-------|
| Linux | Install avahi-daemon (same as server) |
| macOS | Built-in Bonjour (no setup needed) |
| Windows | Install [Bonjour Print Services](https://support.apple.com/kb/DL999) or iTunes |
| Windows WSL2 | Install avahi-daemon in WSL; for Windows apps, use Bonjour |

**Detailed Setup Instructions**:

**Debian / Ubuntu (Systemd)**:
```bash
sudo apt update
sudo apt install avahi-daemon
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon
```

**CentOS / RHEL / Fedora (Systemd)**:
```bash
sudo dnf install avahi
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon
# If firewalld is active:
sudo firewall-cmd --permanent --add-service=mdns
sudo firewall-cmd --reload
```

**Arch Linux (Systemd)**:
```bash
sudo pacman -S avahi nss-mdns
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon
# Edit /etc/nsswitch.conf: add 'mdns_minimal [NOTFOUND=return]' before 'resolve'
```

**Alpine Linux (OpenRC)**:
```bash
apk add avahi
rc-update add avahi-daemon default
rc-service avahi-daemon start
```

**Windows WSL2**:
```bash
# Inside WSL2 Ubuntu
sudo apt update
sudo apt install avahi-daemon
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon
# Note: For Windows apps, install Bonjour Print Services
```

**Verification**:
```bash
# Test hostname resolution
ping myserver.local

# Discover mDNS services
avahi-browse -art

# Check registered hostnames
cat /etc/avahi/hosts
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

### Phase 2: mDNS Auto-Broadcast (via avahi-daemon)
- [x] Use system avahi-daemon instead of Docker service (simpler approach)
- [x] `create-server.sh` registers hostname in `/etc/avahi/hosts`
- [x] `delete-server.sh` removes hostname from `/etc/avahi/hosts`
- [x] Document avahi-daemon setup for various OS (Debian, CentOS, Arch, Alpine)
- [x] Document client setup (Linux, macOS, Windows, WSL)
- [x] Test mDNS resolution on local network

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

### Phase 6: npm Package Distribution ✅
- [x] pnpm workspace Monorepo structure
- [x] `@minecraft-docker/shared` - Common types and utilities
- [x] `@minecraft-docker/mcctl` - Global CLI package
- [x] Shell script environment variable support (MCCTL_ROOT, etc.)
- [x] Templates directory for npm distribution
- [x] Data directory: `~/minecraft-servers` (Snap Docker compatible)

**Installation**:
```bash
npm install -g @minecraft-docker/mcctl
mcctl init
mcctl create myserver
```

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

# mc-router Settings (configured in docker-compose.yml environment)
# AUTO_SCALE_DOWN_AFTER=10m      # Stop server after 10 min idle
# DOCKER_TIMEOUT=120             # Wait 2 min for server startup

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
