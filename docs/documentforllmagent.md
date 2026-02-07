# mcctl - Minecraft Server Management CLI

> **Version**: 1.13.0
> **Last Updated**: 2026-02-07
> **Purpose**: Knowledge base for LLM agents (ChatGPT, Gemini, Claude) to answer mcctl questions

## System Requirements

| Component | Minimum Version | Recommended | Notes |
|-----------|-----------------|-------------|-------|
| **Node.js** | >= 18.0.0 | 20 LTS | Required for mcctl CLI |
| **Docker Engine** | >= 24.0.0 | Latest | Container runtime |
| **Docker Compose** | >= 2.20.0 | Latest | `include` feature required |
| **PM2** | >= 6.0.14 | Latest | Admin Service process management (bundled with mcctl) |
| **OS** | Linux, macOS | Ubuntu 22.04+ | Windows via WSL2 |

**Ports:**

| Service | Default Port | Description |
|---------|-------------|-------------|
| mcctl-api | 5001 | REST API server |
| mcctl-console | 5000 | Web Management UI |
| mc-router | 25565 | Minecraft connection router |

## Overview

`mcctl` is a command-line tool for managing multiple Minecraft servers using Docker. It provides:

- Multi-server management with hostname-based routing
- Auto-scaling (servers start on connect, stop when idle)
- Shared world storage with locking mechanism
- Player management (whitelist, ban, op, kick)
- Mod management (Modrinth, CurseForge, Spiget)
- Admin Service (REST API + Web Console)
- Audit Log System (activity tracking with SQLite storage)
- Real-time server monitoring via SSE (Server-Sent Events)

## Installation

```bash
# Install globally via npm
npm install -g @minecraft-docker/mcctl

# Or via pnpm
pnpm add -g @minecraft-docker/mcctl

# Initialize platform
mcctl init
```

Default data directory: `~/minecraft-servers`

## Command Reference

### Platform Management

```bash
mcctl init                    # Initialize platform
mcctl up                      # Start all (router + servers)
mcctl down                    # Stop all
mcctl router start|stop|restart  # Manage mc-router only
```

### Server Management

```bash
mcctl status                  # Show all servers status
mcctl status <server>         # Show specific server status
mcctl status --detail         # Show detailed info (memory, CPU)
mcctl status --watch          # Real-time monitoring

mcctl create <name>           # Create server (interactive)
mcctl create <name> -t FORGE -v 1.20.4  # Create with options
mcctl delete <name>           # Delete server (preserves world)

mcctl start <server>          # Start server
mcctl stop <server>           # Stop server
mcctl start --all             # Start all servers
mcctl stop --all              # Stop all servers

mcctl logs <server>           # View server logs
mcctl logs <server> -f        # Follow logs
mcctl console <server>        # RCON console
mcctl exec <server> <cmd>     # Execute RCON command
```

### Server Configuration

```bash
mcctl config <server>              # View all config
mcctl config <server> MOTD         # View specific key
mcctl config <server> MOTD "Hi!"   # Set value
mcctl config <server> --cheats     # Enable cheats
mcctl config <server> --no-pvp     # Disable PvP
```

### Player Management

```bash
# Operator management
mcctl op <server> list             # List operators
mcctl op <server> add <player>     # Add operator
mcctl op <server> remove <player>  # Remove operator

# Whitelist management
mcctl whitelist <server> list      # List whitelisted
mcctl whitelist <server> add <p>   # Add to whitelist
mcctl whitelist <server> remove <p>  # Remove from whitelist
mcctl whitelist <server> on|off    # Enable/disable whitelist

# Ban management
mcctl ban <server> list            # List banned players
mcctl ban <server> add <p> [reason]  # Ban player
mcctl ban <server> remove <p>      # Unban player
mcctl ban <server> ip list         # List banned IPs
mcctl ban <server> ip add <ip>     # Ban IP

# Kick player
mcctl kick <server> <player> [reason]

# Online players
mcctl player online <server>       # List online players
mcctl player online --all          # All servers

# Player info
mcctl player info <name>           # Get UUID, skin URL
mcctl player info <name> --offline # Offline UUID
```

### World Management

```bash
mcctl world list              # List worlds with lock status
mcctl world new               # Interactive: create new world
mcctl world new <name>        # Create world directory with .meta file
mcctl world new <name> --seed 12345  # Create with seed (stored in .meta)
mcctl world new <name> --server <srv>  # Create and assign to server
mcctl world new <name> --server <srv> --no-start  # Don't auto-start
mcctl world assign <world> <server>  # Lock world to server
mcctl world release <world>   # Release lock
mcctl world delete <world>    # Delete world (with confirmation)
mcctl world delete <world> --force  # Force delete without confirmation
```

