# Implementation Plan: Multi-Server Minecraft Management System

## Module Plans Dashboard

All modules have independent implementation plans. Use this dashboard for centralized tracking.

### Module Status Overview

| Module | Plan | Progress | Status | Agent |
|--------|------|----------|--------|-------|
| **shared** | [plan.md](platform/services/shared/plan.md) | Phase 1-6 ✅ | Completed | 🔧 Core |
| **cli** | [plan.md](platform/services/cli/plan.md) | Phase 1-7 ✅, Admin ✅ | Completed | 💻 CLI |
| **mcctl-api** | [plan.md](platform/services/mcctl-api/plan.md) | Phase 1-5 ✅ | Completed | 🖥️ Backend |
| **mcctl-console** | [plan.md](platform/services/mcctl-console/plan.md) | Phase 1-7 ✅ | Completed | 🎨 Frontend |

### Module Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                         shared                                   │
│              (Domain, Use Cases, Common Adapters)               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ imports
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│     cli       │   │  mcctl-api    │   │mcctl-console  │
│ Terminal UI   │   │  REST API     │   │  Web Console  │
└───────────────┘   └───────┬───────┘   └───────┬───────┘
                            │ HTTP              │
                            └───────────────────┘
```

### Quick Navigation

**Implementation Plans**:
- [shared/plan.md](platform/services/shared/plan.md) - Domain Layer, Application Layer
- [cli/plan.md](platform/services/cli/plan.md) - CLI Commands, Interactive Mode
- [mcctl-api/plan.md](platform/services/mcctl-api/plan.md) - REST API, Authentication
- [mcctl-console/plan.md](platform/services/mcctl-console/plan.md) - BFF, Dashboard UI

**Related PRDs**:
- [shared/prd.md](platform/services/shared/prd.md)
- [cli/prd.md](platform/services/cli/prd.md)
- [mcctl-api/prd.md](platform/services/mcctl-api/prd.md)
- [mcctl-console/prd.md](platform/services/mcctl-console/prd.md)

---

## Quick Reference

### Milestones
| Version | Description | Status |
|---------|-------------|--------|
| [v0.2.0](https://github.com/smallmiro/minecraft-server-manager/milestone/1) | Infrastructure (Phase 1, 2) | ✅ Closed |
| [v0.3.0](https://github.com/smallmiro/minecraft-server-manager/milestone/2) | Core Features (Phase 3, 4) | ✅ Closed |
| [v0.4.0](https://github.com/smallmiro/minecraft-server-manager/milestone/4) | CLI Interactive Mode (Phase 7) | ✅ Closed |
| [v1.0.0](https://github.com/smallmiro/minecraft-server-manager/milestone/3) | Release (Phase 5) | ✅ Closed |
| [v2.0.0](https://github.com/smallmiro/minecraft-server-manager/milestone/5) | Admin Service (Phase 8) | ✅ Closed |

### Issues by Phase
| Phase | Issues | Status |
|-------|--------|--------|
| Phase 1: Infrastructure | [#1](https://github.com/smallmiro/minecraft-server-manager/issues/1), [#2](https://github.com/smallmiro/minecraft-server-manager/issues/2), [#3](https://github.com/smallmiro/minecraft-server-manager/issues/3) | ✅ Closed |
| Phase 2: Docker & mc-router | [#4](https://github.com/smallmiro/minecraft-server-manager/issues/4), [#5](https://github.com/smallmiro/minecraft-server-manager/issues/5), [#6](https://github.com/smallmiro/minecraft-server-manager/issues/6) | ✅ Closed |
| Phase 2.5: mDNS Publisher | [#20](https://github.com/smallmiro/minecraft-server-manager/issues/20) | ✅ Completed |
| Phase 2.6: nip.io Magic DNS | [#52](https://github.com/smallmiro/minecraft-server-manager/issues/52) | ✅ Completed |
| Phase 3: World Locking | [#7](https://github.com/smallmiro/minecraft-server-manager/issues/7) | ✅ Completed |
| Phase 4: Management CLI | [#8](https://github.com/smallmiro/minecraft-server-manager/issues/8), [#9](https://github.com/smallmiro/minecraft-server-manager/issues/9), [#12](https://github.com/smallmiro/minecraft-server-manager/issues/12) | ✅ Completed |
| Phase 5: Documentation | [#10](https://github.com/smallmiro/minecraft-server-manager/issues/10), [#11](https://github.com/smallmiro/minecraft-server-manager/issues/11) | ✅ Completed |
| Phase 6: npm Package | [#28](https://github.com/smallmiro/minecraft-server-manager/issues/28) | ✅ Closed |
| Phase 7: CLI Interactive Mode | [#30](https://github.com/smallmiro/minecraft-server-manager/issues/30), [#31](https://github.com/smallmiro/minecraft-server-manager/issues/31), [#32](https://github.com/smallmiro/minecraft-server-manager/issues/32), [#33](https://github.com/smallmiro/minecraft-server-manager/issues/33), [#34](https://github.com/smallmiro/minecraft-server-manager/issues/34), [#35](https://github.com/smallmiro/minecraft-server-manager/issues/35), [#36](https://github.com/smallmiro/minecraft-server-manager/issues/36), [#37](https://github.com/smallmiro/minecraft-server-manager/issues/37), [#38](https://github.com/smallmiro/minecraft-server-manager/issues/38), [#39](https://github.com/smallmiro/minecraft-server-manager/issues/39), [#40](https://github.com/smallmiro/minecraft-server-manager/issues/40), [#54](https://github.com/smallmiro/minecraft-server-manager/issues/54), [#56](https://github.com/smallmiro/minecraft-server-manager/issues/56) | ✅ Completed |
| Phase 7.1: Server Management Commands | [#58](https://github.com/smallmiro/minecraft-server-manager/issues/58) ✅, [#59](https://github.com/smallmiro/minecraft-server-manager/issues/59) ✅, [#60](https://github.com/smallmiro/minecraft-server-manager/issues/60) ✅ | ✅ Completed |
| Phase 7.2: Server Backup Commands | [#64](https://github.com/smallmiro/minecraft-server-manager/issues/64) ✅ | ✅ Completed |
| Phase 7.3: World Selection Enhancement | [#66](https://github.com/smallmiro/minecraft-server-manager/issues/66) ✅ | ✅ Completed |
| Phase 7.4: Player Management Commands | [#67](https://github.com/smallmiro/minecraft-server-manager/issues/67) ✅ | ✅ Completed |
| Phase 7.5: Detailed Monitoring | [#68](https://github.com/smallmiro/minecraft-server-manager/issues/68) ✅ | ✅ Completed |
| Phase 7.6: Sudo Password Handling | [#72](https://github.com/smallmiro/minecraft-server-manager/issues/72) ✅ | ✅ Completed |
| Phase 7.7: Unified Player Management | [#73](https://github.com/smallmiro/minecraft-server-manager/issues/73) ✅ | ✅ Completed |
| Phase 8.1: Shared Package Extension | [#80](https://github.com/smallmiro/minecraft-server-manager/issues/80) ✅, [#81](https://github.com/smallmiro/minecraft-server-manager/issues/81) ✅, [#82](https://github.com/smallmiro/minecraft-server-manager/issues/82) ✅, [#83](https://github.com/smallmiro/minecraft-server-manager/issues/83) ✅ | ✅ Completed |
| Phase 8.2: CLI Admin Commands | [#84](https://github.com/smallmiro/minecraft-server-manager/issues/84) ✅, [#85](https://github.com/smallmiro/minecraft-server-manager/issues/85) ✅, [#86](https://github.com/smallmiro/minecraft-server-manager/issues/86) ✅, [#87](https://github.com/smallmiro/minecraft-server-manager/issues/87) ✅ | ✅ Completed |
| Phase 8.3: mcctl-api Service | [#88](https://github.com/smallmiro/minecraft-server-manager/issues/88) ✅, [#89](https://github.com/smallmiro/minecraft-server-manager/issues/89) ✅, [#90](https://github.com/smallmiro/minecraft-server-manager/issues/90) ✅, [#91](https://github.com/smallmiro/minecraft-server-manager/issues/91) ✅, [#92](https://github.com/smallmiro/minecraft-server-manager/issues/92) ✅, [#93](https://github.com/smallmiro/minecraft-server-manager/issues/93) ✅, [#94](https://github.com/smallmiro/minecraft-server-manager/issues/94) ✅ | ✅ Completed |
| Phase 8.4: mcctl-console Service | [#95](https://github.com/smallmiro/minecraft-server-manager/issues/95) ✅, [#96](https://github.com/smallmiro/minecraft-server-manager/issues/96) ✅, [#97](https://github.com/smallmiro/minecraft-server-manager/issues/97) ✅, [#98](https://github.com/smallmiro/minecraft-server-manager/issues/98) ✅, [#99](https://github.com/smallmiro/minecraft-server-manager/issues/99) ✅, [#100](https://github.com/smallmiro/minecraft-server-manager/issues/100) ✅ | ✅ Completed |
| Phase 8.5: Integration & Testing | [#101](https://github.com/smallmiro/minecraft-server-manager/issues/101) ✅, [#102](https://github.com/smallmiro/minecraft-server-manager/issues/102) ✅ | ✅ Completed |

---

## Overview

This plan outlines the implementation steps for the multi-server Minecraft management system defined in `prd.md`.

## Architecture: mc-router Based

```
┌─────────────────────────────────────────────────────────────┐
│                    mc-router (:25565)                        │
│              (always running, hostname routing)              │
├─────────────────────────────────────────────────────────────┤
│  myserver.local                → mc-myserver (auto-scale)   │
│  myserver.192.168.20.37.nip.io → mc-myserver (auto-scale)   │
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

