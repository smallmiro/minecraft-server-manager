# Management Console Overview

Management Console provides a web-based management interface and REST API for Docker Minecraft servers. It enables remote server management, monitoring, and administration through a modern web console.

!!! info "Status"
    Both **mcctl-api** (REST API) and **mcctl-console** (Web UI) are available on npm and production-ready as of v1.13.0. Install with `mcctl console init`.

## Architecture

```
                              +---------------------+
                              |    Web Browser      |
                              |  (Admin Console)    |
                              +----------+----------+
                                         |
                                    :5000 (HTTP)
                                         |
+------------------------+     +---------v---------+
|                        |     |                   |
|  Minecraft Servers     |     |  mcctl-console    |
|  (mc-xxx containers)   |     |  (Next.js + Auth) |
|                        |     |                   |
+----------+-------------+     +---------+---------+
           ^                             |
           |                      :5001 (Internal)
           |                             |
           |                   +---------v---------+
           |                   |                   |
           +-------------------+    mcctl-api      |
            Docker Socket      |  (Fastify REST)   |
            (read-only)        |                   |
                               +-------------------+
```

## Components

### mcctl-api (REST API Server)

A Fastify-based REST API server that provides:

- **Server Management**: List, start, stop, restart Minecraft servers
- **Server Information**: Health status, players, resource usage
- **RCON Integration**: Execute console commands remotely
- **Swagger Documentation**: Auto-generated API docs at `/docs`
- **Health Checks**: Built-in health endpoint at `/health`

Default port: `5001`

### mcctl-console (Web Management UI)

A Next.js web application that provides:

- **Dashboard**: Overview of all servers with real-time SSE status updates
- **Server Details**: Detailed server info, console, logs, options, and activity tabs
- **World Management**: List, create, assign, release, delete, and reset worlds (v1.11+)
- **Audit Logs**: Activity tracking with filtering, stats, and export (v1.10+)
- **Routing**: Avahi mDNS monitoring and hostname configuration (v1.13+)
- **User Authentication**: Secure login with Better Auth
- **BFF Proxy**: Backend-for-Frontend pattern for secure API access
- **React Query Hooks**: Type-safe data fetching with automatic caching

Default port: `5000`

#### BFF Proxy Routes (v1.7.8+)

The console proxies all API requests through Next.js server routes:

| Route | Description |
|-------|-------------|
| `/api/servers/*` | Server management (list, create, delete, start/stop/restart) |
| `/api/servers/:name/exec` | Execute RCON commands |
| `/api/servers/:name/logs` | Fetch server logs |
| `/api/worlds/*` | World management (list, create, delete, assign/release) |

This architecture ensures API keys never reach the browser.

## Authentication Modes

Management Console supports multiple authentication modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| `internal` | Docker network only (most secure) | Default production |
| `api-key` | External access with X-API-Key header | Automation/scripts |
| `ip-whitelist` | IP-based access control | Known client IPs |
| `api-key-ip` | Both API key and IP required | High security |
| `open` | No authentication | Development only |

!!! warning "Security Warning"
    Never use `open` mode in production. It disables all authentication and exposes your servers to unauthorized access.

## Features

### Server Management

- View all Minecraft servers with status
- Start, stop, and restart servers
- View server logs in real-time
- Monitor player counts and server health

### Console Integration

- Execute RCON commands through the web interface
- View command output in real-time
- Supports all standard Minecraft commands

### User Management

- Multiple user accounts with role-based access
- Admin role: Full access to all features
- Viewer role: Read-only access to status and logs

## Quick Start

> **Note**: `mcctl admin` commands are deprecated. Use `mcctl console` instead. The `admin` command alias still works for backward compatibility but will be removed in a future release.

### 1. Initialize Management Console

```bash
mcctl console init
```

Follow the interactive prompts to configure:

1. Select services to install (mcctl-api, mcctl-console)
2. Admin username (required if console selected)
3. Admin password (min 8 characters, requires uppercase, lowercase, number)
4. API access mode (internal, api-key, ip-whitelist, api-key-ip, open)
5. IP whitelist (if applicable)

### 2. Start Management Consoles

```bash
mcctl console service start
```

### 3. Access Web Console

Open your browser and navigate to:

```
http://localhost:5000
```

Log in with the admin credentials created during initialization.

## Requirements

- mcctl platform initialized (`mcctl init`)
- Docker running
- Ports 5000 and 5001 available (or custom ports in `.env`)

## Configuration Files

After initialization, the following files are created:

| File | Description |
|------|-------------|
| `~/minecraft-servers/.mcctl-admin.yml` | Admin service configuration |
| `~/minecraft-servers/users.yaml` | User credentials (hashed passwords) |
| `~/minecraft-servers/platform/ecosystem.config.cjs` | PM2 ecosystem configuration |

## Next Steps

- **[Installation Guide](installation.md)** - Detailed setup instructions
- **[CLI Commands](cli-commands.md)** - Complete CLI reference
- **[API Reference](api-reference.md)** - REST API documentation
- **[Web Console Guide](web-console.md)** - Using the web interface
