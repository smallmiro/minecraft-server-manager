# API Reference

Complete REST API documentation for the mcctl-api server.

## Overview

The mcctl-api provides a RESTful interface for managing Docker Minecraft servers. All endpoints return JSON responses.

**Base URL:** `http://localhost:5001`

**Documentation:** Swagger UI is available at `/docs` when the service is running.

## Authentication

Authentication is based on the configured access mode.

### API Key Authentication

When using `api-key` or `combined` mode, include the API key in the request header:

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

`409` is also returned when the world the server would use (`worldName`, else its default world `<name>`) is assigned to another server, or when another server's `config.env` cannot be interpreted (#670). See [World Assignment Rules](../cli/commands.md#world-assignment-rules).

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
| `force` | boolean | false | Accepted for compatibility; a running server is always stopped and deleted |
| `deleteWorld` | boolean | false | Delete the world inside the server (`servers/<name>/data/<LEVEL>`) instead of moving it to `worlds/`. Worlds in `worlds/` are never deleted |

**Request Body (optional):**

| Field | Type | Description |
|-------|------|-------------|
| `sudoPassword` | string | Sudo password for removing the mDNS hostname `<name>.local` from `/etc/avahi/hosts` (write-only, never logged). Not needed with the sudoers `NOPASSWD` rule |