### Mod Management

```bash
mcctl mod search <query>           # Search mods on Modrinth
mcctl mod add <server> <mod...>    # Add mods (Modrinth default)
mcctl mod add <server> --curseforge <mod>  # CurseForge
mcctl mod add <server> --spiget <id>  # SpigotMC plugin
mcctl mod add <server> --url <url>    # Direct URL
mcctl mod list <server>            # List configured mods
mcctl mod remove <server> <mod>    # Remove mod
mcctl mod sources                  # Show mod sources
```

### Backup Management

```bash
# Server config backup
mcctl server-backup <server>       # Backup server config
mcctl server-backup <server> --list  # List backups
mcctl server-restore <server>      # Interactive restore
mcctl server-restore <server> <id>   # Restore specific backup

# World backup (GitHub)
mcctl backup init                 # Interactive GitHub backup setup
mcctl backup status               # Show backup config
mcctl backup push                 # Backup to GitHub
mcctl backup push -m "message"    # With message
mcctl backup history              # Show history
mcctl backup restore <commit>     # Restore from commit
```

### Console Management (Admin Service)

#### Initialization

```bash
mcctl console init              # Initialize console service (interactive)
mcctl console init --force      # Reinitialize (stops services, cleans config)
mcctl console init --api-port 8001 --console-port 8000  # Custom ports
```

**Interactive init flow:**

1. Select services to install (mcctl-api, mcctl-console via multiselect)
2. Admin username (required only if console selected)
3. Admin password (min 8 chars, uppercase + lowercase + number)
4. API access mode (internal / api-key / ip-whitelist / api-key-ip / open)
5. API key generated (if api-key or api-key-ip mode)
6. IP whitelist (if ip-whitelist or api-key-ip mode)
7. Generates PM2 ecosystem.config.cjs
8. Saves configuration (.mcctl-admin.yml)

**Files created after init:**

| File | Location | Description |
|------|----------|-------------|
| `.mcctl-admin.yml` | `~/minecraft-servers/` | Admin service configuration |
| `users.yaml` | `~/minecraft-servers/` | User credentials (hashed) |
| `ecosystem.config.cjs` | `~/minecraft-servers/platform/` | PM2 process config |

#### Service Lifecycle (v1.13.0+ Interactive Selection)

```bash
# Start services (interactive prompt if both available)
mcctl console service start       # Prompts: "API only" or "API + Console"
mcctl console service start --api # Start API only (no prompt)
mcctl console service start --console  # Start API + Console (console needs API)

# Stop services (interactive prompt if both available)
mcctl console service stop        # Prompts: "All services" or "Console only"
mcctl console service stop --api  # Stop ALL services (console depends on API)
mcctl console service stop --console   # Stop console only
mcctl console service stop --force     # Force kill PM2 processes

# Restart services
mcctl console service restart     # Interactive prompt
mcctl console service restart --force  # Kill PM2 daemon and restart fresh

# Status and logs
mcctl console service status      # Show PM2 process status
mcctl console service status --json    # JSON output
mcctl console service logs        # View recent logs
mcctl console service logs -f     # Follow logs in real-time
```

**Service dependency rules:**

