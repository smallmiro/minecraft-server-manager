# API Endpoints Reference

Complete reference for all mcctl-api REST endpoints.

## Health Check

### GET /health

Check API server health status.

**Authentication:** Not required

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-01-30T10:30:00.000Z"
}
```

---

## Server Endpoints

### GET /api/servers

List all Minecraft servers.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `include` | string | Optional. `summary` adds `type`, `version`, `memory`, `players`, `stats` per server and a top-level `totals`. Any other value returns `400`. |

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
    }
  ],
  "total": 1
}
```

**Response with `include=summary`:**

The default response above is unchanged when `include` is omitted.

```json
{
  "servers": [
    {
      "name": "survival",
      "container": "mc-survival",
      "status": "running",
      "health": "healthy",
      "hostname": "survival.192.168.1.100.nip.io",
      "type": "PAPER",
      "version": "1.21.1",
      "memory": "4G",
      "players": {
        "online": 3,
        "max": 20,
        "players": ["Player1", "Player2", "Player3"]
      },
      "stats": {
        "memoryUsage": 2254857830,
        "memoryLimit": 4294967296
      }
    }
  ],
  "total": 1,
  "totals": {
    "playersOnline": 3,
    "playersMax": 20,
    "running": 1
  }
}
```

!!! note "Summary behavior"
    - `type`, `version`, and `memory` come from the server's `config.env`.
    - `players` and `stats` are returned only for running servers. `players` is `null` when the RCON query fails or times out. `stats` (`memoryUsage`, `memoryLimit`, in bytes) is omitted when `docker stats` does not answer in time.
    - RCON and stats run in parallel for running servers with a timeout of about 2 seconds each, so one slow server only gets `players: null`.
    - Results are cached for about 10 seconds per server.
    - `totals.playersOnline` and `totals.playersMax` sum only the servers whose players are known. `totals.running` is the number of running servers.

**Status Values:**

| Status | Description |
|--------|-------------|
| `running` | Container is running |
| `exited` | Container has stopped |
| `created` | Container created but not started |
| `paused` | Container is paused |

---

### GET /api/servers/:name

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

---

### GET /api/servers/:name/logs

Get server console logs. Supports both JSON response and SSE streaming.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Server name |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lines` | integer | 100 | Number of log lines to return |
| `follow` | boolean | false | Enable SSE streaming |

**JSON Response (follow=false):**

```json
{
  "logs": "[10:30:15] [Server thread/INFO]: Player1 joined the game\n...",
  "lines": 100
}
```

**SSE Response (follow=true):**

```
data: {"log": "[10:30:15] Player joined"}
data: {"log": "[10:30:20] Player left"}
: heartbeat
data: {"event": "closed"}
```

---

### POST /api/servers/:name/start

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
  "timestamp": "2025-01-30T10:30:00.000Z",
  "message": "Server started successfully"
}
```

---

### POST /api/servers/:name/stop

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
  "timestamp": "2025-01-30T10:30:00.000Z",
  "message": "Server stopped successfully"
}
```

---

### POST /api/servers/:name/restart

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
  "timestamp": "2025-01-30T10:30:00.000Z",
  "message": "Server restarted successfully"
}
```

---

### POST /api/servers/:name/exec

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

**Common Commands:**

| Command | Description |
|---------|-------------|
| `list` | List online players |
| `say <message>` | Broadcast message |
| `give <player> <item> [count]` | Give item to player |
| `save-all` | Save world |
| `whitelist add <player>` | Add to whitelist |
| `op <player>` | Grant operator |

---

## World Endpoints

### World assignment rules

A world is assigned to a server by the server's `LEVEL` in `servers/<name>/config.env` (legacy `WORLD_NAME` is read when `LEVEL` is unset; unset means itzg's default `world`). There is no lock file: `worlds/.locks` is no longer read, written or created.