By default the world inside the server is moved to `worlds/<LEVEL>`. If `worlds/` already has that name or the world inside the server cannot be located with certainty (see [`mcctl delete`](../cli/commands.md#mcctl-delete)), the request fails with `409` and nothing is deleted; if Docker cannot be queried or the container cannot be stopped, it fails with `500` and nothing is deleted. A `409` after the container was removed (for example `servers/compose.yml` locked by another mcctl process, or a world move that failed) says so, names the worlds already moved to `worlds/`, and what is left to clean up. The server leaves `servers/compose.yml` before its world moves, so a start request cannot bring it back meanwhile; a failed move puts it back. A delete of a server that another process (`mcctl delete`, say) is deleting fails with `409`, and so does a server with a hand-written `servers/compose.yml` include entry (anything but `<name>/docker-compose.yml`), before anything is changed. No backup runs before the delete.

**Example:**

```bash
curl -X DELETE "http://localhost:5001/api/servers/myserver" \
  -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"sudoPassword": "your-sudo-password"}'
```

**Response:**

```json
{
  "success": true,
  "server": "myserver",
  "message": "Server deleted successfully"
}
```

When the server was deleted but its mDNS hostname could not be removed, the response adds `warning` (for example `"mDNS hostname myserver.local was not removed: sudo authentication failed; check the sudo password"`). The same goes for files left in `servers/<name>/` after it is out of `servers/compose.yml` (for example files the container wrote as root): the server counts as deleted and `warning` says to remove them with `sudo rm -rf`. Both warnings are joined with `; `.

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
        "serverStatus": "running",
        "autoScaleUp": true,
        "autoScaleDown": true,
        "discoveredByRouter": true
      },
      {
        "hostname": "creative.192.168.1.100.nip.io",
        "target": "mc-creative:25565",
        "serverStatus": "exited",
        "autoScaleUp": true,
        "autoScaleDown": false,
        "discoveredByRouter": true
      }
    ],
    "image": "itzg/mc-router:1.47.1",
    "autoScale": {
      "up": true,
      "down": true,
      "downAfter": "10m",
      "asleepMotd": "Server is asleep. Join to wake it up."
    },
    "resolver": {
      "hostIp": "192.168.1.100",
      "hostIps": ["192.168.1.100"]
    }
  },
  "avahi": {
    "name": "avahi-daemon",
    "status": "running",
    "type": "system"
  },
  "playit": {
    "enabled": false,
    "agentRunning": false,
    "secretKeyConfigured": false
  }
}
```

| Field | Description |
|-------|-------------|
| `status` | Router container status |
| `health` | Health check status |
| `port` | External listening port |
| `uptime` / `uptimeSeconds` | Router uptime as a display string and in seconds (optional) |
| `mode` | Routing mode (auto-scale enabled) |
| `routes` | List of hostname-to-server mappings |
| `image` | Router container image (optional) |
| `autoScale` | Global auto-scale settings of the router container (optional) |
| `resolver` | Host addresses used for `<server>.<ip>.nip.io` hostnames (optional) |
| `avahi` | `avahi-daemon` status (optional) |
| `playit` | playit.gg summary: `enabled`, `agentRunning`, `secretKeyConfigured`. Omitted when the playit status cannot be read |

**`router.autoScale`:**

| Field | Type | Description |
|-------|------|-------------|
| `up` | boolean | Global `AUTO_SCALE_UP`: start a stopped server when a client connects. A missing or invalid value is `false` |
| `down` | boolean | Global `AUTO_SCALE_DOWN`: stop an idle server. A missing or invalid value is `false` |
| `downAfter` | string | `AUTO_SCALE_DOWN_AFTER` as written (Go duration, for example `10m`). Absent when not set |
| `asleepMotd` | string | `AUTO_SCALE_ASLEEP_MOTD` as written; may contain a literal `\n` and `§` color codes. Absent when not set |

**`router.resolver`:**

| Field | Type | Description |
|-------|------|-------------|
| `hostIps` | string[] | Host addresses, using the same rule as server creation: the comma-separated `HOST_IPS` / `HOST_IP` lists in `.env`, else the probed host address |
| `hostIp` | string | The first entry of `hostIps`. Absent when no address is known |

**`router.routes[]` optional fields:**

| Field | Type | Description |
|-------|------|-------------|
| `autoScaleUp` | boolean | The server's `mc-router.auto-scale-up` label if it parses as a boolean, else the router global. Always `false` while the global `AUTO_SCALE_UP` is off, because mc-router ignores stopped containers then |
| `autoScaleDown` | boolean | The server's `mc-router.auto-scale-down` label if it parses as a boolean, else the router global |
| `discoveredByRouter` | boolean | Whether mc-router lists this hostname in its management API (`127.0.0.1:25580` `/routes`) |

When a field can be absent:

- `discoveredByRouter` is absent for every route when mc-router is not running or its management API cannot be read.
- While the global `AUTO_SCALE_UP` is off, stopped routes are not judged and have no `discoveredByRouter`, because mc-router ignores stopped containers in that mode. Running routes are still judged.
- `autoScaleUp` / `autoScaleDown` are absent when they cannot be determined (no usable label and no known router global).

---

### Router Restart

#### POST /api/router/restart

Restart the mc-router container by running `docker compose restart router`. Active player connections through the router are dropped while it restarts.

Authentication follows the global API authentication. The request has no body.

**Example:**

```bash
curl -X POST "http://localhost:5001/api/router/restart" \
  -H "X-API-Key: mctk_xxx"
```

**Response (200):**

```json
{
  "success": true,
  "message": "mc-router restarted"
}
```

**Response (500):**

```json
{
  "error": "InternalServerError",
  "message": "Failed to restart mc-router"
}
```

`message` carries the error reported by `docker compose` when it failed.

An audit log entry is written for every request: action `router.restart`, status `success` or `failure`, target type `service`, target name `mc-router`.

!!! note "Admin only in the console"
    In the Web Console, `POST /api/router/restart` is a BFF route that requires the admin role (`requireAdmin`), and the restart button on the router page is shown to admins only.

---

### Router Log Stream (SSE)

#### GET /api/router/logs/stream

Follow the mc-router logs in real time (`docker logs -f mc-router`). Each log line becomes one `router-log` event.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tail` | integer | 100 | Number of recent log lines to replay first. Clamped to 1..500; an empty or non-numeric value falls back to 100 |

**Example:**

```bash
curl -N "http://localhost:5001/api/router/logs/stream?tail=50" \
  -H "X-API-Key: mctk_xxx"
```

**Events:**

