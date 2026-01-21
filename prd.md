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
  - [x] At least 3 servers can run concurrently
  - [x] Each server has independent configuration
  - [x] Servers can be started/stopped independently
  - [x] Different server types supported (Vanilla, Paper, Forge, Fabric)

#### FR-002: Shared World Storage
- **Priority**: High
- **Description**: All servers share a common world storage directory
- **Acceptance Criteria**:
  - [x] `worlds/` directory accessible by all servers
  - [x] Worlds can be assigned to different servers
  - [x] World data persists across server restarts
  - [x] New worlds can be created and managed

#### FR-003: World Locking Mechanism
- **Priority**: High
- **Description**: Prevent multiple servers from using the same world simultaneously
- **Acceptance Criteria**:
  - [x] Only one server can use a world at a time
  - [x] Lock is acquired before server starts
  - [x] Lock is released when server stops
  - [x] Lock status is queryable
  - [x] Stale locks can be manually cleared

#### FR-004: Per-Server Logging
- **Priority**: Medium
- **Description**: Each server maintains separate log files
- **Acceptance Criteria**:
  - [x] Logs stored in `servers/<name>/logs/`
  - [x] Log rotation configured (max size, max files)
  - [x] Logs viewable via CLI command
  - [x] Real-time log tailing supported

#### FR-005: Management CLI
- **Priority**: Medium
- **Description**: Command-line tool for server management
- **Acceptance Criteria**:
  - [x] Start/stop/restart servers
  - [x] View server status
  - [x] View and tail logs
  - [x] Manage world assignments
  - [x] Access RCON console

#### FR-006: Shared Resources
- **Priority**: Low
- **Description**: Plugins and mods can be shared across servers
- **Acceptance Criteria**:
  - [x] `shared/plugins/` mountable as read-only
  - [x] `shared/mods/` mountable as read-only
  - [x] Server-specific overrides supported

#### FR-007: Automatic Server Start/Stop (mc-router)
- **Priority**: High
- **Description**: Automatically start servers on client connection and stop after idle timeout
- **Acceptance Criteria**:
  - [x] mc-router always running, listening on single port with hostname routing
  - [x] Server auto-starts when client connects (via Docker socket)
  - [x] MOTD shows server status when sleeping (configurable message)
  - [x] Server auto-stops after configurable idle timeout (default: 10 min)
  - [x] Zero resource usage when server is stopped (container not running)
  - [x] External PCs connect via hostname (e.g., ironwood.local, myserver.local)
  - [x] Multiple servers supported with hostname-based routing

#### FR-008: Player UUID Lookup
- **Priority**: Medium
- **Description**: Look up player information including Online/Offline UUID via PlayerDB API
- **API**: `https://playerdb.co/api/player/minecraft/{playerName}`
- **Acceptance Criteria**:
  - [x] Query PlayerDB API to retrieve player information
  - [x] Return Online UUID (from Mojang account)
  - [x] Calculate Offline UUID (MD5-based Version 3 UUID)
  - [x] Display player avatar URL and skin texture
  - [x] Support `--json` output for Web API integration
  - [x] Integrate with `mcctl.sh player` command
  - [x] Handle errors gracefully (player not found, API timeout)

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

