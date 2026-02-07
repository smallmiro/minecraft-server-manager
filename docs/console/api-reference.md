# API Reference

Complete REST API documentation for the mcctl-api server.

## Overview

The mcctl-api provides a RESTful interface for managing Docker Minecraft servers. All endpoints return JSON responses.

**Base URL:** `http://localhost:5001`

**Documentation:** Swagger UI is available at `/docs` when the service is running.

## Authentication

Authentication is based on the configured access mode.

### API Key Authentication

When using `api-key` or `api-key-ip` mode, include the API key in the request header:

```http
X-API-Key: mctk_your_api_key_here
```

### Basic Authentication

When using `basic` mode, include credentials in the Authorization header:

```http
Authorization: Basic base64(username:password)
```

### Example with curl

```bash
# API Key authentication
curl -H "X-API-Key: mctk_your_key" http://localhost:5001/api/servers

# Basic authentication
curl -u admin:password http://localhost:5001/api/servers
```

## Endpoints

### Health Check

#### GET /health

Check API server health status.

**Authentication:** Not required

**Response:**

```json
{
  "status": "healthy"
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Service is healthy |
| 503 | Service is unhealthy |

---

### Server Management

#### GET /api/servers

List all Minecraft servers.

**Response:**

```json
{
  "servers": [
    {
      "name": "survival",
      "container": "mc-survival",
      "status": "running",
      "health": "healthy",
      "hostname": "survival.192.168.1.100.nip.io"
    },
    {
      "name": "creative",
      "container": "mc-creative",
      "status": "exited",
      "health": "none",
      "hostname": "creative.192.168.1.100.nip.io"
    }
  ],
  "total": 2
}
```

**Server Status Values:**

| Status | Description |
|--------|-------------|
| `running` | Container is running |
| `exited` | Container has stopped |
| `created` | Container created but not started |
| `paused` | Container is paused |

**Health Values:**

| Health | Description |
|--------|-------------|
| `healthy` | Health check passed |
| `unhealthy` | Health check failed |
| `starting` | Health check in progress |
| `none` | No health check configured |

---

#### GET /api/servers/:name

Get detailed information about a specific server.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Server name (without `mc-` prefix) |

**Response:**

```json
{
  "server": {
    "name": "survival",
    "container": "mc-survival",
    "status": "running",
    "health": "healthy",
    "hostname": "survival.192.168.1.100.nip.io",
    "type": "PAPER",
    "version": "1.21.1",
    "memory": "4G",
    "uptime": "2d 5h 30m",
    "uptimeSeconds": 192600,
    "players": {
      "online": 3,
      "max": 20,
      "list": ["Player1", "Player2", "Player3"]
    },
    "stats": {
      "cpu": "15.2%",
      "memory": "2.1GB / 4GB"
    },
    "worldName": "survival",
    "worldSize": "1.2 GB"
  }
}
```

**Error Response (404):**

```json
{
  "error": "NotFound",
  "message": "Server 'unknown' not found"
}
```

---

#### GET /api/servers/:name/logs

Get server console logs.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Server name |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lines` | integer | 100 | Number of log lines to return |

**Example:**

```bash
curl "http://localhost:5001/api/servers/survival/logs?lines=50"
```

**Response:**

```json
{
  "logs": "[10:30:15] [Server thread/INFO]: Player1 joined the game\n[10:30:20] [Server thread/INFO]: Player1 has made the advancement [Getting Wood]",
  "lines": 50
}
```

---

### Server Actions

#### POST /api/servers/:name/start

Start a stopped server.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Server name |

**Response:**

```json
{
  "success": true,
  "server": "survival",
  "action": "start",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "message": "Server started successfully"
}
```

**Error Response:**

```json
{
  "success": false,
  "server": "survival",
  "action": "start",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "error": "Failed to execute action",
  "message": "Container already running"
}
```

---

#### POST /api/servers/:name/stop

Stop a running server.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Server name |

**Response:**

```json
{
  "success": true,
  "server": "survival",
  "action": "stop",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "message": "Server stopped successfully"
}
```

---

#### POST /api/servers/:name/restart

Restart a server (stop then start).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Server name |

**Response:**

```json
{
  "success": true,
  "server": "survival",
  "action": "restart",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "message": "Server restarted successfully"
}
```

---

### Console Commands

#### POST /api/servers/:name/exec

Execute an RCON command on the server.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Server name |

**Request Body:**

```json
{
  "command": "list"
}
```

**Response:**

```json
{
  "success": true,
  "output": "There are 3 of a max of 20 players online: Player1, Player2, Player3"
}
```

**Example Commands:**

