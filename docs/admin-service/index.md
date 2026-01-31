# Admin Service Overview

Admin Service provides a web-based management interface and REST API for Docker Minecraft servers. It enables remote server management, monitoring, and administration through a modern web console.

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

- **Dashboard**: Overview of all servers with real-time status
- **Server Details**: Detailed server information and controls
- **User Authentication**: Secure login with NextAuth.js
- **BFF Proxy**: Backend-for-Frontend pattern for secure API access

Default port: `5000`

## Authentication Modes

Admin Service supports multiple authentication modes:

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

### 1. Initialize Admin Service

```bash
mcctl console init
```

Follow the interactive prompts to configure:

1. Admin username
2. Admin password (min 8 characters, requires uppercase, lowercase, number)
3. API access mode
4. IP whitelist (if applicable)

### 2. Start Admin Services

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
| `~/minecraft-servers/admin.yaml` | Admin service configuration |
| `~/minecraft-servers/users.yaml` | User credentials (hashed passwords) |
| `~/minecraft-servers/api-config.json` | API access configuration |

## Next Steps

- **[Installation Guide](installation.md)** - Detailed setup instructions
- **[CLI Commands](cli-commands.md)** - Complete CLI reference
- **[API Reference](api-reference.md)** - REST API documentation
- **[Web Console Guide](web-console.md)** - Using the web interface