| Action | --api flag | --console flag | No flag (interactive) |
|--------|-----------|---------------|----------------------|
| **start** | API only | API + Console (console needs API) | Prompt: "API only" / "API + Console" |
| **stop** | ALL (console can't run without API) | Console only | Prompt: "All services" / "Console only" |
| **restart** | Same as start | Same as start | Same as start |
| **logs** | API logs | API + Console logs | Prompt: "API only" / "API + Console" |

**Key behavior:**
- Console **always requires** API to be running
- Stopping API **always stops** Console too (dependency enforcement)
- If only one service is installed, no prompt is shown
- User can cancel interactive prompts (returns gracefully)

#### User Management

```bash
mcctl console user list         # List console users
mcctl console user add <name>   # Add user (interactive password prompt)
mcctl console user add <name> --role viewer --password "Pass123"
mcctl console user remove <name>  # Remove user
mcctl console user reset-password <name>  # Reset password
mcctl console user update <name> --role admin  # Change role
```

**User roles:**

| Role | Permissions |
|------|------------|
| `admin` | Full access: manage servers, users, settings |
| `viewer` | Read-only: view status, logs (no start/stop/create/delete) |

#### API Key Management

```bash
mcctl console api status        # Show API access mode and config
mcctl console api key regenerate  # Regenerate API key
mcctl console api whitelist list  # List allowed IPs
mcctl console api whitelist add <ip>  # Add IP to whitelist
mcctl console api mode <mode>   # Change access mode
```

#### Remove Console

```bash
mcctl console remove            # Interactive removal (stops services, deletes config)
mcctl console remove --force    # Skip confirmation
mcctl console remove --keep-config  # Keep config files for later reinstall
```

### Audit Log Management

```bash
mcctl audit list                   # List recent 50 logs
mcctl audit list --limit 100       # List 100 logs
mcctl audit list --action server.create  # Filter by action
mcctl audit list --actor cli:local  # Filter by actor
mcctl audit list --target myserver  # Filter by target server
mcctl audit list --status failure   # Show only failures
mcctl audit list --from 2026-01-01  # Date range filtering

mcctl audit stats                  # Overview statistics
mcctl audit purge                  # Delete logs older than 90 days
mcctl audit purge --days 30        # Custom retention period
mcctl audit purge --before 2026-01-01  # Delete before date
mcctl audit purge --dry-run        # Preview without deleting
mcctl audit purge --force          # Skip confirmation
```

### Self Update

```bash
mcctl update                    # Update CLI to latest version
mcctl update --check            # Check for updates only
mcctl update --force            # Force check (ignore cache)
mcctl update --yes              # Auto-confirm update
mcctl update --all              # Update CLI + all installed services
mcctl update --check --all      # Check updates for CLI and services
```

The `--all` flag updates mcctl-api, mcctl-console, and @minecraft-docker/shared services via `npm install <pkg>@latest` and restarts their PM2 processes automatically.

## Server Types

| Type | Description | Plugins | Mods | Recommended For |
|------|-------------|---------|------|-----------------|
| **PAPER** | High-performance (default) | Yes | No | General use |
| **VANILLA** | Official Minecraft | No | No | Pure experience |
| **FORGE** | Forge mod server | No | Yes | Complex modpacks |
| **NEOFORGE** | NeoForge mod server (1.20.1+) | No | Yes | Modern modpacks |
| **FABRIC** | Lightweight mods | No | Yes | Performance mods |
| **PURPUR** | Paper fork | Yes | No | Advanced customization |

## REST API Reference

Admin Service provides a REST API (port 5001) for programmatic access.

### Authentication

```bash
# API Key (recommended)
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers

# Basic Auth
curl -u admin:password http://localhost:5001/api/servers
```

**5 Authentication Modes:**

| Mode | Description | Use Case |
|------|-------------|----------|
| `internal` | Local network only (default) | Home/local deployment |
| `api-key` | X-API-Key header required | Automation, scripts |
| `ip-whitelist` | IP-based access control | Known client IPs |
| `api-key-ip` | Both API key AND IP required | Maximum security |
| `open` | No authentication | Development only |

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/servers` | List all servers |
| GET | `/api/servers/:name` | Get server details |
| POST | `/api/servers` | Create new server |
| DELETE | `/api/servers/:name` | Delete server |
| POST | `/api/servers/:name/start` | Start server |
| POST | `/api/servers/:name/stop` | Stop server |
| POST | `/api/servers/:name/restart` | Restart server |
| POST | `/api/servers/:name/exec` | Execute RCON command |
| GET | `/api/servers/:name/logs` | Get logs (supports SSE) |
| GET | `/api/servers/:name/config` | Get server configuration |
| PUT | `/api/servers/:name/config` | Update server configuration |
| POST | `/api/servers/:name/world/reset` | Reset server world |
| GET | `/api/sse/servers-status` | SSE stream: all server statuses |
| GET | `/api/router/status` | Get mc-router status and routes |
| GET | `/api/servers/:name/players` | List online players |
| GET | `/api/players/:username` | Get player info from Mojang |
| GET | `/api/servers/:name/whitelist` | Get whitelist |
| POST | `/api/servers/:name/whitelist` | Add to whitelist |
| DELETE | `/api/servers/:name/whitelist/:player` | Remove from whitelist |
| GET | `/api/servers/:name/bans` | Get banned players |
| POST | `/api/servers/:name/bans` | Ban player |
| DELETE | `/api/servers/:name/bans/:player` | Unban player |
| GET | `/api/servers/:name/ops` | Get operators |
| POST | `/api/servers/:name/ops` | Add operator |
| DELETE | `/api/servers/:name/ops/:player` | Remove operator |
| POST | `/api/servers/:name/kick` | Kick player |
| GET | `/api/worlds` | List all worlds |
| POST | `/api/worlds` | Create world |
| GET | `/api/worlds/:name` | Get world details |
| DELETE | `/api/worlds/:name` | Delete world |
| POST | `/api/worlds/:name/assign` | Assign world to server |
| POST | `/api/worlds/:name/release` | Release world lock |
| GET | `/api/backup/status` | Get backup config status |
| POST | `/api/backup/push` | Push backup to GitHub |
| GET | `/api/backup/history` | Get backup history |
| POST | `/api/backup/restore` | Restore from backup |
| GET | `/api/audit` | List audit logs (with filtering) |
| GET | `/api/audit/stats` | Audit log statistics |
| GET | `/api/audit/:id` | Get audit log detail |
| DELETE | `/api/audit` | Purge old audit logs |
| GET | `/api/audit/stream` | SSE stream: real-time audit events |

### SSE (Server-Sent Events) Endpoints

The API supports real-time streaming via SSE:

```bash
# Stream all server statuses (real-time)
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/sse/servers-status

# Stream audit log events (real-time)
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/audit/stream

# Server logs (SSE mode)
curl -H "X-API-Key: mctk_xxx" "http://localhost:5001/api/servers/myserver/logs?stream=true"
```

### Example: Execute Command

```bash
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"command": "list"}' \
  http://localhost:5001/api/servers/survival/exec