#### FR-012: nip.io Magic DNS Support
- **Priority**: High
- **Description**: Add nip.io magic DNS as alternative hostname routing method. nip.io automatically resolves `<name>.<ip>.nip.io` to `<ip>` without any client configuration.
- **Issue**: [#52](https://github.com/smallmiro/minecraft-server-manager/issues/52)
- **Acceptance Criteria**:
  - [x] `HOST_IP` in `.env` used to generate nip.io hostnames
  - [x] `create-server.sh` generates dual hostname: `<name>.local,<name>.<HOST_IP>.nip.io`
  - [x] Template updated with nip.io documentation
  - [x] Migration script for existing servers (`migrate-nip-io.sh`)
  - [x] Fallback to `.local` only if `HOST_IP` not set
  - [x] Clients can connect via `<server>.<HOST_IP>.nip.io:25565` without any setup
  - [x] Documentation updated with nip.io connection examples

#### FR-013: Individual Server Backup/Restore
- **Priority**: Medium
- **Description**: Backup and restore individual server configuration files (not world data). Enables saving server settings before changes and restoring if needed.
- **Issue**: [#64](https://github.com/smallmiro/minecraft-server-manager/issues/64)
- **Acceptance Criteria**:
  - [x] `mcctl server-backup <server>` creates backup tar.gz with manifest
  - [x] `mcctl server-backup <server> --list` shows all backups for a server
  - [x] `mcctl server-restore <server>` shows interactive backup selection
  - [x] `mcctl server-restore <server> <id>` restores specific backup
  - [x] Backup includes: config.env, docker-compose.yml, ops.json, whitelist.json, banned-players.json, banned-ips.json
  - [x] Backup stored in `~/minecraft-servers/backups/servers/<server>/`
  - [x] Backup filename includes timestamp (e.g., `20250120-143025.tar.gz`)
  - [x] manifest.json contains metadata (version, files, checksums, server config)
  - [x] Restore prompts for confirmation (unless --force)
  - [x] `--dry-run` option shows what would be restored without changes

#### FR-014: World Selection Enhancement
- **Priority**: Medium
- **Description**: Enhanced world selection in `mcctl create` that shows available worlds with usage status, allowing users to select from existing worlds categorized by availability.
- **Issue**: [#66](https://github.com/smallmiro/minecraft-server-manager/issues/66)
- **Acceptance Criteria**:
  - [ ] Show available worlds in interactive mode when "Use existing world" is selected
  - [ ] Display 3 categories: Available (not used), Reusable (server stopped), Locked (server running)
  - [ ] Show server name and status for locked/reusable worlds
  - [ ] Allow selection via @clack/prompts select UI
  - [ ] Warn user when selecting world used by stopped server (will transfer ownership)
  - [ ] Block selection of worlds used by running servers
  - [ ] Maintain backward compatibility with CLI arguments (`-w <name>`)

#### FR-015: Player Management Commands
- **Priority**: Medium
- **Description**: Comprehensive player management commands for whitelist, ban/unban, and kick operations, integrated with existing player lookup feature for UUID resolution.
- **Issue**: [#67](https://github.com/smallmiro/minecraft-server-manager/issues/67)
- **Acceptance Criteria**:
  - [ ] `mcctl whitelist <server> <add|remove|list|on|off> [player]` - Whitelist management
  - [ ] `mcctl ban <server> <add|remove|list> [player] [--reason]` - Ban management
  - [ ] `mcctl kick <server> <player> [--reason]` - Kick player from server
  - [ ] Integration with PlayerLookupUseCase for UUID resolution
  - [ ] RCON command execution for runtime changes
  - [ ] JSON file updates for persistence (whitelist.json, banned-players.json)
  - [ ] `--json` output support for all commands
  - [ ] Interactive mode with player name autocomplete from online players

#### FR-016: Detailed Server Monitoring
- **Priority**: Medium
- **Description**: Enhanced monitoring capabilities showing detailed server and mc-router status including online players, resource usage, uptime, and real-time updates.
- **Issue**: [#68](https://github.com/smallmiro/minecraft-server-manager/issues/68)
- **Acceptance Criteria**:
  - [ ] `mcctl status --detail` shows comprehensive server information
  - [ ] `mcctl status --watch` enables real-time status updates (5s interval)
  - [ ] `mcctl status <server>` shows single server detailed status
  - [ ] `mcctl router status` shows mc-router specific information
  - [ ] Display online player count and names per server
  - [ ] Display memory/CPU usage from Docker stats
  - [ ] Display server uptime
  - [ ] Display TPS (ticks per second) when available
  - [ ] Display mc-router connection stats and routing table
  - [ ] `--json` output support for all monitoring commands

#### FR-017: Sudo Password Handling for Automation ✅
- **Priority**: Medium
- **Description**: Add sudo password handling mechanism to enable CLI automation. Scripts requiring sudo (create-server.sh, delete-server.sh) currently block automation due to password prompts.
- **Issue**: [#72](https://github.com/smallmiro/minecraft-server-manager/issues/72)
- **PR**: [#74](https://github.com/smallmiro/minecraft-server-manager/pull/74)
- **Status**: ✅ Completed
- **Acceptance Criteria**:
  - [x] `--sudo-password` CLI option for create/delete commands
  - [x] `MCCTL_SUDO_PASSWORD` environment variable support
  - [x] Interactive password prompt using `@clack/prompts` password() when needed
  - [x] Bash scripts support `sudo -S` with password from environment
  - [x] Password not visible in process list (`ps aux`)
  - [x] Password never logged to files or console
  - [x] Documentation for sudoers NOPASSWD configuration as alternative

#### FR-018: Unified Player Management with Interactive Mode ✅
- **Priority**: Medium
- **Description**: Create unified `mcctl player` command with interactive mode for comprehensive player management. Integrate Mojang API with encrypted local cache to minimize API calls and avoid rate limiting.
- **Issue**: [#73](https://github.com/smallmiro/minecraft-server-manager/issues/73)
- **PR**: [#75](https://github.com/smallmiro/minecraft-server-manager/pull/75)
- **Status**: ✅ Completed
- **Acceptance Criteria**:
  - [x] `mcctl player` unified interactive mode (server → player → action)
  - [x] `mcctl player info <name>` shows player info (UUID, skin URL)
  - [x] `mcctl player cache clear` clears cached player data
  - [x] `mcctl player cache stats` shows cache statistics
  - [x] Server selection prompt showing online player counts
  - [x] Player selection from online players or manual entry
  - [x] Action selection (view info, whitelist, ban, op, kick)
  - [x] Reusable prompt components (`server-select`, `player-select`, `action-select`)
  - [x] Interactive mode for existing commands (whitelist, ban, op, kick)
  - [x] Mojang API integration with encrypted local cache
  - [x] Cache location: `~/.minecraft-docker/.player-cache`
  - [x] Cache encryption: AES-256-GCM with machine-specific key
  - [x] Cache policy: UUID permanent, username 30 days, skin 1 day
  - [x] Cache file permissions: `600`
  - [x] Support offline UUID calculation for offline-mode servers

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

### Phase 3: Locking System ✅
- [x] Implement `scripts/lock.sh`
- [x] Test lock acquire/release
- [x] Test concurrent lock attempts
- [x] Handle stale lock cleanup

### Phase 4: Management CLI ✅
- [x] Implement `scripts/mcctl.sh`
- [x] Implement `scripts/logs.sh`
- [x] Add `--json` output option for Web-ready integration
- [x] Test all CLI commands
- [x] Add error handling with proper exit codes

### Phase 5: Documentation
- [ ] Update `CLAUDE.md`
- [ ] Update `README.md`
- [ ] Create usage examples

### Phase 6: Testing & Refinement (Partial)
- [x] Test multi-server startup
- [x] Test world switching
- [ ] Test failure scenarios
- [ ] Performance validation
- [x] Verify JSON output parsing

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

### Phase 7: CLI Interactive Mode ✅
> **Milestone**: [v0.4.0](https://github.com/smallmiro/minecraft-server-manager/milestone/4)

See **Section 9** for detailed CLI Architecture (Hexagonal + Clean Architecture).
- [x] Add `@clack/prompts` dependency
- [x] Implement Domain Layer (Value Objects, Entities)
- [x] Implement Application Layer (Ports, Use Cases)
- [x] Implement Infrastructure Adapters (ClackPromptAdapter, DocsAdapter)
- [x] Interactive `mcctl create` command
- [x] Interactive `mcctl delete` command
- [x] Interactive world and backup commands
- [x] Unit and integration tests
- [x] Documentation update

### Future: Phase 8 (Web Management UI)
See **Section 10.1** for detailed Web UI implementation plan.
- Wrap CLI functions with Next.js API routes
- Build Tailwind CSS dashboard components
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

## 9. CLI Architecture (Hexagonal + Clean Architecture)

> **Milestone**: [v0.4.0 - CLI Interactive Mode](https://github.com/smallmiro/minecraft-server-manager/milestone/4)
> **Issues**: [#30](https://github.com/smallmiro/minecraft-server-manager/issues/30) - [#40](https://github.com/smallmiro/minecraft-server-manager/issues/40)

### 9.1 Design Principles

#### SOLID Principles
| Principle | Application |
|-----------|-------------|
| **SRP** | Each class has single responsibility (e.g., `ServerCreator` only creates servers) |
| **OCP** | Open for extension via interfaces, closed for modification |
| **LSP** | All implementations are substitutable for their interfaces |
| **ISP** | Small, focused interfaces (e.g., `IPromptPort`, `IShellPort`) |
| **DIP** | Domain depends on abstractions, not concrete implementations |

#### Clean Code Guidelines
- Meaningful names: `createServerWithPrompts()` not `create()`
- Small functions: Max 20 lines per function
- No side effects: Pure functions where possible
- Error handling: Result pattern over exceptions

#### Technology Stack: CLI Framework

| Component | Package | Purpose |
|-----------|---------|---------|
| **Prompts** | `@clack/prompts` | Interactive CLI prompts (input, select, confirm, multiselect) |
| **Spinner** | `@clack/prompts` (built-in) | Progress indicators during async operations |
| **Colors** | `picocolors` | Terminal color styling (lightweight alternative to chalk) |

**Why @clack/prompts?**
- Modern, accessible UI with beautiful terminal output
- Built-in spinner functionality (no separate `ora` dependency)
- Small bundle size (~20KB vs inquirer's ~200KB)
- TypeScript-first with excellent type inference
- Active maintenance and growing ecosystem

**Example Usage:**
```typescript
import * as p from '@clack/prompts';

// Start a prompt group with intro
p.intro('Create Minecraft Server');

// Text input with validation
const name = await p.text({
  message: 'Server name',
  placeholder: 'myserver',
  validate: (value) => {
    if (!/^[a-z0-9-]+$/.test(value)) {
      return 'Only lowercase letters, numbers, and hyphens allowed';
    }
  }
});

// Select with options
const type = await p.select({
  message: 'Server type',
  options: [
    { value: 'PAPER', label: 'Paper', hint: 'High-performance (recommended)' },
    { value: 'VANILLA', label: 'Vanilla', hint: 'Official Mojang server' },
    { value: 'FORGE', label: 'Forge', hint: 'Mod support' },
    { value: 'FABRIC', label: 'Fabric', hint: 'Lightweight mods' },
  ]
});

// Spinner for async operations
const s = p.spinner();
s.start('Creating server...');
await createServer(name, type);
s.stop('Server created!');

// End with outro
p.outro('Connect via: myserver.local:25565');
```

### 9.2 Hexagonal Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │   CLI Entry    │  │  Web API       │  │  (Future)      │        │
│  │   (index.ts)   │  │  (Next.js)     │  │  Discord Bot   │        │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘        │
└──────────┼───────────────────┼───────────────────┼─────────────────┘
           │                   │                   │
           ▼                   ▼                   ▼
┌────────────────────────────────────────────────────────────────────┐
│                      PRIMARY ADAPTERS (Driving)                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Command Handlers                         │   │
│  │   CreateServerCommand │ DeleteServerCommand │ StatusCommand │   │
│  └────────────────────────────────┬────────────────────────────┘   │
└───────────────────────────────────┼────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                         PRIMARY PORTS (Inbound)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │IServerUseCase│  │IWorldUseCase │  │IBackupUseCase│              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼─────────────────┼─────────────────┼──────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER (Use Cases)                  │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  CreateServerUseCase │ DeleteServerUseCase │ BackupUseCase │    │
│  │  AssignWorldUseCase  │ LockWorldUseCase    │ StatusUseCase │    │
│  └────────────────────────────────┬───────────────────────────┘    │
└───────────────────────────────────┼────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                          DOMAIN LAYER                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                      Entities                              │    │
│  │   Server │ World │ Lock │ Player │ Backup │ ServerConfig   │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │                    Value Objects                           │    │
│  │   ServerName │ ServerType │ McVersion │ WorldSeed │ UUID   │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │                   Domain Services                          │    │
│  │   ServerConfigBuilder │ WorldValidator │ LockManager       │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                       SECONDARY PORTS (Outbound)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ IPromptPort  │  │ IShellPort   │  │ IDocProvider │              │
│  │ IConfigPort  │  │ IDockerPort  │  │ IPlayerAPI   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼─────────────────┼─────────────────┼──────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                    SECONDARY ADAPTERS (Driven)                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ ClackPrompt    │  │ BashShellExec  │  │ DocsProvider   │        │
│  │ ConfigFileRepo │  │ DockerodeAPI   │  │ PlayerDBAPI    │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Bash Scripts (Delegation)                │   │
│  │   create-server.sh │ delete-server.sh │ backup.sh │ lock.sh │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

### 9.3 Directory Structure

> **Note**: Issue [#54](https://github.com/smallmiro/minecraft-server-manager/issues/54) - Domain/Application Layer를 shared 패키지로 이동하여 CLI와 web-admin이 공유하도록 리팩토링 예정

#### Target Structure (After Refactoring)

```
platform/services/
├── shared/                          # @minecraft-docker/shared (공통 비즈니스 로직)
│   └── src/
│       ├── index.ts
│       │
│       ├── domain/                  # 🟢 DOMAIN LAYER (공통)
│       │   ├── entities/
│       │   │   ├── Server.ts
│       │   │   ├── World.ts
│       │   │   └── Lock.ts
│       │   └── value-objects/
│       │       ├── ServerName.ts
│       │       ├── ServerType.ts
│       │       ├── McVersion.ts
│       │       ├── Memory.ts
│       │       └── WorldOptions.ts
│       │
│       ├── application/             # 🟡 APPLICATION LAYER (공통)
│       │   ├── ports/
│       │   │   ├── inbound/         # Use Case 인터페이스
│       │   │   └── outbound/        # Repository/Service 인터페이스
│       │   └── use-cases/
│       │       ├── CreateServerUseCase.ts
│       │       ├── DeleteServerUseCase.ts
│       │       └── ...
│       │
│       ├── infrastructure/          # 🔴 공통 INFRASTRUCTURE
│       │   ├── adapters/
│       │   │   ├── ShellAdapter.ts
│       │   │   ├── ServerRepository.ts
│       │   │   └── WorldRepository.ts
│       │   └── docker/              # Docker 유틸리티
│       │
│       ├── types/                   # 타입 정의
│       └── utils/                   # 유틸리티 함수
│
├── cli/                             # @minecraft-docker/mcctl (CLI 전용)
│   └── src/
│       ├── index.ts                 # Entry point
│       ├── adapters/
│       │   └── ClackPromptAdapter.ts  # CLI 전용 (@clack/prompts)
│       ├── di/
│       │   └── container.ts         # CLI용 DI 구성
│       └── commands/
│           ├── create.ts
│           ├── delete.ts
│           └── ...
│
└── web-admin/                       # @minecraft-docker/web-admin (Web 전용, 향후)
    └── src/
        ├── api/                     # REST/GraphQL endpoints
        ├── adapters/
        │   └── WebPromptAdapter.ts  # Web 전용 (HTTP 기반)
        ├── di/
        │   └── container.ts         # Web용 DI 구성
        └── index.ts
```

#### Layer Placement Strategy

| Layer | Package | Reason |
|-------|---------|--------|
| Domain (entities, value-objects) | `shared` | 비즈니스 규칙은 UI와 무관 |
| Application (ports, use-cases) | `shared` | 비즈니스 로직은 공통 |
| Infrastructure (shell, repos) | `shared` | bash 스크립트 호출은 동일 |
| ClackPromptAdapter | `cli` | @clack/prompts는 CLI 전용 |
| WebPromptAdapter | `web-admin` | HTTP 기반은 Web 전용 |
| DI Container | 각 서비스 | 서비스별 어댑터 주입이 다름 |

### 9.4 Port Interfaces

#### IPromptPort (User Interaction)
```typescript
// application/ports/outbound/IPromptPort.ts
export interface IPromptPort {
  // Basic prompts
  input(message: string, options?: InputOptions): Promise<string>;
  select<T>(message: string, choices: Choice<T>[]): Promise<T>;
  confirm(message: string, defaultValue?: boolean): Promise<boolean>;

  // Domain-specific prompts (composed from docs/)
  promptServerName(): Promise<ServerName>;
  promptServerType(): Promise<ServerType>;
  promptMcVersion(type: ServerType): Promise<McVersion>;
  promptWorldOptions(): Promise<WorldOptions>;
  promptMemory(): Promise<Memory>;

  // Feedback
  spinner(message: string): Spinner;
  success(message: string): void;
  error(message: string): void;
  warn(message: string): void;
}
```

#### IShellPort (Script Execution)
```typescript
// application/ports/outbound/IShellPort.ts
export interface IShellPort {
  // Script execution (delegates to Bash)
  createServer(name: ServerName, config: ServerConfig): Promise<Result<void>>;
  deleteServer(name: ServerName, force: boolean): Promise<Result<void>>;
  startServer(name: ServerName): Promise<Result<void>>;
  stopServer(name: ServerName): Promise<Result<void>>;

  // World operations
  lockWorld(world: string, server: string): Promise<Result<void>>;
  unlockWorld(world: string, server: string): Promise<Result<void>>;

  // Backup operations
  backupPush(message: string): Promise<Result<void>>;
  backupRestore(commit: string): Promise<Result<void>>;
}
```

#### IDocProvider (Documentation Access)
```typescript
// application/ports/outbound/IDocProvider.ts
export interface IDocProvider {
  // Server types from docs/06-types-and-platforms.md
  getServerTypes(): Promise<ServerTypeInfo[]>;
  getServerTypeDetails(type: ServerType): Promise<ServerTypeDetails>;

  // Variables from docs/03-variables.md
  getVariables(category?: string): Promise<Variable[]>;
  getVariableDescription(name: string): Promise<string>;

  // Versions
  getSupportedVersions(type: ServerType): Promise<McVersion[]>;
}
```

### 9.5 Use Case Example: CreateServerUseCase

```typescript
// application/use-cases/server/CreateServerUseCase.ts
export class CreateServerUseCase implements IServerUseCase {
  constructor(
    private readonly promptPort: IPromptPort,
    private readonly shellPort: IShellPort,
    private readonly docProvider: IDocProvider,
    private readonly configPort: IConfigPort,
  ) {}

  async execute(options?: Partial<ServerConfig>): Promise<Result<Server>> {
    // 1. Collect information via prompts (uses docs/ for choices)
    const serverTypes = await this.docProvider.getServerTypes();

    const name = options?.name ?? await this.promptPort.promptServerName();
    const type = options?.type ?? await this.promptPort.promptServerType();
    const version = options?.version ?? await this.promptPort.promptMcVersion(type);
    const worldOptions = await this.promptPort.promptWorldOptions();
    const memory = options?.memory ?? await this.promptPort.promptMemory();

    // 2. Build validated config (domain service)
    const config = ServerConfigBuilder.create()
      .withName(name)
      .withType(type)
      .withVersion(version)
      .withWorld(worldOptions)
      .withMemory(memory)
      .build();

    // 3. Confirm with user
    this.promptPort.showSummary(config);
    const confirmed = await this.promptPort.confirm('Create server?');
    if (!confirmed) {
      return Result.cancelled();
    }

    // 4. Execute via shell (delegates to Bash script)
    const spinner = this.promptPort.spinner('Creating server...');
    const result = await this.shellPort.createServer(name, config);

    if (result.isSuccess()) {
      spinner.succeed(`Server '${name.value}' created!`);
      return Result.ok(new Server(name, config));
    } else {
      spinner.fail('Failed to create server');
      return Result.fail(result.error);
    }
  }
}
```

### 9.6 Prompt Flow with Docs Integration

```
┌──────────────────────────────────────────────────────────────────┐
│                     User runs: mcctl create                      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  ClackPromptAdapter.promptServerName()                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ◆ 서버 이름을 입력하세요: █                                    │  │
│  │    (소문자, 숫자, 하이픈만 사용 가능)                            │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ validated: ServerName("myserver")
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  DocsProviderAdapter.getServerTypes()                            │
│  → Reads docs/06-types-and-platforms.md                          │
│  → Returns: [PAPER, VANILLA, FORGE, FABRIC, QUILT, ...]          │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  ClackPromptAdapter.promptServerType()                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ◆ 서버 타입을 선택하세요:                                      │  │
│  │  ● Paper (추천) - High-performance Spigot fork              │  │
│  │  ○ Vanilla - Official Mojang server                        │  │
│  │    Forge - Mod support server                              │  │
│  │    Fabric - Lightweight mod loader                         │  │
│  │    Quilt - Fabric compatible                               │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ selected: ServerType.PAPER
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  ClackPromptAdapter.promptMcVersion(PAPER)                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ? Minecraft 버전을 입력하세요: 1.21.1                         │  │
│  │    (지원: 1.8.8 ~ 1.21.1)                                   │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  ClackPromptAdapter.promptWorldOptions()                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ? 월드 설정 방법을 선택하세요:                                  │  │
│  │  ❯ 새 월드 생성 (기본)                                         │  │
│  │    시드 지정                                                 │  │
│  │    기존 월드 사용                                             │  │
│  │    URL에서 다운로드                                           │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  ClackPromptAdapter.promptMemory()                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ? 메모리 할당량: 4G                                          │  │
│  │    (형식: 2G, 4G, 8G 또는 2048M)                             │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Confirmation Summary                                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  📋 설정 확인:                                               │  │
│  │     이름: myserver                                          │  │
│  │     타입: PAPER                                             │  │
│  │     버전: 1.21.1                                            │  │
│  │     월드: 새 월드 생성                                         │  │
│  │     메모리: 4G                                               │  │
│  │                                                            │  │
│  │  ? 서버를 생성할까요? (Y/n)                                    │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ confirmed: true
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  BashShellAdapter.createServer()                                 │
│  → Executes: create-server.sh myserver -t PAPER -v 1.21.1        │
│  → Shows spinner while executing                                 │
│  → Returns: Result<void>                                         │
└──────────────────────────────────────────────────────────────────┘
```

### 9.7 Dependency Injection

```typescript
// infrastructure/di/container.ts
import { CreateServerUseCase } from '@/application/use-cases/server/CreateServerUseCase';
import { ClackPromptAdapter } from '@/infrastructure/adapters/prompt/ClackPromptAdapter';
import { BashShellAdapter } from '@/infrastructure/adapters/shell/BashShellAdapter';
import { DocsProviderAdapter } from '@/infrastructure/adapters/docs/DocsProviderAdapter';
import { FileConfigAdapter } from '@/infrastructure/adapters/config/FileConfigAdapter';

export function createContainer(paths: Paths) {
  // Secondary adapters (driven side)
  const promptAdapter = new ClackPromptAdapter();
  const shellAdapter = new BashShellAdapter(paths);
  const docsAdapter = new DocsProviderAdapter(paths.docs);
  const configAdapter = new FileConfigAdapter(paths);

  // Use cases (application layer)
  const createServerUseCase = new CreateServerUseCase(
    promptAdapter,
    shellAdapter,
    docsAdapter,
    configAdapter,
  );

  const deleteServerUseCase = new DeleteServerUseCase(
    promptAdapter,
    shellAdapter,
    configAdapter,
  );

  // ... other use cases

  return {
    useCases: {
      createServer: createServerUseCase,
      deleteServer: deleteServerUseCase,
      // ...
    },
    adapters: {
      prompt: promptAdapter,
      shell: shellAdapter,
      docs: docsAdapter,
      config: configAdapter,
    },
  };
}
```

### 9.8 Benefits of This Architecture

| Benefit | Description |
|---------|-------------|
| **Testability** | Use cases can be unit tested with mock ports |
| **Flexibility** | Swap adapters without changing business logic |
| **Docs-Driven** | Prompts dynamically generated from docs/ |
| **Type Safety** | Value objects ensure valid data at compile time |
| **Separation** | Clear boundary between TS logic and Bash scripts |
| **Extensibility** | Easy to add Web UI or Discord bot as new adapters |

### 9.9 Migration Path

#### Phase 1: Infrastructure Setup
- [ ] Add dependencies: `@clack/prompts`, `picocolors`
- [ ] Create port interfaces
- [ ] Implement `ClackPromptAdapter`
- [ ] Implement `DocsProviderAdapter`

#### Phase 2: Core Use Cases
- [ ] Implement `CreateServerUseCase` with prompts
- [ ] Implement `DeleteServerUseCase` with confirmation
- [ ] Implement `StatusCommand` (pure TypeScript)

#### Phase 3: Enhanced Features
- [ ] Add `PlayerCommand` (TypeScript, no Bash)
- [ ] Add `WorldCommand` with interactive assignment
- [ ] Add `BackupCommand` with prompts

#### Phase 4: Polish
- [ ] Add progress indicators
- [ ] Improve error messages
- [ ] Add `--yes` flag for non-interactive mode

#### Phase 5: Shared Package Refactoring ([#54](https://github.com/smallmiro/minecraft-server-manager/issues/54))
- [ ] Domain Layer 이동 (`domain/entities`, `domain/value-objects`) → shared
- [ ] Application Layer 이동 (`application/ports`, `application/use-cases`) → shared
- [ ] 공통 Infrastructure 이동 (`ShellAdapter`, `ServerRepository`, `WorldRepository`) → shared
- [ ] CLI 패키지에서 shared 패키지 import로 변경
- [ ] 빌드 및 테스트 검증
- [ ] package.json exports 업데이트

## 10. Future Enhancements

### 10.1 Planned: Web Management UI (All-in-One Package)

**Goal**: Create a web-based management tool that provides complete control over the Minecraft server infrastructure.

#### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js, TypeScript, Tailwind CSS |
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
│   ├── components/         # Tailwind CSS components
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

### 10.2 Other Planned Features
- [ ] Automated backup scheduling
- [ ] Discord integration for notifications
- [ ] Prometheus metrics export

### 10.3 Considered
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
| 3.0.0 | 2026-01-18 | - | Add CLI Architecture (Hexagonal + Clean Architecture, SOLID principles) |