| Event | Data | Description |
|-------|------|-------------|
| `connected` | `{ "timestamp": "..." }` | Sent once when the stream opens |
| `router-log` | `RouterLogEvent` | One per log line |
| `end` | `{ "code": 0, "error"?: "..." }` | The log process exited (`code` is `null` when it could not be run); the stream is closed after it |

A `: heartbeat` comment is sent every 30 seconds. When the client disconnects, the server-side `docker logs -f mc-router` process is killed.

```
event: connected
data: {"timestamp":"2026-10-24T09:12:03.418Z"}

event: router-log
data: {"ts":"2026-10-24T09:12:01Z","kind":"connect","hostname":"survival.192.168.1.100.nip.io","target":"mc-survival:25565","player":"Steve","raw":"time=\"2026-10-24T09:12:01Z\" level=info msg=\"Connecting to backend\" backendHostPort=\"mc-survival:25565\" player=Steve/069a79f4-44e9-4726-a5be-fca90e38aaf5 server=survival.192.168.1.100.nip.io"}
```

**`RouterLogEvent`:**

| Field | Type | Description |
|-------|------|-------------|
| `ts` | string | The log line's `time` field. Absent when the line is not in logfmt |
| `kind` | string | `connect`, `wake`, `error` or `info` |
| `hostname` | string | Hostname the client asked for. Only on `connect`, `wake` and `error` events, when present in the line |
| `target` | string | Backend `host:port` the connection was routed to. Same conditions as `hostname` |
| `player` | string | Player name. Only on login connections, not on status pings |
| `raw` | string | The original log line |

Kind mapping:

| Condition | `kind` |
|-----------|--------|
| Log level `warning` or higher (`warning`, `error`, `fatal`, `panic`) | `error` |
| Message `Connecting to backend` | `connect` |
| Message `Scaling up backend server` or `Woke up backend server` | `wake` |
| Any other line, including lines that cannot be parsed | `info` (only `raw`, plus `ts` when known) |

---

### Router Status Stream (SSE)

#### GET /api/router/status/stream

Stream the same payload as `GET /api/router/status`.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `interval` | integer | 5000 | Poll interval in milliseconds (1000..60000) |

**Events:**

| Event | Data | Description |
|-------|------|-------------|
| `router-status` | Same payload as `GET /api/router/status` | Sent immediately on connect, then only when the status changes |
| `router-status-error` | `{ "timestamp": "..." }` | A poll failed. Clients should fall back to polling `GET /api/router/status`; the next good payload is sent again even if unchanged |

- Changes that only affect `uptimeSeconds` are ignored. The displayed `uptime` string does count as a change.
- Connections that use the same `interval` share one poll.
- A `: heartbeat` comment is sent every 30 seconds.

**Example:**

```bash
curl -N "http://localhost:5001/api/router/status/stream?interval=5000" \
  -H "X-API-Key: mctk_xxx"
```

### Player Management

#### GET /api/servers/:name/players