## Phase 2.5: mDNS Auto-Broadcast (via avahi-daemon)

> **Milestone**: [v0.3.0 - Core Features](https://github.com/smallmiro/minecraft-server-manager/milestone/2)
> **Status**: ✅ Completed

### 2.5.1 Implementation Approach

**Decision**: Use system avahi-daemon instead of Docker-based mdns-publisher service.

**Rationale**:
- Simpler architecture (no additional Docker service)
- More reliable mDNS broadcasting (native system service)
- Lower resource usage
- Better integration with host networking

**Architecture**:
```
┌─────────────────────────────────────────────────────────────┐
│                   Server Host                                │
├─────────────────────────────────────────────────────────────┤
│  create-server.sh        │           avahi-daemon            │
│  - Creates server        │           (system service)        │
│  - Registers hostname    │           - Reads /etc/avahi/hosts│
│    in /etc/avahi/hosts   │           - Broadcasts mDNS       │
│                          │                                   │
│  delete-server.sh        │                                   │
│  - Removes server        │                                   │
│  - Unregisters hostname  │                                   │
└─────────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
    /etc/avahi/hosts               LAN (multicast)
    <host-ip> server.local         224.0.0.251:5353
```

### 2.5.2 Implementation Details

**create-server.sh** registers hostname:
```bash
# Add to /etc/avahi/hosts
echo "$HOST_IP $SERVER_NAME.local" | sudo tee -a /etc/avahi/hosts
sudo systemctl restart avahi-daemon
```

**delete-server.sh** unregisters hostname:
```bash
# Remove from /etc/avahi/hosts
sudo sed -i "/$SERVER_NAME\.local/d" /etc/avahi/hosts
sudo systemctl restart avahi-daemon
```

### 2.5.3 avahi-daemon Setup

| OS | Installation |
|----|--------------|
| Debian/Ubuntu | `sudo apt install avahi-daemon && sudo systemctl enable --now avahi-daemon` |
| CentOS/RHEL | `sudo dnf install avahi && sudo systemctl enable --now avahi-daemon` |
| Arch Linux | `sudo pacman -S avahi nss-mdns && sudo systemctl enable --now avahi-daemon` |
| Alpine Linux | `apk add avahi && rc-update add avahi-daemon default && rc-service avahi-daemon start` |

### 2.5.4 Client Compatibility

| OS | mDNS Support | Notes |
|----|--------------|-------|
| Linux | avahi-daemon | Install same as server |
| macOS | Built-in Bonjour | No setup needed |
| Windows | Bonjour Print Services | Install from Apple or with iTunes |
| Windows WSL | avahi-daemon in WSL | For Windows apps, use Bonjour |

### 2.5.5 Testing

```bash
# 1. Verify avahi-daemon is running
sudo systemctl status avahi-daemon

# 2. Check registered hostnames
cat /etc/avahi/hosts

# 3. Create a server (auto-registers hostname)
./scripts/create-server.sh myserver -t PAPER

# 4. Check mDNS resolution
ping myserver.local

# 5. Browse mDNS services
avahi-browse -art

# 6. Connect via Minecraft: myserver.local:25565
```

---

## Phase 2.6: nip.io Magic DNS Support ✅ COMPLETED

> **Milestone**: [v0.3.0 - Core Features](https://github.com/smallmiro/minecraft-server-manager/milestone/2)
> **Issue**: [#52](https://github.com/smallmiro/minecraft-server-manager/issues/52)
> **Status**: ✅ Completed

### 2.6.1 Overview

**Problem**: mDNS (`.local`) requires client-side setup (avahi/Bonjour) and has reliability issues on some networks.

**Solution**: Add nip.io "magic DNS" as an alternative hostname routing method.

nip.io automatically resolves `<name>.<ip>.nip.io` to `<ip>` without any configuration:
- `myserver.192.168.20.37.nip.io` → resolves to `192.168.20.37`
- Works universally with internet access
- No client-side mDNS setup required

### 2.6.2 Implementation Tasks

- [x] Update `.env.example` with nip.io documentation
- [x] Update `servers/_template/docker-compose.yml` labels
- [x] Modify `create-server.sh` to add nip.io hostname
- [x] Create `migrate-nip-io.sh` for existing servers
- [x] Update CLAUDE.md documentation

### 2.6.3 Dual Hostname Strategy

mc-router supports comma-separated hostnames:
```yaml
labels:
  mc-router.host: "myserver.local,myserver.192.168.20.37.nip.io"
```

**Client Connection Options**:
| Method | Hostname | Requirements |
|--------|----------|--------------|
| nip.io (Recommended) | `myserver.192.168.20.37.nip.io:25565` | Internet access only |
| mDNS | `myserver.local:25565` | avahi-daemon/Bonjour |
| hosts file | `myserver.local:25565` | Manual /etc/hosts entry |

### 2.6.4 Script Changes

**create-server.sh**:
```bash
# Read HOST_IP from .env
HOST_IP=$(get_host_ip)

if [ -n "$HOST_IP" ]; then
    # Dual hostname: .local + nip.io
    sed -i "s/template\.local/$SERVER_NAME.local,$SERVER_NAME.$HOST_IP.nip.io/g" "$COMPOSE_FILE"
else
    # Fallback: .local only
    sed -i "s/template\.local/$SERVER_NAME.local/g" "$COMPOSE_FILE"
fi
```

### 2.6.5 Migration Script

**File**: `platform/scripts/migrate-nip-io.sh`

Updates existing servers to include nip.io hostnames:
```bash
./scripts/migrate-nip-io.sh
# Updates all servers in servers/*/docker-compose.yml
```

---

## Phase 3: World Locking System ✅ COMPLETED

> **Milestone**: [v0.3.0 - Core Features](https://github.com/smallmiro/minecraft-server-manager/milestone/2)

### 3.1 Implement lock.sh ([#7](https://github.com/smallmiro/minecraft-server-manager/issues/7)) ✅

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

### 4.1 Implement mcctl.sh ([#8](https://github.com/smallmiro/minecraft-server-manager/issues/8)) ✅

**File**: `platform/scripts/mcctl.sh`

**Commands**:
```
mcctl.sh status                   - Show mc-router and all servers status
mcctl.sh logs <server> [lines]    - View logs
mcctl.sh console <server>         - RCON console

mcctl.sh world list               - List worlds/locks
mcctl.sh world assign <w> <s>     - Assign world to server config
mcctl.sh world release <w>        - Force release world lock

# Infrastructure management (added in #56)
mcctl up                          - Start all infrastructure (router + servers)
mcctl down                        - Stop all infrastructure
mcctl start --all                 - Start all MC servers (not router)
mcctl stop --all                  - Stop all MC servers (not router)

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

### 4.2 Implement logs.sh ([#9](https://github.com/smallmiro/minecraft-server-manager/issues/9)) ✅

**File**: `platform/scripts/logs.sh`

Helper script for log viewing with Docker and file options.

### 4.3 Implement player.sh ([#12](https://github.com/smallmiro/minecraft-server-manager/issues/12)) ✅

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
| `platform/scripts/delete-server.sh` | 2 | ✅ |
| `platform/scripts/lock.sh` | 3 | ✅ |
| `platform/scripts/mcctl.sh` | 4 | ✅ |
| `platform/scripts/logs.sh` | 4 | ✅ |
| `platform/scripts/player.sh` | 4 | ✅ |
| `platform/scripts/migrate-nip-io.sh` | 2.6 | ✅ |

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

## Phase 6: npm Package Distribution ✅ COMPLETED

> **Milestone**: [v1.0.0 - Release](https://github.com/smallmiro/minecraft-server-manager/milestone/3)
> **Issue**: [#28](https://github.com/smallmiro/minecraft-server-manager/issues/28)
> **PR**: [#29](https://github.com/smallmiro/minecraft-server-manager/pull/29)

### 6.1 Overview

Docker Minecraft 서버 관리 플랫폼을 npm 패키지로 배포하여 전역 CLI(`mcctl`)로 사용 가능하게 합니다.

**패키지 이름**: `@minecraft-docker/mcctl`
**데이터 디렉토리**: `~/minecraft-servers` (Snap Docker 호환성)

### 6.2 Monorepo Structure

```
minecraft/
├── package.json                    # 루트 워크스페이스 (pnpm workspace)
├── pnpm-workspace.yaml
├── tsconfig.base.json
│
├── platform/
│   ├── services/                   # 서비스 모듈들 (Monorepo)
│   │   ├── cli/                    # @minecraft-docker/mcctl
│   │   │   ├── package.json
│   │   │   ├── tsconfig.json
│   │   │   └── src/
│   │   │       ├── index.ts        # CLI 진입점
│   │   │       ├── commands/       # 명령어 구현
│   │   │       └── lib/            # 유틸리티
│   │   │
│   │   ├── shared/                 # @minecraft-docker/shared
│   │   │   ├── package.json
│   │   │   └── src/
│   │   │       ├── types/          # 공통 타입 정의
│   │   │       ├── utils/          # 공통 유틸리티
│   │   │       └── docker/         # Docker API 래퍼
│   │   │
│   │   └── web-admin/              # 웹 어드민 (향후)
│   │
│   ├── scripts/                    # 기존 쉘 스크립트
│   └── ...
│
└── templates/                      # npm 배포용 템플릿
```

### 6.3 Implementation Tasks

- [x] pnpm workspace 설정 (`package.json`, `pnpm-workspace.yaml`)
- [x] `@minecraft-docker/shared` 모듈 구현
  - [x] 타입 정의 (`types/index.ts`)
  - [x] 유틸리티 (`utils/index.ts`)
  - [x] Docker 래퍼 (`docker/index.ts`)
- [x] `@minecraft-docker/mcctl` CLI 모듈 구현
  - [x] CLI 진입점 (`index.ts`)
  - [x] init 명령어 (`commands/init.ts`)
  - [x] status 명령어 (`commands/status.ts`)
  - [x] 쉘 스크립트 호출 래퍼 (`lib/shell.ts`)
- [x] 쉘 스크립트 환경변수 지원 추가
  - [x] `common.sh` - MCCTL_ROOT, MCCTL_SCRIPTS, MCCTL_TEMPLATES
  - [x] `create-server.sh`
  - [x] `delete-server.sh`
  - [x] `init.sh`
  - [x] `lock.sh`
- [x] `templates/` 디렉토리 구성
- [x] 로컬 테스트 (`pnpm link`)

### 6.4 CLI Commands

```bash
# 설치
npm install -g @minecraft-docker/mcctl

# 초기화
mcctl init

# 서버 생성
mcctl create myserver
mcctl create myserver -t FORGE -v 1.20.4

# 상태 확인
mcctl status [--json]

# 기타 명령어 (기존 mcctl.sh와 동일)
mcctl logs <server>
mcctl console <server>
mcctl start <server>
mcctl stop <server>
mcctl world list
mcctl player lookup <name>
mcctl backup push
```

### 6.5 Verification

```bash
# 1. 빌드
cd minecraft
pnpm install
pnpm build

# 2. 로컬 테스트
cd platform/services/cli
pnpm link --global

# 3. 초기화 테스트
mcctl --version
mcctl init

# 4. 서버 생성 테스트
mcctl create testserver
mcctl status

# 5. 기존 platform/ 호환성 확인
cd platform
./scripts/mcctl.sh status
```

---

## Phase 7: CLI Interactive Mode

> **Milestone**: [v0.4.0 - CLI Interactive Mode](https://github.com/smallmiro/minecraft-server-manager/milestone/4)
> **Architecture**: [PRD Section 9 - CLI Architecture](./prd.md#9-cli-architecture-hexagonal--clean-architecture)

### 7.1 Overview

기존 CLI(`mcctl`)를 대화형 인터페이스로 개선하여 사용자 경험을 향상시킵니다.

**핵심 개념**:
- **Hexagonal Architecture**: 포트와 어댑터 패턴으로 테스트 용이한 구조
- **@clack/prompts**: 모던한 터미널 UI (input, select, spinner)
- **Docs-Driven Prompts**: `docs/` 파일에서 선택지 동적 로드
- **Bash Delegation**: TypeScript에서 사용자 입력 수집 후 Bash 스크립트 실행

### 7.2 Implementation Tasks

#### Phase 7.1: Infrastructure Setup ([#30](https://github.com/smallmiro/minecraft-server-manager/issues/30))
- [ ] Add `@clack/prompts` dependency
- [ ] Add `picocolors` for terminal colors
- [ ] Configure TypeScript types
- [ ] Verify compatibility with existing CLI structure

#### Phase 7.2: Domain Layer ([#31](https://github.com/smallmiro/minecraft-server-manager/issues/31))
- [ ] Implement Value Objects:
  - [ ] `ServerName` - validated server name
  - [ ] `ServerType` - PAPER, VANILLA, FORGE, FABRIC enum
  - [ ] `McVersion` - semantic version validation
  - [ ] `Memory` - memory allocation (e.g., "4G")
  - [ ] `WorldOptions` - seed, world-url, existing world
- [ ] Implement Entities:
  - [ ] `Server` - server entity with configuration
  - [ ] `World` - world entity with lock status
- [ ] Add unit tests for Value Objects

#### Phase 7.3: Application Layer - Ports ([#32](https://github.com/smallmiro/minecraft-server-manager/issues/32))
- [ ] Implement Inbound Ports:
  - [ ] `ICreateServerUseCase`
  - [ ] `IDeleteServerUseCase`
  - [ ] `IServerStatusUseCase`
- [ ] Implement Outbound Ports:
  - [ ] `IPromptPort` - user interaction interface
  - [ ] `IShellPort` - bash script execution interface
  - [ ] `IDocProvider` - docs directory reader interface
  - [ ] `IServerRepository` - server data access

#### Phase 7.4: Application Layer - Use Cases ([#33](https://github.com/smallmiro/minecraft-server-manager/issues/33))
- [ ] Implement Use Cases:
  - [ ] `CreateServerUseCase` - interactive server creation
  - [ ] `DeleteServerUseCase` - server deletion with confirmation
  - [ ] `ServerStatusUseCase` - display server status
  - [ ] `WorldManagementUseCase` - world lock/unlock operations
  - [ ] `BackupUseCase` - backup operations
  - [ ] `PlayerLookupUseCase` - player UUID lookup

#### Phase 7.5: Infrastructure Adapters ([#34](https://github.com/smallmiro/minecraft-server-manager/issues/34))
- [ ] Implement Adapters:
  - [ ] `ClackPromptAdapter` - @clack/prompts implementation of IPromptPort
  - [ ] `ShellAdapter` - Bash script execution via ShellExecutor
  - [ ] `DocsAdapter` - Read and parse docs/ markdown files
  - [ ] `ServerRepository` - Server configuration file access
- [ ] Create Dependency Injection container

#### Phase 7.6: DocsAdapter Implementation ([#35](https://github.com/smallmiro/minecraft-server-manager/issues/35))
- [ ] Parse `docs/06-types-and-platforms.md` for server types
- [ ] Parse `docs/03-variables.md` for environment variables
- [ ] Extract version compatibility information
- [ ] Cache parsed documentation
- [ ] Handle documentation format changes gracefully

#### Phase 7.7: Interactive Commands ([#36](https://github.com/smallmiro/minecraft-server-manager/issues/36), [#37](https://github.com/smallmiro/minecraft-server-manager/issues/37), [#38](https://github.com/smallmiro/minecraft-server-manager/issues/38))
- [ ] `mcctl create` - interactive server creation
- [ ] `mcctl delete` - server deletion with confirmation
- [ ] `mcctl world assign` - interactive world assignment
- [ ] `mcctl backup push` - interactive backup with message

#### Phase 7.8: Testing ([#39](https://github.com/smallmiro/minecraft-server-manager/issues/39))
- [ ] Unit tests for Value Objects
- [ ] Use Case tests with mock ports
- [ ] Integration tests with mocked shell
- [ ] Mock implementations:
  - [ ] `MockPromptAdapter`
  - [ ] `MockShellAdapter`
  - [ ] `MockDocsAdapter`

#### Phase 7.9: Documentation ([#40](https://github.com/smallmiro/minecraft-server-manager/issues/40))
- [ ] Update README.md with interactive examples
- [ ] Update CLAUDE.md with new CLI architecture
- [ ] Add developer documentation for extending CLI
- [ ] Update prd.md implementation status

#### Phase 7.10: Shared Package Refactoring ([#54](https://github.com/smallmiro/minecraft-server-manager/issues/54))
- [ ] Domain Layer 이동 (`domain/entities`, `domain/value-objects`) → shared
- [ ] Application Layer 이동 (`application/ports`, `application/use-cases`) → shared
- [ ] 공통 Infrastructure 이동 (`ShellAdapter`, `ServerRepository`, `WorldRepository`) → shared
- [ ] CLI 패키지에서 shared 패키지 import로 변경
- [ ] 빌드 및 테스트 검증
- [ ] package.json exports 업데이트

### 7.3 Directory Structure

#### After Phase 7.10 Refactoring (Target Structure)

**shared 패키지** (`@minecraft-docker/shared`):
```
platform/services/shared/src/
├── domain/                      # 🟢 DOMAIN LAYER (공통)
│   ├── entities/
│   │   ├── Server.ts
│   │   └── World.ts
│   └── value-objects/
│       ├── ServerName.ts
│       ├── ServerType.ts
│       ├── McVersion.ts
│       ├── Memory.ts
│       └── WorldOptions.ts
│
├── application/                 # 🟡 APPLICATION LAYER (공통)
│   ├── ports/
│   │   ├── inbound/             # Use Case 인터페이스
│   │   └── outbound/            # Repository/Service 인터페이스
│   └── use-cases/
│       ├── CreateServerUseCase.ts
│       ├── DeleteServerUseCase.ts
│       └── ...
│
├── infrastructure/              # 🔴 공통 INFRASTRUCTURE
│   ├── adapters/
│   │   ├── ShellAdapter.ts
│   │   ├── ServerRepository.ts
│   │   └── WorldRepository.ts
│   └── docker/                  # 기존 Docker 유틸리티
│
├── types/                       # 기존 유지
└── utils/                       # 기존 유지
```

**CLI 패키지** (`@minecraft-docker/mcctl`):
```
platform/services/cli/src/
├── index.ts                     # Entry point (bootstrap DI)
│
├── adapters/                    # 🔴 CLI 전용 ADAPTERS
│   └── ClackPromptAdapter.ts    # @clack/prompts 구현
│
├── di/
│   └── container.ts             # CLI용 DI 구성
│
└── commands/                    # 🔵 CLI COMMANDS
    ├── create.ts
    ├── delete.ts
    └── ...
```

**web-admin 패키지** (`@minecraft-docker/web-admin`, 향후):
```
platform/services/web-admin/src/
├── api/                         # REST/GraphQL endpoints
├── adapters/
│   └── WebPromptAdapter.ts      # HTTP 기반 구현
├── di/
│   └── container.ts             # Web용 DI 구성
└── index.ts
```

### 7.4 Interactive Flow Example

```
$ mcctl create

┌  Create Minecraft Server
│
◆  Server name?
│  myserver
│
◆  Server type?
│  ● Paper (Recommended) - High performance with plugin support
│  ○ Vanilla - Official Minecraft server
│  ○ Forge - Modded server for Forge mods
│  ○ Fabric - Lightweight modded server
│
◆  Minecraft version?
│  ● 1.21.1 (Latest)
│  ○ 1.20.4
│  ○ Other...
│
◆  World setup?
│  ● New world (generate new)
│  ○ Use existing world
│  ○ Download from URL
│
◆  Memory allocation?
│  4G
│
◇  Creating server...
│
└  ✓ Server 'myserver' created successfully!
   Connect via: myserver.local:25565
```

### 7.5 Technology Stack

| Component | Package | Purpose |
|-----------|---------|---------|
| **Prompts** | `@clack/prompts` | Interactive CLI prompts |
| **Spinner** | `@clack/prompts` (built-in) | Progress indicators |
| **Colors** | `picocolors` | Terminal color styling |

### 7.6 Verification

```bash
# 1. Build
pnpm build

# 2. Test interactive create
mcctl create
# (Follow interactive prompts)

# 3. Test CLI argument mode (backward compatible)
mcctl create myserver -t PAPER -v 1.21.1

# 4. Test interactive delete
mcctl delete
# (Select server from list, confirm deletion)

# 5. Run unit tests
pnpm test

# 6. Check test coverage
pnpm test --coverage
```

---

## Phase 7.2: Server Backup Commands ✅ COMPLETED

> **Issue**: [#64](https://github.com/smallmiro/minecraft-server-manager/issues/64)
> **PR**: [#65](https://github.com/smallmiro/minecraft-server-manager/pull/65)
> **Status**: ✅ Completed

### 7.2.1 Overview

개별 서버의 설정 파일을 백업/복원하는 기능입니다. 월드 데이터가 아닌 서버 운영에 필요한 설정 파일만 대상으로 합니다.

**백업 대상 파일**:
| 파일 | 설명 | 우선순위 |
|------|------|----------|
| `config.env` | 서버 환경 설정 | 필수 |
| `docker-compose.yml` | Docker 서비스 정의 | 필수 |
| `data/ops.json` | 운영자 목록 | 필수 |
| `data/whitelist.json` | 화이트리스트 | 필수 |
| `data/banned-players.json` | 차단된 플레이어 | 필수 |
| `data/banned-ips.json` | 차단된 IP | 필수 |
| `data/server.properties` | 서버 속성 (생성됨) | 선택 |

### 7.2.2 Commands

**`mcctl server-backup <server> [options]`**
```bash
# 기본 백업
mcctl server-backup myserver

# 설명 추가
mcctl server-backup myserver -m "Before upgrade to 1.21"

# 백업 목록 조회
mcctl server-backup myserver --list
mcctl server-backup myserver --list --json
```

**`mcctl server-restore <server> [backup-id] [options]`**
```bash
# 대화형 복원 (백업 목록 표시)
mcctl server-restore myserver

# 직접 복원
mcctl server-restore myserver 20250120-143025

# 강제 복원 (확인 생략)
mcctl server-restore myserver 20250120-143025 --force

# 드라이런 (변경 없이 확인만)
mcctl server-restore myserver 20250120-143025 --dry-run
```

### 7.2.3 Backup File Structure

```
~/minecraft-servers/backups/servers/
└── myserver/
    └── 20250120-143025.tar.gz
        ├── manifest.json
        ├── config.env
        ├── docker-compose.yml
        └── data/
            ├── ops.json
            ├── whitelist.json
            ├── banned-players.json
            ├── banned-ips.json
            └── server.properties
```

### 7.2.4 manifest.json Schema

```json
{
  "version": "1.0",
  "serverName": "myserver",
  "createdAt": "2025-01-20T14:30:25Z",
  "description": "Before upgrade to 1.21",
  "mcctlVersion": "0.1.5",
  "files": [
    { "path": "config.env", "size": 1024, "checksum": "sha256:..." },
    { "path": "docker-compose.yml", "size": 512, "checksum": "sha256:..." },
    { "path": "data/ops.json", "size": 256, "checksum": "sha256:..." }
  ],
  "serverConfig": {
    "type": "PAPER",
    "version": "1.21.1",
    "memory": "4G"
  }
}
```

### 7.2.5 Implementation Tasks

#### Phase 1: server-backup command
- [x] Create `commands/server-backup.ts`
- [x] Implement backup file collection logic
- [x] Create tar.gz with manifest.json
- [x] Add `--list` option for backup listing
- [x] Add to index.ts routing and help text

#### Phase 2: server-restore command
- [x] Create `commands/server-restore.ts`
- [x] Implement backup extraction logic
- [x] Add interactive backup selection
- [x] Add confirmation prompt
- [x] Add `--dry-run` option
- [x] Add `--force` option
- [x] Add to index.ts routing and help text

#### Phase 3: Testing & Documentation
- [x] Unit tests for backup/restore logic
- [x] Integration tests for full backup/restore cycle
- [x] Update README.md with new commands
- [x] Update CLAUDE.md with new commands

### 7.2.6 Verification

```bash
# 1. Build
pnpm build

# 2. Test backup creation
mcctl server-backup myserver -m "Test backup"

# 3. Test backup listing
mcctl server-backup myserver --list
mcctl server-backup myserver --list --json

# 4. Test dry-run restore
mcctl server-restore myserver 20250120-143025 --dry-run

# 5. Test actual restore
mcctl server-restore myserver 20250120-143025

# 6. Verify restored files
cat ~/minecraft-servers/servers/myserver/config.env
```

---

## Phase 7.3: World Selection Enhancement ✅ COMPLETED

> **Issue**: [#66](https://github.com/smallmiro/minecraft-server-manager/issues/66)
> **PR**: [#69](https://github.com/smallmiro/minecraft-server-manager/pull/69)
> **Status**: ✅ Completed

### 7.3.1 Overview

`mcctl create` 명령어에서 "Use existing world" 선택 시 기존 월드 목록을 보여주고 사용 상태별로 분류하여 표시합니다.

**월드 분류**:
| 상태 | 설명 | 선택 가능 |
|------|------|----------|
| 🟢 Available | 어떤 서버에서도 사용하지 않는 월드 | ✅ 바로 선택 가능 |
| 🟡 Reusable | 다른 서버에서 사용하지만 서버가 중지됨 | ⚠️ 경고 후 선택 가능 |
| 🔴 Locked | 다른 서버에서 사용 중 (서버 실행 중) | ❌ 선택 불가 |

### 7.3.2 User Interface

```
$ mcctl create
...
◆ World setup?
│  ○ New world (generate new)
│  ● Use existing world
│  ○ Download from URL
│
◆ Select a world:
│
│  🟢 Available worlds:
│    ● survival-world
│    ○ creative-world
│    ○ test-world
│
│  🟡 Used by stopped servers (will transfer):
│    ○ adventure-world (mc-server1 - stopped)
│
│  🔴 In use (cannot select):
│    ✗ main-world (mc-server2 - running)
│
```

### 7.3.3 Implementation Tasks

#### Phase 1: WorldRepository Enhancement
- [x] Add `getWorldsWithStatus()` method to WorldRepository
- [x] Query ServerRepository for world usage
- [x] Query Docker for server running status
- [x] Return categorized world list

#### Phase 2: ClackPromptAdapter Update
- [x] Modify `promptWorldOptions()` for world selection
- [x] Create `promptSelectWorld()` with categorized display
- [x] Add warning confirmation for reusable worlds
- [x] Disable locked world options

#### Phase 3: CreateServerUseCase Integration
- [x] Update Use Case to use new world selection flow
- [x] Handle world ownership transfer for reusable worlds
- [x] Maintain CLI argument compatibility (`-w <name>`)

#### Phase 4: Testing & Documentation
- [x] Unit tests for WorldRepository categorization
- [x] Integration tests for world selection flow
- [x] Update help text and documentation

### 7.3.4 Verification

```bash
# 1. Build
pnpm build

# 2. Test interactive world selection
mcctl create
# (Select "Use existing world" and verify categorized list)

# 3. Test CLI argument mode (backward compatible)
mcctl create myserver -w existing-world

# 4. Run tests
pnpm test
```

---

## Phase 7.4: Player Management Commands ✅ COMPLETED

> **Issue**: [#67](https://github.com/smallmiro/minecraft-server-manager/issues/67)
> **PR**: [#70](https://github.com/smallmiro/minecraft-server-manager/pull/70)
> **Status**: ✅ Completed

### 7.4.1 Overview

플레이어 관리를 위한 화이트리스트, 밴/언밴, 킥 명령어를 추가합니다. 기존 PlayerLookupUseCase와 통합하여 UUID 조회를 자동화합니다.

**명령어 구조**:
| 명령어 | 설명 |
|--------|------|
| `mcctl whitelist <server> <action> [player]` | 화이트리스트 관리 |
| `mcctl ban <server> <action> [player] [--reason]` | 밴/언밴 관리 |
| `mcctl kick <server> <player> [--reason]` | 플레이어 킥 |

### 7.4.2 Command Details

#### Whitelist Command
```bash
# 화이트리스트 활성화/비활성화
mcctl whitelist myserver on
mcctl whitelist myserver off

# 플레이어 추가/제거
mcctl whitelist myserver add Notch
mcctl whitelist myserver remove Steve

# 목록 조회
mcctl whitelist myserver list
mcctl whitelist myserver list --json
```

#### Ban Command
```bash
# 플레이어 밴
mcctl ban myserver add Griefer --reason "Griefing"
mcctl ban myserver add Griefer  # 사유 없이 밴

# 밴 해제
mcctl ban myserver remove Griefer

# 밴 목록
mcctl ban myserver list
mcctl ban myserver list --json
```

#### Kick Command
```bash
# 플레이어 킥
mcctl kick myserver AFK_Player
mcctl kick myserver AFK_Player --reason "AFK too long"
```

### 7.4.3 Implementation Tasks

#### Phase 1: Infrastructure
- [x] Create `commands/whitelist.ts`
- [x] Create `commands/ban.ts`
- [x] Create `commands/kick.ts`
- [x] Add to index.ts routing and help text

#### Phase 2: RCON Integration
- [x] Implement RCON command execution for whitelist
- [x] Implement RCON command execution for ban/pardon
- [x] Implement RCON command execution for kick
- [x] Handle server not running errors gracefully

#### Phase 3: JSON File Management
- [x] Read/write `whitelist.json`
- [x] Read/write `banned-players.json`
- [x] Integrate with PlayerLookupUseCase for UUID

#### Phase 4: Interactive Mode
- [x] Interactive server selection (if not provided)
- [x] Online player list for kick command
- [x] Confirmation prompts for destructive actions

#### Phase 5: Testing & Documentation
- [x] Unit tests for each command
- [x] Integration tests with mock RCON
- [x] Update README.md and CLAUDE.md

### 7.4.4 Technical Details

**RCON Commands**:
| Action | RCON Command |
|--------|--------------|
| Whitelist on | `whitelist on` |
| Whitelist off | `whitelist off` |
| Whitelist add | `whitelist add <player>` |
| Whitelist remove | `whitelist remove <player>` |
| Whitelist list | `whitelist list` |
| Ban | `ban <player> [reason]` |
| Pardon | `pardon <player>` |
| Ban list | `banlist players` |
| Kick | `kick <player> [reason]` |

**JSON File Structure** (`whitelist.json`):
```json
[
  {
    "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
    "name": "Notch"
  }
]
```

**JSON File Structure** (`banned-players.json`):
```json
[
  {
    "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
    "name": "Griefer",
    "created": "2025-01-20 14:30:25 +0900",
    "source": "Server",
    "expires": "forever",
    "reason": "Griefing"
  }
]
```

### 7.4.5 Verification

```bash
# 1. Build
pnpm build

# 2. Test whitelist commands
mcctl whitelist myserver list
mcctl whitelist myserver add TestPlayer
mcctl whitelist myserver remove TestPlayer
mcctl whitelist myserver on
mcctl whitelist myserver off

# 3. Test ban commands
mcctl ban myserver add TestPlayer --reason "Testing"
mcctl ban myserver list
mcctl ban myserver remove TestPlayer

# 4. Test kick command (requires running server with player)
mcctl kick myserver TestPlayer --reason "Testing kick"

# 5. Run tests
pnpm test
```

---

## Phase 7.5: Detailed Monitoring

> **Issue**: [#68](https://github.com/smallmiro/minecraft-server-manager/issues/68)
> **Status**: ✅ Done

### 7.5.1 Overview

서버와 mc-router의 상세 모니터링 기능을 추가합니다. 온라인 플레이어, 리소스 사용량, 업타임 등을 실시간으로 확인할 수 있습니다.

### 7.5.2 Command Structure

```bash
# 기본 상태 (기존과 동일)
mcctl status

# 상세 상태
mcctl status --detail

# 실시간 모니터링 (5초 간격)
mcctl status --watch

# 특정 서버 상세 상태
mcctl status myserver

# mc-router 상태
mcctl router status
```

### 7.5.3 Output Examples

#### Basic Status (Existing)
```
=== Server Status ===
SERVICE      STATUS    HEALTH    PORT/INFO
mc-router    running   healthy   :25565 (hostname routing)
mc-survival  running   healthy   survival.local
mc-creative  stopped   -         creative.local (auto-scale ready)
```

#### Detailed Status (`--detail`)
```
=== Detailed Server Status ===

📡 MC-ROUTER
   Status: running (healthy)
   Uptime: 3d 14h 22m
   Port: 25565
   Connections: 5 active
   Routing Table:
     survival.local → mc-survival:25565
     creative.local → mc-creative:25565

🖥️  MC-SURVIVAL (Paper 1.21.1)
   Status: running (healthy)
   Uptime: 2d 8h 15m
   Players: 3/20 online
     - Notch
     - Steve
     - Alex
   Memory: 2.1GB / 4GB (52%)
   CPU: 15%
   TPS: 19.8

🖥️  MC-CREATIVE (Paper 1.21.1)
   Status: stopped (auto-scale ready)
   Last active: 2 hours ago
   Players: 0/20
```

#### Watch Mode (`--watch`)
```
=== Live Status (5s refresh) ===
Last update: 2025-01-20 14:30:25

[Press Ctrl+C to exit]

SERVICE      STATUS    PLAYERS   MEM      CPU    TPS
mc-survival  running   3/20      52%      15%    19.8
mc-creative  stopped   -         -        -      -

Total: 3 players online
```

#### Single Server Status (`mcctl status <server>`)
```
=== Server: mc-survival ===

Type: Paper 1.21.1
Status: running (healthy)
Uptime: 2d 8h 15m
Hostname: survival.local, survival.192.168.1.100.nip.io

📊 Resources:
   Memory: 2.1GB / 4GB (52%)
   CPU: 15%
   Disk: 1.2GB

👥 Players (3/20):
   - Notch (OP)
   - Steve
   - Alex

⚡ Performance:
   TPS: 19.8
   MSPT: 48.2ms
```

### 7.5.4 Implementation Tasks

#### Phase 1: Docker Stats Integration
- [ ] Add `getContainerStats()` to docker/index.ts
- [ ] Parse memory usage from Docker stats
- [ ] Parse CPU usage from Docker stats
- [ ] Calculate uptime from container start time

#### Phase 2: Player Information
- [ ] Execute RCON `list` command to get online players
- [ ] Parse player list response
- [ ] Get max players from server.properties or config.env

#### Phase 3: TPS Monitoring
- [ ] Execute RCON command for TPS (Paper/Spigot specific)
- [ ] Handle servers without TPS support gracefully

#### Phase 4: Status Command Enhancement
- [ ] Add `--detail` flag to status command
- [ ] Add `--watch` flag with refresh loop
- [ ] Add single server status (`mcctl status <server>`)
- [ ] Implement table formatting for watch mode

#### Phase 5: Router Status
- [ ] Create `mcctl router status` subcommand
- [ ] Parse mc-router logs for connection stats
- [ ] Show routing table from Docker labels

#### Phase 6: Testing & Documentation
- [ ] Unit tests for stats parsing
- [ ] Integration tests for status commands
- [ ] Update help text and documentation

### 7.5.5 Technical Details

**Docker Stats API**:
```typescript
interface ContainerStats {
  memory: {
    usage: number;    // bytes
    limit: number;    // bytes
    percent: number;  // 0-100
  };
  cpu: {
    percent: number;  // 0-100
  };
  uptime: number;     // seconds
}
```

**RCON Commands**:
| Info | RCON Command | Server Type |
|------|--------------|-------------|
| Player list | `list` | All |
| TPS | `tps` | Paper/Spigot |
| TPS (Forge) | `forge tps` | Forge |

### 7.5.6 Verification

```bash
# 1. Build
pnpm build

# 2. Test detailed status
mcctl status --detail

# 3. Test watch mode
mcctl status --watch
# (Wait for refresh, then Ctrl+C)

# 4. Test single server status
mcctl status myserver

# 5. Test router status
mcctl router status

# 6. Test JSON output
mcctl status --detail --json

# 7. Run tests
pnpm test
```

---

## Phase 7.6: Sudo Password Handling for Automation ✅ COMPLETED

> **Issue**: [#72](https://github.com/smallmiro/minecraft-server-manager/issues/72)
> **PR**: [#74](https://github.com/smallmiro/minecraft-server-manager/pull/74)
> **Status**: ✅ Completed

### 7.6.1 Overview

Scripts requiring `sudo` (create-server.sh, delete-server.sh) block automation. Add password handling mechanism for CLI and environment variable support.

**Problem Areas**:
| Script | sudo Required For | Location |
|--------|-------------------|----------|
| `create-server.sh` | `/etc/avahi/hosts`, `systemctl restart avahi-daemon` | :121-133 |
| `delete-server.sh` | `/etc/avahi/hosts`, `systemctl restart avahi-daemon` | :204-209 |
| `logs.sh` | `journalctl` | :258 |

### 7.6.2 Commands

```bash
# Parameter mode
mcctl create myserver --sudo-password "mypassword"
mcctl delete myserver --sudo-password "mypassword"

# Environment variable mode
MCCTL_SUDO_PASSWORD=secret mcctl create myserver

# Interactive mode (prompted when needed)
$ mcctl create myserver
? sudo password (for mDNS registration): ••••••••
```

### 7.6.3 Implementation Tasks

#### Phase 1: CLI Option & Environment Variable
- [x] Add `--sudo-password` option to create/delete commands
- [x] Support `MCCTL_SUDO_PASSWORD` environment variable
- [x] Add password prompt in interactive mode using `@clack/prompts` password()
- [x] Create `ISudoPort` interface in application layer

#### Phase 2: Bash Script Modifications
- [x] Update `create-server.sh` to support `sudo -S` with password from env
- [x] Update `delete-server.sh` to support `sudo -S` with password from env
- [x] Update `logs.sh` for journalctl sudo handling (optional)

#### Phase 3: Security & Documentation
- [x] Ensure password not visible in `ps` output
- [x] Clear password from memory after use
- [x] Never log passwords
- [x] Document sudoers NOPASSWD configuration as alternative

### 7.6.4 Verification

```bash
# 1. Build
pnpm build

# 2. Test with environment variable
MCCTL_SUDO_PASSWORD=secret mcctl create testserver

# 3. Test with parameter
mcctl create testserver --sudo-password secret

# 4. Test interactive mode
mcctl create testserver
# (Should prompt for password when sudo needed)

# 5. Verify password not in process list
ps aux | grep mcctl  # Should NOT show password
```

---

## Phase 7.7: Unified Player Management with Interactive Mode ✅ COMPLETED

> **Issue**: [#73](https://github.com/smallmiro/minecraft-server-manager/issues/73)
> **PR**: [#75](https://github.com/smallmiro/minecraft-server-manager/pull/75)
> **Status**: ✅ Completed

### 7.7.1 Overview

Create unified `mcctl player` command with interactive mode for player management. Add Mojang API integration with encrypted local cache to minimize API calls.

**Current State**:
| Feature | Implementation | Interactive Mode |
|---------|---------------|------------------|
| Online player list | ✅ `player-online` | ❌ |
| Player info lookup | ❌ None | ❌ |
| Whitelist management | ✅ `whitelist` | ❌ |
| Ban management | ✅ `ban` | ❌ |
| OP management | ✅ `op` | ❌ |
| Kick | ✅ `kick` | ❌ |

### 7.7.2 Commands

```bash
# Unified interactive mode
mcctl player                    # Interactive: server → player → action
mcctl player myserver           # Interactive: player → action

# Subcommands
mcctl player online myserver    # List online players
mcctl player info Steve         # Player info (UUID, skin, etc.)

# Cache management
mcctl player cache clear        # Clear cached data
mcctl player cache stats        # Show cache statistics
```

### 7.7.3 Interactive Workflow

```
$ mcctl player

? Select server: (Use arrow keys)
❯ survival (3 players online)
  creative (0 players online)
  modded (1 player online)

? Select player: (Use arrow keys)
❯ Steve (online)
  Alex (online)
  Notch (online)
  [Enter player name manually]

? Select action:
❯ View player info
  Add to whitelist
  Remove from whitelist
  Add as operator
  Remove as operator
  Ban player
  Kick player (online only)
```

### 7.7.4 Player Cache System

**Purpose**: Cache Mojang API responses to avoid rate limiting.

**Cache Location**: `~/.mcctl/.player-cache` (encrypted)

**Cache Structure**:
```typescript
interface PlayerCache {
  version: number;
  players: {
    [username_lowercase: string]: {
      name: string;           // Original case-sensitive name
      uuid: string;           // Immutable UUID
      cachedAt: number;       // Timestamp
      source: 'mojang' | 'offline';
    }
  }
}
```

**Cache Policy**:
| Data Type | Cache Duration | Reason |
|-----------|---------------|--------|
| UUID | Permanent | Never changes |
| Username | 30 days | Can change (rare) |
| Skin URL | 1 day | Can change frequently |

**Cache Flow**:
```
Player lookup request
        │
        ▼
┌─────────────────────┐
│  Read cache file    │
│  (decrypt if exists)│
└─────────┬───────────┘
          │
          ▼
    ┌───────────┐     Yes    ┌─────────────────┐
    │ In cache? ├────────────► Return cached   │
    └─────┬─────┘            │ data            │
          │ No               └─────────────────┘
          ▼
┌─────────────────────┐
│  Call Mojang API    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Encrypt & save     │
│  to cache file      │
└─────────┬───────────┘
          │
          ▼
    Return data
```

### 7.7.5 Implementation Tasks

#### Phase 1: Unified Player Command
- [x] Create `mcctl player` unified command entry point
- [x] Implement server selection prompt
- [x] Implement player selection prompt (online + manual)
- [x] Implement action selection prompt
- [x] Add player action loop (continuous actions)

#### Phase 2: Reusable Prompt Components
- [x] Create `lib/prompts/server-select.ts`
- [x] Create `lib/prompts/player-select.ts`
- [x] Create `lib/prompts/action-select.ts`

#### Phase 3: Player Info Command (Mojang API)
- [x] Create `lib/mojang-api.ts` - Mojang API client
- [x] Create `commands/player.ts` - Unified player command with info
- [x] Integrate with existing PlayerLookupUseCase

#### Phase 4: Player Cache System
- [x] Create `lib/player-cache.ts` with AES-256-GCM encryption
- [x] Implement cache read/write with machine-specific key
- [x] Add cache statistics command
- [x] Add cache clear command
- [x] Set file permissions to `600`

#### Phase 5: Interactive Mode for Existing Commands
- [x] Add interactive mode to `whitelist.ts`
- [x] Add interactive mode to `ban.ts`
- [x] Add interactive mode to `op.ts`
- [x] Add interactive mode to `kick.ts`

#### Phase 6: Testing & Documentation
- [x] Unit tests for Mojang API client
- [x] Unit tests for cache encryption/decryption
- [x] Integration tests for player workflow
- [x] Update CLI documentation

### 7.7.6 Technical Details

**Mojang API**:
```
GET https://api.mojang.com/users/profiles/minecraft/{username}
Response: { "id": "uuid", "name": "CaseSensitiveName" }
```

**Encryption**:
- Algorithm: AES-256-GCM
- Key: Derived from machine-specific identifier
- File permissions: `600` (owner read/write only)

**Offline UUID Calculation**:
```typescript
// For offline-mode servers
function offlineUUID(name: string): string {
  const hash = md5(`OfflinePlayer:${name}`);
  // Set version 3 (name-based) UUID bits
  return formatAsUUID(hash);
}
```

### 7.7.7 Verification

```bash
# 1. Build
pnpm build

# 2. Test unified player command
mcctl player
# (Follow interactive prompts)

# 3. Test player info
mcctl player info Steve

# 4. Test cache
mcctl player cache stats
mcctl player cache clear

# 5. Test existing commands with interactive mode
mcctl whitelist myserver
# (Should prompt for action and player)

# 6. Run tests
pnpm test
```

---

## Phase 8: Admin Service (Web Management)

> **Milestone**: TBD
> **Status**: Planned

Implementation plan for web-based management console service. Consists of two independent services following MSA principles.

### 8.1 Service Structure

```
platform/services/
├── mcctl-api/              # @minecraft-docker/mcctl-api
│   ├── prd.md              # API service PRD
│   ├── plan.md             # API service Plan
│   └── src/
│
└── mcctl-console/          # @minecraft-docker/mcctl-console
    ├── prd.md              # Console service PRD
    ├── plan.md             # Console service Plan
    └── src/
```

### 8.2 Detailed Plan Documents

Each service has independent implementation plans:

- **mcctl-api**: [Plan](platform/services/mcctl-api/plan.md) - Fastify REST API
- **mcctl-console**: [Plan](platform/services/mcctl-console/plan.md) - Next.js BFF + UI

### 8.3 Implementation Order

#### Phase 8.1: Shared Package Extension
- [ ] Add `IUserRepository` port
- [ ] Implement `YamlUserRepository` adapter
- [ ] Implement `SqliteUserRepository` adapter
- [ ] Implement `ApiPromptAdapter`

#### Phase 8.2: CLI Console Commands
> **Note**: `mcctl admin` commands are deprecated. Use `mcctl console` instead.
- [ ] `mcctl console init` - Initial setup
- [ ] `mcctl console user` - User management
- [ ] `mcctl console api` - API settings
- [ ] `mcctl console service` - Service management

#### Phase 8.3: mcctl-api Service
- [ ] Fastify server structure
- [ ] Authentication plugin (5 access modes)
- [ ] REST API routes
- [ ] OpenAPI/Swagger
- [ ] Dockerfile

#### Phase 8.4: mcctl-console Service
- [ ] Next.js project setup
- [ ] NextAuth.js authentication
- [ ] BFF proxy
- [ ] Dashboard UI
- [ ] Dockerfile

#### Phase 8.5: Integration and Testing
- [ ] Docker Compose integration
- [ ] E2E tests

### 8.4 Verification

```bash
# 1. Initialize
mcctl console init

# 2. Start services
mcctl console service start

# 3. Access Console
open http://localhost:3000

# 4. API test (api-key mode)
curl -H "X-API-Key: mctk_xxx" http://localhost:3001/api/servers
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

**Option A: nip.io Magic DNS (Recommended)**:
No configuration needed! Connect using the nip.io hostname:
```
myserver.192.168.20.37.nip.io:25565
```
Replace `192.168.20.37` with your HOST_IP from `.env`. Works everywhere with internet access.

**Option B: mDNS (.local)**:
Clients on the same LAN automatically discover servers via mDNS (Bonjour/Zeroconf).
Just connect via Minecraft: `ironwood.local:25565`

**mDNS Requirements**:
| OS | Requirement |
|----|-------------|
| Linux | avahi-daemon (usually pre-installed) |
| macOS | Built-in Bonjour (no setup needed) |
| Windows | Bonjour Print Services or iTunes |

**Fallback (without mDNS or nip.io)**:
Add server hostnames to hosts file:
```
# /etc/hosts (Linux/macOS) or C:\Windows\System32\drivers\etc\hosts (Windows)
192.168.1.100 ironwood.local
192.168.1.100 myserver.local
```

Then connect via Minecraft: `ironwood.local:25565`
