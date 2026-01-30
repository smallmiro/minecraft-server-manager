# REST API Overview

The mcctl-api provides a RESTful interface for managing Docker Minecraft servers. It enables external integrations, automation, and serves as the backend for the Web Console.

## System Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Clients                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │  curl    │  │  Python  │  │  Web UI  │  │  Custom Scripts  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘    │
│       │             │             │                  │              │
└───────┴─────────────┴─────────────┴──────────────────┴──────────────┘
                              │
                      ┌───────▼───────┐
                      │   mc-router   │ :25565 (Minecraft)
                      └───────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────────────────┐
│                      ┌──────▼──────┐                                  │
│                      │  mcctl-api  │ :3001                            │
│                      │   Fastify   │                                  │
│                      └──────┬──────┘                                  │
│           ┌─────────────────┼─────────────────┐                       │
│   ┌───────▼───────┐ ┌───────▼───────┐ ┌───────▼───────┐              │
│   │    /health    │ │ /api/servers  │ │  /api/worlds  │              │
│   └───────────────┘ └───────┬───────┘ └───────┬───────┘              │
│                             │                 │                       │
│                     ┌───────▼─────────────────▼───────┐              │
│                     │         Docker Engine           │              │
│                     └───────────────┬─────────────────┘              │
│           ┌─────────────────────────┼─────────────────────────┐      │
│   ┌───────▼───────┐         ┌───────▼───────┐         ┌───────▼──┐   │
│   │  mc-survival  │         │  mc-creative  │         │  mc-xxx  │   │
│   └───────────────┘         └───────────────┘         └──────────┘   │
│                                                                       │
│                     ┌─────────────────────────┐                       │
│                     │       /worlds/          │                       │
│                     │   (shared storage)      │                       │
│                     └─────────────────────────┘                       │
│                                                                       │
│                             Platform                                  │
└───────────────────────────────────────────────────────────────────────┘
```

## mcctl-api Internal Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           mcctl-api (Fastify)                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         Plugins Layer                            │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │   │
│  │  │   CORS    │  │  Helmet   │  │   Auth    │  │  Swagger  │    │   │
│  │  └───────────┘  └───────────┘  └─────┬─────┘  └───────────┘    │   │
│  │                                      │                          │   │
│  │              ┌───────────────────────┴────────────────────┐     │   │
│  │              │            Authentication Modes            │     │   │
│  │              │  ┌─────────┐ ┌─────────┐ ┌─────────┐      │     │   │
│  │              │  │ API Key │ │  Basic  │ │IP White │      │     │   │
│  │              │  └─────────┘ └─────────┘ └─────────┘      │     │   │
│  │              └────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────▼───────────────────────────────┐   │
│  │                         Routes Layer                             │   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│  │  │   /health    │  │  /api/auth   │  │/api/servers  │          │   │
│  │  └──────────────┘  └──────────────┘  └──────┬───────┘          │   │
│  │                                             │                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────▼───────┐          │   │
│  │  │ /api/worlds  │  │  /servers/   │  │   /actions   │          │   │
│  │  │              │  │ :id/console  │  │start|stop|   │          │   │
│  │  │              │  │    /exec     │  │  restart     │          │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────────┘          │   │
│  │         │                 │                                     │   │
│  └─────────┼─────────────────┼─────────────────────────────────────┘   │
│            │                 │                                          │
│  ┌─────────▼─────────────────▼─────────────────────────────────────┐   │
│  │                      Services Layer                              │   │
│  │                                                                  │   │
│  │  ┌──────────────────┐  ┌──────────────────┐                     │   │
│  │  │  @minecraft-     │  │   Docker         │                     │   │
│  │  │  docker/shared   │  │   Compose        │                     │   │
│  │  │                  │  │   Utils          │                     │   │
│  │  │  • Paths         │  │                  │                     │   │
│  │  │  • Repositories  │  │  • start/stop    │                     │   │
│  │  │  • UseCases      │  │  • logs          │                     │   │
│  │  │  • Adapters      │  │  • exec          │                     │   │
│  │  └────────┬─────────┘  └────────┬─────────┘                     │   │
│  │           │                     │                                │   │
│  └───────────┼─────────────────────┼────────────────────────────────┘   │
│              │                     │                                    │
└──────────────┼─────────────────────┼────────────────────────────────────┘
               │                     │
      ┌────────▼─────────┐  ┌────────▼─────────┐
      │   File System    │  │  Docker Engine   │
      │                  │  │                  │
      │  • worlds/       │  │  • containers    │
      │  • servers/      │  │  • images        │
      │  • users.yaml    │  │  • networks      │
      │  • api.key       │  │                  │
      └──────────────────┘  └──────────────────┘
```

