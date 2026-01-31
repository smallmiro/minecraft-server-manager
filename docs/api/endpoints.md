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

### GET /api/worlds

List all worlds with lock status.

**Response:**

```json
{
  "worlds": [
    {
      "name": "survival",
      "path": "/home/user/minecraft-servers/worlds/survival",
      "isLocked": true,
      "lockedBy": "mc-survival",
      "size": "1.2 GB",
      "lastModified": "2025-01-30T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

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
| `serverName` | string | No | Server to assign |
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

Assign world to a server.

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
  "message": "World 'survival' is already locked by mc-creative"
}
```

---

### POST /api/worlds/:name/release

Release world lock.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | World name |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `force` | boolean | false | Force release even if server is running |

**Response:**

```json
{
  "success": true,
  "worldName": "survival",
  "previousServer": "mc-survival"
}
```

---

### DELETE /api/worlds/:name

Delete a world.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | World name |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `force` | boolean | false | Force delete locked world |

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
| `Conflict` | 409 | Resource conflict (e.g., locked world) |
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