```bash
# List players
curl -X POST http://localhost:5001/api/servers/survival/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "list"}'

# Broadcast message
curl -X POST http://localhost:5001/api/servers/survival/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "say Server will restart in 5 minutes!"}'

# Give item to player
curl -X POST http://localhost:5001/api/servers/survival/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "give Player1 diamond 64"}'

# Save world
curl -X POST http://localhost:5001/api/servers/survival/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "save-all"}'
```

---

### Server Create/Delete

#### POST /api/servers

Create a new Minecraft server.

**Request Body:**

```json
{
  "name": "newserver",
  "type": "PAPER",
  "version": "1.21.1",
  "memory": "4G",
  "seed": "12345",
  "autoStart": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Server name (alphanumeric, hyphens allowed) |
| `type` | string | No | Server type: PAPER, VANILLA, FORGE, FABRIC, etc. (default: PAPER) |
| `version` | string | No | Minecraft version (default: LATEST) |
| `memory` | string | No | Memory allocation (e.g., "4G") |
| `seed` | string | No | World seed |
| `worldUrl` | string | No | URL to download world ZIP |
| `worldName` | string | No | Existing world name to use |
| `autoStart` | boolean | No | Start server after creation (default: true) |

**Response (201):**

```json
{
  "success": true,
  "server": {
    "name": "newserver",
    "container": "mc-newserver",
    "status": "starting"
  }
}
```

**Error Response (409 - Conflict):**

```json
{
  "error": "Conflict",
  "message": "Server 'newserver' already exists"
}
```

---

#### DELETE /api/servers/:name

Delete a Minecraft server.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Server name |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `force` | boolean | false | Force delete even if running |

**Example:**

```bash
curl -X DELETE "http://localhost:5001/api/servers/myserver?force=true" \
  -H "X-API-Key: mctk_xxx"
```

**Response:**

```json
{
  "success": true,
  "server": "myserver",
  "message": "Server deleted successfully"
}
```

!!! note "World Data Preserved"
    Deleting a server does NOT delete the world data. Worlds are stored in the shared `/worlds/` directory.

---

### Router Status

#### GET /api/router/status

Get mc-router status and routing information.

**Response:**

```json
{
  "router": {
    "name": "mc-router",
    "status": "running",
    "health": "healthy",
    "port": 25565,
    "uptime": "5d 12h 30m",
    "uptimeSeconds": 477000,
    "mode": "auto-scale",
    "routes": [
      {
        "hostname": "survival.192.168.1.100.nip.io",
        "target": "mc-survival:25565",
        "serverStatus": "running"
      },
      {
        "hostname": "creative.192.168.1.100.nip.io",
        "target": "mc-creative:25565",
        "serverStatus": "exited"
      }
    ]
  }
}
```

| Field | Description |
|-------|-------------|
| `status` | Router container status |
| `health` | Health check status |
| `port` | External listening port |
| `mode` | Routing mode (auto-scale enabled) |
| `routes` | List of hostname-to-server mappings |

---

### Player Management

#### GET /api/servers/:name/players

List online players on a server.

**Response:**

```json
{
  "online": 3,
  "max": 20,
  "players": ["Player1", "Player2", "Player3"]
}
```

---

#### GET /api/players/:username

Get player information from Mojang API.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Minecraft username |

**Response:**

```json
{
  "username": "Notch",
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "skinUrl": "https://crafatar.com/avatars/069a79f444e94726a5befca90e38aaf5?overlay"
}
```

---

### Whitelist Management

#### GET /api/servers/:name/whitelist

Get server whitelist.

**Response:**

```json
{
  "players": ["Player1", "Player2"],
  "total": 2
}
```

---

#### POST /api/servers/:name/whitelist

Add player to whitelist.

**Request Body:**

```json
{
  "player": "Steve"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Added Steve to whitelist"
}
```

---

#### DELETE /api/servers/:name/whitelist/:player

Remove player from whitelist.

**Response:**

```json
{
  "success": true,
  "message": "Removed Steve from whitelist"
}
```

---

### Ban Management

#### GET /api/servers/:name/bans

Get banned players list.

**Response:**

```json
{
  "players": ["Griefer1"],
  "total": 1
}
```

---

#### POST /api/servers/:name/bans

Ban a player.

**Request Body:**

```json
{
  "player": "Griefer",
  "reason": "Griefing is not allowed"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Banned Griefer"
}
```

---

#### DELETE /api/servers/:name/bans/:player

Unban a player.

**Response:**

```json
{
  "success": true,
  "message": "Unbanned Griefer"
}
```

---

### Operator Management

#### GET /api/servers/:name/ops

Get server operators list.

**Response:**

```json
{
  "players": ["Admin1", "Admin2"],
  "total": 2
}
```

---

#### POST /api/servers/:name/ops

Add player as operator.

**Request Body:**

```json
{
  "player": "TrustedPlayer"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Made TrustedPlayer an operator"
}
```

---

#### DELETE /api/servers/:name/ops/:player

Remove operator status.

**Response:**

```json
{
  "success": true,
  "message": "Removed operator status from TrustedPlayer"
}
```

---

### Kick Player

#### POST /api/servers/:name/kick

Kick a player from the server.

**Request Body:**

```json
{
  "player": "AFKPlayer",
  "reason": "AFK timeout"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Kicked AFKPlayer"
}
```

---

### Backup Management

#### GET /api/backup/status

Get backup configuration status.

**Response:**

```json
{
  "configured": true,
  "repository": "username/minecraft-worlds",
  "branch": "main",
  "lastBackup": "2026-01-31T10:30:00.000Z"
}
```

---

#### POST /api/backup/push

Push worlds backup to GitHub.

**Request Body:**

```json
{
  "message": "Before server upgrade"
}
```

**Response:**

```json
{
  "success": true,
  "commitHash": "abc1234",
  "message": "Backup pushed successfully"
}
```

**Error Response (400 - Not Configured):**

```json
{
  "error": "BadRequest",
  "message": "Backup not configured. Set BACKUP_GITHUB_REPO and BACKUP_GITHUB_TOKEN environment variables."
}
```

---

#### GET /api/backup/history

Get backup history (git commits).

**Response:**

```json
{
  "commits": [
    {
      "hash": "abc1234",
      "message": "Before server upgrade",
      "date": "2026-01-31T10:30:00.000Z",
      "author": "mcctl"
    },
    {
      "hash": "def5678",
      "message": "Daily backup",
      "date": "2026-01-30T10:30:00.000Z",
      "author": "mcctl"
    }
  ],
  "total": 2
}
```

---

#### POST /api/backup/restore

Restore worlds from a backup commit.

**Request Body:**

```json
{
  "commitHash": "abc1234"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Restored to commit abc1234"
}
```

!!! warning "Restore Impact"
    Restoring a backup will overwrite current world data. Stop all servers before restoring.

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "ErrorType",
  "message": "Human-readable error description"
}
```