List the merged online (RCON) + known (files) player roster for a server (#528). Works even when the server is stopped — `roster` is then file-based only, and `online`/`max`/`players` are all empty/zero. Supports SSE streaming via `?follow=true&interval=<ms>` (default `5000`), emitting `event: players` with the same JSON payload plus a heartbeat every 30 seconds — mirrors `GET /api/servers/:name/players/live`.

**Response:**

```json
{
  "serverName": "survival",
  "running": true,
  "online": 3,
  "max": 20,
  "players": ["Player1", "Player2", "Player3"],
  "roster": [
    {
      "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
      "name": "Player1",
      "lastSeen": "2026-09-20T12:34:56.000Z",
      "isOp": false,
      "isBanned": false,
      "isWhitelisted": true,
      "online": true
    }
  ]
}
```

---

#### GET /api/servers/:name/players/:uuid

Get a single known player by UUID (#528, `uuid` must be a dashed Minecraft UUID). 404 when the server is undefined or the player is unknown.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `include` | string | Comma-separated extras to include: `stats`, `nbt`, `sessions` (any order/combination, #528, Phase 2/3/4); an unknown value returns 400. |

`?include=stats` adds a `stats` field (from the player's `stats/<uuid>.json` + `advancements/<uuid>.json`): an object when a stats file exists, `null` when it doesn't.

`?include=nbt` adds `data` (last known position/vitals/game mode/inventory summary, parsed from `playerdata/<uuid>.dat`) and `livePosition` (current position via RCON, resolved only while the player is online and the server is running). Both are `null` when unavailable (no playerdata file; offline or server stopped).

`?include=sessions` adds a `sessions` field: visit count, cumulative playtime, last-seen timestamp, and the most recent join/leave timeline (newest first, up to 20 entries). This history is collected from server logs from deployment onward (the first run backfills up to the last 24h of container logs) — a background collector parses each running server's Docker logs for `<player> joined/left the game` every 30 seconds and stores the events in `data/players.db` (SQLite, under `MCCTL_ROOT`). A brand-new player (or a fresh `players.db`) still gets a `sessions` object, not `null` — `visitCount: 0`, `totalPlaytimeSeconds: 0`, `lastSeen: null`, `recent: []`.

Each key (`stats`, `data`, `livePosition`, `sessions`) is omitted entirely unless its corresponding `include` value was requested.

**Response:**

```json
{
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "name": "Player1",
  "lastSeen": "2026-09-20T12:34:56.000Z",
  "isOp": false,
  "isBanned": false,
  "isWhitelisted": true,
  "online": true
}
```

**Response with `?include=stats`:**

```json
{
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "name": "Player1",
  "lastSeen": "2026-09-20T12:34:56.000Z",
  "isOp": false,
  "isBanned": false,
  "isWhitelisted": true,
  "online": true,
  "stats": {
    "playTimeSeconds": 600,
    "deaths": 3,
    "mobKills": 10,
    "playerKills": 1,
    "distanceMeters": 500,
    "blocksMined": 42,
    "itemsCrafted": 7,
    "advancementsCompleted": 1
  }
}
```

**Response with `?include=nbt`:**

```json
{
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "name": "Player1",
  "lastSeen": "2026-09-20T12:34:56.000Z",
  "isOp": false,
  "isBanned": false,
  "isWhitelisted": true,
  "online": true,
  "data": {
    "x": 10.5,
    "y": 64,
    "z": -20.25,
    "dimension": "overworld",
    "health": 20,
    "food": 18,
    "xpLevel": 7,
    "gameMode": "survival",
    "inventory": { "slotsUsed": 3, "items": [{ "id": "minecraft:diamond", "count": 12 }] }
  },
  "livePosition": { "x": 10.6, "y": 64, "z": -20.1, "dimension": "overworld" }
}
```

**Response with `?include=sessions`:**

```json
{
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "name": "Player1",
  "lastSeen": "2026-09-20T12:34:56.000Z",
  "isOp": false,
  "isBanned": false,
  "isWhitelisted": true,
  "online": true,
  "sessions": {
    "visitCount": 12,
    "totalPlaytimeSeconds": 43200,
    "lastSeen": "2026-09-27T08:13:49.000Z",
    "recent": [
      { "joinedAt": "2026-09-27T07:00:00.000Z", "leftAt": "2026-09-27T08:13:49.000Z", "durationSeconds": 4429 },
      { "joinedAt": "2026-09-26T20:00:00.000Z", "leftAt": "2026-09-26T21:30:00.000Z", "durationSeconds": 5400 }
    ]
  }
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
  "message": "Before server upgrade",
  "allowMissing": false
}
```

`allowMissing` (optional): consent to drop worlds that are in the last backup but missing now; without it such a push is refused with `400`. "No changes" succeeds with `"message": "No changes to backup"`. A backup that is already running answers `409`.

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

All servers must be stopped. Status codes: `409` servers running, another backup running, unfinished restore, or LEVEL conflict; `404` unknown commit; `503` Docker cannot be queried. The request never waits for input.

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