## Request Flow Sequence

### Server Start Request

```text
Client                    mcctl-api                 Docker Engine
  │                          │                           │
  │  POST /api/servers/      │                           │
  │      survival/start      │                           │
  │─────────────────────────>│                           │
  │                          │                           │
  │                    ┌─────┴─────┐                     │
  │                    │   Auth    │                     │
  │                    │  Plugin   │                     │
  │                    └─────┬─────┘                     │
  │                          │                           │
  │                    ┌─────┴─────┐                     │
  │                    │ Validate  │                     │
  │                    │  Server   │                     │
  │                    │   Name    │                     │
  │                    └─────┬─────┘                     │
  │                          │                           │
  │                          │  docker compose up -d     │
  │                          │     mc-survival           │
  │                          │──────────────────────────>│
  │                          │                           │
  │                          │        success            │
  │                          │<──────────────────────────│
  │                          │                           │
  │    { success: true,      │                           │
  │      action: "start" }   │                           │
  │<─────────────────────────│                           │
  │                          │                           │
```

### RCON Command Execution

```text
Client                    mcctl-api                 MC Container
  │                          │                           │
  │  POST /api/servers/      │                           │
  │    survival/exec         │                           │
  │  { command: "list" }     │                           │
  │─────────────────────────>│                           │
  │                          │                           │
  │                    ┌─────┴─────┐                     │
  │                    │   Auth    │                     │
  │                    └─────┬─────┘                     │
  │                          │                           │
  │                          │  docker exec mc-survival  │
  │                          │    rcon-cli list          │
  │                          │──────────────────────────>│
  │                          │                           │
  │                          │   "3 players online..."   │
  │                          │<──────────────────────────│
  │                          │                           │
  │   { success: true,       │                           │
  │     output: "3 players   │                           │
  │       online..." }       │                           │
  │<─────────────────────────│                           │
  │                          │                           │
```

### World Assignment Flow

```text
Client                    mcctl-api              WorldManagement
  │                          │                    UseCase
  │  POST /api/worlds/       │                       │
  │   survival/assign        │                       │
  │  { serverName:           │                       │
  │    "mc-myserver" }       │                       │
  │─────────────────────────>│                       │
  │                          │                       │
  │                    ┌─────┴─────┐                 │
  │                    │   Auth    │                 │
  │                    └─────┬─────┘                 │
  │                          │                       │
  │                          │  assignWorldByName()  │
  │                          │──────────────────────>│
  │                          │                       │
  │                          │         ┌─────────────┴──────────────┐
  │                          │         │ 1. Check world exists      │
  │                          │         │ 2. Check not locked        │
  │                          │         │ 3. Create lock file        │
  │                          │         │ 4. Update server config    │
  │                          │         └─────────────┬──────────────┘
  │                          │                       │
  │                          │   { success: true }   │
  │                          │<──────────────────────│
  │                          │                       │
  │   { success: true,       │                       │
  │     worldName: "survival"│                       │
  │     serverName: "..." }  │                       │
  │<─────────────────────────│                       │
  │                          │                       │
```

### SSE Log Streaming