### Common Error Types

| Error | Status Code | Description |
|-------|-------------|-------------|
| `AuthenticationError` | 401 | Missing or invalid credentials |
| `ForbiddenError` | 403 | IP not in whitelist |
| `NotFound` | 404 | Resource not found |
| `ValidationError` | 400 | Invalid request parameters |
| `InternalServerError` | 500 | Server-side error |

---

## Rate Limiting

Currently, no rate limiting is implemented. Consider using a reverse proxy (nginx, Traefik) for production deployments.

---

## Code Examples

### Python

```python
import requests

API_URL = "http://localhost:5001"
API_KEY = "mctk_your_key_here"

headers = {"X-API-Key": API_KEY}

# List servers
response = requests.get(f"{API_URL}/api/servers", headers=headers)
servers = response.json()["servers"]

# Start a server
response = requests.post(
    f"{API_URL}/api/servers/survival/start",
    headers=headers
)

# Execute command
response = requests.post(
    f"{API_URL}/api/servers/survival/exec",
    headers=headers,
    json={"command": "list"}
)
print(response.json()["output"])
```

### JavaScript/TypeScript

```typescript
const API_URL = "http://localhost:5001";
const API_KEY = "mctk_your_key_here";

const headers = {
  "X-API-Key": API_KEY,
  "Content-Type": "application/json"
};

// List servers
const servers = await fetch(`${API_URL}/api/servers`, { headers })
  .then(res => res.json());

// Start a server
await fetch(`${API_URL}/api/servers/survival/start`, {
  method: "POST",
  headers
});

// Execute command
const result = await fetch(`${API_URL}/api/servers/survival/exec`, {
  method: "POST",
  headers,
  body: JSON.stringify({ command: "list" })
}).then(res => res.json());

console.log(result.output);
```

### Bash/curl

```bash
#!/bin/bash
API_URL="http://localhost:5001"
API_KEY="mctk_your_key_here"

# List servers
curl -H "X-API-Key: $API_KEY" "$API_URL/api/servers"

# Start server
curl -X POST -H "X-API-Key: $API_KEY" "$API_URL/api/servers/survival/start"

# Stop server
curl -X POST -H "X-API-Key: $API_KEY" "$API_URL/api/servers/survival/stop"

# Execute command
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command": "list"}' \
  "$API_URL/api/servers/survival/exec"

# Get logs
curl -H "X-API-Key: $API_KEY" "$API_URL/api/servers/survival/logs?lines=50"
```

---

## OpenAPI/Swagger

The full OpenAPI specification is available at:

```
http://localhost:5001/docs
```

This provides an interactive interface for exploring and testing API endpoints.