```

### Example: Create Server

```bash
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"name": "survival", "type": "PAPER", "version": "1.21.1", "memory": "4G"}' \
  http://localhost:5001/api/servers
```

### Swagger Documentation

Auto-generated API docs available at: `http://localhost:5001/docs`

## Web Console (mcctl-console)

### Overview

mcctl-console is a Next.js web application providing a modern UI for managing Minecraft servers. It runs on port 5000 and communicates with mcctl-api (port 5001) through a BFF (Backend-for-Frontend) proxy pattern.

**Key Technologies:**
- Next.js 14+ (App Router)
- React 18+ with MUI 5.x (Material UI)
- Better Auth for session-based authentication
- React Query for data fetching and caching
- SSE (Server-Sent Events) for real-time updates

### Architecture (BFF Proxy)

```
+------------------+      +-----------------+      +---------------+
|   Web Browser    | ---> | mcctl-console   | ---> |   mcctl-api   |
|   (React Query)  |      | (Next.js BFF)   |      |   (Fastify)   |
+------------------+      +-----------------+      +---------------+
                              |
                              | Session-based auth (Better Auth)
                              | + X-API-Key forwarding to mcctl-api
```

**Why BFF Proxy?**
1. API keys stay server-side, never exposed to browser
2. Better Auth handles user sessions securely
3. Type-safe shared TypeScript interfaces
4. React Query provides optimistic updates and caching

### Pages and Features

#### Dashboard (`/`)

- Server cards showing: name, type, version, status, players, hostname
- Quick action buttons: Start / Stop / Restart per server
- Real-time status via SSE (Server-Sent Events) - no polling
- Create Server dialog with type, version, memory, world options
- Recent Activity Feed from audit logs
- Changelog Feed from GitHub releases

**Status indicators:**
| Color | Meaning |
|-------|---------|
| Green | Running, healthy |
| Yellow | Starting, health check in progress |
| Red | Stopped, unhealthy |
| Gray | Not created, unknown |

#### Server Detail (`/servers/:name`)

- **Overview Tab**: Container info, uptime, memory, world name/size
- **Players Tab**: Online player list with Mojang skins
- **Console Tab**: RCON command execution with output display
- **Logs Tab**: Real-time server logs viewer
- **Options Tab** (v1.11+): Server configuration editing via web UI
- **Activity Tab** (v1.10+): Per-server audit log history
- **Delete**: MoreVert menu with delete confirmation dialog

#### Worlds Page (`/worlds`) (v1.11+)

- World list with: name, size, lock status, assigned server
- Create new world with seed option
- Assign world to server (shows non-running servers only)
- Release world lock
- Delete world with confirmation
- World reset functionality with safety checks

#### Audit Logs Page (`/audit-logs`) (v1.10+)

- Filterable audit log table: action, actor, target, status, date
- Statistics overview (total events, actions breakdown)
- Detail view for individual entries
- Export functionality
- SSE real-time streaming of new events

#### Routing Page (`/routing`) (v1.13+)

- Avahi mDNS monitoring
- Hostname routing configuration

#### Authentication

- Login page with username/password
- Better Auth session management (24h default)
- Sign out from user menu

### BFF Proxy Routes

