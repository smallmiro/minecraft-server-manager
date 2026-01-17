# Implementation Plan: Multi-Server Minecraft Management System

## Quick Reference

### Milestones
| Version | Description | Status |
|---------|-------------|--------|
| [v0.2.0](https://github.com/smallmiro/minecraft-server-manager/milestone/1) | Infrastructure (Phase 1, 2) | ✅ Closed |
| [v0.3.0](https://github.com/smallmiro/minecraft-server-manager/milestone/2) | Core Features (Phase 3, 4) | 🔄 Open |
| [v1.0.0](https://github.com/smallmiro/minecraft-server-manager/milestone/3) | Release (Phase 5) | 🔄 Open |

### Issues by Phase
| Phase | Issues | Status |
|-------|--------|--------|
| Phase 1: Infrastructure | [#1](https://github.com/smallmiro/minecraft-server-manager/issues/1), [#2](https://github.com/smallmiro/minecraft-server-manager/issues/2), [#3](https://github.com/smallmiro/minecraft-server-manager/issues/3) | ✅ Closed |
| Phase 2: Docker & mc-router | [#4](https://github.com/smallmiro/minecraft-server-manager/issues/4), [#5](https://github.com/smallmiro/minecraft-server-manager/issues/5), [#6](https://github.com/smallmiro/minecraft-server-manager/issues/6) | ✅ Closed |
| Phase 2.5: mDNS Publisher | [#20](https://github.com/smallmiro/minecraft-server-manager/issues/20) | 🔄 PR #21 |
| Phase 3: World Locking | [#7](https://github.com/smallmiro/minecraft-server-manager/issues/7) | 🔄 Open |
| Phase 4: Management CLI | [#8](https://github.com/smallmiro/minecraft-server-manager/issues/8), [#9](https://github.com/smallmiro/minecraft-server-manager/issues/9), [#12](https://github.com/smallmiro/minecraft-server-manager/issues/12) | 🔄 Open |
| Phase 5: Documentation | [#10](https://github.com/smallmiro/minecraft-server-manager/issues/10), [#11](https://github.com/smallmiro/minecraft-server-manager/issues/11) | 🔄 Open |

---

## Overview

This plan outlines the implementation steps for the multi-server Minecraft management system defined in `prd.md`.

## Architecture: mc-router Based

```
┌─────────────────────────────────────────────────────────────┐
│                    mc-router (:25565)                        │
│              (always running, hostname routing)              │
├─────────────────────────────────────────────────────────────┤
│  ironwood.local    → mc-ironwood    (auto-scale up/down)    │
│  <new-server>.local → mc-<new-server> (add via script)      │
└─────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Single port (25565) for all servers via hostname routing
- Auto-scale: servers start on client connect, stop after idle timeout
- Zero resources when servers are stopped (only mc-router runs)
- Fully automated server creation via `create-server.sh`

## Development Strategy: CLI-First, Web-Ready

All features are implemented via **CLI first**, with **Web Management UI** as a future enhancement.

### Web-Ready Implementation Guidelines

```bash
# 1. Support JSON output for Web API integration
mcctl.sh status --json
# Output: {"router":"running","servers":[{"name":"ironwood","status":"running",...}]}

# 2. Use consistent exit codes
# 0 = success
# 1 = error
# 2 = warning

# 3. Separate logic from CLI parsing
# scripts/lib/servers.sh - Reusable functions
# scripts/mcctl.sh - CLI wrapper

# 4. All config in parseable formats (TOML, JSON, env)
```

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2.0+
- Bash 4.0+
- At least 8GB RAM available for servers

## GitHub Issues Integration

### Issue Labels
| Label | Color | Description |
|-------|-------|-------------|
| `phase:1-infra` | #0052CC | Phase 1: Infrastructure |
| `phase:2-docker` | #0052CC | Phase 2: Docker & mc-router |
| `phase:3-locking` | #0052CC | Phase 3: World Locking |
| `phase:4-cli` | #0052CC | Phase 4: Management CLI |
| `phase:5-docs` | #0052CC | Phase 5: Documentation |
| `type:feature` | #1D76DB | New feature |
| `type:bug` | #D73A4A | Bug fix |
| `type:docs` | #0075CA | Documentation |

### Branch → Issue Linking
```bash
# Branch naming
feature/<issue-number>-<description>
bugfix/<issue-number>-<description>

# Commit message
feat: Add lock.sh script (#7)

Implements world locking mechanism with flock.

- Add lock/unlock/check/list commands
- Handle stale lock detection

Closes #7
```

---

## Phase 1: Infrastructure Setup ✅ COMPLETED

> **Milestone**: [v0.2.0 - Infrastructure](https://github.com/smallmiro/minecraft-server-manager/milestone/1) (Closed)

### 1.1 Create Directory Structure ([#1](https://github.com/smallmiro/minecraft-server-manager/issues/1)) ✅

```
platform/
├── docker-compose.yml       # Main orchestration (mc-router + includes)
├── .env                     # Global environment variables
├── .env.example             # Template
├── servers/
│   ├── _template/           # Template for new servers
│   │   ├── docker-compose.yml
│   │   └── config.env
│   └── ironwood/            # Default server
│       ├── docker-compose.yml
│       ├── config.env
│       ├── data/            # Server data (gitignored)
│       └── logs/            # Server logs (gitignored)
├── worlds/                  # Shared world storage
│   └── .locks/              # Lock files (future)
├── shared/
│   ├── plugins/             # Shared plugins (read-only mount)
│   └── mods/                # Shared mods (read-only mount)
├── scripts/
│   └── create-server.sh     # Fully automated server creation
└── backups/                 # Backup storage
```

### 1.2 Create Global Environment File ([#2](https://github.com/smallmiro/minecraft-server-manager/issues/2)) ✅

**File**: `platform/.env`

### 1.3 Create Server Template ([#3](https://github.com/smallmiro/minecraft-server-manager/issues/3)) ✅

**File**: `platform/servers/_template/`

## Phase 2: Docker & mc-router Configuration ✅ COMPLETED

> **Milestone**: [v0.2.0 - Infrastructure](https://github.com/smallmiro/minecraft-server-manager/milestone/1) (Closed)

### 2.1 Create docker-compose.yml ([#4](https://github.com/smallmiro/minecraft-server-manager/issues/4)) ✅

**Key Features**:
- mc-router service (always running)
- Docker Compose `include` directive for modular server configs
- Shared network (`minecraft-net`)
- Auto-scale via Docker socket integration

**Current Structure**:
```yaml
include:
  - servers/ironwood/docker-compose.yml
  # Add more via create-server.sh

services:
  router:
    image: itzg/mc-router
    command: >
      --in-docker
      --auto-scale-up
      --auto-scale-down
      --auto-scale-down-after=10m
    ports:
      - "25565:25565"
    environment:
      MAPPING: |
        ironwood.local=mc-ironwood:25565
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

### 2.2 Configure mc-router ([#5](https://github.com/smallmiro/minecraft-server-manager/issues/5)) ✅

mc-router is configured via docker-compose.yml command and environment variables.

| Option | Description |
|--------|-------------|
| `--in-docker` | Enable Docker integration |
| `--auto-scale-up` | Start containers on client connect |
| `--auto-scale-down` | Stop containers when idle |
| `--auto-scale-down-after=10m` | Idle timeout before shutdown |

### 2.3 Create Server Configurations ([#6](https://github.com/smallmiro/minecraft-server-manager/issues/6)) ✅

- `platform/servers/ironwood/` - Default Paper server

### 2.4 Fully Automated Server Creation ✅

**File**: `platform/scripts/create-server.sh`

The script automatically:
1. Creates server directory from template
2. Updates server's docker-compose.yml
3. Updates config.env
4. Updates main docker-compose.yml (include, MAPPING, depends_on)
5. Validates configuration
6. Starts the server (unless --no-start)

```bash
./scripts/create-server.sh myserver              # Create & start
./scripts/create-server.sh myserver -t FORGE     # With server type
./scripts/create-server.sh myserver --no-start   # Create only
./scripts/create-server.sh myserver --seed 12345 # With world seed
```

---

## Phase 2.5: mDNS Auto-Broadcast Service

> **Milestone**: [v0.3.0 - Core Features](https://github.com/smallmiro/minecraft-server-manager/milestone/2)

### 2.5.1 Implement mdns-publisher ([#20](https://github.com/smallmiro/minecraft-server-manager/issues/20))

**Purpose**: Automatically broadcast mDNS (Bonjour/Zeroconf) A records for `.local` hostnames so clients can connect without manual hosts file configuration.

**Directory Structure**:
```
platform/services/mdns-publisher/
├── Dockerfile
├── requirements.txt
├── mdns_publisher.py
└── README.md
```

**Architecture**:
```
┌─────────────────────────────────────────────────────────────┐
│                     mdns-publisher                           │
│                    (host network mode)                       │
├─────────────────────────────────────────────────────────────┤
│  Docker SDK          │           Zeroconf                    │
│  - Monitor events    │           - Register A records        │
│  - Read labels       │           - Broadcast on mDNS         │
│  - container start   │           - Unregister on stop        │
│  - container die     │                                       │
└─────────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
    Docker Socket                   LAN (multicast)
    /var/run/docker.sock            224.0.0.251:5353
```

**Key Components**:

| Component | Description |
|-----------|-------------|
| Docker Event Listener | Monitor container start/die events |
| Label Parser | Extract `mc-router.host` label from containers |
| mDNS Broadcaster | Register/unregister A records via zeroconf |
| Health Endpoint | HTTP endpoint for Docker healthcheck |

**Label Detection**:
```yaml
# Server container labels (already exists)
labels:
  - "mc-router.host=ironwood.local"
  - "mc-router.auto-scale-up=true"
  - "mc-router.auto-scale-down=true"
```

**Implementation Details**:

```python
# mdns_publisher.py pseudo-code
import docker
from zeroconf import Zeroconf, ServiceInfo
import socket

# Get host IP for mDNS A record
host_ip = socket.gethostbyname(socket.gethostname())

# Watch Docker events
for event in client.events(decode=True, filters={'event': ['start', 'die']}):
    container = client.containers.get(event['id'])
    hostname = container.labels.get('mc-router.host')

    if hostname:
        if event['Action'] == 'start':
            # Register mDNS: hostname -> host_ip
            register_mdns(hostname, host_ip)
        elif event['Action'] == 'die':
            # Unregister mDNS
            unregister_mdns(hostname)
```

**Docker Compose Service**:
```yaml
# In main docker-compose.yml
services:
  mdns-publisher:
    build: ./services/mdns-publisher
    container_name: mdns-publisher
    restart: unless-stopped
    network_mode: host  # Required for mDNS multicast
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - LOG_LEVEL=INFO
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5353/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**Dependencies**:
```
# requirements.txt
docker>=6.0.0
zeroconf>=0.131.0
flask>=3.0.0  # For health endpoint
```

### 2.5.2 Client Compatibility

| OS | mDNS Support | Notes |
|----|--------------|-------|
| Linux | avahi-daemon | Usually pre-installed on Ubuntu/Debian |
| macOS | Built-in Bonjour | No setup needed |
| Windows | Bonjour Print Services | Install from Apple or with iTunes |

### 2.5.3 Testing

```bash
# 1. Start mdns-publisher
docker compose up -d mdns-publisher

# 2. Start a Minecraft server
docker compose up -d mc-ironwood

# 3. Check mDNS registration (Linux)
avahi-browse -art | grep ironwood

# 4. Check mDNS registration (macOS)
dns-sd -B _services._dns-sd._udp

# 5. Resolve hostname (all platforms)
ping ironwood.local

# 6. Connect via Minecraft
# Server address: ironwood.local:25565
```

---

## Phase 3: World Locking System

> **Milestone**: [v0.3.0 - Core Features](https://github.com/smallmiro/minecraft-server-manager/milestone/2)

### 3.1 Implement lock.sh ([#7](https://github.com/smallmiro/minecraft-server-manager/issues/7))

**File**: `platform/scripts/lock.sh`

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

**Lock File Location**: `platform/worlds/.locks/<world-name>.lock`

### 3.2 Lock Safety Rules

1. Lock acquired BEFORE container start
2. Lock released AFTER container stop
3. Only lock owner can release
4. Stale locks detectable via timestamp

---

## Phase 4: Management CLI

> **Milestone**: [v0.3.0 - Core Features](https://github.com/smallmiro/minecraft-server-manager/milestone/2)

### 4.1 Implement mcctl.sh ([#8](https://github.com/smallmiro/minecraft-server-manager/issues/8))

**File**: `platform/scripts/mcctl.sh`

**Commands**:
```
mcctl.sh status                   - Show mc-router and all servers status
mcctl.sh logs <server> [lines]    - View logs
mcctl.sh console <server>         - RCON console

mcctl.sh world list               - List worlds/locks
mcctl.sh world assign <w> <s>     - Assign world to server config
mcctl.sh world release <w>        - Force release world lock

# Manual override (bypasses mc-router auto-management)
mcctl.sh start <server>           - Force start server
mcctl.sh stop <server>            - Force stop server
```

**Status Output Example**:
```
=== Server Status (mc-router Managed) ===
ROUTER     STATUS     PORT
mc-router  RUNNING    25565 (hostname routing)

SERVER       STATUS     HOSTNAME           IDLE
mc-ironwood  RUNNING    ironwood.local     2m ago
mc-myserver  STOPPED    myserver.local     auto-scale ready

mc-router: RUNNING (2 servers configured)
```

### 4.2 Implement logs.sh ([#9](https://github.com/smallmiro/minecraft-server-manager/issues/9))

**File**: `platform/scripts/logs.sh`

Helper script for log viewing with Docker and file options.

### 4.3 Implement player.sh ([#12](https://github.com/smallmiro/minecraft-server-manager/issues/12))

**File**: `platform/scripts/player.sh`

Player UUID lookup using PlayerDB API.

**API**: `https://playerdb.co/api/player/minecraft/{playerName}`

**Commands**:
```bash
./scripts/player.sh lookup <playerName>        # Full player info
./scripts/player.sh lookup <playerName> --json # JSON output
./scripts/player.sh uuid <playerName>          # Online UUID only
./scripts/player.sh uuid <playerName> --offline # Offline UUID only
```

### 4.4 Implement backup.sh ([#26](https://github.com/smallmiro/minecraft-server-manager/issues/26))

**File**: `platform/scripts/backup.sh`

GitHub backup for worlds/ directory. Auto-backup triggers on `mcctl.sh stop`.

**Environment Variables** (in `.env`):
```bash
BACKUP_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
BACKUP_GITHUB_REPO=username/minecraft-worlds-backup
BACKUP_AUTO_ON_STOP=true
```

**Commands**:
```bash
./scripts/backup.sh push [--message "msg"]  # Backup to GitHub
./scripts/backup.sh status                   # Show configuration
./scripts/backup.sh history [--json]         # Backup history
./scripts/backup.sh restore <commit>         # Restore from commit
```

---

## Phase 5: Documentation Update

> **Milestone**: [v1.0.0 - Release](https://github.com/smallmiro/minecraft-server-manager/milestone/3)

### 5.1 Update CLAUDE.md ([#10](https://github.com/smallmiro/minecraft-server-manager/issues/10))

Add sections:
- mc-router based multi-server architecture overview
- CLI commands reference (`mcctl.sh`)
- World locking explanation
- Troubleshooting for multi-server

### 5.2 Update README.md ([#11](https://github.com/smallmiro/minecraft-server-manager/issues/11))

Add sections:
- Multi-server quick start
- Server management commands
- World management guide

---

## File Checklist

### Completed ✅

| File | Phase | Status |
|------|-------|--------|
| `platform/.env` | 1 | ✅ |
| `platform/.env.example` | 1 | ✅ |
| `platform/docker-compose.yml` | 2 | ✅ |
| `platform/servers/_template/` | 1 | ✅ |
| `platform/servers/ironwood/` | 2 | ✅ |
| `platform/scripts/create-server.sh` | 2 | ✅ |
| `platform/services/mdns-publisher/` | 2.5 | ✅ |
| `platform/scripts/lock.sh` | 3 | ✅ |
| `platform/scripts/mcctl.sh` | 4 | ✅ |
| `platform/scripts/logs.sh` | 4 | ✅ |
| `platform/scripts/player.sh` | 4 | ✅ |

### Pending

| File | Phase | Issue |
|------|-------|-------|
| `platform/scripts/backup.sh` | 4 | [#26](https://github.com/smallmiro/minecraft-server-manager/issues/26) |

---

## Verification Steps

### Phase 1-2 Verification ✅

```bash
# Validate docker-compose syntax
cd platform && docker compose config

# Check services defined
docker compose config --services

# Start mc-router and servers
docker compose up -d

# Check mc-router is listening
ss -tuln | grep 25565

# Test server creation
./scripts/create-server.sh testserver --no-start
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
./scripts/mcctl.sh status --json
./scripts/mcctl.sh world list

# Test lock.sh
./scripts/lock.sh list
./scripts/lock.sh lock test-world mc-test
./scripts/lock.sh check test-world
./scripts/lock.sh unlock test-world mc-test

# Test player.sh
./scripts/player.sh lookup Notch
./scripts/player.sh uuid Steve --offline

# Test backup.sh (requires .env configuration)
./scripts/backup.sh status
# If configured:
# ./scripts/backup.sh push -m "Test backup"
# ./scripts/backup.sh history

# Test mc-router auto-start (connect with MC client)
# 1. Add to hosts: <host-ip> ironwood.local
# 2. Connect to ironwood.local:25565
# 3. Check server started: docker ps
# 4. Disconnect and wait 10 min
# 5. Check server stopped: docker ps
```

### Phase 5 Verification

```bash
# Run sync-docs to validate documentation
/sync-docs
```

---

## Rollback Plan

If implementation fails at any phase:

1. **Phase 3-4 Failure**: Remove only scripts
   ```bash
   rm platform/scripts/lock.sh platform/scripts/mcctl.sh platform/scripts/logs.sh
   ```

2. **Phase 5 Failure**: Restore from git
   ```bash
   git checkout CLAUDE.md README.md
   ```

---

## Dependencies

### External
- `itzg/minecraft-server` Docker image
- `itzg/mc-router` Docker image
- Docker Engine & Compose

### Internal
- `prd.md` - Requirements reference
- `docs/` - Official documentation reference

### mc-router Resources
- GitHub: https://github.com/itzg/mc-router
- Docker Hub: https://hub.docker.com/r/itzg/mc-router

---

## Notes

### mc-router Architecture
- **mc-router proxy**: Always running, minimal resources (~20MB RAM)
- **MC servers**: Started on-demand by mc-router, stopped after idle
- **Hostname routing**: All servers on port 25565, distinguished by hostname
- **External access**: Clients configure DNS/hosts file to resolve hostnames
- **Auto start**: Client connects → mc-router starts container → proxies connection
- **Auto stop**: No players for 10 min → mc-router stops container
- **Resource efficiency**: Zero RAM usage when servers are stopped

### Client Configuration

**With mDNS Publisher (Recommended)**:
No configuration needed! Clients on the same LAN automatically discover servers via mDNS (Bonjour/Zeroconf).

Just connect via Minecraft: `ironwood.local:25565`

**mDNS Requirements**:
| OS | Requirement |
|----|-------------|
| Linux | avahi-daemon (usually pre-installed) |
| macOS | Built-in Bonjour (no setup needed) |
| Windows | Bonjour Print Services or iTunes |

**Fallback (without mDNS)**:
Add server hostnames to hosts file:
```
# /etc/hosts (Linux/macOS) or C:\Windows\System32\drivers\etc\hosts (Windows)
192.168.1.100 ironwood.local
192.168.1.100 myserver.local
```

Then connect via Minecraft: `ironwood.local:25565`