- **One world, one server.** A world and its `<world>_nether` / `<world>_the_end` folders count as one world. A world used by another server cannot be assigned. This applies to `POST /api/worlds/:name/assign`, `POST /api/worlds` with `serverName`, `POST /api/servers` (including the new server's default world `<name>`) and `PATCH /api/servers/:name/config` with `level`. Deleting a server frees its world for reuse.
- **Stopped server only.** Assign, release, `POST /api/worlds` with `serverName` and `PATCH /api/servers/:name/config` with `level` are refused while the container is running, paused, restarting or created. Nothing is stopped automatically.
- **Fail-closed.** If any server's `config.env` cannot be read, or its `LEVEL` cannot be interpreted safely (path separators, `.`/`..`, quotes, control characters, Compose interpolation such as `${VAR}` outside single quotes, or an unsupported `--universe` location), every assignment change and world delete/reset is refused until it is fixed. Legacy names such as `My World` are still accepted as existing values; new names must be letters, digits, `-` or `_`.
- **Status codes** for world assign/release/delete/create and config `level`: invalid world name `400`, unknown server or world `404`, everything else refused by these rules `409` (conflict, server running, undetermined config).
- **Config snapshot restore** answers `409` when the restored `config.env` would assign a world another server uses, or change the world of a running server (even with force), and when the restored `docker-compose.yml` sets `LEVEL`, `WORLD_NAME` or `EXTRA_ARGS` in `environment` or changes the `/worlds` or `/data` volume mapping.
- **World reset.** `POST /api/servers/:name/world/reset` is refused for servers that keep their world inside `servers/<name>/data` and when another server uses the same world.

---

### GET /api/worlds

List all worlds with the servers they are assigned to.

**Response:**

```json
{
  "worlds": [
    {
      "name": "survival",
      "path": "/home/user/minecraft-servers/worlds/survival",
      "isLocked": true,
      "lockedBy": "mc-survival",
      "servers": ["mc-survival"],
      "size": "1.2 GB",
      "lastModified": "2025-01-30T10:00:00.000Z"
    }
  ],
  "total": 1,
  "assignmentWarnings": []
}
```

`isLocked` and `lockedBy` remain as aliases for "assigned". Duplicate assignments from older installs are reported, not fixed: `servers` then lists every server using the world and `assignmentWarnings` (`string[]`) has one entry per duplicate world and per server whose `config.env` cannot be read.

---

### GET /api/worlds/:name

Get world details.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | World name |

**Response:**

```json
{
  "world": {
    "name": "survival",
    "path": "/home/user/minecraft-servers/worlds/survival",
    "isLocked": true,
    "lockedBy": "mc-survival",
    "servers": ["mc-survival"],
    "size": "1.2 GB",
    "lastModified": "2025-01-30T10:00:00.000Z"
  }
}
```

---

### POST /api/worlds

Create a new world.

**Request Body:**

```json
{
  "name": "myworld",
  "seed": "12345",
  "serverName": "mc-myserver",
  "autoStart": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | World name |
| `seed` | string | No | World seed |
| `serverName` | string | No | Server to assign (must be stopped; `409` if the world is used by another server) |
| `autoStart` | boolean | No | Start server after assignment |

**Response (201):**

```json
{
  "success": true,
  "worldName": "myworld",
  "seed": "12345",
  "serverName": "mc-myserver",
  "started": false
}
```

---

### POST /api/worlds/:name/assign

Assign world to a server (sets the server's `LEVEL`). The server must be stopped.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | World name |

**Request Body:**

```json
{
  "serverName": "mc-survival"
}
```

**Response:**

```json
{
  "success": true,
  "worldName": "survival",
  "serverName": "mc-survival"
}
```

**Error (409 Conflict):**

```json
{
  "error": "Conflict",
  "message": "World 'survival' is assigned to 'mc-creative'; assign another world to 'mc-creative' or delete it first"
}
```

---

### POST /api/worlds/:name/release

Switch the server using the world back to its own default world `<server>`: an existing free `worlds/<server>` is adopted, otherwise it is created on the next start. The world stays in `worlds/`. The server must be stopped. Releasing a server from its own default world, a world assigned to more than one server, or a server whose world is inside `servers/<name>/data` is refused with `409`.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | World name |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `force` | boolean | false | Accepted and ignored |

**Response:**

```json
{
  "success": true,
  "worldName": "survival",
  "previousServer": "mc-survival",
  "fallbackWorld": "mc-survival",
  "fallbackExists": false
}
```

`fallbackWorld` is the world the previous server now uses. `fallbackExists` is `false` when `worlds/<fallbackWorld>` does not exist yet and will be created on the next start.

---

### DELETE /api/worlds/:name

Delete a world. Refused with `409` while any server uses it. Servers that keep their world inside `servers/<name>/data` (no `EXTRA_ARGS=--universe /worlds/`) do not block deleting `worlds/<name>`.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | World name |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `force` | boolean | false | Accepted for compatibility; does not delete a world a server uses |

**Response:**

```json
{
  "success": true,
  "worldName": "oldworld",
  "size": "500 MB"
}
```

---

## Authentication Endpoints

### POST /api/auth/login

Authenticate user with credentials.

**Request Body:**

```json
{
  "username": "admin",
  "password": "secret"
}
```

**Response (200):**

```json
{
  "id": "user-123",
  "username": "admin",
  "role": "admin",
  "name": "admin"
}
```

**Response (401):**

```json
{
  "error": "Unauthorized",
  "message": "Invalid username or password"
}
```

---

### GET /api/auth/me

Get current authenticated user info.

**Headers:**

| Header | Description |
|--------|-------------|
| `X-User` | Username (set by BFF proxy) |
| `X-Role` | User role (set by BFF proxy) |

**Response:**

```json
{
  "username": "admin",
  "role": "admin"
}
```

---

## Console Endpoints

### POST /servers/:id/console/exec

Alternative endpoint for RCON command execution.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Server name |

**Request Body:**

```json
{
  "command": "help"
}
```

**Response:**

```json
{
  "output": "...",
  "exitCode": 0
}
```

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
| `Conflict` | 409 | Resource conflict (e.g., world used by another server, server running) |
| `InternalServerError` | 500 | Server-side error |

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
requests.post(f"{API_URL}/api/servers/survival/start", headers=headers)

# Execute command
response = requests.post(
    f"{API_URL}/api/servers/survival/exec",
    headers=headers,
    json={"command": "list"}
)
print(response.json()["output"])

# Create world
requests.post(
    f"{API_URL}/api/worlds",
    headers=headers,
    json={"name": "newworld", "seed": "12345"}
)
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

// Stream logs with SSE
const eventSource = new EventSource(
  `${API_URL}/api/servers/survival/logs?follow=true`
);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.log);
};
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

# Execute command
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command": "list"}' \
  "$API_URL/api/servers/survival/exec"

# List worlds
curl -H "X-API-Key: $API_KEY" "$API_URL/api/worlds"

# Create world
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "newworld", "seed": "12345"}' \
  "$API_URL/api/worlds"

# Assign world to server
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"serverName": "mc-survival"}' \
  "$API_URL/api/worlds/newworld/assign"
```