| Console Route | Method | mcctl-api Route | Description |
|---------------|--------|-----------------|-------------|
| `/api/servers` | GET | `/api/servers` | List all servers |
| `/api/servers` | POST | `/api/servers` | Create server |
| `/api/servers/:name` | GET | `/api/servers/:name` | Get server details |
| `/api/servers/:name` | DELETE | `/api/servers/:name` | Delete server |
| `/api/servers/:name/start` | POST | `/api/servers/:name/start` | Start server |
| `/api/servers/:name/stop` | POST | `/api/servers/:name/stop` | Stop server |
| `/api/servers/:name/restart` | POST | `/api/servers/:name/restart` | Restart server |
| `/api/servers/:name/exec` | POST | `/api/servers/:name/exec` | Execute RCON command |
| `/api/servers/:name/logs` | GET | `/api/servers/:name/logs` | Get server logs |
| `/api/servers/:name/config` | GET/PUT | `/api/servers/:name/config` | Server config |
| `/api/servers/:name/world/reset` | POST | `/api/servers/:name/world/reset` | Reset world |
| `/api/worlds` | GET/POST | `/api/worlds` | List/Create worlds |
| `/api/worlds/:name` | GET/DELETE | `/api/worlds/:name` | World details/delete |
| `/api/worlds/:name/assign` | POST | `/api/worlds/:name/assign` | Assign world |
| `/api/worlds/:name/release` | POST | `/api/worlds/:name/release` | Release world |
| `/api/audit` | GET | `/api/audit` | List audit logs |
| `/api/audit/stats` | GET | `/api/audit/stats` | Audit statistics |
| `/api/sse/servers-status` | GET | `/api/sse/servers-status` | SSE server status |

### React Query Hooks

The console provides type-safe hooks for data fetching:

```typescript
// Server hooks
useServers()                    // List all servers (auto-refresh 10s)
useServer(name)                 // Get server details (auto-refresh 5s)
useCreateServer()               // Create server mutation
useDeleteServer()               // Delete server mutation
useStartServer()                // Start server mutation
useStopServer()                 // Stop server mutation
useRestartServer()              // Restart server mutation
useExecCommand()                // Execute RCON command
useServerLogs(name, lines)      // Get server logs (auto-refresh 3s)
useServersSSE()                 // SSE real-time server status stream
useServerStatus(name)           // Individual server SSE status

// World hooks
useWorlds()                     // List all worlds (auto-refresh 30s)
useWorld(name)                  // Get world details
useCreateWorld()                // Create world mutation
useAssignWorld()                // Assign world mutation
useReleaseWorld()               // Release world mutation
useDeleteWorld()                // Delete world mutation

// Audit hooks
useAuditLogs(filters)           // List audit logs with filtering
useAuditStats()                 // Audit log statistics
```

### Web Console Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCCTL_API_URL` | mcctl-api URL (internal) | `http://localhost:5001` |
| `MCCTL_API_KEY` | API key for authentication | Required |
| `BETTER_AUTH_SECRET` | Session encryption secret | Auto-generated |
| `BETTER_AUTH_URL` | Console URL for auth | `http://localhost:5000` |
| `PORT` | Console listening port | `5000` |
| `HOSTNAME` | Console listening host | `0.0.0.0` |
| `MCCTL_ROOT` | Platform root directory | `~/minecraft-servers` |

## Common Use Cases

### Setting Up a New Server

```bash
mcctl init                        # First time only
mcctl create myserver -t PAPER -v 1.21.1
# Connect via myserver.<HOST_IP>.nip.io:25565
```

### Setting Up a Modded Server

```bash
mcctl create modded -t FORGE -v 1.20.4
mcctl mod search create           # Search mods
mcctl mod add modded create jei journeymap
mcctl stop modded && mcctl start modded
```

### Performance Fabric Server

```bash
mcctl create perf -t FABRIC -v 1.21.1
mcctl config perf MODRINTH_PROJECTS "fabric-api,lithium,starlight,krypton"
mcctl config perf MODRINTH_DOWNLOAD_DEPENDENCIES required
mcctl stop perf && mcctl start perf
```

### Managing Players

```bash
mcctl whitelist myserver add Steve
mcctl op myserver add Notch
mcctl kick myserver Griefer "Griefing not allowed"
mcctl ban myserver add Griefer "Repeated griefing"
```

### Setting Up Admin Service (API + Web Console)

```bash
# Step 1: Initialize (interactive prompts)
mcctl console init
# Select: [mcctl-api, mcctl-console]
# Enter admin username and password
# Choose API access mode

# Step 2: Start services
mcctl console service start
# Select: "API + Console"

# Step 3: Access
# Web Console: http://localhost:5000
# REST API: http://localhost:5001
# Swagger Docs: http://localhost:5001/docs
```

### Setting Up API Only (No Web Console)

```bash
# Step 1: Initialize (select only mcctl-api)
mcctl console init
# Select: [mcctl-api] only (deselect mcctl-console)

# Step 2: Start
mcctl console service start
# No prompt shown (only API available)

# Step 3: Use REST API
curl -H "X-API-Key: mctk_xxx" http://localhost:5001/api/servers
```