```text
Client                    mcctl-api                 Docker
  │                          │                         │
  │  GET /api/servers/       │                         │
  │   survival/logs?         │                         │
  │   follow=true            │                         │
  │─────────────────────────>│                         │
  │                          │                         │
  │  Content-Type:           │                         │
  │  text/event-stream       │                         │
  │<─────────────────────────│                         │
  │                          │                         │
  │                          │  docker logs -f         │
  │                          │    mc-survival          │
  │                          │────────────────────────>│
  │                          │                         │
  │  data: {"log": "..."}    │       log line          │
  │<─────────────────────────│<────────────────────────│
  │                          │                         │
  │  data: {"log": "..."}    │       log line          │
  │<─────────────────────────│<────────────────────────│
  │                          │                         │
  │  : heartbeat             │                         │
  │<─────────────────────────│  (every 30s)            │
  │                          │                         │
  │         ...              │         ...             │
  │                          │                         │
```

## Base URL

```
http://localhost:3001
```

## Authentication

The API supports 5 authentication modes:

| Mode | Description | Header |
|------|-------------|--------|
| `disabled` | No authentication (dev only) | - |
| `api-key` | API key in header | `X-API-Key: mctk_xxx` |
| `ip-whitelist` | IP-based access control | - |
| `basic` | HTTP Basic Auth | `Authorization: Basic xxx` |
| `combined` | API key + IP whitelist | Both required |

### API Key Authentication

```bash
curl -H "X-API-Key: mctk_your_key_here" http://localhost:3001/api/servers
```

### Basic Authentication

```bash
curl -u admin:password http://localhost:3001/api/servers
```

## Quick Start

```bash
# 1. Initialize console service
mcctl console init

# 2. Start API service
mcctl console api start

# 3. Test connection
curl http://localhost:3001/health

# 4. List servers (with API key)
curl -H "X-API-Key: $(cat ~/minecraft-servers/api.key)" \
  http://localhost:3001/api/servers
```

## API Endpoint Groups

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health status |

### Server Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servers` | List all servers |
| GET | `/api/servers/:name` | Get server details |
| GET | `/api/servers/:name/logs` | Get server logs (supports SSE) |
| POST | `/api/servers/:name/exec` | Execute RCON command |
| POST | `/api/servers/:name/start` | Start server |
| POST | `/api/servers/:name/stop` | Stop server |
| POST | `/api/servers/:name/restart` | Restart server |

### World Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/worlds` | List all worlds |
| GET | `/api/worlds/:name` | Get world details |
| POST | `/api/worlds` | Create new world |
| POST | `/api/worlds/:name/assign` | Assign world to server |
| POST | `/api/worlds/:name/release` | Release world lock |
| DELETE | `/api/worlds/:name` | Delete world |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| GET | `/api/auth/me` | Get current user |

### Console Commands

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/servers/:id/console/exec` | Execute RCON command (alternative) |

## Response Format

### Success Response

```json
{
  "servers": [...],
  "total": 2
}
```

### Error Response

```json
{
  "error": "NotFound",
  "message": "Server 'unknown' not found"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Server Error |

## Real-time Log Streaming (SSE)

The logs endpoint supports Server-Sent Events for real-time log streaming:

```bash
curl -H "Accept: text/event-stream" \
  "http://localhost:3001/api/servers/survival/logs?follow=true"
```

```
data: {"log": "[10:30:15] Player joined"}
data: {"log": "[10:30:20] Player left"}
: heartbeat
```

## OpenAPI/Swagger

Interactive API documentation is available at:

```
http://localhost:3001/docs
```

This provides:
- Interactive endpoint testing
- Request/response schema documentation
- Authentication testing

## Next Steps

- **[Endpoints Reference](endpoints.md)** - Detailed endpoint documentation
- **[Installation](../admin-service/installation.md)** - Setup guide
- **[CLI Commands](../admin-service/cli-commands.md)** - mcctl console commands
