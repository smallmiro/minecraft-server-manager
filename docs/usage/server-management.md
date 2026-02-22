# Server Start & Stop Guide

This guide consolidates all methods for starting, stopping, and restarting Minecraft servers managed by mcctl.

## Overview

There are several ways to manage server lifecycle:

| Method | Scope | Best For |
|--------|-------|----------|
| [mcctl CLI](#mcctl-cli-commands) | Individual server or all servers | Day-to-day management |
| [Docker Compose](#docker-compose-direct) | Full infrastructure or individual containers | Advanced users |
| [Web Console](#web-console) | Individual servers via browser | Visual management |
| [PM2](#pm2-service-management) | Management Console services | Console lifecycle |
| [Auto-Scale](#auto-scale-mc-router) | Automatic start/stop based on player activity | Hands-off operation |

---

## mcctl CLI Commands

### Start All Infrastructure

Start mc-router and all Minecraft servers:

```bash
mcctl up
```

This is equivalent to `docker compose up -d`. It starts the entire platform including mc-router and all registered servers.

### Stop All Infrastructure

Stop all servers, mc-router, and remove the Docker network:

```bash
mcctl down
```

This runs `docker compose down`, stopping all mc-* containers.

### Start Individual Server

```bash
# Start a specific server
mcctl start myserver

# Start all Minecraft servers (not mc-router)
mcctl start --all
```

| Option | Short | Description |
|--------|-------|-------------|
| `--all` | `-a` | Start all Minecraft servers (not router) |

### Stop Individual Server

```bash
# Stop a specific server
mcctl stop myserver

# Stop all Minecraft servers (not mc-router)
mcctl stop --all
```

| Option | Short | Description |
|--------|-------|-------------|
| `--all` | `-a` | Stop all Minecraft servers (not router) |

### Restart a Server

To restart a server (e.g., after configuration changes):

```bash
mcctl stop myserver && mcctl start myserver
```

!!! tip "When to Restart"
    You need to restart a server after:

    - Changing `config.env` settings
    - Modifying `server.properties`
    - Adding or removing mods/plugins
    - Changing memory allocation

### Manage mc-router Independently

```bash
mcctl router start     # Start mc-router only
mcctl router stop      # Stop mc-router only
mcctl router restart   # Restart mc-router
```

mc-router must be running for players to connect to any server via hostname routing.

---

## Docker Compose (Direct)

For advanced users who prefer direct Docker Compose commands. All commands should be run from the platform root directory (default: `~/minecraft-servers`).

### Start Everything

```bash
cd ~/minecraft-servers
docker compose up -d
```

### Stop Everything

```bash
cd ~/minecraft-servers
docker compose down
```

### Start/Stop Individual Containers

```bash
# Start a specific server container
docker compose up -d mc-myserver

# Stop a specific server container
docker compose stop mc-myserver

# Restart a specific container
docker compose restart mc-myserver
```

### View Container Status

```bash
docker compose ps
```

!!! note "Prefer mcctl CLI"
    While direct Docker Compose commands work, `mcctl` commands handle additional tasks like mDNS registration and compose file management. Use Docker Compose directly only when needed for troubleshooting or advanced scenarios.

---

## Web Console

The Management Console provides a browser-based interface for server management at `http://localhost:5000`.

### Prerequisites

Management Console must be installed and running:

```bash
mcctl console init       # First-time setup
mcctl console service start   # Start the console
```

### Server Controls via Web UI

From the **Dashboard**, each server card shows quick action buttons:

| Button | Action | Available When |
|--------|--------|----------------|
| Play (Start) | Start the server | Server is stopped |
| Stop | Graceful shutdown | Server is running |
| Restart | Stop then start | Server is running |

### Server Detail Page

Click on a server card to access detailed controls:

1. **Start/Stop/Restart** buttons in the server controls section
2. **Console Panel** - Execute RCON commands including `stop` to stop the server
3. **Real-time Status** - SSE-based live status updates (no polling)

### REST API

For programmatic control, use the API endpoints:

```bash
# Start a server
curl -X POST http://localhost:5001/servers/myserver/start

# Stop a server
curl -X POST http://localhost:5001/servers/myserver/stop

# Restart a server
curl -X POST http://localhost:5001/servers/myserver/restart
```

See the [API Reference](../api/index.md) for authentication details.

---

## PM2 Service Management

PM2 manages the Management Console services (mcctl-api and mcctl-console), not the Minecraft servers themselves.

### Console Service Commands

```bash
# Start Management Console services
mcctl console service start

# Stop Management Console services
mcctl console service stop

# Restart Management Console services
mcctl console service restart

# Check service status
mcctl console service status
```

### Direct PM2 Commands

```bash
# View all managed processes
pm2 list

# View logs
pm2 logs mcctl-api
pm2 logs mcctl-console

# Restart services
pm2 restart mcctl-api
pm2 restart mcctl-console
```

!!! warning "PM2 vs Minecraft Servers"
    PM2 manages the **Management Console** (API + Web UI), not the Minecraft servers. Minecraft servers are managed by Docker containers.

---

## Auto-Scale (mc-router)

mc-router supports automatic server start/stop based on player activity. This is the recommended approach for resource optimization.

### How It Works

1. **Auto-Scale Up**: When a player connects to a sleeping server's hostname, mc-router automatically starts the Docker container
2. **Auto-Scale Down**: When a server has no players for the configured idle timeout, mc-router stops the container

```
Player connects → mc-router detects → Docker container starts → Player joins
                                                                    ↓
                                                          No players for 10m
                                                                    ↓
                                                    mc-router stops container
```

### Configuration

Configure auto-scaling in `.env`:

```bash
# Enable auto-start on player connect
AUTO_SCALE_UP=true

# Enable auto-stop when idle
AUTO_SCALE_DOWN=true

# Idle timeout before stopping (1m, 5m, 10m, 30m, 1h)
AUTO_SCALE_DOWN_AFTER=10m

# Container start timeout in seconds
DOCKER_TIMEOUT=120

# Custom MOTD shown while server is starting
AUTO_SCALE_ASLEEP_MOTD=§e§lServer is sleeping§r\n§7Connect to wake up!
```

After changing settings, restart mc-router:

```bash
mcctl router restart
```

### Player Experience

When auto-scale is enabled:

- **Sleeping server**: Player sees the custom MOTD and is asked to retry
- **Starting server**: Player waits briefly while the container starts (typically 30-120 seconds)
- **Running server**: Normal gameplay, no difference from a manually started server

!!! tip "Auto-Start on Connect"
    With auto-scale enabled, you don't need to manually start servers. Just let players connect and the server starts automatically.

---

## Quick Reference

### Common Scenarios

=== "Start Everything"

    ```bash
    mcctl up
    ```

=== "Stop Everything"

    ```bash
    mcctl down
    ```

=== "Restart One Server"

    ```bash
    mcctl stop myserver && mcctl start myserver
    ```

=== "Start All Servers Only"

    ```bash
    mcctl start --all
    ```

=== "Stop All Servers Only"

    ```bash
    mcctl stop --all
    ```

### Command Summary

| Task | Command |
|------|---------|
| Start all (router + servers) | `mcctl up` |
| Stop all | `mcctl down` |
| Start one server | `mcctl start <name>` |
| Stop one server | `mcctl stop <name>` |
| Start all servers (not router) | `mcctl start --all` |
| Stop all servers (not router) | `mcctl stop --all` |
| Start mc-router only | `mcctl router start` |
| Stop mc-router only | `mcctl router stop` |
| Restart mc-router | `mcctl router restart` |
| Start console services | `mcctl console service start` |
| Stop console services | `mcctl console service stop` |

### Infrastructure vs Servers

Understanding the difference between infrastructure and server commands:

| Scope | Start | Stop | What It Affects |
|-------|-------|------|-----------------|
| **Full Infrastructure** | `mcctl up` | `mcctl down` | mc-router + all servers + network |
| **All Servers** | `mcctl start --all` | `mcctl stop --all` | All Minecraft servers (not router) |
| **Single Server** | `mcctl start <name>` | `mcctl stop <name>` | One Minecraft server |
| **Router Only** | `mcctl router start` | `mcctl router stop` | mc-router only |
| **Console Services** | `mcctl console service start` | `mcctl console service stop` | API + Web UI (PM2) |

## See Also

- [CLI Commands Reference](../cli/commands.md) - Full command reference
- [Networking Guide](../advanced/networking.md) - Hostname routing and DNS
- [Web Console Guide](../console/web-console.md) - Web UI details
- [API Reference](../api/index.md) - REST API endpoints