### Auto-Start Services on Boot

```bash
# Configure PM2 startup
pm2 startup
# Run the command PM2 displays (with sudo)
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# Save current process list
pm2 save
```

### Updating Services

```bash
# Update everything (CLI + API + Console)
mcctl update --all --yes

# Or update manually
mcctl console service stop
npm update -g @minecraft-docker/mcctl
mcctl console service start
```

## FAQ

### Q: How do I connect to my server?
A: Use `<server>.<your-ip>.nip.io:25565` (works everywhere) or `<server>.local:25565` (requires mDNS/avahi).

### Q: Why does my server auto-stop?
A: mc-router auto-scales servers. They stop after 10 minutes of no players. They auto-start when someone connects.

### Q: How do I add mods?
A: Use `mcctl mod add <server> <mod-name>`. Default source is Modrinth. Use `--curseforge` for CurseForge mods.

### Q: Where is world data stored?
A: All worlds are in `~/minecraft-servers/worlds/`. They're shared across servers using locks.

### Q: How do I backup my server?
A: Use `mcctl server-backup <server>` for config. For worlds, run `mcctl backup init` for guided GitHub setup, then use `mcctl backup push`.

### Q: What server types are supported?
A: PAPER (default, recommended), VANILLA, FORGE, NEOFORGE, FABRIC, PURPUR, SPIGOT, BUKKIT, QUILT.

### Q: What are the system requirements?
A: Node.js >= 18.0.0, Docker Engine >= 24.0.0, Docker Compose >= 2.20.0. The `include` feature in docker-compose requires v2.20.0 or higher. PM2 is bundled with mcctl and installed automatically.

### Q: How do I enable cheats?
A: Use `mcctl config <server> --cheats` or set `ALLOW_CHEATS=true`.

### Q: How do I change memory?
A: Use `mcctl config <server> MEMORY 8G` then restart the server.

### Q: What is the Admin Service?
A: Web console (port 5000) + REST API (port 5001). Initialize with `mcctl console init` and start with `mcctl console service start`. The web console provides dashboard, server management, world management, audit logs, and routing configuration.

### Q: How do I use the REST API?
A: After `mcctl console init`, use the generated API key with `X-API-Key` header. See REST API Reference section. Swagger docs available at `http://localhost:5001/docs`.

### Q: Can I run just the API without the Web Console?
A: Yes. During `mcctl console init`, select only `mcctl-api` in the service selection. Or use `mcctl console service start --api` to start API only.

### Q: How does service selection work?
A: Since v1.13.0, `mcctl console service start/stop/restart` shows an interactive prompt when both services are installed. Console always requires API (start console = start API + console). Stopping API also stops Console. Use `--api` or `--console` flags to skip the prompt.

### Q: How do I optimize performance?
A: Use `mcctl config <server> USE_AIKAR_FLAGS true`. For modded servers, increase MEMORY to 6-8G.

### Q: What are audit logs?
A: Audit logs track all server operations (create, delete, start, stop, player management). View with `mcctl audit list` or in the Web Console. Auto-cleanup removes logs older than 90 days by default.

### Q: How does SSE work in the Web Console?
A: The console uses Server-Sent Events (SSE) for real-time server status updates instead of polling. This provides instant status changes with lower overhead. The SSE endpoint is `GET /api/sse/servers-status`.

## Architecture

```
+-------------------------------------------------------------+
|                     mc-router (:25565)                        |
|                  hostname-based routing                       |
|                  auto-scale up/down                           |
+------------------------------+------------------------------+
                               |
    +--------------------------+----------------------------+
    |                          |                            |
+--------+              +--------+                   +--------+
|mc-srv1 |              |mc-srv2 |                   |mc-srv3 |
| :25566 |              | :25567 |                   | :25568 |
+---+----+              +---+----+                   +---+----+
    |                       |                            |
    +-----------+-----------+----------------------------+
                |
     +----------v----------+
     |     worlds/          |
     |  (shared storage)    |
     +----------------------+

+-----------------------------------------------------------+
|                   Admin Service Layer                       |
|                                                            |
|  +-------------------+      +-------------------+          |
|  |  mcctl-console    | ---> |    mcctl-api      |          |
|  |  (Next.js BFF)    |      |  (Fastify REST)   |          |
|  |  :5000             |      |  :5001             |          |
|  +-------------------+      +-------------------+          |
|         |                           |                      |
|    Better Auth               Docker Socket + Shell          |
|    Session Auth              Server Management              |
+-----------------------------------------------------------+
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `HOST_IP` | Your IP for nip.io hostnames |
| `HOST_IPS` | Multiple IPs for VPN mesh (comma-separated) |
| `RCON_PASSWORD` | Default RCON password |
| `DEFAULT_MEMORY` | Default memory allocation (e.g., 4G) |
| `CF_API_KEY` | CurseForge API key (for mods) |
| `BACKUP_GITHUB_TOKEN` | GitHub PAT for backup |
| `BACKUP_GITHUB_REPO` | Backup repository (user/repo) |
| `AUDIT_AUTO_CLEANUP` | Auto-delete old audit logs (default: true) |
| `AUDIT_RETENTION_DAYS` | Days to retain audit logs (default: 90) |
| `MCCTL_SUDO_PASSWORD` | Sudo password for mDNS registration |

## Troubleshooting

### Server won't start
- Check logs: `mcctl logs <server>`
- Verify Docker is running: `docker ps`
- Check config: `mcctl config <server>`

### Can't connect to server
- Check if running: `mcctl status <server>`
- Use nip.io hostname if mDNS fails
- Verify mc-router: `mcctl status router`

### Mod errors
- Verify Minecraft version matches mod requirements
- Check mod compatibility with server type
- View mod config: `mcctl mod list <server>`

### Console service won't start
- Check prerequisites: `mcctl console init` will validate Node.js, PM2, Docker
- Verify PM2 is installed: `pm2 --version`
- Check ecosystem config exists: `ls ~/minecraft-servers/platform/ecosystem.config.cjs`
- View PM2 logs: `pm2 logs mcctl-api` or `pm2 logs mcctl-console`
- Check port conflicts: `netstat -tlnp | grep -E "5000|5001"`

### mcctl-console shows "not installed (skipping)"
- The console package needs to be installed: `npm install @minecraft-docker/mcctl-console` in `~/minecraft-servers/`
- Or reinitialize: `mcctl console init --force` and select mcctl-console
- Verify installation: `ls ~/minecraft-servers/node_modules/@minecraft-docker/mcctl-console/`

### API connection issues
- Check service status: `mcctl console service status`
- Verify API key: check output from `mcctl console init` (shown only once)
- Test health: `curl http://localhost:5001/health`
- Check access mode: `mcctl console api status`

### Can't log in to Web Console
- Verify user exists: `mcctl console user list`
- Reset password: `mcctl console user reset-password admin`
- Check Better Auth config: Ensure `BETTER_AUTH_SECRET` is set in ecosystem config
- View console logs: `mcctl console service logs -f`

### PM2 process keeps restarting
- Check for crashes: `pm2 logs mcctl-api --lines 100`
- Verify dependencies: `cd ~/minecraft-servers && npm ls @minecraft-docker/mcctl-api`
- Check memory limit: PM2 restarts at 500MB by default
- Force restart: `mcctl console service restart --force`

### SSE not working (real-time updates)
- Ensure mcctl-api is running: `mcctl console service status`
- Check if proxy/firewall blocks SSE connections
- Verify URL: `curl -N http://localhost:5001/api/sse/servers-status`

### World management issues
- Ensure server is stopped before world reset
- Check world locks: `mcctl world list`
- Release stuck locks: `mcctl world release <world>`

## Version History and Changelog

### Version 1.13.0 (2026-02-07)

**Added:**
- Interactive service selection for `mcctl console service start/stop/restart/logs`
- Unified Prerequisite Checker for `mcctl init` and `mcctl console init`
- Console npm publishing: `@minecraft-docker/mcctl-console` available on npm
- `--force` option for `mcctl console service stop/restart` (PM2 process killing)
- Routing Page in Web Console (Avahi mDNS monitoring)
- `isConsoleAvailable()` now returns `true` (console is GA)

**Fixed:**
- `force-dynamic` export added to all 22 API routes to prevent SQLITE_BUSY at build time

### Version 1.12.0 ~ 1.12.1 (2026-02-06~07)

**Added:**
- All-Servers SSE Status Endpoint (`GET /api/sse/servers-status`)
- Server Detail Delete Menu with confirmation dialog
- API Audit Logging for server CRUD and actions

**Fixed:**
- `not_created` status handling in all SSE and API interfaces
- Assign world dialog shows all non-running servers

### Version 1.11.0 (2026-02-06)

**Added:**
- World Management UI in Web Console (list, create, assign, release, delete, reset)
- Server Options Tab (config management via web UI)
- SSE Real-time Server Status (replaced polling)
- Server Config API (`GET/PUT /api/servers/:name/config`)
- World Reset API (`POST /api/servers/:name/world/reset`)

**Fixed:**
- Path traversal prevention in world reset endpoint
- Container status checks before world reset
- Force update check bypass for `mcctl update`

### Version 1.10.0 (2026-02-05)

**Added:**
- Audit Log System with CLI (`mcctl audit`), API (5 endpoints), and Web Console UI
- SQLite storage with WAL mode, auto-migration, auto-cleanup (90-day retention)
- Dashboard widget: Recent Activity Feed
- Server Detail: Activity tab with per-server audit history

### Version 1.9.0 (2026-02-05)

**Added:**
- `mcctl update --all` flag - Update CLI and all installed services

### Version 1.8.0 (2026-02-05)

**Added:**
- Web Console sudo password support for server creation
- Dashboard ChangelogFeed from GitHub releases

### Version 1.7.9 ~ 1.7.12

**Changes:**
- 1.7.12: Fix TEMPLATE_DIR path duplication and improve API error reporting
- 1.7.11: Fix world size calculation for servers using LEVEL config
- 1.7.10: Console ANSI colors, SSE streaming for server creation, MCCTL_ROOT path fix
- 1.7.9: Fix YAML syntax error in E2E workflow

### Version 1.7.8

**Added:**
- Selective console service support during `mcctl console init`
- Fixed environment variable names for mcctl-api authentication (`MCCTL_*` prefix)

### Version 1.7.5 ~ 1.7.7

**Changes:**
- 1.7.7: Auto-install mcctl-api on console init
- 1.7.6: mcctl-api npm publishing support
- 1.7.5: Fixed Edge runtime error in mcctl-console middleware

**Known Issue - Edge Runtime Error (v1.7.4 and below):**
- **Symptom:** `mcctl-console` fails with `@better-auth/*` package incompatibility error
- **Solution:** Update to v1.7.5 or later

### Version 1.7.0 ~ 1.7.4

**Major Features:**
- Router Status API (`GET /api/router/status`)
- Server Create/Delete API (`POST/DELETE /api/servers/:name`)
- Player Management API
- Backup API
- `mcctl init --reconfigure` option

### Version 1.6.8 ~ 1.6.11

!!! warning "Critical Bug - World Storage Location"
    Servers created with these versions store worlds in wrong directory.

**Issue:** Missing `EXTRA_ARGS=--universe /worlds/` in npm package template

**Symptoms:**
- World data stored in `servers/<name>/data/` instead of `worlds/`
- Server creates new world on every restart
- World sharing doesn't work

**Detection:**
```bash
# If this shows output, you're affected
ls ~/minecraft-servers/servers/*/data/*/level.dat 2>/dev/null
```

**Solution:**
```bash
# Option 1: Automated migration (recommended)
mcctl migrate status
mcctl migrate worlds --all

# Option 2: Manual fix
echo 'EXTRA_ARGS=--universe /worlds/' >> ~/minecraft-servers/servers/<name>/config.env
mcctl stop <name>
mv ~/minecraft-servers/servers/<name>/data/<world> ~/minecraft-servers/worlds/<world>
mcctl start <name>
```

### Version 1.6.0 ~ 1.6.7

**Features:**
- Admin Service (REST API + Web Console)
- `mcctl console` commands
- User management with roles

**Deprecation:**
- `mcctl admin` commands deprecated (use `mcctl console` instead)

### Version 1.5.x

**Features:**
- Mod management (`mcctl mod search/add/remove/list/sources`)
- Modrinth, CurseForge, Spiget, direct URL mod sources
- Server backup/restore commands

### Version 1.4.x

**Features:**
- Player management (whitelist, ban, op, kick)
- World management with `.meta` file support
- Interactive world selection in `mcctl create`

### Version 1.3.x

**Features:**
- nip.io magic DNS support
- VPN mesh network support (Tailscale, ZeroTier)
- Migration script for nip.io hostnames

## npm Packages

| Package | Description | Port |
|---------|-------------|------|
| `@minecraft-docker/mcctl` | CLI tool (main package) | - |
| `@minecraft-docker/shared` | Shared domain entities, value objects, use cases | - |
| `@minecraft-docker/mod-source-modrinth` | Modrinth API adapter | - |
| `@minecraft-docker/mcctl-api` | REST API server (Fastify) | 5001 |
| `@minecraft-docker/mcctl-console` | Web Management UI (Next.js) | 5000 |

## Links

- **GitHub**: https://github.com/smallmiro/minecraft-server-manager
- **Documentation**: https://minecraft-server-manager.readthedocs.io/
- **REST API Docs**: https://minecraft-server-manager.readthedocs.io/en/latest/api/
- **AI Assistant**: https://notebooklm.google.com/notebook/e91b656e-0d95-45b4-a961-fb1610b13962
- **itzg/minecraft-server**: https://hub.docker.com/r/itzg/minecraft-server/
